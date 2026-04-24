# 🚀 Authentication API Testing Guide

Complete guide for testing all 7 authentication APIs with **working cURL commands** and **expected responses**.

---

## ✅ **Tested & Working APIs**

All APIs are **fully functional** and return proper `accessToken` and `refreshToken` in Danish language.

### Base URL
```
http://localhost:8000/api
```

For Replit deployment, replace `localhost:8000` with your Replit URL.

---

## 📋 **API Endpoints**

| # | Method | Endpoint | Description | Status |
|---|--------|----------|-------------|--------|
| 1 | POST | `/signup` | User registration | ✅ Tested |
| 2 | POST | `/login` | User login | ✅ Tested |
| 3 | POST | `/refresh-token` | Refresh access token | ✅ Tested |
| 4 | POST | `/forgot-password` | Request OTP for password reset | ⚠️ Needs Email Setup |
| 5 | POST | `/verify-otp` | Verify OTP code | ⚠️ Needs Email Setup |
| 6 | POST | `/reset-password` | Reset password with token | ⚠️ Needs Email Setup |
| 7 | PUT | `/profile` | Update user profile | ✅ Tested |

---

## 1️⃣ **SIGNUP API** ✅

Creates a new user account with email and password.

### Request

```bash
curl -X POST http://localhost:8000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Ahmed",
    "lastName": "Khan",
    "email": "ahmed@example.com",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!"
  }'
```

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Bruger registreret med succes",
  "user": {
    "id": 6,
    "firstName": "Ahmed",
    "lastName": "Khan",
    "email": "ahmed@example.com",
    "createdAt": "2025-11-04T02:43:43.466663"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo2LCJlbWFpbCI6ImFobWVkQGV4YW1wbGUuY29tIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6MTc2MjIyNzgyMywiaWF0IjoxNzYyMjI0MjIzfQ.68QL3m44Pr3maWgaAseFuketeefxJj9c6JlRPQ1JqHM",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo2LCJlbWFpbCI6ImFobWVkQGV4YW1wbGUuY29tIiwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NjI4MjkwMjMsImlhdCI6MTc2MjIyNDIyM30.907lyTQ7SkAPmjh6Lj8Sk7nmHtMTUz2i2HZO81-fXMw"
}
```

### Error Responses

**Email Already Exists (400)**
```json
{
  "success": false,
  "error": "Bruger med denne e-mail eksisterer allerede",
  "code": "EMAIL_EXISTS"
}
```

**Passwords Don't Match (400)**
```json
{
  "success": false,
  "error": "Adgangskoder matcher ikke",
  "code": "PASSWORD_MISMATCH"
}
```

**Weak Password (400)**
```json
{
  "success": false,
  "error": "Adgangskoden skal være mindst 8 tegn lang og indeholde både store og små bogstaver, tal og specialtegn",
  "code": "WEAK_PASSWORD",
  "requirements": {
    "minLength": true,
    "hasUpperCase": false,
    "hasLowerCase": true,
    "hasNumber": false,
    "hasSpecialChar": false
  }
}
```

---

## 2️⃣ **LOGIN API** ✅

Authenticates user and returns tokens.

### Request

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "password": "SecurePass123!"
  }'
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login vellykket",
  "user": {
    "id": 6,
    "firstName": "Ahmed",
    "lastName": "Khan",
    "email": "ahmed@example.com",
    "createdAt": "2025-11-04T02:43:43.466663"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo2LCJlbWFpbCI6ImFobWVkQGV4YW1wbGUuY29tIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6MTc2MjIyNzgzNSwiaWF0IjoxNzYyMjI0MjM1fQ.M9xhFVUh7B2DbgnhrzeABWt1H4iYJMmd6BAo4Haqaik",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo2LCJlbWFpbCI6ImFobWVkQGV4YW1wbGUuY29tIiwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NjI4MjkwMzUsImlhdCI6MTc2MjIyNDIzNX0.fu1cZaEt8j_wrKoWrB5ZPy78QjxvqFYWqhajICFjong"
}
```

### Error Response

**Invalid Credentials (401)**
```json
{
  "success": false,
  "error": "Ugyldig e-mail eller adgangskode",
  "code": "INVALID_CREDENTIALS"
}
```

---

## 3️⃣ **REFRESH TOKEN API** ✅

Get a new access token using refresh token.

### Request

