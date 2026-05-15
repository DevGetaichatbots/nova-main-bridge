from flask import Blueprint, request, jsonify
from utils.database import get_db_connection
from utils.validators import validate_email, validate_otp
from utils.token_manager import generate_reset_token
from utils.redis_client import rate_limit_check
from datetime import datetime
from psycopg2.extras import RealDictCursor

verify_otp_bp = Blueprint('verify_otp', __name__)


@verify_otp_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    """
    Verify OTP API
    Verifies the OTP sent to user's email and returns reset token
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Anmodningsdata påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        rate_key = f"rate_limit:verify_otp:{client_ip}"
        allowed, remaining, reset_time = rate_limit_check(rate_key, 5, 900)
        
        if not allowed:
            return jsonify({
                'success': False,
                'error': 'For mange OTP-forsøg. Prøv igen senere.',
                'code': 'RATE_LIMITED',
                'retryAfter': reset_time
            }), 429
        
        email = data.get('email', '').strip().lower()
        otp = data.get('otp', '').strip()
        
        is_valid_email, email_error = validate_email(email)
        if not is_valid_email:
            return jsonify({
                'success': False,
                'error': email_error,
                'code': 'VALIDATION_ERROR'
            }), 400
        
        is_valid_otp, otp_error = validate_otp(otp)
        if not is_valid_otp:
            return jsonify({
                'success': False,
                'error': otp_error,
                'code': 'VALIDATION_ERROR'
            }), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id, email FROM users WHERE email = %s", (email,))
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'E-mail ikke fundet',
                        'code': 'EMAIL_NOT_FOUND'
                    }), 404
                
                cur.execute(
                    """
                    SELECT id, otp_code, expires_at, is_used
                    FROM password_reset_otps
                    WHERE user_id = %s AND otp_code = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (user['id'], otp)
                )
                otp_record = cur.fetchone()
                
                if not otp_record:
                    return jsonify({
                        'success': False,
                        'error': 'Ugyldig OTP',
                        'code': 'INVALID_OTP'
                    }), 400
                
                if otp_record['is_used']:
                    return jsonify({
                        'success': False,
                        'error': 'OTP er allerede blevet brugt',
                        'code': 'OTP_ALREADY_USED'
                    }), 400
                
                if datetime.utcnow() > otp_record['expires_at']:
                    return jsonify({
                        'success': False,
                        'error': 'OTP er udløbet',
                        'code': 'OTP_EXPIRED'
                    }), 410
                
                cur.execute(
                    """
                    UPDATE password_reset_otps
                    SET is_used = TRUE, used_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (otp_record['id'],)
                )
                conn.commit()
                
                reset_token = generate_reset_token(user['id'], user['email'])
                
                return jsonify({
                    'success': True,
                    'message': 'OTP verificeret',
                    'data': {
                        'resetToken': reset_token,
                        'expiresIn': 900
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Verify OTP error: {e}")
            return jsonify({
                'success': False,
                'error': 'Kunne ikke behandle anmodningen',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Verify OTP request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400
