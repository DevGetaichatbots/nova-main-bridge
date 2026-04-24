"""
Super Admin routes for platform-wide management
Nordic Construction A/S - Platform Owner Access
"""
from flask import Blueprint, request, jsonify
from functools import wraps
from utils.database import get_db_connection
from utils.token_manager import verify_access_token
from psycopg2.extras import RealDictCursor
import bcrypt

super_admin_bp = Blueprint('super_admin', __name__)


def super_admin_required(f):
    """Middleware to require super_admin role"""
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
                'error': 'Unauthorized',
                'code': 'UNAUTHORIZED'
            }), 401
        
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
                'code': 'DB_ERROR'
            }), 500
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, role, company_id FROM users WHERE id = %s",
                    (payload['user_id'],)
                )
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'User not found',
                        'code': 'USER_NOT_FOUND'
                    }), 404
                
                if user['role'] != 'super_admin':
                    return jsonify({
                        'success': False,
                        'error': 'Super admin access required',
                        'code': 'FORBIDDEN'
                    }), 403
                
                request.current_user = user
                return f(*args, **kwargs)
        finally:
            conn.close()
    
    return decorated_function


@super_admin_bp.route('/super-admin/dashboard', methods=['GET'])
@super_admin_required
def get_dashboard():
    """Get platform-wide analytics and statistics"""
    conn = get_db_connection()
    if not conn:
        return jsonify({
            'success': False,
            'error': 'Database connection failed',
            'code': 'INTERNAL_ERROR'
        }), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Total companies (excluding super admin company)
            cur.execute("""
                SELECT COUNT(*) as total FROM companies 
                WHERE is_super_admin IS NOT TRUE
            """)
            total_companies = cur.fetchone()['total']
            
            # Total users
            cur.execute("SELECT COUNT(*) as total FROM users")
            total_users = cur.fetchone()['total']
            
            # Active users
            cur.execute("SELECT COUNT(*) as total FROM users WHERE is_active = TRUE")
            active_users = cur.fetchone()['total']
            
            # Users by role
            cur.execute("""
                SELECT role, COUNT(*) as count FROM users 
                GROUP BY role ORDER BY count DESC
            """)
            users_by_role = cur.fetchall()
            
            # Get limit parameters from query string
            companies_limit = request.args.get('companiesLimit', 5, type=int)
            users_limit = request.args.get('usersLimit', 5, type=int)
            users_page = request.args.get('usersPage', 1, type=int)
            companies_page = request.args.get('companiesPage', 1, type=int)
            
            # Validate limits
            if companies_limit < 1:
                companies_limit = 5
            if companies_limit > 100:
                companies_limit = 100
            if users_limit < 1:
                users_limit = 5
            if users_limit > 100:
                users_limit = 100
            if users_page < 1:
                users_page = 1
            if companies_page < 1:
                companies_page = 1
            
            users_offset = (users_page - 1) * users_limit
            companies_offset = (companies_page - 1) * companies_limit
            
            # Companies with user counts
            cur.execute("""
                SELECT 
                    c.id, c.name, c.email, c.is_active, c.created_at,
                    COUNT(u.id) as user_count
                FROM companies c
                LEFT JOIN users u ON u.company_id = c.id
                WHERE c.is_super_admin IS NOT TRUE
                GROUP BY c.id
                ORDER BY c.created_at DESC
                LIMIT %s OFFSET %s
            """, (companies_limit, companies_offset))
            recent_companies = cur.fetchall()
            
            # Recent users
            cur.execute("""
                SELECT 
                    u.id, u.first_name, u.last_name, u.email, u.role, 
                    u.is_active, u.created_at,
                    c.name as company_name
                FROM users u
                LEFT JOIN companies c ON u.company_id = c.id
                ORDER BY u.created_at DESC
                LIMIT %s OFFSET %s
            """, (users_limit, users_offset))
            recent_users = cur.fetchall()
            
            return jsonify({
                'success': True,
                'dashboard': {
                    'totalCompanies': total_companies,
                    'totalUsers': total_users,
                    'activeUsers': active_users,
                    'usersByRole': [{'role': r['role'] or 'user', 'count': r['count']} for r in users_by_role],
                    'recentCompanies': [{
                        'id': c['id'],
                        'name': c['name'],
                        'email': c['email'],
                        'isActive': c['is_active'],
                        'userCount': c['user_count'],
                        'createdAt': c['created_at'].isoformat() if c['created_at'] else None
                    } for c in recent_companies],
                    'recentUsers': [{
                        'id': u['id'],
                        'firstName': u['first_name'],
                        'lastName': u['last_name'],
                        'email': u['email'],
                        'role': u['role'] or 'user',
                        'isActive': u['is_active'],
                        'companyName': u['company_name'],
                        'createdAt': u['created_at'].isoformat() if u['created_at'] else None
                    } for u in recent_users],
                    'recentUsersPagination': {
                        'page': users_page,
                        'limit': users_limit,
                        'total': total_users,
                        'totalPages': max(1, -(-total_users // users_limit))
                    },
                    'recentCompaniesPagination': {
                        'page': companies_page,
                        'limit': companies_limit,
                        'total': total_companies,
                        'totalPages': max(1, -(-total_companies // companies_limit))
                    }
                }
            }), 200
            
    except Exception as e:
        print(f"Dashboard error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to load dashboard',
            'code': 'INTERNAL_ERROR'
        }), 500
    finally:
        conn.close()


@super_admin_bp.route('/super-admin/companies', methods=['GET'])
@super_admin_required
def get_all_companies():
    """Get all companies with pagination and search"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    search = request.args.get('search', '').strip()
    
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
            'error': 'Database connection failed',
            'code': 'INTERNAL_ERROR'
        }), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_conditions = ["c.is_super_admin IS NOT TRUE"]
            params = []
            
            if search:
                where_conditions.append("""
                    (LOWER(c.name) LIKE LOWER(%s) OR 
                     LOWER(c.email) LIKE LOWER(%s) OR
                     LOWER(c.cvr_number) LIKE LOWER(%s))
                """)
                search_pattern = f'%{search}%'
                params.extend([search_pattern, search_pattern, search_pattern])
            
            where_clause = " AND ".join(where_conditions)
            
            # Get total count
            count_query = f"""
                SELECT COUNT(*) as total FROM companies c WHERE {where_clause}
            """
            cur.execute(count_query, params)
            total_count = cur.fetchone()['total']
            
            # Get companies with user counts
            query = f"""
                SELECT 
                    c.id, c.name, c.cvr_number, c.email, c.phone_number as phone,
                    c.website, c.address, c.industry, c.size, c.is_active, 
                    c.created_at, c.updated_at,
                    COUNT(u.id) as user_count,
                    COUNT(CASE WHEN u.role = 'company_owner' THEN 1 END) as owner_count,
                    COUNT(CASE WHEN u.role = 'standard_user' THEN 1 END) as standard_user_count,
                    COUNT(CASE WHEN u.role = 'read_only_user' THEN 1 END) as read_only_count
                FROM companies c
                LEFT JOIN users u ON u.company_id = c.id
                WHERE {where_clause}
                GROUP BY c.id
                ORDER BY c.created_at DESC
                LIMIT %s OFFSET %s
            """
            params.extend([limit, offset])
            cur.execute(query, params)
            companies = cur.fetchall()
            
            companies_list = [{
                'id': c['id'],
                'name': c['name'],
                'cvrNumber': c['cvr_number'],
                'email': c['email'],
                'phone': c['phone'],
                'website': c['website'],
                'address': c['address'],
                'industry': c['industry'],
                'size': c['size'],
                'isActive': c['is_active'],
                'userCount': c['user_count'],
                'ownerCount': c['owner_count'],
                'standardUserCount': c['standard_user_count'],
                'readOnlyCount': c['read_only_count'],
                'createdAt': c['created_at'].isoformat() if c['created_at'] else None,
                'updatedAt': c['updated_at'].isoformat() if c['updated_at'] else None
            } for c in companies]
            
            total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
            
            return jsonify({
                'success': True,
                'companies': companies_list,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'totalItems': total_count,
                    'totalPages': total_pages,
                    'hasNext': page < total_pages,
                    'hasPrev': page > 1
                }
            }), 200
            
    except Exception as e:
        print(f"Get companies error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch companies',
            'code': 'INTERNAL_ERROR'
        }), 500
    finally:
        conn.close()


@super_admin_bp.route('/super-admin/companies', methods=['POST'])
@super_admin_required
def create_company():
    """Create a new company with owner account"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower() if data.get('email') else None
        
        owner_first_name = data.get('ownerFirstName', '').strip()
        owner_last_name = data.get('ownerLastName', '').strip()
        owner_email = data.get('ownerEmail', '').strip().lower() if data.get('ownerEmail') else None
        owner_password = data.get('ownerPassword', '')
        
        if not name:
            return jsonify({
                'success': False,
                'error': 'Company name is required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if not owner_email:
            return jsonify({
                'success': False,
                'error': 'Owner email is required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if not owner_password or len(owner_password) < 6:
            return jsonify({
                'success': False,
                'error': 'Owner password must be at least 6 characters',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if not owner_first_name:
            return jsonify({
                'success': False,
                'error': 'Owner first name is required',
                'code': 'VALIDATION_ERROR'
            }), 400
        
        if not owner_last_name:
            return jsonify({
                'success': False,
                'error': 'Owner last name is required',
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
                cur.execute("SELECT id FROM companies WHERE LOWER(name) = LOWER(%s)", (name,))
                if cur.fetchone():
                    return jsonify({
                        'success': False,
                        'error': 'A company with this name already exists',
                        'code': 'NAME_EXISTS'
                    }), 400
                
                if email:
                    cur.execute("SELECT id FROM companies WHERE email = %s", (email,))
                    if cur.fetchone():
                        return jsonify({
                            'success': False,
                            'error': 'Company with this email already exists',
                            'code': 'EMAIL_EXISTS'
                        }), 400
                
                cur.execute("SELECT id FROM users WHERE email = %s", (owner_email,))
                if cur.fetchone():
                    return jsonify({
                        'success': False,
                        'error': 'A user with this owner email already exists',
                        'code': 'OWNER_EMAIL_EXISTS'
                    }), 400
                
                cur.execute("""
                    INSERT INTO companies (name, email, cvr_number, phone_number, website, 
                                           address, industry, size, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, name, email, created_at
                """, (
                    name, email,
                    data.get('cvrNumber', '').strip() or None,
                    data.get('phone', '').strip() or None,
                    data.get('website', '').strip() or None,
                    data.get('address', '').strip() or None,
                    data.get('industry', '').strip() or None,
                    data.get('size', '').strip() or None,
                    True
                ))
                new_company = cur.fetchone()
                
                password_hash = bcrypt.hashpw(owner_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                cur.execute("""
                    INSERT INTO users (email, password_hash, first_name, last_name, role, company_id, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, email, first_name, last_name, role
                """, (
                    owner_email,
                    password_hash,
                    owner_first_name,
                    owner_last_name,
                    'company_owner',
                    new_company['id'],
                    True
                ))
                owner_user = cur.fetchone()
                
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Company and owner account created successfully',
                    'company': {
                        'id': new_company['id'],
                        'name': new_company['name'],
                        'email': new_company['email'],
                        'createdAt': new_company['created_at'].isoformat()
                    },
                    'owner': {
                        'id': owner_user['id'],
                        'email': owner_user['email'],
                        'firstName': owner_user['first_name'],
                        'lastName': owner_user['last_name'],
                        'role': owner_user['role']
                    }
                }), 201
                
        except Exception as e:
            conn.rollback()
            error_msg = str(e)
            print(f"Create company error: {error_msg}")
            
            if 'duplicate key' in error_msg.lower() or 'unique constraint' in error_msg.lower():
                if 'email' in error_msg.lower():
                    return jsonify({
                        'success': False,
                        'error': 'Email already exists',
                        'code': 'DUPLICATE_EMAIL'
                    }), 400
                elif 'name' in error_msg.lower():
                    return jsonify({
                        'success': False,
                        'error': 'Company name already exists',
                        'code': 'DUPLICATE_NAME'
                    }), 400
                else:
                    return jsonify({
                        'success': False,
                        'error': 'A record with this information already exists',
                        'code': 'DUPLICATE_ENTRY'
                    }), 400
            
            return jsonify({
                'success': False,
                'error': 'Failed to create company. Please try again.',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Create company request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400


@super_admin_bp.route('/super-admin/companies/<int:company_id>', methods=['PUT'])
@super_admin_required
def update_company(company_id):
    """Update a company"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data required',
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
                # Check company exists and is not super admin
                cur.execute("""
                    SELECT id, is_super_admin FROM companies WHERE id = %s
                """, (company_id,))
                company = cur.fetchone()
                
                if not company:
                    return jsonify({
                        'success': False,
                        'error': 'Company not found',
                        'code': 'NOT_FOUND'
                    }), 404
                
                if company.get('is_super_admin'):
                    return jsonify({
                        'success': False,
                        'error': 'Cannot modify platform owner company',
                        'code': 'FORBIDDEN'
                    }), 403
                
                cur.execute("""
                    UPDATE companies SET
                        name = COALESCE(%s, name),
                        email = COALESCE(%s, email),
                        cvr_number = %s,
                        phone_number = %s,
                        website = %s,
                        address = %s,
                        industry = %s,
                        size = %s,
                        is_active = COALESCE(%s, is_active),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id, name, email, is_active, updated_at
                """, (
                    data.get('name', '').strip() or None,
                    data.get('email', '').strip().lower() or None,
                    data.get('cvrNumber', '').strip() or None,
                    data.get('phone', '').strip() or None,
                    data.get('website', '').strip() or None,
                    data.get('address', '').strip() or None,
                    data.get('industry', '').strip() or None,
                    data.get('size', '').strip() or None,
                    data.get('isActive'),
                    company_id
                ))
                updated = cur.fetchone()
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Company updated successfully',
                    'company': {
                        'id': updated['id'],
                        'name': updated['name'],
                        'email': updated['email'],
                        'isActive': updated['is_active'],
                        'updatedAt': updated['updated_at'].isoformat()
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Update company error: {e}")
            return jsonify({
                'success': False,
                'error': 'Failed to update company',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Update company request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400


@super_admin_bp.route('/super-admin/companies/<int:company_id>', methods=['DELETE'])
@super_admin_required
def delete_company(company_id):
    """Delete a company and all its related data"""
    conn = get_db_connection()
    if not conn:
        return jsonify({
            'success': False,
            'error': 'Database connection failed',
            'code': 'INTERNAL_ERROR'
        }), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, is_super_admin FROM companies WHERE id = %s
            """, (company_id,))
            company = cur.fetchone()
            
            if not company:
                return jsonify({
                    'success': False,
                    'error': 'Company not found',
                    'code': 'NOT_FOUND'
                }), 404
            
            if company.get('is_super_admin'):
                return jsonify({
                    'success': False,
                    'error': 'Cannot delete platform owner company',
                    'code': 'FORBIDDEN'
                }), 403
            
            cur.execute("SELECT id FROM chat_sessions WHERE company_id = %s", (company_id,))
            session_ids = [row['id'] for row in cur.fetchall()]
            
            if session_ids:
                cur.execute("DELETE FROM chat_messages WHERE session_id = ANY(%s)", (session_ids,))
                cur.execute("DELETE FROM chat_session_files WHERE session_id = ANY(%s)", (session_ids,))
            
            cur.execute("DELETE FROM chat_sessions WHERE company_id = %s", (company_id,))
            
            cur.execute("DELETE FROM audit_logs WHERE company_id = %s", (company_id,))
            
            cur.execute("DELETE FROM users WHERE company_id = %s", (company_id,))
            
            cur.execute("DELETE FROM companies WHERE id = %s", (company_id,))
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'Company "{company["name"]}" and all related data deleted successfully'
            }), 200
            
    except Exception as e:
        conn.rollback()
        print(f"Delete company error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete company. Some related data may still exist.',
            'code': 'INTERNAL_ERROR'
        }), 500
    finally:
        conn.close()


@super_admin_bp.route('/super-admin/companies/<int:company_id>/users', methods=['GET'])
@super_admin_required
def get_company_users(company_id):
    """Get all users for a specific company"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    
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
            'error': 'Database connection failed',
            'code': 'INTERNAL_ERROR'
        }), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify company exists
            cur.execute("SELECT id, name FROM companies WHERE id = %s", (company_id,))
            company = cur.fetchone()
            
            if not company:
                return jsonify({
                    'success': False,
                    'error': 'Company not found',
                    'code': 'NOT_FOUND'
                }), 404
            
            # Get total count
            cur.execute("""
                SELECT COUNT(*) as total FROM users WHERE company_id = %s
            """, (company_id,))
            total_count = cur.fetchone()['total']
            
            # Get users
            cur.execute("""
                SELECT id, first_name, last_name, email, role, phone_number,
                       is_active, created_at, updated_at
                FROM users WHERE company_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """, (company_id, limit, offset))
            users = cur.fetchall()
            
            users_list = [{
                'id': u['id'],
                'firstName': u['first_name'],
                'lastName': u['last_name'],
                'email': u['email'],
                'role': u['role'] or 'user',
                'phoneNumber': u['phone_number'],
                'isActive': u['is_active'],
                'createdAt': u['created_at'].isoformat() if u['created_at'] else None,
                'updatedAt': u['updated_at'].isoformat() if u['updated_at'] else None
            } for u in users]
            
            total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
            
            return jsonify({
                'success': True,
                'company': {
                    'id': company['id'],
                    'name': company['name']
                },
                'users': users_list,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'totalItems': total_count,
                    'totalPages': total_pages,
                    'hasNext': page < total_pages,
                    'hasPrev': page > 1
                }
            }), 200
            
    except Exception as e:
        print(f"Get company users error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch users',
            'code': 'INTERNAL_ERROR'
        }), 500
    finally:
        conn.close()


@super_admin_bp.route('/super-admin/users', methods=['GET'])
@super_admin_required
def get_all_users():
    """Get all users across all companies"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    search = request.args.get('search', '').strip()
    role_filter = request.args.get('role', '').strip().lower()
    company_id = request.args.get('company_id', type=int)
    
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
            'error': 'Database connection failed',
            'code': 'INTERNAL_ERROR'
        }), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_conditions = ["1=1"]
            params = []
            
            if company_id:
                where_conditions.append("u.company_id = %s")
                params.append(company_id)
            
            if search:
                where_conditions.append("""
                    (LOWER(u.first_name) LIKE LOWER(%s) OR 
                     LOWER(u.last_name) LIKE LOWER(%s) OR 
                     LOWER(u.email) LIKE LOWER(%s) OR
                     LOWER(c.name) LIKE LOWER(%s))
                """)
                search_pattern = f'%{search}%'
                params.extend([search_pattern, search_pattern, search_pattern, search_pattern])
            
            if role_filter:
                where_conditions.append("u.role = %s")
                params.append(role_filter)
            
            where_clause = " AND ".join(where_conditions)
            
            # Get total count
            count_query = f"""
                SELECT COUNT(*) as total FROM users u
                LEFT JOIN companies c ON u.company_id = c.id
                WHERE {where_clause}
            """
            cur.execute(count_query, params)
            total_count = cur.fetchone()['total']
            
            # Get users
            query = f"""
                SELECT u.id, u.first_name, u.last_name, u.email, u.role, 
                       u.phone_number, u.is_active, u.created_at, u.updated_at,
                       c.id as company_id, c.name as company_name
                FROM users u
                LEFT JOIN companies c ON u.company_id = c.id
                WHERE {where_clause}
                ORDER BY u.created_at DESC
                LIMIT %s OFFSET %s
            """
            params.extend([limit, offset])
            cur.execute(query, params)
            users = cur.fetchall()
            
            users_list = [{
                'id': u['id'],
                'firstName': u['first_name'],
                'lastName': u['last_name'],
                'email': u['email'],
                'role': u['role'] or 'user',
                'phoneNumber': u['phone_number'],
                'isActive': u['is_active'],
                'companyId': u['company_id'],
                'companyName': u['company_name'],
                'createdAt': u['created_at'].isoformat() if u['created_at'] else None,
                'updatedAt': u['updated_at'].isoformat() if u['updated_at'] else None
            } for u in users]
            
            total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
            
            return jsonify({
                'success': True,
                'users': users_list,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'totalItems': total_count,
                    'totalPages': total_pages,
                    'hasNext': page < total_pages,
                    'hasPrev': page > 1
                }
            }), 200
            
    except Exception as e:
        print(f"Get all users error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch users',
            'code': 'INTERNAL_ERROR'
        }), 500
    finally:
        conn.close()


@super_admin_bp.route('/super-admin/users/<int:user_id>', methods=['PUT'])
@super_admin_required
def update_user(user_id):
    """Update any user"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request data required',
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
                # Check user exists
                cur.execute("SELECT id, role FROM users WHERE id = %s", (user_id,))
                user = cur.fetchone()
                
                if not user:
                    return jsonify({
                        'success': False,
                        'error': 'User not found',
                        'code': 'NOT_FOUND'
                    }), 404
                
                # Build update query
                updates = []
                params = []
                
                if 'firstName' in data:
                    updates.append("first_name = %s")
                    params.append(data['firstName'].strip())
                
                if 'lastName' in data:
                    updates.append("last_name = %s")
                    params.append(data['lastName'].strip())
                
                if 'email' in data:
                    updates.append("email = %s")
                    params.append(data['email'].strip().lower())
                
                if 'role' in data:
                    updates.append("role = %s")
                    params.append(data['role'])
                
                if 'phoneNumber' in data:
                    updates.append("phone_number = %s")
                    params.append(data['phoneNumber'].strip() if data['phoneNumber'] else None)
                
                if 'isActive' in data:
                    updates.append("is_active = %s")
                    params.append(data['isActive'])
                
                if 'companyId' in data:
                    updates.append("company_id = %s")
                    params.append(data['companyId'])
                
                if 'password' in data and data['password']:
                    password_hash = bcrypt.hashpw(
                        data['password'].encode('utf-8'),
                        bcrypt.gensalt()
                    ).decode('utf-8')
                    updates.append("password_hash = %s")
                    params.append(password_hash)
                
                updates.append("updated_at = CURRENT_TIMESTAMP")
                params.append(user_id)
                
                update_query = f"""
                    UPDATE users SET {', '.join(updates)}
                    WHERE id = %s
                    RETURNING id, first_name, last_name, email, role, is_active
                """
                cur.execute(update_query, params)
                updated = cur.fetchone()
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'User updated successfully',
                    'user': {
                        'id': updated['id'],
                        'firstName': updated['first_name'],
                        'lastName': updated['last_name'],
                        'email': updated['email'],
                        'role': updated['role'],
                        'isActive': updated['is_active']
                    }
                }), 200
                
        except Exception as e:
            conn.rollback()
            print(f"Update user error: {e}")
            return jsonify({
                'success': False,
                'error': 'Failed to update user',
                'code': 'INTERNAL_ERROR'
            }), 500
        finally:
            conn.close()
            
    except Exception as e:
        print(f"Update user request error: {e}")
        return jsonify({
            'success': False,
            'error': 'Invalid request data',
            'code': 'VALIDATION_ERROR'
        }), 400


@super_admin_bp.route('/super-admin/users/<int:user_id>', methods=['DELETE'])
@super_admin_required
def delete_user(user_id):
    """Delete any user and all their data (chat history, files, messages)"""
    conn = get_db_connection()
    if not conn:
        return jsonify({
            'success': False,
            'error': 'Database connection failed',
            'code': 'INTERNAL_ERROR'
        }), 500
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check user exists
            cur.execute("SELECT id, email, role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            
            if not user:
                return jsonify({
                    'success': False,
                    'error': 'User not found',
                    'code': 'NOT_FOUND'
                }), 404
            
            # Prevent deleting super admin
            if user['role'] == 'super_admin':
                return jsonify({
                    'success': False,
                    'error': 'Cannot delete super admin user',
                    'code': 'FORBIDDEN'
                }), 403
            
            # Get all chat sessions for this user to delete related data
            cur.execute("SELECT id FROM chat_sessions WHERE user_id = %s", (user_id,))
            session_ids = [row['id'] for row in cur.fetchall()]
            
            deleted_sessions = 0
            deleted_messages = 0
            deleted_files = 0
            
            if session_ids:
                # Delete chat messages for all user's sessions
                cur.execute(
                    "DELETE FROM chat_messages WHERE session_id = ANY(%s)",
                    (session_ids,)
                )
                deleted_messages = cur.rowcount
                
                # Delete chat session files for all user's sessions
                cur.execute(
                    "DELETE FROM chat_session_files WHERE session_id = ANY(%s)",
                    (session_ids,)
                )
                deleted_files = cur.rowcount
                
                # Delete all chat sessions for this user
                cur.execute("DELETE FROM chat_sessions WHERE user_id = %s", (user_id,))
                deleted_sessions = cur.rowcount
            
            # Finally delete the user
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
            
            print(f"🗑️ Deleted user {user['email']}: {deleted_sessions} sessions, {deleted_messages} messages, {deleted_files} files")
            
            return jsonify({
                'success': True,
                'message': f'User "{user["email"]}" and all their data deleted successfully',
                'deletedData': {
                    'sessions': deleted_sessions,
                    'messages': deleted_messages,
                    'files': deleted_files
                }
            }), 200
            
    except Exception as e:
        conn.rollback()
        print(f"Delete user error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete user',
            'code': 'INTERNAL_ERROR'
        }), 500
    finally:
        conn.close()
