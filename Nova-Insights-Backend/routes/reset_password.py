from flask import Blueprint, request, jsonify
import bcrypt
from utils.database import get_db_connection
from utils.validators import validate_password
from utils.redis_client import cache_set, cache_delete
from middleware.auth_middleware import require_reset_token
from psycopg2.extras import RealDictCursor
from datetime import datetime

reset_password_bp = Blueprint('reset_password', __name__)


@reset_password_bp.route('/reset-password', methods=['POST'])
@require_reset_token
def reset_password():
    """
    Reset Password API
    Resets user's password after OTP verification
    Requires reset token in Authorization header
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Anmodningsdata påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        password = data.get('password', '')
        confirm_password = data.get('confirmPassword', '')
        
        if not password or not confirm_password:
            return jsonify({
                'success': False,
                'error': 'Adgangskode og bekræftelse af adgangskode er påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if password != confirm_password:
            return jsonify({
                'success': False,
                'error': 'Adgangskoder matcher ikke',
                'code': 'PASSWORD_MISMATCH'
            }), 400
        
        is_valid, error_msg, requirements = validate_password(password)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
                'code': 'WEAK_PASSWORD',
                'requirements': requirements
            }), 400
        
        user_id = request.reset_user_id
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                password_hash = bcrypt.hashpw(
                    password.encode('utf-8'),
                    bcrypt.gensalt()
                ).decode('utf-8')
                
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                    """,
                    (password_hash, user_id)
                )
                updated_user = cur.fetchone()
                
                if not updated_user:
                    return jsonify({
                        'success': False,
                        'error': 'Bruger ikke fundet',
                        'code': 'USER_NOT_FOUND'
                    }), 404
                
                conn.commit()
                
                cur.execute(
                    "UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = %s AND is_revoked = FALSE",
                    (user_id,)
                )
                conn.commit()
                
                cache_delete(f"user_profile:{user_id}")
                
                return jsonify({
                    'success': True,
                    'message': 'Adgangskode ændret med succes',
                    'data': {
                        'userId': f"user_{user_id}",
                        'passwordChangedAt': datetime.utcnow().isoformat() + 'Z'
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Reset password error: {e}")
            return jsonify({
                'success': False,
                'error': 'Kunne ikke nulstille adgangskode',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Reset password request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400
