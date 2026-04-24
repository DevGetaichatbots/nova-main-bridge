from flask import Blueprint, request, jsonify
from utils.database import get_db_connection
from utils.email_service import generate_otp, send_otp_email
from utils.validators import validate_email
from utils.redis_client import rate_limit_check
from datetime import datetime, timedelta
from psycopg2.extras import RealDictCursor

forgot_password_bp = Blueprint('forgot_password', __name__)


@forgot_password_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """
    Forgot Password API
    Sends OTP to user's email for password reset
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
        rate_key = f"rate_limit:forgot_password:{client_ip}"
        allowed, remaining, reset_time = rate_limit_check(rate_key, 3, 900)
        
        if not allowed:
            return jsonify({
                'success': False,
                'error': 'For mange nulstillingsanmodninger. Prøv igen senere.',
                'code': 'RATE_LIMITED',
                'retryAfter': reset_time
            }), 429
        
        email = data.get('email', '').strip().lower()
        
        is_valid, error_msg = validate_email(email)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
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
                
                otp_code = generate_otp()
                
                expires_at = datetime.utcnow() + timedelta(minutes=10)
                
                cur.execute(
                    """
                    INSERT INTO password_reset_otps (user_id, otp_code, expires_at)
                    VALUES (%s, %s, %s)
                    RETURNING id, created_at
                    """,
                    (user['id'], otp_code, expires_at)
                )
                otp_record = cur.fetchone()
                conn.commit()
                
                success, message = send_otp_email(email, otp_code)
                
                if not success:
                    return jsonify({
                        'success': False,
                        'error': 'Kunne ikke sende OTP-e-mail. Kontroller venligst e-mail-konfigurationen',
                        'code': 'EMAIL_SEND_FAILED'
                    }), 500
                
                return jsonify({
                    'success': True,
                    'message': 'OTP sendt til din e-mail',
                    'data': {
                        'email': email,
                        'otpSentAt': otp_record['created_at'].isoformat() + 'Z',
                        'expiresIn': 600
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Forgot password error: {e}")
            return jsonify({
                'success': False,
                'error': 'Kunne ikke behandle anmodningen',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Forgot password request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400
