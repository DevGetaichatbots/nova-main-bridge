# Authentication API Documentation

## Overview
Complete authentication system with JWT access/refresh tokens, OTP-based password reset, and profile management.

## Base URL
`http://your-domain.com/api`

---

## Authentication Endpoints

### 1. User Signup
**Endpoint:** `POST /signup`

**Request Body:**
```json
{
  "firstName": "Anders",
  "lastName": "Andersen",
  "email": "anders@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Bruger registreret med succes",
  "user": {
    "id": 1,
    "firstName": "Anders",
    "lastName": "Andersen",
    "email": "anders@example.com",
    "createdAt": "2025-11-04T10:00:00"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

### 2. User Login
**Endpoint:** `POST /login`

**Request Body:**
```json
{
  "email": "anders@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login vellykket",
  "user": {
    "id": 1,
    "firstName": "Anders",
    "lastName": "Andersen",
    "email": "anders@example.com",
    "createdAt": "2025-11-04T10:00:00"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

### 3. Refresh Access Token
**Endpoint:** `POST /refresh-token`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token opdateret",
  "accessToken": "eyJhbGc..."
}
```

---

## Password Reset Flow

### 4. Forgot Password (Send OTP)
**Endpoint:** `POST /forgot-password`

**Request Body:**
```json
{
  "email": "anders@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sendt til din e-mail",
  "data": {
    "email": "anders@example.com",
    "otpSentAt": "2025-11-04T10:30:00Z",
    "expiresIn": 600
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "E-mail ikke fundet",
  "code": "EMAIL_NOT_FOUND"
}
```

---

### 5. Verify OTP
**Endpoint:** `POST /verify-otp`

**Request Body:**
```json
{
  "email": "anders@example.com",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP verificeret",
  "data": {
    "resetToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Error Responses:**
- **400:** Invalid OTP
- **410:** OTP expired

---

### 6. Reset Password
**Endpoint:** `POST /reset-password`

**Headers:**
```
Authorization: Bearer {resetToken}
```

**Request Body:**
```json
{
  "password": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Adgangskode ændret med succes",
  "data": {
    "userId": "user_1",
    "passwordChangedAt": "2025-11-04T10:35:00Z"
  }
}
```

---

## Profile Management

### 7. Update Profile
**Endpoint:** `PUT /profile`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "firstName": "Anders",
  "lastName": "Andersen",
  "password": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Note:** All fields are optional. Email cannot be changed.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profil opdateret med succes",
  "data": {
    "userId": "user_1",
    "firstName": "Anders",
    "lastName": "Andersen",
    "email": "anders@example.com",
    "updatedAt": "2025-11-04T10:45:00Z"
  }
}
```

---

## Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

---

## Token System
- **Access Token:** Valid for 60 minutes
- **Refresh Token:** Valid for 7 days
- **Reset Token:** Valid for 15 minutes

---

## Error Codes
| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request data validation failed |
| `UNAUTHORIZED` | Missing or invalid authentication token |
| `EMAIL_NOT_FOUND` | Email address not registered |
| `EMAIL_EXISTS` | Email already registered |
| `INVALID_CREDENTIALS` | Wrong email or password |
| `INVALID_OTP` | OTP code is incorrect |
| `OTP_EXPIRED` | OTP has expired (10 minutes) |
| `PASSWORD_MISMATCH` | Passwords don't match |
| `WEAK_PASSWORD` | Password doesn't meet requirements |
| `INVALID_TOKEN` | Token is invalid or expired |
| `INTERNAL_ERROR` | Server error |

---

## Environment Variables Required

```env
# JWT Secrets
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# SMTP Configuration for OTP Emails
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Database (automatically configured in Replit)
DATABASE_URL=postgresql://...
```

---

## File Structure

```
backend/
├── routes/
│   ├── auth.py               # Signup, Login, Refresh Token
│   ├── forgot_password.py    # Send OTP
│   ├── verify_otp.py         # Verify OTP
│   ├── reset_password.py     # Reset Password
│   └── update_profile.py     # Update Profile
├── middleware/
│   ├── auth_middleware.py    # Authentication middleware
│   └── error_handler.py      # Global error handler
├── utils/
│   ├── database.py           # Database connection & initialization
│   ├── email_service.py      # OTP email sender
│   ├── token_manager.py      # JWT token management
│   └── validators.py         # Input validators
├── app.py                     # Main Flask app (original APIs)
└── app_auth_routes.py        # New routes registration
```

---

## Testing the APIs

### Using cURL:

**1. Signup:**
```bash
curl -X POST http://localhost:8000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "TestPass123!",
    "confirmPassword": "TestPass123!"
  }'
```

**2. Forgot Password:**
```bash
curl -X POST http://localhost:8000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**3. Verify OTP:**
```bash
curl -X POST http://localhost:8000/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

**4. Reset Password:**
```bash
curl -X POST http://localhost:8000/api/reset-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {resetToken}" \
  -d '{
    "password": "NewPass123!",
    "confirmPassword": "NewPass123!"
  }'
```

**5. Update Profile:**
```bash
curl -X PUT http://localhost:8000/api/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {accessToken}" \
  -d '{
    "firstName": "Updated",
    "lastName": "Name"
  }'
```

---

## Notes
- All responses are in Danish as per requirements
- OTP codes are 6 digits and expire after 10 minutes
- Access tokens expire after 60 minutes
- Refresh tokens expire after 7 days
- Email cannot be changed after registration
- Password requirements are enforced on all password operations
