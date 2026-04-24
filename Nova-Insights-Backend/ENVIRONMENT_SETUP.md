# 🔧 Environment Variables Setup Guide

Complete guide for configuring all required and optional environment variables for the authentication system.

---

## 🚨 **REQUIRED Environment Variables**

These environment variables are **MANDATORY** for production deployment:

### 1. **JWT_SECRET** ⚠️ CRITICAL
Secret key for signing JSON Web Tokens (JWTs).

**Security Level:** 🔴 **CRITICAL**

**Purpose:**
- Signs access tokens (60-minute validity)
- Signs refresh tokens (7-day validity)
- Prevents token forgery

**How to Set:**

#### Option 1: Generate Secure Random String (Recommended)
```bash
# Generate a 64-character random string
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

#### Option 2: Use OpenSSL
```bash
openssl rand -base64 48
```

#### Option 3: Use pwgen
```bash
pwgen -s 64 1
```

**Example Value:**
```
JWT_SECRET=8kF9xN2mP5wQ7vB3dE6gH1jK4lM0oR8sT2uV5yW9zA3cD7fG1hJ4kL6mN9pQ2rS5tU8vX1yZ4aB7cE0dF3gH6jK9lM2nP5qR8sT1uW4vX7yZ0aC3bD6eG9fH2iJ5kL8mN1oP4qR7sT0uV3wX6yZ9
```

**⚠️ Security Warning:**
- Never use predictable values like `'secret'`, `'password123'`, or `'your-secret-key-here'`
- Never commit JWT_SECRET to version control
- Never share JWT_SECRET in screenshots or logs
- Use different secrets for development and production

**In Replit:**
1. Go to **Tools** → **Secrets**
2. Add new secret: `JWT_SECRET`
3. Paste your generated random string
4. Click **Add Secret**

**What Happens If Not Set:**
- ⚠️ App will generate a random secret on startup (development only)
- ⚠️ All tokens will be invalidated on server restart
- ⚠️ Users will be logged out every time you redeploy
- 🚫 **NOT ACCEPTABLE FOR PRODUCTION!**

---

### 2. **JWT_REFRESH_SECRET** (Optional but Recommended)
Separate secret key for signing refresh tokens.

**Security Level:** 🟡 **RECOMMENDED**

**Purpose:**
- Provides additional security by using separate keys
- Limits damage if access token secret is compromised
- Best practice for token security

**How to Set:**
```bash
# Generate a different secret from JWT_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

**Default Behavior:**
- If not set, uses `JWT_SECRET` for refresh tokens too
- Less secure but functional

**Recommended Setup:**
```
JWT_SECRET=8kF9xN2mP5wQ7vB3dE6gH1jK4lM0oR...  # For access tokens
JWT_REFRESH_SECRET=2rS5tU8vX1yZ4aB7cE0dF3gH6jK...  # For refresh tokens (different!)
```

---

## 📧 **Email Configuration (For Password Reset)**

Required for Forgot Password, Verify OTP, and Reset Password features.

### 3. **SMTP_EMAIL** ⚠️ REQUIRED
Your Gmail address for sending emails.

**Example:**
```
SMTP_EMAIL=your.email@gmail.com
```

**Note:** Must be a valid Gmail address.

---

### 4. **SMTP_PASSWORD** ⚠️ REQUIRED
Gmail App Password (NOT your regular Gmail password).

**⚠️ CRITICAL:** Google no longer allows regular passwords for SMTP!

