from flask import Blueprint, request, jsonify
import bcrypt
import json
from utils.database import get_db_connection
from utils.validators import validate_email, validate_password, validate_name
from utils.token_manager import (
    generate_access_token, 
    generate_refresh_token, 
    hash_token,
    verify_refresh_token
)
from utils.audit_logger import log_audit_event
from utils.redis_client import rate_limit_check, cache_get, cache_set, cache_delete
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

RATE_LIMIT_LOGIN = 5
RATE_LIMIT_WINDOW = 300
RATE_LIMIT_SIGNUP = 5
RATE_LIMIT_SIGNUP_WINDOW = 3600
USER_CACHE_TTL = 300


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """User registration endpoint with access + refresh tokens"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Anmodningsdata påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        rate_key = f"rate_limit:signup:{client_ip}"
        allowed, remaining, reset_time = rate_limit_check(rate_key, RATE_LIMIT_SIGNUP, RATE_LIMIT_SIGNUP_WINDOW)
        
        if not allowed:
            return jsonify({
                'success': False,
                'error': 'For mange registreringsforsøg. Prøv igen senere.',
                'code': 'RATE_LIMITED',
                'retryAfter': reset_time
            }), 429
        
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirmPassword', '')
        
        is_valid, error_msg = validate_name(first_name, "Fornavn")
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
                'code': 'VALIDATION_ERROR'
            }), 400
        
        is_valid, error_msg = validate_name(last_name, "Efternavn")
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
                'code': 'VALIDATION_ERROR'
            }), 400
        
        is_valid, error_msg = validate_email(email)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
                'code': 'VALIDATION_ERROR'
            }), 400
        
        is_valid, error_msg, requirements = validate_password(password)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
                'code': 'WEAK_PASSWORD',
                'requirements': requirements
            }), 400
        
        if password != confirm_password:
            return jsonify({
                'success': False,
                'error': 'Adgangskoder matcher ikke',
                'code': 'PASSWORD_MISMATCH'
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
                cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                existing_user = cur.fetchone()
                
                if existing_user:
                    return jsonify({
                        'success': False,
                        'error': 'Bruger med denne e-mail eksisterer allerede',
                        'code': 'EMAIL_EXISTS'
                    }), 400
                
                password_hash = bcrypt.hashpw(
                    password.encode('utf-8'),
                    bcrypt.gensalt()
                ).decode('utf-8')
                
                cur.execute(
                    """
                    INSERT INTO users (first_name, last_name, email, password_hash)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, first_name, last_name, email, created_at
                    """,
                    (first_name, last_name, email, password_hash)
                )
                new_user = cur.fetchone()
                
                access_token = generate_access_token(new_user['id'], new_user['email'])
                refresh_token = generate_refresh_token(new_user['id'], new_user['email'])
                
                refresh_token_hash = hash_token(refresh_token)
                expires_at = datetime.utcnow() + timedelta(days=7)
                
                cur.execute(
                    """
                    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                    VALUES (%s, %s, %s)
                    """,
                    (new_user['id'], refresh_token_hash, expires_at)
                )
                
                conn.commit()
                
                response_data = {
                    'success': True,
                    'message': 'Bruger registreret med succes',
                    'user': {
                        'id': new_user['id'],
                        'firstName': new_user['first_name'],
                        'lastName': new_user['last_name'],
                        'email': new_user['email'],
                        'role': 'user',
                        'createdAt': new_user['created_at'].isoformat()
                    }
                }
                
                resp = jsonify(response_data)
                
                is_secure = request.scheme == 'https' or request.headers.get('X-Forwarded-Proto') == 'https'
                
                resp.set_cookie(
                    'accessToken',
                    access_token,
                    httponly=True,
                    secure=is_secure,
                    samesite='Lax',
                    max_age=86400,
                    path='/'
                )
                resp.set_cookie(
                    'refreshToken',
                    refresh_token,
                    httponly=True,
                    secure=is_secure,
                    samesite='Lax',
                    max_age=604800,
                    path='/api/'
                )
                
                return resp, 201
                
        except Exception as e:
            conn.rollback()
            print(f"Signup error: {e}")
            return jsonify({
                'success': False,
                'error': 'Registrering fejlede. Prøv venligst igen',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Signup request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint with access + refresh tokens"""
    try:
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        rate_key = f"rate_limit:login:{client_ip}"
        allowed, remaining, reset_time = rate_limit_check(rate_key, RATE_LIMIT_LOGIN, RATE_LIMIT_WINDOW)
        
        if not allowed:
            return jsonify({
                'success': False,
                'error': 'For mange loginforsøg. Prøv igen senere.',
                'code': 'RATE_LIMITED',
                'retryAfter': reset_time
            }), 429
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Anmodningsdata påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        is_valid, error_msg = validate_email(email)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if not password:
            return jsonify({
                'success': False,
                'error': 'Adgangskode er påkrævet',
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
                cur.execute(
                    """
                    SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, u.role, 
                           u.company_id, u.is_active, u.created_at,
                           c.name as company_name, c.cvr_number, c.is_active as company_active
                    FROM users u
                    LEFT JOIN companies c ON u.company_id = c.id
                    WHERE u.email = %s
                    """,
                    (email,)
                )
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'Ugyldig e-mail eller adgangskode',
                        'code': 'INVALID_CREDENTIALS'
                    }), 401
                
                if user.get('is_active') == False:
                    return jsonify({
                        'success': False,
                        'error': 'Account is deactivated. Contact your administrator.',
                        'code': 'ACCOUNT_DEACTIVATED'
                    }), 401
                
                if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                    return jsonify({
                        'success': False,
                        'error': 'Ugyldig e-mail eller adgangskode',
                        'code': 'INVALID_CREDENTIALS'
                    }), 401
                
                access_token = generate_access_token(user['id'], user['email'])
                refresh_token = generate_refresh_token(user['id'], user['email'])
                
                refresh_token_hash = hash_token(refresh_token)
                expires_at = datetime.utcnow() + timedelta(days=7)
                
                cur.execute(
                    """
                    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                    VALUES (%s, %s, %s)
                    """,
                    (user['id'], refresh_token_hash, expires_at)
                )
                
                conn.commit()
                
                log_audit_event(
                    event_type='login',
                    actor_user_id=user['id'],
                    company_id=user.get('company_id'),
                    event_description=f"User logged in: {user['email']}",
                    context={'email': user['email'], 'role': user['role']}
                )
                
                user_response = {
                    'id': user['id'],
                    'firstName': user['first_name'],
                    'lastName': user['last_name'],
                    'email': user['email'],
                    'role': user['role'] or 'user',
                    'companyId': user.get('company_id'),
                    'createdAt': user['created_at'].isoformat()
                }
                
                if user.get('company_id'):
                    user_response['company'] = {
                        'id': user['company_id'],
                        'name': user.get('company_name'),
                        'cvrNumber': user.get('cvr_number')
                    }
                
                response_data = {
                    'success': True,
                    'message': 'Login vellykket',
                    'user': user_response
                }
                
                resp = jsonify(response_data)
                
                is_secure = request.scheme == 'https' or request.headers.get('X-Forwarded-Proto') == 'https'
                
                resp.set_cookie(
                    'accessToken',
                    access_token,
                    httponly=True,
                    secure=is_secure,
                    samesite='Lax',
                    max_age=86400,
                    path='/'
                )
                resp.set_cookie(
                    'refreshToken',
                    refresh_token,
                    httponly=True,
                    secure=is_secure,
                    samesite='Lax',
                    max_age=604800,
                    path='/api/'
                )
                
                return resp, 200
                
        except Exception as e:
            conn.rollback()
            print(f"Login error: {e}")
            return jsonify({
                'success': False,
                'error': 'Login fejlede. Prøv venligst igen',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Login request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Get current user profile info with Redis caching"""
    auth_header = request.headers.get('Authorization')
    token = None
    
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
    
    try:
        from utils.token_manager import verify_access_token
        payload, error = verify_access_token(token)
        
        if error:
            return jsonify({
                'success': False,
                'error': 'Ugyldig eller udløbet token',
                'code': 'INVALID_TOKEN'
            }), 401
        
        user_id = payload['user_id']
        cache_key = f"user_profile:{user_id}"
        
        cached_data = cache_get(cache_key)
        if cached_data:
            try:
                user_response = json.loads(cached_data)
                return jsonify({
                    'success': True,
                    'user': user_response,
                    'cached': True
                }), 200
            except:
                pass
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT u.id, u.first_name, u.last_name, u.email, u.role, 
                           u.company_id, u.phone_number, u.is_active, u.created_at, u.updated_at,
                           c.name as company_name, c.cvr_number, c.email as company_email,
                           c.phone as company_phone, c.website as company_website,
                           c.address as company_address, c.industry as company_industry,
                           c.is_active as company_active
                    FROM users u
                    LEFT JOIN companies c ON u.company_id = c.id
                    WHERE u.id = %s
                    """,
                    (user_id,)
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
                
                user_response = {
                    'id': user['id'],
                    'firstName': user['first_name'],
                    'lastName': user['last_name'],
                    'email': user['email'],
                    'role': user['role'] or 'user',
                    'phoneNumber': user.get('phone_number'),
                    'companyId': user.get('company_id'),
                    'isActive': user.get('is_active', True),
                    'createdAt': user['created_at'].isoformat() if user.get('created_at') else None,
                    'updatedAt': user['updated_at'].isoformat() if user.get('updated_at') else None
                }
                
                if user.get('company_id'):
                    user_response['company'] = {
                        'id': user['company_id'],
                        'name': user.get('company_name'),
                        'cvrNumber': user.get('cvr_number'),
                        'email': user.get('company_email'),
                        'phone': user.get('company_phone'),
                        'website': user.get('company_website'),
                        'address': user.get('company_address'),
                        'industry': user.get('company_industry'),
                        'isActive': user.get('company_active', True)
                    }
                
                cache_set(cache_key, json.dumps(user_response), ex=USER_CACHE_TTL)
                
                return jsonify({
                    'success': True,
                    'user': user_response
                }), 200
                
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Get current user error: {e}")
        return jsonify({
            'success': False,
            'error': 'Kunne ikke hente brugerprofil',
            'code': 'INTERNAL_ERROR'
        }), 500


def invalidate_user_cache(user_id):
    """Helper to invalidate user cache when profile is updated"""
    cache_key = f"user_profile:{user_id}"
    cache_delete(cache_key)


@auth_bp.route('/refresh-token', methods=['POST'])
def refresh_access_token():
    """Refresh access token using refresh token"""
    try:
        data = request.get_json() or {}
        
        refresh_token = data.get('refreshToken') or request.cookies.get('refreshToken')
        
        if not refresh_token:
            return jsonify({
                'success': False,
                'error': 'Refresh token er påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        payload, error = verify_refresh_token(refresh_token)
        if error:
            return jsonify({
                'success': False,
                'error': 'Ugyldig eller udløbet refresh token',
                'code': 'INVALID_TOKEN'
            }), 401
        
        token_hash = hash_token(refresh_token)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, is_revoked, expires_at
                    FROM refresh_tokens
                    WHERE token_hash = %s AND user_id = %s
                    """,
                    (token_hash, payload['user_id'])
                )
                token_record = cur.fetchone()
                
                if not token_record or token_record['is_revoked']:
                    return jsonify({
                        'success': False,
                        'error': 'Token er ugyldig eller tilbagekaldt',
                        'code': 'INVALID_TOKEN'
                    }), 401
                
                new_access_token = generate_access_token(payload['user_id'], payload['email'])
                
                resp = jsonify({
                    'success': True,
                    'message': 'Token opdateret'
                })
                
                is_secure = request.scheme == 'https' or request.headers.get('X-Forwarded-Proto') == 'https'
                
                resp.set_cookie(
                    'accessToken',
                    new_access_token,
                    httponly=True,
                    secure=is_secure,
                    samesite='Lax',
                    max_age=86400,
                    path='/'
                )
                
                return resp, 200
                
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Refresh token error: {e}")
        return jsonify({
            'success': False,
            'error': 'Kunne ikke opdatere token',
            'code': 'INTERNAL_ERROR'
        }), 500
