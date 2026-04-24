"""
Company routes for company registration and management
Includes company signup and company owner portal for managing users
"""
from flask import Blueprint, request, jsonify
import bcrypt
import json
from utils.database import get_db_connection
from utils.validators import validate_email, validate_password, validate_name
from utils.token_manager import (
    generate_access_token, 
    generate_refresh_token, 
    hash_token
)
from utils.audit_logger import log_audit_event
from utils.redis_client import rate_limit_check, cache_get, cache_set, cache_delete
from middleware.auth_middleware import require_auth
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

company_bp = Blueprint('company', __name__)

import re

def validate_phone_number(phone):
    if not phone or not phone.strip():
        return True, None
    cleaned = re.sub(r'[\s\-\(\)\+]', '', phone.strip())
    if not cleaned.isdigit():
        return False, 'Phone number can only contain digits, spaces, hyphens, parentheses and +'
    if len(cleaned) < 6 or len(cleaned) > 15:
        return False, 'Phone number must be between 6 and 15 digits'
    return True, None

RATE_LIMIT_REGISTER = 3
RATE_LIMIT_WINDOW = 3600
COMPANY_CACHE_TTL = 300


def company_owner_required(f):
    """Decorator to require company_owner or super_admin role"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            token = request.cookies.get('accessToken')
        
        if not token:
            return jsonify({
                'success': False,
                'error': 'Authorization token required',
                'code': 'UNAUTHORIZED'
            }), 401
        
        from utils.token_manager import verify_access_token
        payload, error = verify_access_token(token)
        
        if error:
            return jsonify({
                'success': False,
                'error': 'Invalid or expired token',
                'code': 'INVALID_TOKEN'
            }), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, role, company_id FROM users WHERE id = %s AND is_active = TRUE",
                    (payload['user_id'],)
                )
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'User not found',
                        'code': 'UNAUTHORIZED'
                    }), 401
                
                if user['role'] not in ['company_owner', 'super_admin']:
                    return jsonify({
                        'success': False,
                        'error': 'Company owner or super admin access required',
                        'code': 'FORBIDDEN'
                    }), 403
                
                if not user['company_id']:
                    return jsonify({
                        'success': False,
                        'error': 'No company associated with this account',
                        'code': 'FORBIDDEN'
                    }), 403
                
                request.current_user_id = user['id']
                request.current_company_id = user['company_id']
                request.current_user_role = user['role']
                
        finally:
            conn.close()
        
        return f(*args, **kwargs)
    
    return decorated_function


@company_bp.route('/company/register', methods=['POST'])
def register_company():
    """Register a new company with owner account
    
    Required: companyName, email, password, confirmPassword
    Optional: firstName, lastName, cvrNumber, companyAddress, companyWebsite, companyIndustry, companySize, companyPhone
    """
    try:
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        rate_key = f"rate_limit:company_register:{client_ip}"
        allowed, remaining, reset_time = rate_limit_check(rate_key, RATE_LIMIT_REGISTER, RATE_LIMIT_WINDOW)
        
        if not allowed:
            return jsonify({
                'success': False,
                'error': 'Too many registration attempts. Please try again later.',
                'code': 'RATE_LIMITED',
                'retryAfter': reset_time
            }), 429
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        company_name = data.get('companyName', '').strip()
        cvr_number = data.get('cvrNumber', '').strip() if data.get('cvrNumber') else None
        company_address = data.get('companyAddress', '').strip() if data.get('companyAddress') else None
        company_website = data.get('companyWebsite', '').strip() if data.get('companyWebsite') else None
        company_industry = data.get('companyIndustry', '').strip() if data.get('companyIndustry') else None
        company_size = data.get('companySize', '').strip() if data.get('companySize') else None
        company_phone = data.get('companyPhone', '').strip() if data.get('companyPhone') else None
        company_email = data.get('companyEmail', '').strip() if data.get('companyEmail') else None
        
        first_name = data.get('firstName', '').strip() if data.get('firstName') else None
        last_name = data.get('lastName', '').strip() if data.get('lastName') else None
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirmPassword', '')
        owner_phone = data.get('phoneNumber', '').strip() if data.get('phoneNumber') else None
        
        if not company_name:
            return jsonify({
                'success': False,
                'error': 'Company name is required',
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
                'error': 'Passwords do not match',
                'code': 'PASSWORD_MISMATCH'
            }), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                if cur.fetchone():
                    return jsonify({
                        'success': False,
                        'error': 'User with this email already exists',
                        'code': 'EMAIL_EXISTS'
                    }), 400
                
                if cvr_number:
                    cur.execute("SELECT id FROM companies WHERE cvr_number = %s", (cvr_number,))
                    if cur.fetchone():
                        return jsonify({
                            'success': False,
                            'error': 'Company with this CVR number already exists',
                            'code': 'CVR_EXISTS'
                        }), 400
                
                cur.execute(
                    """
                    INSERT INTO companies (name, cvr_number, address, website, industry, size, phone_number, email)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, name, cvr_number, address, website, industry, size, phone_number, email, created_at
                    """,
                    (company_name, cvr_number, company_address, company_website, 
                     company_industry, company_size, company_phone, company_email or email)
                )
                new_company = cur.fetchone()
                
                password_hash = bcrypt.hashpw(
                    password.encode('utf-8'),
                    bcrypt.gensalt()
                ).decode('utf-8')
                
                cur.execute(
                    """
                    INSERT INTO users (first_name, last_name, email, password_hash, role, phone_number, 
                                       company_id, company_name)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, first_name, last_name, email, role, phone_number, company_id, created_at
                    """,
                    (first_name, last_name, email, password_hash, 'company_owner', 
                     owner_phone, new_company['id'], company_name)
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
                
                display_name = f"{first_name or ''} {last_name or ''}".strip() or company_name
                
                return jsonify({
                    'success': True,
                    'message': 'Company registered successfully',
                    'company': {
                        'id': new_company['id'],
                        'name': new_company['name'],
                        'cvrNumber': new_company['cvr_number'],
                        'address': new_company['address'],
                        'website': new_company['website'],
                        'industry': new_company['industry'],
                        'size': new_company['size'],
                        'phoneNumber': new_company['phone_number'],
                        'email': new_company['email'],
                        'createdAt': new_company['created_at'].isoformat()
                    },
                    'user': {
                        'id': new_user['id'],
                        'firstName': new_user['first_name'],
                        'lastName': new_user['last_name'],
                        'displayName': display_name,
                        'email': new_user['email'],
                        'role': new_user['role'],
                        'companyId': new_user['company_id'],
                        'companyName': company_name,
                        'createdAt': new_user['created_at'].isoformat()
                    },
                    'accessToken': access_token,
                    'refreshToken': refresh_token
                }), 201
                
        except Exception as e:
            conn.rollback()
            print(f"Company registration error: {e}")
            return jsonify({
                'success': False,
                'error': 'Company registration failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Company registration request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400


@company_bp.route('/company/users', methods=['GET'])
@company_owner_required
def get_company_users():
    """Get all users within the company - Company owner only
    
    Query Parameters:
    - page: Page number (default: 1)
    - limit: Items per page (default: 10, max: 100)
    - search: Search in name, email
    - role: Filter by role
    """
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        search = request.args.get('search', '').strip()
        role_filter = request.args.get('role', '').strip().lower()
        
        if page < 1:
            page = 1
        if limit < 1:
            limit = 10
        if limit > 100:
            limit = 100
        
        offset = (page - 1) * limit
        company_id = request.current_company_id
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                where_conditions = ["company_id = %s"]
                params = [company_id]
                
                if search:
                    where_conditions.append("""
                        (LOWER(first_name) LIKE LOWER(%s) OR 
                         LOWER(last_name) LIKE LOWER(%s) OR 
                         LOWER(email) LIKE LOWER(%s))
                    """)
                    search_pattern = f'%{search}%'
                    params.extend([search_pattern, search_pattern, search_pattern])
                
                if role_filter and role_filter in ['standard_user', 'read_only_user', 'company_owner']:
                    where_conditions.append("role = %s")
                    params.append(role_filter)
                
                where_clause = " AND ".join(where_conditions)
                
                count_query = f"SELECT COUNT(*) as total FROM users WHERE {where_clause}"
                cur.execute(count_query, params)
                total_count = cur.fetchone()['total']
                
                query = f"""
                    SELECT id, first_name, last_name, email, role, phone_number,
                           company_id, is_active, created_at, updated_at
                    FROM users
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([limit, offset])
                cur.execute(query, params)
                users = cur.fetchall()
                
                users_list = [{
                    'id': user['id'],
                    'firstName': user['first_name'],
                    'lastName': user['last_name'],
                    'email': user['email'],
                    'role': user['role'],
                    'phoneNumber': user.get('phone_number'),
                    'isActive': user.get('is_active', True),
                    'createdAt': user['created_at'].isoformat() if user.get('created_at') else None,
                    'updatedAt': user['updated_at'].isoformat() if user.get('updated_at') else None
                } for user in users]
                
                total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
                
                return jsonify({
                    'success': True,
                    'users': users_list,
                    'pagination': {
                        'page': page,
                        'limit': limit,
                        'total': total_count,
                        'totalPages': total_pages,
                        'hasNextPage': page < total_pages,
                        'hasPrevPage': page > 1
                    }
                }), 200
                
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Get company users error: {e}")
        return jsonify({
            'success': False,
            'error': 'Could not fetch users',
            'code': 'INTERNAL_ERROR'
        }), 500


