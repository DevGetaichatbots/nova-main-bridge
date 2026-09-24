from flask import Blueprint, request, jsonify
from utils.database import get_db_connection
from utils.i18n import t
from utils.email_service import generate_otp, send_otp_email
from utils.validators import validate_email
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
                'error': t('common.request_data_required'),
                'code': 'VALIDATION_ERROR'
            }), 400
        
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
                'error': t('common.db_connection_failed'),
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id, email FROM users WHERE email = %s", (email,))
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': t('otp.email_not_found'),
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
                        'error': t('otp.send_failed'),
                        'code': 'EMAIL_SEND_FAILED'
                    }), 500
                
                return jsonify({
                    'success': True,
                    'message': t('otp.sent'),
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
                'error': t('common.process_request_failed'),
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Forgot password request error: {e}")
        return jsonify({
            'success': False,
            'error': t('common.invalid_request_data'),
            'code': 'VALIDATION_ERROR'
        }), 400
