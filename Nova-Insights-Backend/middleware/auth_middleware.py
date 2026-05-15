from functools import wraps
from flask import request, jsonify
from utils.token_manager import verify_access_token
from utils.database import get_db_connection
from psycopg2.extras import RealDictCursor


def require_auth(f):
    """Middleware to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                pass
        
        if not token:
            token = request.cookies.get('accessToken')
        
        if not token:
            return jsonify({
                'success': False,
                'error': 'Ikke autoriseret',
                'code': 'UNAUTHORIZED'
            }), 401
        
        payload, error = verify_access_token(token)
        if error:
            return jsonify({
                'success': False,
                'error': 'Ugyldig eller udløbet token',
                'code': 'INVALID_TOKEN'
            }), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'DB_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT u.id, u.first_name, u.last_name, u.email, u.role, 
                           u.company_id, u.phone_number, u.is_active,
                           c.name as company_name, c.is_active as company_active
                    FROM users u
                    LEFT JOIN companies c ON u.company_id = c.id
                    WHERE u.id = %s
                    """,
                    (payload['user_id'],)
                )
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'Bruger ikke fundet',
                        'code': 'USER_NOT_FOUND'
                    }), 404
                
                if user.get('is_active') == False:
                    return jsonify({
                        'success': False,
                        'error': 'Account is deactivated',
                        'code': 'ACCOUNT_DEACTIVATED'
                    }), 401
                
                request.current_user = user
                return f(*args, **kwargs)
        finally:
            conn.close()
    
    return decorated_function


def require_reset_token(f):
    """Middleware to require reset token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({
                'success': False,
                'error': 'Nulstillingstoken påkrævet',
                'code': 'UNAUTHORIZED'
            }), 401
        
        try:
            from utils.token_manager import verify_reset_token
            token = auth_header.split(' ')[1]
            payload, error = verify_reset_token(token)
            
            if error:
                return jsonify({
                    'success': False,
                    'error': error,
                    'code': 'INVALID_TOKEN'
                }), 401
            
            request.reset_user_id = payload['user_id']
            request.reset_user_email = payload['email']
            return f(*args, **kwargs)
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': 'Ugyldig token',
                'code': 'INVALID_TOKEN'
            }), 401
    
    return decorated_function
