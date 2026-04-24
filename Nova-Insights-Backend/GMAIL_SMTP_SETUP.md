# Gmail SMTP Setup Instructions

## ⚠️ Important Note
Google Gmail **no longer allows** using your regular Gmail password for SMTP authentication. You **MUST** use an **App Password** instead.

## 📋 Prerequisites
- A Gmail account
- 2-Step Verification enabled on your Google account

---

## 🔧 Step-by-Step Setup

### Step 1: Enable 2-Step Verification

1. Go to your [Google Account Security Settings](https://myaccount.google.com/security)
2. Under "Signing in to Google", click on **2-Step Verification**
3. Follow the prompts to enable 2-Step Verification if not already enabled
4. You'll need your phone number to receive verification codes

### Step 2: Generate App Password

1. Go to your [Google Account Security Settings](https://myaccount.google.com/security)
2. Under "Signing in to Google", click on **App passwords**
   - If you don't see this option, make sure 2-Step Verification is enabled first
3. Click **Select app** → Choose **"Mail"**
4. Click **Select device** → Choose **"Other (Custom name)"**
5. Enter a name like "Flask Backend Authentication" or "File Comparison App"
6. Click **Generate**
7. Google will display a **16-character password** (e.g., `abcd efgh ijkl mnop`)
8. **Copy this password immediately** - you won't be able to see it again!

### Step 3: Update Replit Secrets

1. In your Replit project, go to **Tools** → **Secrets**
2. Update the following secrets:
   - **SMTP_EMAIL**: Your full Gmail address (e.g., `your.email@gmail.com`)
   - **SMTP_PASSWORD**: The 16-character App Password you just generated
     - ⚠️ **Remove all spaces** from the password (e.g., `abcdefghijklmnop`)

**Example:**
```
SMTP_EMAIL=ahmed.khan@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
```

### Step 4: Verify Configuration

The backend uses these environment variables automatically:
- `SMTP_EMAIL` - Your Gmail address
- `SMTP_PASSWORD` - Your App Password
- `SMTP_HOST` - Defaults to `smtp.gmail.com` (no need to set)
- `SMTP_PORT` - Defaults to `587` (no need to set)

---

## ✅ Testing Email Functionality

After setup, test the email functionality using the **Forgot Password API**:

```bash
curl -X POST http://localhost:8000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sendt til din e-mail",
  "data": {
    "email": "test@example.com",
    "otpSentAt": "2025-11-04T10:30:00Z",
    "expiresIn": 600
  }
}
```

Check your email inbox - you should receive an email with a 6-digit OTP code.

---

## 🚨 Common Errors & Solutions

### Error: "Username and Password not accepted"
**Solution:** You're using your regular Gmail password instead of an App Password.
- Generate a new App Password and use that instead

### Error: "535-5.7.8 Username and Password not accepted"
**Solution:** The App Password might have spaces in it.
- Remove all spaces from the password when adding to secrets

### Error: "Application-specific password required"
**Solution:** 2-Step Verification is not enabled.
- Enable 2-Step Verification first, then generate App Password

### Error: "SMTP connection failed"
**Solution:** Check your internet connection and firewall settings.
- Port 587 must be open for outgoing SMTP connections

---

## 📧 Email Template

The system sends beautifully formatted HTML emails with:
- Subject: "Nulstil adgangskode - OTP-kode" (Danish)
- Professional styling with green color scheme
- Large, centered 6-digit OTP code
- 10-minute expiration notice
- Fallback plain text version for older email clients

---

## 🔒 Security Best Practices

1. **Never share your App Password** - treat it like a regular password
2. **Revoke unused App Passwords** - regularly review and remove old ones
3. **Use environment variables** - never hardcode credentials in source code
4. **Monitor usage** - check Google account activity for suspicious login attempts
5. **Rotate passwords** - generate new App Passwords periodically

---

## 📝 Alternative SMTP Providers

If you prefer not to use Gmail, you can configure other SMTP providers:

### SendGrid
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_EMAIL=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>
```

### Mailgun
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_EMAIL=<your-mailgun-smtp-username>
SMTP_PASSWORD=<your-mailgun-smtp-password>
```

### AWS SES
```
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_EMAIL=<your-aws-access-key-id>
SMTP_PASSWORD=<your-aws-secret-access-key>
```

---

## 📞 Need Help?

If you're still having issues after following these steps:
1. Check the backend logs for detailed error messages
2. Verify all secrets are set correctly (no typos, no extra spaces)
3. Try generating a new App Password
4. Make sure your Gmail account is not locked or flagged

**Backend logs location:** Check Replit's Shell/Console output when testing the API.
