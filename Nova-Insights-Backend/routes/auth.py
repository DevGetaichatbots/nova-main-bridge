from flask import Blueprint, request, jsonify
import bcrypt
import json
from utils.database import get_db_connection
from utils.i18n import t
from utils.validators import validate_email
from utils.token_manager import (
    generate_access_token, 
    generate_refresh_token, 
    hash_token,
    verify_refresh_token
)
from utils.audit_logger import log_audit_event
from utils.tenant import build_redirect_url
from utils.redis_client import cache_get, cache_set, cache_delete
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

USER_CACHE_TTL = 300


def get_cookie_settings():
    """Use Secure+SameSite=None on HTTPS, and Lax cookies for local HTTP development."""
    is_secure = request.scheme == 'https' or request.headers.get('X-Forwarded-Proto') == 'https'
    return {
        'secure': is_secure,
        'samesite': 'None' if is_secure else 'Lax',
    }


def set_auth_cookies(resp, access_token, refresh_token):
    """Attach HttpOnly access/refresh cookies (shared by login and company registration)."""
    cookie_settings = get_cookie_settings()
    resp.set_cookie('accessToken', access_token, httponly=True,
                    secure=cookie_settings['secure'], samesite=cookie_settings['samesite'],
                    max_age=86400, path='/')
    resp.set_cookie('refreshToken', refresh_token, httponly=True,
                    secure=cookie_settings['secure'], samesite=cookie_settings['samesite'],
                    max_age=604800, path='/api/')


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint with access + refresh tokens"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': t('common.request_data_required'),
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
                'error': t('password.required'),
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
                cur.execute(
                    """
                    SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, u.role, 
                           u.company_id, u.is_active, u.created_at,
                           c.name as company_name, c.cvr_number, c.is_active as company_active,
                           c.subdomain as company_subdomain
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
                        'error': t('auth.invalid_credentials'),
                        'code': 'INVALID_CREDENTIALS'
                    }), 401
                
                if user.get('is_active') == False:
                    return jsonify({
                        'success': False,
                        'error': t('auth.account_deactivated_contact_admin'),
                        'code': 'ACCOUNT_DEACTIVATED'
                    }), 401

                if user.get('company_active') == False:
                    return jsonify({
                        'success': False,
                        'error': t('auth.company_deactivated_contact_admin'),
                        'code': 'COMPANY_DEACTIVATED'
                    }), 401
                
                if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                    return jsonify({
                        'success': False,
                        'error': t('auth.invalid_credentials'),
                        'code': 'INVALID_CREDENTIALS'
                    }), 401
                
                access_token = generate_access_token(user['id'], user['email'], company_id=user.get('company_id'))
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
                    'companySubdomain': user.get('company_subdomain'),
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
                    'message': t('auth.login_success'),
                    'user': user_response,
                    'access_token': access_token,
                    'redirectUrl': build_redirect_url(user.get('company_subdomain'), user['role'])
                }
                
                resp = jsonify(response_data)
                
                set_auth_cookies(resp, access_token, refresh_token)
                
                return resp, 200
                
        except Exception as e:
            conn.rollback()
            print(f"Login error: {e}")
            return jsonify({
                'success': False,
                'error': t('auth.login_failed'),
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Login request error: {e}")
        return jsonify({
            'success': False,
            'error': t('common.invalid_request_data'),
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
            'error': t('common.unauthorized'),
            'code': 'UNAUTHORIZED'
        }), 401
    
    try:
        from utils.token_manager import verify_access_token
        payload, error = verify_access_token(token)
        
        if error:
            return jsonify({
                'success': False,
                'error': t('auth.invalid_or_expired_token'),
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
                'error': t('common.db_connection_failed'),
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT u.id, u.first_name, u.last_name, u.email, u.role, 
                           u.company_id, u.phone_number, u.is_active, u.created_at, u.updated_at,
                           c.name as company_name, c.cvr_number, c.email as company_email,
                           c.phone_number as company_phone, c.website as company_website,
                           c.address as company_address, c.industry as company_industry,
                           c.is_active as company_active, c.subdomain as company_subdomain
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
                        'error': t('user.not_found'),
                        'code': 'USER_NOT_FOUND'
                    }), 404
                
                if user.get('is_active') == False:
                    return jsonify({
                        'success': False,
                        'error': t('auth.account_deactivated'),
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
                    'companySubdomain': user.get('company_subdomain'),
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
            'error': t('user.profile_fetch_failed'),
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
                'error': t('auth.refresh_token_required'),
                'code': 'VALIDATION_ERROR'
            }), 400
        
        payload, error = verify_refresh_token(refresh_token)
        if error:
            return jsonify({
                'success': False,
                'error': t('auth.invalid_refresh_token'),
                'code': 'INVALID_TOKEN'
            }), 401
        
        token_hash = hash_token(refresh_token)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': t('common.db_connection_failed'),
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
                        'error': t('auth.token_invalid_or_revoked'),
                        'code': 'INVALID_TOKEN'
                    }), 401

                cur.execute(
                    """
                    SELECT u.is_active, c.is_active as company_active
                    FROM users u
                    LEFT JOIN companies c ON u.company_id = c.id
                    WHERE u.id = %s
                    """,
                    (payload['user_id'],)
                )
                user = cur.fetchone()
                if not user or user['is_active'] == False or user['company_active'] == False:
                    return jsonify({
                        'success': False,
                        'error': t('auth.account_or_company_deactivated'),
                        'code': 'ACCOUNT_DEACTIVATED'
                    }), 401
                
                new_access_token = generate_access_token(payload['user_id'], payload['email'])
                
                resp = jsonify({
                    'success': True,
                    'message': t('auth.token_refreshed')
                })
                
                cookie_settings = get_cookie_settings()
                
                resp.set_cookie(
                    'accessToken',
                    new_access_token,
                    httponly=True,
                    secure=cookie_settings['secure'],
                    samesite=cookie_settings['samesite'],
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
            'error': t('auth.token_refresh_failed'),
            'code': 'INTERNAL_ERROR'
        }), 500
