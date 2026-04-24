from flask import Blueprint, request, jsonify
import bcrypt
from utils.database import get_db_connection
from utils.validators import validate_password, validate_name
from middleware.auth_middleware import require_auth
from psycopg2.extras import RealDictCursor
from datetime import datetime

update_profile_bp = Blueprint('update_profile', __name__)


@update_profile_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    """
    Update Profile API
    Updates user's firstName, lastName, and/or password
    Email cannot be changed
    Requires access token in Authorization header
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Anmodningsdata påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        current_user = request.current_user
        
        first_name = data.get('firstName', '').strip() if data.get('firstName') else None
        last_name = data.get('lastName', '').strip() if data.get('lastName') else None
        password = data.get('password', '') if data.get('password') else None
        confirm_password = data.get('confirmPassword', '') if data.get('confirmPassword') else None
        
        if not first_name and not last_name and not password:
            return jsonify({
                'success': False,
                'error': 'Mindst ét felt skal opdateres',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if first_name:
            is_valid, error_msg = validate_name(first_name, "Fornavn")
            if not is_valid:
                return jsonify({
                    'success': False,
                    'error': error_msg,
                    'code': 'VALIDATION_ERROR'
                }), 400
        
        if last_name:
            is_valid, error_msg = validate_name(last_name, "Efternavn")
            if not is_valid:
                return jsonify({
                    'success': False,
                    'error': error_msg,
                    'code': 'VALIDATION_ERROR'
                }), 400
        
        password_hash = None
        if password:
            if not confirm_password:
                return jsonify({
                    'success': False,
                    'error': 'Bekræftelse af adgangskode er påkrævet',
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
            
            password_hash = bcrypt.hashpw(
                password.encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                update_fields = []
                update_values = []
                
                if first_name:
                    update_fields.append("first_name = %s")
                    update_values.append(first_name)
                
                if last_name:
                    update_fields.append("last_name = %s")
                    update_values.append(last_name)
                
                if password_hash:
                    update_fields.append("password_hash = %s")
                    update_values.append(password_hash)
                
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                
                update_values.append(current_user['id'])
                
                query = f"""
                    UPDATE users
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, first_name, last_name, email, updated_at
                """
                
                cur.execute(query, update_values)
                updated_user = cur.fetchone()
                
                if not updated_user:
                    return jsonify({
                        'success': False,
                        'error': 'Bruger ikke fundet',
                        'code': 'USER_NOT_FOUND'
                    }), 404
                
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Profil opdateret med succes',
                    'data': {
                        'userId': f"user_{updated_user['id']}",
                        'firstName': updated_user['first_name'],
                        'lastName': updated_user['last_name'],
                        'email': updated_user['email'],
                        'updatedAt': updated_user['updated_at'].isoformat() + 'Z'
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Update profile error: {e}")
            return jsonify({
                'success': False,
                'error': 'Kunne ikke opdatere profil',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Update profile request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400