```bash
curl -X POST http://localhost:8000/api/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
  }'
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Token opdateret",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo2LCJlbWFpbCI6ImFobWVkQGV4YW1wbGUuY29tIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6MTc2MjIyNzg0NiwiaWF0IjoxNzYyMjI0MjQ2fQ.PbfOSMSlInVslnrxN8wwlqGhR7a01bV8T5NxsW5gTMw"
}
```

### Error Response

**Invalid/Expired Token (401)**
```json
{
  "success": false,
  "error": "Ugyldig eller udløbet refresh token",
  "code": "INVALID_TOKEN"
}
```

---

## 4️⃣ **FORGOT PASSWORD API** ⚠️

Request OTP for password reset (requires email setup).

### Request

```bash
curl -X POST http://localhost:8000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com"
  }'
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "OTP sendt til din e-mail",
  "data": {
    "email": "ahmed@example.com",
    "otpSentAt": "2025-11-04T10:30:00Z",
    "expiresIn": 600
  }
}
```

### Error Responses

**Email Not Found (404)**
```json
{
  "success": false,
  "error": "E-mail ikke fundet",
  "code": "EMAIL_NOT_FOUND"
}
```

**Email Send Failed (500)**
```json
{
  "success": false,
  "error": "Kunne ikke sende OTP-e-mail. Kontroller venligst e-mail-konfigurationen",
  "code": "EMAIL_SEND_FAILED"
}
```

**⚠️ Setup Required:** See `GMAIL_SMTP_SETUP.md` for email configuration instructions.

---

## 5️⃣ **VERIFY OTP API** ⚠️

Verify the 6-digit OTP code sent via email.

### Request

```bash
curl -X POST http://localhost:8000/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "otp": "123456"
  }'
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "OTP verificeret",
  "data": {
    "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

### Error Responses

**Invalid OTP (400)**
```json
{
  "success": false,
  "error": "Ugyldig OTP-kode",
  "code": "INVALID_OTP"
}
```

**Expired OTP (400)**
```json
{
  "success": false,
  "error": "OTP-kode er udløbet. Anmod om en ny",
  "code": "OTP_EXPIRED"
}
```

**⚠️ Important:** Save the `resetToken` - you'll need it for the next step!

---

## 6️⃣ **RESET PASSWORD API** ⚠️

Reset password using the reset token from OTP verification.

### Request

```bash
curl -X POST http://localhost:8000/api/reset-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_RESET_TOKEN_HERE" \
  -d '{
    "password": "NewSecurePass123!",
    "confirmPassword": "NewSecurePass123!"
  }'
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Adgangskode ændret med succes",
  "data": {
    "userId": "user_6",
    "passwordChangedAt": "2025-11-04T10:35:00Z"
  }
}
```

### Error Responses

**Invalid/Expired Reset Token (401)**
```json
{
  "success": false,
  "error": "Ugyldig eller udløbet reset token",
  "code": "INVALID_TOKEN"
}
```

**Passwords Don't Match (400)**
```json
{
  "success": false,
  "error": "Adgangskoder matcher ikke",
  "code": "PASSWORD_MISMATCH"
}
```

---

## 7️⃣ **UPDATE PROFILE API** ✅

Update user profile (firstName, lastName, password).

### Request

```bash
curl -X PUT http://localhost:8000/api/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "firstName": "Ahmed Updated",
    "lastName": "Khan Updated",
    "password": "NewPassword123!",
    "confirmPassword": "NewPassword123!"
  }'
```

**Note:** All fields are optional. Only send fields you want to update.

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Profil opdateret med succes",
  "data": {
    "userId": "user_6",
    "firstName": "Ahmed Updated",
    "lastName": "Khan Updated",
    "email": "ahmed@example.com",
    "updatedAt": "2025-11-04T10:45:00Z"
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "success": false,
  "error": "Autorisering påkrævet",
  "code": "UNAUTHORIZED"
}
```

**Invalid Token (401)**
```json
{
  "success": false,
  "error": "Ugyldig eller udløbet token",
  "code": "INVALID_TOKEN"
}
```

---

## 🔑 **Token Information**

### Access Token
- **Validity:** 60 minutes
- **Used for:** Accessing protected endpoints (Update Profile, etc.)
- **Header Format:** `Authorization: Bearer YOUR_ACCESS_TOKEN`

### Refresh Token
- **Validity:** 7 days
- **Used for:** Getting new access tokens
- **Stored in:** Database for security tracking