@company_bp.route('/company/users', methods=['POST'])
@company_owner_required
def create_company_user():
    """Create a new user within the company - Company owner only
    
    Required: firstName, lastName, email, password
    Optional: role (user), phoneNumber
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        role = data.get('role', 'user').strip().lower()
        phone_number = data.get('phoneNumber', '').strip() if data.get('phoneNumber') else None
        
        company_id = request.current_company_id
        
        is_valid, error_msg = validate_name(first_name, "First name")
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg,
                'code': 'VALIDATION_ERROR'
            }), 400
        
        is_valid, error_msg = validate_name(last_name, "Last name")
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
        
        if role not in ['standard_user', 'read_only_user']:
            return jsonify({
                'success': False,
                'error': 'Invalid role. Only "standard_user" or "read_only_user" can be assigned',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        is_valid, error_msg = validate_phone_number(phone_number)
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
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                if cur.fetchone():
                    return jsonify({
                        'success': False,
                        'error': 'User with this email already exists',
                        'code': 'EMAIL_EXISTS'
                    }), 400
                
                cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
                company = cur.fetchone()
                company_name = company['name'] if company else None
                
                password_hash = bcrypt.hashpw(
                    password.encode('utf-8'),
                    bcrypt.gensalt()
                ).decode('utf-8')
                
                cur.execute(
                    """
                    INSERT INTO users (first_name, last_name, email, password_hash, role, 
                                       phone_number, company_id, company_name)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, first_name, last_name, email, role, phone_number, 
                              company_id, is_active, created_at, updated_at
                    """,
                    (first_name, last_name, email, password_hash, role, 
                     phone_number, company_id, company_name)
                )
                new_user = cur.fetchone()
                conn.commit()
                
                log_audit_event(
                    event_type='user_created',
                    actor_user_id=request.current_user_id,
                    company_id=company_id,
                    target_user_id=new_user['id'],
                    event_description=f"User created: {email} with role {role}",
                    context={'email': email, 'role': role, 'first_name': first_name, 'last_name': last_name}
                )
                
                return jsonify({
                    'success': True,
                    'message': 'User created successfully',
                    'user': {
                        'id': new_user['id'],
                        'firstName': new_user['first_name'],
                        'lastName': new_user['last_name'],
                        'email': new_user['email'],
                        'role': new_user['role'],
                        'phoneNumber': new_user.get('phone_number'),
                        'companyId': new_user['company_id'],
                        'isActive': new_user.get('is_active', True),
                        'createdAt': new_user['created_at'].isoformat() if new_user.get('created_at') else None,
                        'updatedAt': new_user['updated_at'].isoformat() if new_user.get('updated_at') else None
                    }
                }), 201
                
        except Exception as e:
            conn.rollback()
            print(f"Create company user error: {e}")
            return jsonify({
                'success': False,
                'error': 'User creation failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Create company user request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400


@company_bp.route('/company/users/<int:user_id>', methods=['PUT'])
@company_owner_required
def update_company_user(user_id):
    """Update a user within the company - Company owner only"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        company_id = request.current_company_id
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, email, role, company_id FROM users WHERE id = %s",
                    (user_id,)
                )
                existing_user = cur.fetchone()
                
                if not existing_user:
                    return jsonify({
                        'success': False,
                        'error': 'User not found',
                        'code': 'NOT_FOUND'
                    }), 404
                
                if existing_user['company_id'] != company_id:
                    return jsonify({
                        'success': False,
                        'error': 'User does not belong to your company',
                        'code': 'FORBIDDEN'
                    }), 403
                
                update_fields = []
                update_values = []
                
                if 'firstName' in data:
                    first_name = data['firstName'].strip()
                    is_valid, error_msg = validate_name(first_name, "First name")
                    if not is_valid:
                        return jsonify({
                            'success': False,
                            'error': error_msg,
                            'code': 'VALIDATION_ERROR'
                        }), 400
                    update_fields.append("first_name = %s")
                    update_values.append(first_name)
                
                if 'lastName' in data:
                    last_name = data['lastName'].strip()
                    is_valid, error_msg = validate_name(last_name, "Last name")
                    if not is_valid:
                        return jsonify({
                            'success': False,
                            'error': error_msg,
                            'code': 'VALIDATION_ERROR'
                        }), 400
                    update_fields.append("last_name = %s")
                    update_values.append(last_name)
                
                if 'email' in data:
                    email = data['email'].strip().lower()
                    is_valid, error_msg = validate_email(email)
                    if not is_valid:
                        return jsonify({
                            'success': False,
                            'error': error_msg,
                            'code': 'VALIDATION_ERROR'
                        }), 400
                    
                    if email != existing_user['email']:
                        cur.execute("SELECT id FROM users WHERE email = %s AND id != %s", (email, user_id))
                        if cur.fetchone():
                            return jsonify({
                                'success': False,
                                'error': 'Email is already in use',
                                'code': 'EMAIL_EXISTS'
                            }), 400
                    
                    update_fields.append("email = %s")
                    update_values.append(email)
                
                if 'password' in data and data['password']:
                    password = data['password']
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
                    update_fields.append("password_hash = %s")
                    update_values.append(password_hash)
                
                if 'phoneNumber' in data:
                    phone_number = data['phoneNumber'].strip() if data['phoneNumber'] else None
                    is_valid, error_msg = validate_phone_number(phone_number)
                    if not is_valid:
                        return jsonify({
                            'success': False,
                            'error': error_msg,
                            'code': 'VALIDATION_ERROR'
                        }), 400
                    update_fields.append("phone_number = %s")
                    update_values.append(phone_number)
                
                if 'role' in data:
                    new_role = data['role'].strip().lower()
                    if existing_user['role'] == 'company_owner':
                        return jsonify({
                            'success': False,
                            'error': 'Cannot change role of company owner',
                            'code': 'FORBIDDEN'
                        }), 403
                    if new_role not in ['standard_user', 'read_only_user']:
                        return jsonify({
                            'success': False,
                            'error': 'Invalid role. Only "standard_user" or "read_only_user" can be assigned',
                            'code': 'VALIDATION_ERROR'
                        }), 400
                    update_fields.append("role = %s")
                    update_values.append(new_role)
                
                if 'isActive' in data:
                    if existing_user['role'] == 'company_owner':
                        return jsonify({
                            'success': False,
                            'error': 'Cannot deactivate company owner',
                            'code': 'FORBIDDEN'
                        }), 403
                    update_fields.append("is_active = %s")
                    update_values.append(bool(data['isActive']))
                
                if not update_fields:
                    return jsonify({
                        'success': False,
                        'error': 'No fields to update',
                        'code': 'VALIDATION_ERROR'
                    }), 400
                
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                update_values.append(user_id)
                
                update_query = f"""
                    UPDATE users 
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, first_name, last_name, email, role, phone_number,
                              company_id, is_active, created_at, updated_at
                """
                
                cur.execute(update_query, update_values)
                updated_user = cur.fetchone()
                conn.commit()
                
                log_audit_event(
                    event_type='user_updated',
                    actor_user_id=request.current_user_id,
                    company_id=company_id,
                    target_user_id=user_id,
                    event_description=f"User updated: {updated_user['email']}",
                    context={'email': updated_user['email'], 'updated_fields': list(data.keys())}
                )
                
                return jsonify({
                    'success': True,
                    'message': 'User updated successfully',
                    'user': {
                        'id': updated_user['id'],
                        'firstName': updated_user['first_name'],
                        'lastName': updated_user['last_name'],
                        'email': updated_user['email'],
                        'role': updated_user['role'],
                        'phoneNumber': updated_user.get('phone_number'),
                        'companyId': updated_user['company_id'],
                        'isActive': updated_user.get('is_active', True),
                        'createdAt': updated_user['created_at'].isoformat() if updated_user.get('created_at') else None,
                        'updatedAt': updated_user['updated_at'].isoformat() if updated_user.get('updated_at') else None
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Update company user error: {e}")
            return jsonify({
                'success': False,
                'error': 'User update failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Update company user request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400


@company_bp.route('/company/users/<int:user_id>', methods=['DELETE'])
@company_owner_required
def delete_company_user(user_id):
    """Delete a user within the company - Company owner only"""
    try:
        company_id = request.current_company_id
        current_user_id = request.current_user_id
        
        if user_id == current_user_id:
            return jsonify({
                'success': False,
                'error': 'You cannot delete your own account',
                'code': 'FORBIDDEN'
            }), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, email, role, company_id FROM users WHERE id = %s",
                    (user_id,)
                )
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'User not found',
                        'code': 'NOT_FOUND'
                    }), 404
                
                if user['company_id'] != company_id:
                    return jsonify({
                        'success': False,
                        'error': 'User does not belong to your company',
                        'code': 'FORBIDDEN'
                    }), 403
                
                if user['role'] == 'company_owner':
                    return jsonify({
                        'success': False,
                        'error': 'Cannot delete company owner',
                        'code': 'FORBIDDEN'
                    }), 403
                
                cur.execute("DELETE FROM refresh_tokens WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM password_reset_otps WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
                conn.commit()
                
                log_audit_event(
                    event_type='user_deleted',
                    actor_user_id=current_user_id,
                    company_id=company_id,
                    target_user_id=user_id,
                    event_description=f"User deleted: {user['email']}",
                    context={'email': user['email'], 'role': user['role']}
                )
                
                return jsonify({
                    'success': True,
                    'message': f'User {user["email"]} deleted successfully'
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Delete company user error: {e}")
            return jsonify({
                'success': False,
                'error': 'User deletion failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Delete company user request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400


@company_bp.route('/company/info', methods=['GET'])
@company_owner_required
def get_company_info():
    """Get company information - Company owner only"""
    try:
        company_id = request.current_company_id
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, name, cvr_number, address, website, industry, size, 
                           phone_number, email, is_active, created_at, updated_at
                    FROM companies WHERE id = %s
                    """,
                    (company_id,)
                )
                company = cur.fetchone()
                
                if not company:
                    return jsonify({
                        'success': False,
                        'error': 'Company not found',
                        'code': 'NOT_FOUND'
                    }), 404
                
                cur.execute(
                    "SELECT COUNT(*) as total FROM users WHERE company_id = %s",
                    (company_id,)
                )
                user_count = cur.fetchone()['total']
                
                return jsonify({
                    'success': True,
                    'company': {
                        'id': company['id'],
                        'name': company['name'],
                        'cvrNumber': company['cvr_number'],
                        'address': company['address'],
                        'website': company['website'],
                        'industry': company['industry'],
                        'size': company['size'],
                        'phoneNumber': company['phone_number'],
                        'email': company['email'],
                        'isActive': company.get('is_active', True),
                        'userCount': user_count,
                        'createdAt': company['created_at'].isoformat() if company.get('created_at') else None,
                        'updatedAt': company['updated_at'].isoformat() if company.get('updated_at') else None
                    }
                }), 200
                
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Get company info error: {e}")
        return jsonify({
            'success': False,
            'error': 'Could not fetch company info',
            'code': 'INTERNAL_ERROR'
        }), 500


@company_bp.route('/company/info', methods=['PUT'])
@company_owner_required
def update_company_info():
    """Update company information - Company owner only"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        company_id = request.current_company_id
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database connection failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                update_fields = []
                update_values = []
                
                if 'name' in data:
                    name = data['name'].strip()
                    if not name:
                        return jsonify({
                            'success': False,
                            'error': 'Company name is required',
                            'code': 'VALIDATION_ERROR'
                        }), 400
                    update_fields.append("name = %s")
                    update_values.append(name)
                
                if 'cvrNumber' in data:
                    cvr = data['cvrNumber'].strip() if data['cvrNumber'] else None
                    if cvr:
                        cur.execute(
                            "SELECT id FROM companies WHERE cvr_number = %s AND id != %s",
                            (cvr, company_id)
                        )
                        if cur.fetchone():
                            return jsonify({
                                'success': False,
                                'error': 'CVR number already in use',
                                'code': 'CVR_EXISTS'
                            }), 400
                    update_fields.append("cvr_number = %s")
                    update_values.append(cvr)
                
                if 'address' in data:
                    update_fields.append("address = %s")
                    update_values.append(data['address'].strip() if data['address'] else None)
                
                if 'website' in data:
                    update_fields.append("website = %s")
                    update_values.append(data['website'].strip() if data['website'] else None)
                
                if 'industry' in data:
                    update_fields.append("industry = %s")
                    update_values.append(data['industry'].strip() if data['industry'] else None)
                
                if 'size' in data:
                    update_fields.append("size = %s")
                    update_values.append(data['size'].strip() if data['size'] else None)
                
                if 'phoneNumber' in data:
                    update_fields.append("phone_number = %s")
                    update_values.append(data['phoneNumber'].strip() if data['phoneNumber'] else None)
                
                if 'email' in data:
                    update_fields.append("email = %s")
                    update_values.append(data['email'].strip() if data['email'] else None)
                
                if not update_fields:
                    return jsonify({
                        'success': False,
                        'error': 'No fields to update',
                        'code': 'VALIDATION_ERROR'
                    }), 400
                
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                update_values.append(company_id)
                
                update_query = f"""
                    UPDATE companies 
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, name, cvr_number, address, website, industry, size, 
                              phone_number, email, is_active, created_at, updated_at
                """
                
                cur.execute(update_query, update_values)
                updated_company = cur.fetchone()
                conn.commit()
                
                if 'name' in data:
                    cur.execute(
                        "UPDATE users SET company_name = %s WHERE company_id = %s",
                        (data['name'].strip(), company_id)
                    )
                    conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Company updated successfully',
                    'company': {
                        'id': updated_company['id'],
                        'name': updated_company['name'],
                        'cvrNumber': updated_company['cvr_number'],
                        'address': updated_company['address'],
                        'website': updated_company['website'],
                        'industry': updated_company['industry'],
                        'size': updated_company['size'],
                        'phoneNumber': updated_company['phone_number'],
                        'email': updated_company['email'],
                        'isActive': updated_company.get('is_active', True),
                        'createdAt': updated_company['created_at'].isoformat() if updated_company.get('created_at') else None,
                        'updatedAt': updated_company['updated_at'].isoformat() if updated_company.get('updated_at') else None
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Update company info error: {e}")
            return jsonify({
                'success': False,
                'error': 'Company update failed',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Update company info request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400
