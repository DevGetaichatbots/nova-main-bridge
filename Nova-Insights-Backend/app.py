from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import jwt
import os
from datetime import datetime, timedelta
import re
import requests
from werkzeug.utils import secure_filename
import uuid
import sys

sys.path.insert(0, os.path.dirname(__file__))

app = Flask(__name__)

ALLOWED_ORIGINS = []
replit_dev_domain = os.getenv('REPLIT_DEV_DOMAIN', '')
if replit_dev_domain:
    ALLOWED_ORIGINS.append(f"https://{replit_dev_domain}")

replit_domains = os.getenv('REPLIT_DOMAINS', '')
if replit_domains:
    for domain in replit_domains.split(','):
        domain = domain.strip()
        if domain:
            ALLOWED_ORIGINS.append(f"https://{domain}")

ALLOWED_ORIGINS.extend(["http://localhost:5000", "http://localhost:5173"])

CORS(app,
     origins=ALLOWED_ORIGINS,
     allow_headers=[
         'Content-Type', 'Authorization', 'X-Requested-With'
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     supports_credentials=True)


@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    return response

# Configuration - JWT Secret (REQUIRED)
JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    print("\n" + "="*70)
    print("🚨 CRITICAL ERROR: JWT_SECRET environment variable is not set!")
    print("="*70)
    print("\nThe application cannot start without a secure JWT secret.")
    print("\nTo fix this:")
    print("1. Generate a secure random secret:")
    print("   python3 -c \"import secrets; print(secrets.token_urlsafe(48))\"")
    print("\n2. Set it in Replit Secrets:")
    print("   - Go to Tools → Secrets")
    print("   - Add new secret: JWT_SECRET")
    print("   - Paste the generated value")
    print("\n3. Restart the backend workflow")
    print("\nFor more details, see: backend/ENVIRONMENT_SETUP.md")
    print("="*70 + "\n")
    sys.exit(1)

app.config['SECRET_KEY'] = JWT_SECRET

# Database configuration - prioritize DATABASE_URL for Replit
DATABASE_URL = os.getenv('DATABASE_URL')
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'postgres'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', ''),
    'port': os.getenv('DB_PORT', 5432)
}


def get_db_connection():
    """Create a database connection"""
    try:
        # First try to use DATABASE_URL (Replit's standard)
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            conn = psycopg2.connect(database_url)
            return conn

        # Fallback to individual environment variables
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'database': os.getenv('DB_NAME', 'postgres'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', ''),
            'port': os.getenv('DB_PORT', 5432)
        }
        conn = psycopg2.connect(**db_config)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None


def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"