**How to Get:**
1. Enable 2-Step Verification on your Google Account
2. Go to [Google Account Security](https://myaccount.google.com/security)
3. Click **App passwords** (under "Signing in to Google")
4. Select **Mail** → **Other (Custom name)**
5. Enter a name like "Flask Backend"
6. Click **Generate**
7. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
8. **Remove all spaces**: `abcdefghijklmnop`

**Example:**
```
SMTP_PASSWORD=abcdefghijklmnop
```

**Detailed Setup:** See `GMAIL_SMTP_SETUP.md` for step-by-step instructions.

---

### 5. **SMTP_HOST** (Optional)
SMTP server hostname.

**Default:** `smtp.gmail.com`

**When to Set:**
- Using a different email provider (SendGrid, Mailgun, AWS SES)

**Examples:**
```bash
# Gmail (default)
SMTP_HOST=smtp.gmail.com

# SendGrid
SMTP_HOST=smtp.sendgrid.net

# Mailgun
SMTP_HOST=smtp.mailgun.org

# AWS SES
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
```

---

### 6. **SMTP_PORT** (Optional)
SMTP server port.

**Default:** `587`

**Common Values:**
- `587` - TLS (recommended)
- `465` - SSL
- `25` - Unencrypted (not recommended)

**When to Set:**
- Using a different email provider with custom port

---

## 🗄️ **Database Configuration**

### 7. **DATABASE_URL** (Replit Auto-Configured)
Full PostgreSQL connection string.

**Format:**
```
DATABASE_URL=postgresql://username:password@host:port/database
```

**In Replit:**
- Automatically set when you create a PostgreSQL database
- No manual configuration needed
- Just use the "Database" tool in Replit

**Example:**
```
DATABASE_URL=postgresql://postgres:password@db.replit.dev:5432/file_comparison
```

---

### Alternative Database Variables (If DATABASE_URL not available)

### 8. **DB_HOST**
Database server hostname.

**Default:** `localhost`

**Example:** `db.replit.dev` or `127.0.0.1`

---

### 9. **DB_NAME**
Database name.

**Default:** `postgres`

**Example:** `file_comparison_db`

---

### 10. **DB_USER**
Database username.

**Default:** `postgres`

---

### 11. **DB_PASSWORD**
Database password.

**Default:** Empty string

---

### 12. **DB_PORT**
Database port number.

**Default:** `5432` (PostgreSQL default)

---

## 📝 **Complete Environment Variables Checklist**

### For Basic Authentication (No Email)
```bash
✅ JWT_SECRET=<64-character-random-string>
✅ DATABASE_URL=<auto-configured-in-replit>
```

### For Full Authentication (With Email)
```bash
✅ JWT_SECRET=<64-character-random-string>
🟡 JWT_REFRESH_SECRET=<different-64-character-random-string>
✅ SMTP_EMAIL=your.email@gmail.com
✅ SMTP_PASSWORD=<gmail-app-password-no-spaces>
✅ DATABASE_URL=<auto-configured-in-replit>
```

### Optional (Advanced)
```bash
⚪ SMTP_HOST=smtp.gmail.com
⚪ SMTP_PORT=587
⚪ DB_HOST=localhost
⚪ DB_NAME=postgres
⚪ DB_USER=postgres
⚪ DB_PASSWORD=
⚪ DB_PORT=5432
```

---

## 🔐 **Security Best Practices**

### 1. **Never Commit Secrets**
❌ **DO NOT:**
```python
JWT_SECRET = "my-secret-key"  # WRONG!
```

✅ **DO:**
```python
JWT_SECRET = os.getenv('JWT_SECRET')  # CORRECT!
```

### 2. **Use Different Secrets for Environments**
```
Development:  JWT_SECRET=dev_secret_123...
Staging:      JWT_SECRET=stg_secret_456...
Production:   JWT_SECRET=prd_secret_789...
```

### 3. **Rotate Secrets Periodically**
- Change JWT_SECRET every 6 months
- Change SMTP_PASSWORD yearly
- Immediately rotate if compromised

### 4. **Store Secrets Securely**
- Use Replit Secrets (encrypted storage)
- Use environment variables
- Never hardcode in source files
- Never log secret values

### 5. **Minimum Secret Length**
- **JWT_SECRET:** Minimum 32 characters, recommended 64+
- **SMTP_PASSWORD:** Use Gmail's generated 16-character App Password

---

## 🧪 **Testing Your Configuration**

### Test JWT Secret
```bash
# Check if JWT_SECRET is set
echo $JWT_SECRET

# Should output your secret (if set in current shell)
# OR check backend logs on startup
```

### Test SMTP Configuration
```bash
# Use the Forgot Password API
curl -X POST http://localhost:8000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check response - should NOT say "EMAIL_SEND_FAILED"
```

### Test Database Connection
```bash
# Use the health check endpoint
curl http://localhost:8000/api/health

# Response should show:
# "database_status": "connected"
```

---

## ⚠️ **Common Errors & Solutions**

### Error: "JWT_SECRET not set"
**Cause:** Missing JWT_SECRET environment variable

**Solution:**
1. Generate a random secret: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
2. Add to Replit Secrets: `JWT_SECRET=<generated-value>`
3. Restart backend workflow

---

### Error: "Email send failed"
**Cause:** Invalid SMTP credentials or Gmail App Password not set

**Solution:**
1. Follow `GMAIL_SMTP_SETUP.md` to generate App Password
2. Set `SMTP_EMAIL` and `SMTP_PASSWORD` in Replit Secrets
3. Make sure App Password has NO SPACES
4. Restart backend workflow

---

### Error: "Database connection failed"
**Cause:** PostgreSQL database not running or DATABASE_URL not set

**Solution:**
1. In Replit, go to **Database** tool
2. Create a PostgreSQL database
3. DATABASE_URL will be auto-configured
4. Restart backend workflow

---

### Error: "Tokens invalidated after restart"
**Cause:** JWT_SECRET changes on each restart (auto-generated)

**Solution:**
1. Set a permanent JWT_SECRET in Replit Secrets
2. Never rely on auto-generated secrets in production

---

## 📊 **Environment Variables Priority**

The backend checks environment variables in this order:

**Database:**
1. `DATABASE_URL` (if set, uses this)
2. Falls back to individual variables: `DB_HOST`, `DB_NAME`, etc.

**JWT:**
1. `JWT_SECRET` (if set, uses this)
2. Falls back to auto-generated random secret (development only)

**SMTP:**
1. `SMTP_HOST` (if set, uses this)
2. Falls back to `smtp.gmail.com`

---

## 🚀 **Quick Start Checklist**

### For Development (Minimum)
- [ ] Set `JWT_SECRET` (or accept auto-generated warning)
- [ ] Database will auto-connect in Replit

### For Production (Required)
- [ ] Generate and set `JWT_SECRET` (64+ characters)
- [ ] Set `JWT_REFRESH_SECRET` (different from JWT_SECRET)
- [ ] Configure SMTP credentials (for email features)
- [ ] Verify DATABASE_URL is set
- [ ] Test all endpoints
- [ ] Review security checklist

---

## 📞 **Need Help?**

### Useful Commands

**List all environment variables:**
```bash
env | grep -E "JWT|SMTP|DB"
```

**Generate JWT secret:**
```bash
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48))"
```

**Check if backend can access secrets:**
```bash
python3 -c "import os; print('JWT_SECRET:', 'SET' if os.getenv('JWT_SECRET') else 'NOT SET')"
```

---

## 📚 **Related Documentation**

- **API Testing:** See `API_TESTING_GUIDE.md`
- **Gmail SMTP Setup:** See `GMAIL_SMTP_SETUP.md`
- **Complete API Docs:** See `AUTH_API_README.md`

---

**Last Updated:** November 4, 2025  
**Backend Version:** Flask with JWT Authentication  
**Security Level:** Production-Ready with proper configuration