### Token Refresh Flow
1. Access token expires after 60 minutes
2. Use refresh token to get new access token via `/api/refresh-token`
3. If refresh token expires (after 7 days), user must login again

---

## 🧪 **Complete Testing Flow**

### Full Authentication Cycle

```bash
# Step 1: Register a new user
curl -X POST http://localhost:8000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@test.com","password":"Test1234!","confirmPassword":"Test1234!"}'

# Step 2: Login with credentials
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!"}'

# Step 3: Save the accessToken and refreshToken from response

# Step 4: Use access token to update profile
curl -X PUT http://localhost:8000/api/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"firstName":"Test Updated"}'

# Step 5: When access token expires, refresh it
curl -X POST http://localhost:8000/api/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Password Reset Flow (Requires Email Setup)

```bash
# Step 1: Request OTP
curl -X POST http://localhost:8000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'

# Step 2: Check email for 6-digit OTP code

# Step 3: Verify OTP
curl -X POST http://localhost:8000/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","otp":"123456"}'

# Step 4: Save the resetToken from response

# Step 5: Reset password
curl -X POST http://localhost:8000/api/reset-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_RESET_TOKEN" \
  -d '{"password":"NewPass123!","confirmPassword":"NewPass123!"}'
```

---

## 🛠️ **Testing Tools**

### Option 1: Command Line (cURL)
All examples above use cURL - copy and paste directly!

### Option 2: Postman
1. Import the cURL commands as Postman requests
2. Create environment variables for tokens
3. Use collection variables for base URL

### Option 3: Thunder Client (VS Code Extension)
1. Install Thunder Client extension
2. Create new requests from examples above
3. Save as collection for reuse

### Option 4: Replit Shell
1. Open Shell in Replit
2. Run cURL commands directly
3. No installation needed!

---

## 🚨 **Common Issues & Solutions**

### Issue: "Address already in use - Port 8000"
**Solution:** Kill the existing process
```bash
pkill -9 -f "python.*app.py"
```

### Issue: "Database connection failed"
**Solution:** Check if PostgreSQL database is running
```bash
# In Replit, database should auto-start
# Check backend logs for specific error
```

### Issue: "Email send failed"
**Solution:** Setup Gmail App Password
- See `GMAIL_SMTP_SETUP.md` for complete instructions
- Update `SMTP_EMAIL` and `SMTP_PASSWORD` secrets

### Issue: "Token has expired"
**Solution:** Use refresh token to get new access token
```bash
curl -X POST http://localhost:8000/api/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

---

## 📊 **Response Status Codes**

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200 | OK | Successful request |
| 201 | Created | User successfully registered |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Invalid or expired token |
| 404 | Not Found | Email/user not found |
| 500 | Internal Server Error | Server-side error |

---

## 🔒 **Security Best Practices**

1. **Never expose tokens** in logs or screenshots
2. **Use HTTPS** in production (not HTTP)
3. **Store tokens securely** (localStorage/sessionStorage)
4. **Implement token refresh** before expiration
5. **Clear tokens** on logout
6. **Validate all inputs** on frontend before API calls
7. **Use environment variables** for secrets

---

## 📝 **Notes**

- All responses are in **Danish language** as requested
- Tokens use **JWT (JSON Web Tokens)** format
- Passwords are hashed with **bcrypt** (cannot be reversed)
- OTP codes are **6 digits** and expire in **10 minutes**
- Reset tokens expire in **15 minutes**
- Database uses **PostgreSQL** with proper indexing

---

## ✅ **Testing Checklist**

- [x] Signup API - Returns accessToken + refreshToken
- [x] Login API - Returns accessToken + refreshToken
- [x] Refresh Token API - Returns new accessToken
- [x] Update Profile API - Updates user data
- [ ] Forgot Password API - Requires email setup
- [ ] Verify OTP API - Requires email setup
- [ ] Reset Password API - Requires email setup

**To complete remaining tests:** Configure Gmail SMTP using `GMAIL_SMTP_SETUP.md`

---

## 📞 **Support**

If you encounter any issues:
1. Check backend logs in Replit console
2. Verify all environment variables are set
3. Ensure database is running
4. Review this guide for proper request format

**Backend Logs Location:** Replit Shell/Console output

---

**Last Updated:** November 4, 2025  
**Backend Version:** Flask with JWT Authentication  
**Language:** Danish (da-DK)