def create_tables():
    """Create users table if it doesn't exist"""
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            """)
            conn.commit()
            return True
    except Exception as e:
        print(f"Error creating tables: {e}")
        return False
    finally:
        conn.close()


def seed_admin_user():
    """Create Nordic Construction A/S as super admin company and default admin user"""
    conn = get_db_connection()
    if not conn:
        print("❌ Cannot seed admin: Database connection failed")
        return False

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Add is_super_admin column to companies table if not exists
            cur.execute("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name='companies' AND column_name='is_super_admin') THEN
                        ALTER TABLE companies ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
                    END IF;
                END $$;
            """)
            
            # Check if Nordic Construction A/S company already exists
            cur.execute("SELECT id FROM companies WHERE email = %s", ('admin@nordicai.dk',))
            existing_company = cur.fetchone()
            
            if existing_company:
                company_id = existing_company['id']
                print("ℹ️  Nordic Construction A/S company already exists")
            else:
                # Create Nordic Construction A/S as super admin company
                cur.execute("""
                    INSERT INTO companies (name, email, phone_number, is_active, is_super_admin)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, ('Nordic Construction A/S', 'admin@nordicai.dk', '+45 12345678', True, True))
                company_id = cur.fetchone()['id']
                print("✅ Nordic Construction A/S company created successfully")
            
            # Check if admin user already exists
            cur.execute("SELECT id FROM users WHERE email = %s", ('admin@nordicai.dk',))
            existing_user = cur.fetchone()
            
            if existing_user:
                # Update existing admin user to have super_admin role and link to company
                cur.execute("""
                    UPDATE users SET role = 'super_admin', company_id = %s 
                    WHERE email = %s
                """, (company_id, 'admin@nordicai.dk'))
                conn.commit()
                print("ℹ️  Admin user updated to super_admin role")
                return True
            
            # Create admin user with secure password hash
            admin_password = 'Admin@123'
            password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cur.execute("""
                INSERT INTO users (first_name, last_name, email, password_hash, role, company_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, ('Nordic', 'Admin', 'admin@nordicai.dk', password_hash, 'super_admin', company_id))
            
            conn.commit()
            print("✅ Super Admin user created successfully (admin@nordicai.dk)")
            return True
            
    except Exception as e:
        print(f"❌ Error seeding admin user: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()




@app.route('/api/verify-token', methods=['POST'])
def verify_token():
    """Verify JWT token endpoint"""
    try:
        token = None
        data = request.get_json() or {}
        token = data.get('token')
        
        if not token:
            token = request.cookies.get('accessToken')

        if not token:
            return jsonify({
                'success': False,
                'message': 'Token is required'
            }), 400

        try:
            from utils.token_manager import is_token_blacklisted
            if is_token_blacklisted(token):
                return jsonify({'success': False, 'message': 'Token has been revoked'}), 401
            
            payload = jwt.decode(token,
                                 app.config['SECRET_KEY'],
                                 algorithms=['HS256'])

            # Get user details from database
            conn = get_db_connection()
            if not conn:
                return jsonify({
                    'success': False,
                    'message': 'Database connection failed'
                }), 500

            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT id, first_name, last_name, email, created_at
                        FROM users WHERE id = %s
                    """, (payload['user_id'], ))

                    user = cur.fetchone()

                    if not user:
                        return jsonify({
                            'success': False,
                            'message': 'User not found'
                        }), 404

                    return jsonify({
                        'success': True,
                        'user': {
                            'id': user['id'],
                            'firstName': user['first_name'],
                            'lastName': user['last_name'],
                            'email': user['email'],
                            'createdAt': user['created_at'].isoformat()
                        }
                    }), 200
            finally:
                conn.close()

        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'message': 'Token has expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token'}), 401

    except Exception as e:
        print(f"Token verification error: {e}")
        return jsonify({
            'success': False,
            'message': 'Token verification failed'
        }), 400


@app.route('/api/logout', methods=['POST'])
def logout():
    """User logout endpoint with token blacklisting"""
    try:
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
            resp = jsonify({'success': True, 'message': 'Logout successful'})
            resp.delete_cookie('accessToken', path='/')
            resp.delete_cookie('refreshToken', path='/api/')
            return resp, 200

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload.get('user_id')
            
            from utils.redis_client import cache_set
            from utils.token_manager import hash_token
            token_hash = hash_token(token)
            exp = payload.get('exp', 0)
            import time
            ttl = max(int(exp - time.time()), 0)
            if ttl > 0:
                cache_set(f"token_blacklist:{token_hash}", "1", ex=ttl)
            
            if user_id:
                conn = get_db_connection()
                if conn:
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = %s AND is_revoked = FALSE",
                                (user_id,)
                            )
                            conn.commit()
                    except Exception as e:
                        print(f"Error revoking refresh tokens: {e}")
                        conn.rollback()
                    finally:
                        conn.close()
                
                from utils.redis_client import cache_delete
                cache_delete(f"user_profile:{user_id}")

            from utils.audit_logger import log_audit_event
            log_audit_event(
                event_type='logout',
                actor_user_id=user_id,
                event_description=f"User logged out"
            )

            resp = jsonify({'success': True, 'message': 'Logout successful'})
            resp.delete_cookie('accessToken', path='/')
            resp.delete_cookie('refreshToken', path='/api/')
            return resp, 200

        except jwt.ExpiredSignatureError:
            resp = jsonify({'success': True, 'message': 'Logout successful'})
            resp.delete_cookie('accessToken', path='/')
            resp.delete_cookie('refreshToken', path='/api/')
            return resp, 200
        except jwt.InvalidTokenError:
            resp = jsonify({'success': False, 'message': 'Invalid token'})
            resp.delete_cookie('accessToken', path='/')
            resp.delete_cookie('refreshToken', path='/api/')
            return resp, 401

    except Exception as e:
        print(f"Logout error: {e}")
        return jsonify({'success': False, 'message': 'Logout failed. Please try again.'}), 500




@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    # Test database connection
    db_status = "connected"
    try:
        conn = get_db_connection()
        if conn:
            conn.close()
        else:
            db_status = "failed"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return jsonify({
        'success': True,
        'message': 'Backend is running',
        'database_status': db_status,
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@app.route('/api/upload-files', methods=['POST'])
def upload_files():
    """File upload endpoint - returns file URLs"""
    try:
        file_urls = []
        files = request.files
        
        if not files:
            return jsonify({
                'success': True,
                'fileUrls': []
            }), 200
        
        upload_dir = os.path.join('public', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        for key in files:
            file = files[key]
            if file and file.filename:
                # Generate unique filename
                file_ext = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                file_path = os.path.join(upload_dir, unique_filename)
                
                # Save file
                file.save(file_path)
                
                # Generate public URL based on request domain (works for dev and production)
                # Get the actual domain from the incoming request
                host = request.host
                scheme = request.scheme  # http or https
                file_url = f"{scheme}://{host}/uploads/{unique_filename}"
                file_urls.append(file_url)
        
        return jsonify({
            'success': True,
            'fileUrls': file_urls
        }), 200
            
    except Exception as e:
        print(f"File upload error: {e}")
        return jsonify({
            'success': False,
            'message': f'File upload failed: {str(e)}'
        }), 500


@app.route('/uploads/<filename>')
def serve_upload(filename):
    """Serve uploaded files"""
    upload_dir = os.path.join('public', 'uploads')
    return send_from_directory(upload_dir, filename)


# --- NAYA CODE YAHAN KHATAM HOTA HAI ---

# --- Production Static File Serving ---
# Get the path to the frontend dist folder (one level up from Nova-Insights-Backend)
FRONTEND_DIST_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dist')

@app.route('/api')
@app.route('/api/')
def api_info():
    """API root endpoint - shows available endpoints"""
    return jsonify({
        'success': True,
        'message': 'Nova Insights Backend API',
        'version': '1.0.0',
        'endpoints': {
            'auth': {
                'POST /api/signup': 'Register new user',
                'POST /api/login': 'User login',
                'POST /api/logout': 'User logout',
                'POST /api/verify-token': 'Verify JWT token',
                'POST /api/refresh-token': 'Refresh access token'
            },
            'password_reset': {
                'POST /api/forgot-password': 'Request password reset OTP',
                'POST /api/verify-otp': 'Verify OTP code',
                'POST /api/reset-password': 'Reset password with OTP'
            },
            'profile': {
                'PUT /api/update-profile': 'Update user profile'
            },
            'admin': {
                'GET /api/admin/users': 'Get all users (Admin only)',
                'POST /api/admin/users': 'Create user (Admin only)',
                'GET /api/admin/users/:id': 'Get single user (Admin only)',
                'PUT /api/admin/users/:id': 'Update user (Admin only)',
                'DELETE /api/admin/users/:id': 'Delete user (Admin only)'
            },
            'company': {
                'POST /api/company/register': 'Register new company with owner',
                'GET /api/company/users': 'Get company users (Company owner only)',
                'POST /api/company/users': 'Create company user (Company owner only)',
                'PUT /api/company/users/:id': 'Update company user (Company owner only)',
                'DELETE /api/company/users/:id': 'Delete company user (Company owner only)',
                'GET /api/company/info': 'Get company info (Company owner only)',
                'PUT /api/company/info': 'Update company info (Company owner only)'
            },
            'files': {
                'POST /api/upload-files': 'Upload files',
                'GET /uploads/:filename': 'Get uploaded file'
            },
            'health': {
                'GET /api/health': 'Health check'
            }
        }
    }), 200


@app.route('/api/redis/health', methods=['GET'])
def redis_health():
    """Check Redis connection status"""
    try:
        from utils.redis_client import test_connection, get_redis_client
        client = get_redis_client()
        
        if not client:
            return jsonify({
                'status': 'disconnected',
                'message': 'Redis client not initialized - check credentials'
            }), 503
        
        if test_connection():
            return jsonify({
                'status': 'connected',
                'message': 'Redis connection successful'
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': 'Redis connection test failed'
            }), 503
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve frontend files in production"""
    # Skip API routes and uploads - they are handled by other routes
    if path.startswith('api/') or path.startswith('api') or path.startswith('uploads/'):
        return jsonify({'error': 'Not found'}), 404
    
    # Check if dist folder exists
    if not os.path.exists(FRONTEND_DIST_PATH):
        return jsonify({'error': 'Frontend build not found. Run npm run build first.'}), 500
    
    # Try to serve the requested file
    file_path = os.path.join(FRONTEND_DIST_PATH, path)
    if path and os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIST_PATH, path)
    
    # For all other routes, serve index.html (SPA routing)
    response = send_from_directory(FRONTEND_DIST_PATH, 'index.html')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


# Initialize database and routes (runs on both direct execution and Gunicorn import)
def initialize_app():
    """Initialize database tables and register routes"""
    print("Creating database tables...")
    if create_tables():
        print("✅ Database tables created successfully")
    else:
        print("❌ Failed to create database tables")
    
    from utils.database import init_database
    print("Initializing authentication database tables...")
    if init_database():
        print("✅ Authentication tables created successfully")
    else:
        print("❌ Failed to create authentication tables")
    
    # Seed admin user for production
    print("Checking admin user...")
    seed_admin_user()
    
    from app_auth_routes import register_auth_routes
    register_auth_routes(app)

# Run initialization when module is loaded (for Gunicorn)
initialize_app()

if __name__ == '__main__':
    # Run the Flask app on port 8000 for development
    print("🚀 Starting Flask backend on 0.0.0.0:8000 (development mode)")
    app.run(host='0.0.0.0', port=8000, debug=False)
