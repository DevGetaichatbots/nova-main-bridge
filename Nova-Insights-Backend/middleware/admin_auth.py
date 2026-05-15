"""
Admin authentication middleware
Verifies JWT token and checks if user has admin role
"""
from functools import wraps
from flask import request, jsonify
import jwt
import os
from utils.database import get_db_connection
from psycopg2.extras import RealDictCursor

JWT_SECRET = os.getenv('JWT_SECRET')


def get_token_from_header():
    """Extract JWT token from Authorization header or cookies"""
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            token = auth_header.split(' ')[1]
            return token, None
        except IndexError:
            pass
    
    token = request.cookies.get('accessToken')
    if token:
        return token, None
    
    return None, 'Autorisationstoken mangler'


def verify_token(token):
    """Verify JWT token and return payload"""
    try:
        from utils.token_manager import is_token_blacklisted
        if is_token_blacklisted(token):
            return None, 'Token er tilbagekaldt'
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, 'Token er udløbet'
    except jwt.InvalidTokenError:
        return None, 'Ugyldig token'


def get_user_role(user_id):
    """Get user role from database"""
    conn = get_db_connection()
    if not conn:
        return None, 'Database forbindelse fejlede'
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user:
                return None, 'Bruger ikke fundet'
            return user['role'], None
    except Exception as e:
        print(f"Error getting user role: {e}")
        return None, 'Kunne ikke hente brugerrolle'
    finally:
        conn.close()


def admin_required(f):
    """Decorator to require admin role for an endpoint"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token, error = get_token_from_header()
        if error:
            return jsonify({
                'success': False,
                'error': error,
                'code': 'UNAUTHORIZED'
            }), 401
        
        payload, error = verify_token(token)
        if error:
            return jsonify({
                'success': False,
                'error': error,
                'code': 'INVALID_TOKEN'
            }), 401
        
        role, error = get_user_role(payload['user_id'])
        if error:
            return jsonify({
                'success': False,
                'error': error,
                'code': 'INTERNAL_ERROR'
            }), 500
        
        if role != 'admin':
            return jsonify({
                'success': False,
                'error': 'Admin adgang påkrævet',
                'code': 'FORBIDDEN'
            }), 403
        
        request.current_user_id = payload['user_id']
        request.current_user_role = role
        
        return f(*args, **kwargs)
    return decorated_function


def token_required(f):
    """Decorator to require valid token for an endpoint"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token, error = get_token_from_header()
        if error:
            return jsonify({
                'success': False,
                'error': error,
                'code': 'UNAUTHORIZED'
            }), 401
        
        payload, error = verify_token(token)
        if error:
            return jsonify({
                'success': False,
                'error': error,
                'code': 'INVALID_TOKEN'
            }), 401
        
        role, error = get_user_role(payload['user_id'])
        if error:
            return jsonify({
                'success': False,
                'error': error,
                'code': 'INTERNAL_ERROR'
            }), 500
        
        request.current_user_id = payload['user_id']
        request.current_user_role = role
        request.current_user_email = payload.get('email')
        
        return f(*args, **kwargs)
    return decorated_function
