# Nova Insights Backend API

## Overview
This is a Flask-based REST API backend for the Nova Insights application. It provides authentication, user management, password reset functionality, and file upload features.

## Recent Changes (December 17, 2025)
- Added company details to users (company_name required, other fields optional)
- Added phone_number field to users
- Added filtering to GET /api/admin/users (search, name, email, companyName, phoneNumber, role)
- Added pagination to GET /api/admin/users
- Updated all admin APIs to include company and phone data

## Previous Changes (December 5, 2025)
- Migrated from full-stack to backend-only project
- Removed frontend serving code
- Added API info endpoint at root path
- Added role column to users table
- Configured for Replit environment with port 5000

## Project Architecture

### Directory Structure
```
├── app.py                 # Main Flask application
├── app_auth_routes.py     # Auth routes registration
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── controllers/           # Controller modules
├── middleware/
│   ├── admin_auth.py      # Admin authorization middleware
│   ├── auth_middleware.py # Authentication middleware
│   └── error_handler.py   # Global error handlers
├── routes/
│   ├── admin.py           # Admin CRUD routes
│   ├── auth.py            # Authentication routes
│   ├── forgot_password.py # Password reset request
│   ├── verify_otp.py      # OTP verification
│   ├── reset_password.py  # Password reset
│   └── update_profile.py  # Profile updates
├── utils/
│   ├── database.py        # Database connection & setup
│   ├── email_service.py   # Email/OTP service
│   ├── token_manager.py   # JWT token management
│   └── validators.py      # Input validation
└── public/uploads/        # Uploaded files storage
```

### Database Schema
- **users**: id, first_name, last_name, email, password_hash, role, phone_number, company_name, company_address, company_website, company_industry, company_size, created_at, updated_at
- **password_reset_otps**: id, user_id, otp_code, created_at, expires_at, is_used, used_at
- **refresh_tokens**: id, user_id, token_hash, created_at, expires_at, is_revoked

### API Endpoints

#### Authentication
- `POST /api/signup` - Register new user
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/verify-token` - Verify JWT token
- `POST /api/refresh-token` - Refresh access token

#### Password Reset
- `POST /api/forgot-password` - Request password reset OTP
- `POST /api/verify-otp` - Verify OTP code
- `POST /api/reset-password` - Reset password with OTP

#### Profile
- `PUT /api/update-profile` - Update user profile

#### Admin (Admin only)
- `GET /api/admin/users` - Get all users with filtering and pagination
  - Query params: page, limit, search, name, email, companyName, phoneNumber, role
- `POST /api/admin/users` - Create user (companyName required)
- `GET /api/admin/users/:id` - Get single user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

#### Files
- `POST /api/upload-files` - Upload files
- `GET /uploads/:filename` - Get uploaded file

#### Health
- `GET /api/health` - Health check

## User Response Format
```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "role": "user",
  "phoneNumber": "+45 12345678",
  "company": {
    "name": "Acme Corp",
    "address": "123 Main St",
    "website": "https://acme.com",
    "industry": "Technology",
    "size": "50-100"
  },
  "createdAt": "2025-12-17T10:00:00",
  "updatedAt": "2025-12-17T10:00:00"
}
```

## Create User Request
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "user",
  "phoneNumber": "+45 12345678",
  "companyName": "Acme Corp",
  "company": {
    "address": "123 Main St",
    "website": "https://acme.com",
    "industry": "Technology",
    "size": "50-100"
  }
}
```

## Pagination Response Format
```json
{
  "success": true,
  "users": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `JWT_SECRET` - Secret key for JWT tokens

## Default Admin User
- Email: admin@nordicai.dk
- Password: Admin@123

## Running the Project
The backend runs automatically via the "Backend API" workflow on port 5000.

## Technologies
- Python 3.11
- Flask 2.3.3
- PostgreSQL (psycopg2-binary)
- JWT (PyJWT)
- bcrypt for password hashing
- Flask-CORS for cross-origin requests
