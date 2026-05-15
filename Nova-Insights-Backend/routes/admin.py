"""
Admin routes for user management
CRUD operations for users - Admin only access
"""
from flask import Blueprint, request, jsonify
import bcrypt
from utils.database import get_db_connection
from utils.validators import validate_email, validate_password, validate_name
from middleware.admin_auth import admin_required
from psycopg2.extras import RealDictCursor

admin_bp = Blueprint('admin', __name__)


def format_user_response(user):
    """Helper function to format user data for API response"""
    return {
        'id': user['id'],
        'firstName': user['first_name'],
        'lastName': user['last_name'],
        'email': user['email'],
        'role': user['role'],
        'phoneNumber': user.get('phone_number'),
        'company': {
            'name': user.get('company_name'),
            'address': user.get('company_address'),
            'website': user.get('company_website'),
            'industry': user.get('company_industry'),
            'size': user.get('company_size')
        } if user.get('company_name') else None,
        'createdAt': user['created_at'].isoformat() if user.get('created_at') else None,
        'updatedAt': user['updated_at'].isoformat() if user.get('updated_at') else None
    }


@admin_bp.route('/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    """Get all users with filtering and pagination - Admin only
    
    Query Parameters:
    - page: Page number (default: 1)
    - limit: Items per page (default: 10, max: 100)
    - search: Search in name, email, company name, phone number
    - name: Filter by first or last name
    - email: Filter by email
    - companyName: Filter by company name
    - phoneNumber: Filter by phone number
    - role: Filter by role (user/admin)
    """
    try:
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        search = request.args.get('search', '').strip()
        name_filter = request.args.get('name', '').strip()
        email_filter = request.args.get('email', '').strip()
        company_filter = request.args.get('companyName', '').strip()
        phone_filter = request.args.get('phoneNumber', '').strip()
        role_filter = request.args.get('role', '').strip().lower()
        
        # Validate pagination
        if page < 1:
            page = 1
        if limit < 1:
            limit = 10
        if limit > 100:
            limit = 100
        
        offset = (page - 1) * limit
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Build WHERE clause dynamically
                where_conditions = []
                params = []
                
                # General search across multiple fields
                if search:
                    where_conditions.append("""
                        (LOWER(first_name) LIKE LOWER(%s) OR 
                         LOWER(last_name) LIKE LOWER(%s) OR 
                         LOWER(email) LIKE LOWER(%s) OR 
                         LOWER(company_name) LIKE LOWER(%s) OR 
                         phone_number LIKE %s)
                    """)
                    search_pattern = f'%{search}%'
                    params.extend([search_pattern, search_pattern, search_pattern, search_pattern, search_pattern])
                
                # Specific filters
                if name_filter:
                    where_conditions.append("(LOWER(first_name) LIKE LOWER(%s) OR LOWER(last_name) LIKE LOWER(%s))")
                    name_pattern = f'%{name_filter}%'
                    params.extend([name_pattern, name_pattern])
                
                if email_filter:
                    where_conditions.append("LOWER(email) LIKE LOWER(%s)")
                    params.append(f'%{email_filter}%')
                
                if company_filter:
                    where_conditions.append("LOWER(company_name) LIKE LOWER(%s)")
                    params.append(f'%{company_filter}%')
                
                if phone_filter:
                    where_conditions.append("phone_number LIKE %s")
                    params.append(f'%{phone_filter}%')
                
                if role_filter and role_filter in ['user', 'admin']:
                    where_conditions.append("role = %s")
                    params.append(role_filter)
                
                where_clause = ""
                if where_conditions:
                    where_clause = "WHERE " + " AND ".join(where_conditions)
                
                # Get total count
                count_query = f"SELECT COUNT(*) as total FROM users {where_clause}"
                cur.execute(count_query, params)
                total_count = cur.fetchone()['total']
                
                # Get paginated results
                query = f"""
                    SELECT id, first_name, last_name, email, role, phone_number,
                           company_name, company_address, company_website, 
                           company_industry, company_size, created_at, updated_at
                    FROM users
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([limit, offset])
                cur.execute(query, params)
                users = cur.fetchall()
                
                users_list = [format_user_response(user) for user in users]
                
                # Calculate pagination info
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
        print(f"Get users error: {e}")
        return jsonify({
            'success': False,
            'error': 'Kunne ikke hente brugere',
            'code': 'INTERNAL_ERROR'
        }), 500


@admin_bp.route('/admin/users', methods=['POST'])
@admin_required
def create_user():
    """Create a new user - Admin only
    
    Required fields: firstName, lastName, email, password, companyName
    Optional fields: role, phoneNumber, company.address, company.website, company.industry, company.size
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Anmodningsdata påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        role = data.get('role', 'user').strip().lower()
        phone_number = data.get('phoneNumber', '').strip() if data.get('phoneNumber') else None
        
        # Company details - companyName is required
        company_data = data.get('company', {}) or {}
        company_name = company_data.get('name', '').strip() if company_data.get('name') else data.get('companyName', '').strip()
        company_address = company_data.get('address', '').strip() if company_data.get('address') else None
        company_website = company_data.get('website', '').strip() if company_data.get('website') else None
        company_industry = company_data.get('industry', '').strip() if company_data.get('industry') else None
        company_size = company_data.get('size', '').strip() if company_data.get('size') else None
        
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
        
        # Validate company name (required)
        if not company_name:
            return jsonify({
                'success': False,
                'error': 'Firmanavn er påkrævet',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if role not in ['user', 'admin']:
            return jsonify({
                'success': False,
                'error': 'Ugyldig rolle. Skal være "user" eller "admin"',
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
                    INSERT INTO users (first_name, last_name, email, password_hash, role, 
                                       phone_number, company_name, company_address, 
                                       company_website, company_industry, company_size)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, first_name, last_name, email, role, phone_number,
                              company_name, company_address, company_website, 
                              company_industry, company_size, created_at, updated_at
                    """,
                    (first_name, last_name, email, password_hash, role, phone_number,
                     company_name, company_address, company_website, company_industry, company_size)
                )
                new_user = cur.fetchone()
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Bruger oprettet med succes',
                    'user': format_user_response(new_user)
                }), 201
                
        except Exception as e:
            conn.rollback()
            print(f"Create user error: {e}")
            return jsonify({
                'success': False,
                'error': 'Brugeroprettelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Create user request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400


@admin_bp.route('/admin/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Update a user - Admin only"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Anmodningsdata påkrævet',
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
                cur.execute("SELECT id, email FROM users WHERE id = %s", (user_id,))
                existing_user = cur.fetchone()
                
                if not existing_user:
                    return jsonify({
                        'success': False,
                        'error': 'Bruger ikke fundet',
                        'code': 'NOT_FOUND'
                    }), 404
                
                update_fields = []
                update_values = []
                
                if 'firstName' in data:
                    first_name = data['firstName'].strip()
                    is_valid, error_msg = validate_name(first_name, "Fornavn")
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
                    is_valid, error_msg = validate_name(last_name, "Efternavn")
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
                                'error': 'E-mail er allerede i brug',
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
                
                if 'role' in data:
                    role = data['role'].strip().lower()
                    if role not in ['user', 'admin']:
                        return jsonify({
                            'success': False,
                            'error': 'Ugyldig rolle. Skal være "user" eller "admin"',
                            'code': 'VALIDATION_ERROR'
                        }), 400
                    update_fields.append("role = %s")
                    update_values.append(role)
                
                # Phone number
                if 'phoneNumber' in data:
                    phone_number = data['phoneNumber'].strip() if data['phoneNumber'] else None
                    update_fields.append("phone_number = %s")
                    update_values.append(phone_number)
                
                # Company details
                company_data = data.get('company', {}) or {}
                
                # Support both flat companyName and nested company.name
                if 'companyName' in data or 'name' in company_data:
                    company_name = company_data.get('name', '').strip() if company_data.get('name') else data.get('companyName', '').strip()
                    if company_name:
                        update_fields.append("company_name = %s")
                        update_values.append(company_name)
                
                if 'address' in company_data:
                    update_fields.append("company_address = %s")
                    update_values.append(company_data['address'].strip() if company_data['address'] else None)
                
                if 'website' in company_data:
                    update_fields.append("company_website = %s")
                    update_values.append(company_data['website'].strip() if company_data['website'] else None)
                
                if 'industry' in company_data:
                    update_fields.append("company_industry = %s")
                    update_values.append(company_data['industry'].strip() if company_data['industry'] else None)
                
                if 'size' in company_data:
                    update_fields.append("company_size = %s")
                    update_values.append(company_data['size'].strip() if company_data['size'] else None)
                
                if not update_fields:
                    return jsonify({
                        'success': False,
                        'error': 'Ingen felter at opdatere',
                        'code': 'VALIDATION_ERROR'
                    }), 400
                
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                update_values.append(user_id)
                
                update_query = f"""
                    UPDATE users 
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, first_name, last_name, email, role, phone_number,
                              company_name, company_address, company_website,
                              company_industry, company_size, created_at, updated_at
                """
                
                cur.execute(update_query, update_values)
                updated_user = cur.fetchone()
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Bruger opdateret med succes',
                    'user': format_user_response(updated_user)
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Update user error: {e}")
            return jsonify({
                'success': False,
                'error': 'Brugeropdatering fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Update user request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400


@admin_bp.route('/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user - Admin only"""
    try:
        if user_id == request.current_user_id:
            return jsonify({
                'success': False,
                'error': 'Du kan ikke slette din egen konto',
                'code': 'FORBIDDEN'
            }), 403
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id, email, role FROM users WHERE id = %s", (user_id,))
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'Bruger ikke fundet',
                        'code': 'NOT_FOUND'
                    }), 404
                
                cur.execute("DELETE FROM refresh_tokens WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM password_reset_otps WHERE user_id = %s", (user_id,))
                
                cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': f'Bruger {user["email"]} slettet med succes'
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Delete user error: {e}")
            return jsonify({
                'success': False,
                'error': 'Brugersletning fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Delete user request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Ugyldig anmodningsdata',
            'code': 'VALIDATION_ERROR'
        }), 400


@admin_bp.route('/admin/users/<int:user_id>', methods=['GET'])
@admin_required
def get_user(user_id):
    """Get a single user - Admin only"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database forbindelse fejlede',
                'code': 'INTERNAL_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, first_name, last_name, email, role, phone_number,
                           company_name, company_address, company_website, 
                           company_industry, company_size, created_at, updated_at
                    FROM users WHERE id = %s
                """, (user_id,))
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'Bruger ikke fundet',
                        'code': 'NOT_FOUND'
                    }), 404
                
                return jsonify({
                    'success': True,
                    'user': format_user_response(user)
                }), 200
                
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Get user error: {e}")
        return jsonify({
            'success': False,
            'error': 'Kunne ikke hente bruger',
            'code': 'INTERNAL_ERROR'
        }), 500
