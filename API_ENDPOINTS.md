# Nova Insights - API Endpoints Documentation

**Last Updated:** December 22, 2025  
**Application Type:** Frontend-Only (Backend hosted externally)  
**Frontend:** React + Vite on Port 5000

---

## Overview

This document details all API endpoints used in Nova Insights, including authentication, chat services, file upload, and support integrations.

---

## 1. Authentication & User APIs

### Base URL
```
https://nova-insights-backend-nordic-ai.replit.app
```

### 1.1 User Registration

**Endpoint:** `POST /api/signup`

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully"
}
```

---

### 1.2 User Login

**Endpoint:** `POST /api/login`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

---

### 1.3 User Logout

**Endpoint:** `POST /api/logout`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 1.4 Token Verification

**Endpoint:** `GET /api/verify-token`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": { ... }
}
```

---

### 1.5 Health Check

**Endpoint:** `GET /api/health`

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-22T10:00:00Z"
}
```

---

### 1.6 Password Reset Flow

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/forgot-password` | POST | Request OTP code |
| `/api/verify-otp` | POST | Verify 6-digit OTP |
| `/api/reset-password` | POST | Set new password |

---

### 1.7 User Profile

**Endpoint:** `PUT /api/user/profile`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Smith"
}
```

---

## 2. Admin APIs

### Base URL
```
https://nova-insights-backend-nordic-ai.replit.app
```

**Required Role:** Admin

### 2.1 List Users (Paginated)

**Endpoint:** `GET /api/admin/users`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Users per page (default: 10)
- `search` - Search by name/email
- `role` - Filter by role (admin/user)

**Response:**
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

---

### 2.2 Create User

**Endpoint:** `POST /api/admin/users`

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "SecurePass123",
  "role": "user",
  "companyName": "Acme Inc",
  "phoneNumber": "+45 12345678",
  "company": {
    "address": "123 Main St",
    "industry": "Construction"
  }
}
```

---

### 2.3 Update User

**Endpoint:** `PUT /api/admin/users/:id`

---

### 2.4 Delete User

**Endpoint:** `DELETE /api/admin/users/:id`

---

## 3. Chat Service APIs (n8n Webhooks)

### 3.1 Guest Chat

**Endpoint:** `POST https://kasras.app.n8n.cloud/webhook/bf4dd093-bb02-472c-9454-7ab9af97bd1d`

**Request:**
```json
{
  "message": "What can you help me with?",
  "session_id": "session_abc123..."
}
```

---

### 3.2 Logged-in User Chat

**Endpoint:** `POST https://kasras.app.n8n.cloud/webhook/chat`

**Request:**
```json
{
  "message": "Show me delayed tasks",
  "session_id": "session_abc123..."
}
```

---

### 3.3 Session-Based Query (Primary Chat Endpoint)

**Endpoint:** `POST https://kasras.app.n8n.cloud/webhook/34126e6a-c655-45c8-ab3a-68d7fbbb51bb`

**Request (FormData):**
```
query: "What tasks are delayed?"
vs_table: "session_abc123def456..."
language: "da" | "en"
old_session_id: "table_old_timestamp_random" (optional)
new_session_id: "table_new_timestamp_random" (optional)
```

**Response:**
```json
{
  "output": "AI response or HTML table",
  "isHtmlTable": true,
  "tableCount": 2,
  "originalOutput": "Raw AI response"
}
```

**Features:**
- NLP to SQL conversion
- Multi-language support (Danish/English)
- Context-aware responses
- HTML table generation for data

---

### 3.4 End Session

**Endpoint:** `POST https://nordic-azure-agent--nordic-ai.replit.app/api/sessions/{sessionId}/end`

**Request:**
```json
{
  "end": "yes"
}
```

---

## 4. File Upload APIs

### 4.1 Upload Schedule Files (n8n Webhook)

**Endpoint:** `POST https://kasras.app.n8n.cloud/webhook/6562c1a4-2c5d-43d3-b155-27904ac051e8`

**Request (FormData):**
```
session_id: "session_abc123..."
old_session_id: "table_old_timestamp_random"
old_schedule: [File]
new_session_id: "table_new_timestamp_random"
new_schedule: [File]
```

**Response:**
```json
{
  "success": true,
  "message": "Files processed successfully"
}
```

**Supported File Types:**
- PDF
- DOC
- DOCX
- TXT

---

### 4.2 PDF Extraction Service (External)

**Base URL:** `https://nordic-file-versionfile-attachment-frontend-nordic-ai.replit.app`

#### Submit PDF for Extraction

**Endpoint:** `POST /extract-tasks`

**Request (FormData):**
```
pdf: [PDF File]
```

**Response (202 Accepted):**
```json
{
  "job_id": "job_1234567890_abc123",
  "session_id": "session_1234567890_def456",
  "filename": "schedule.pdf",
  "status": "accepted",
  "check_status_url": "/status/{job_id}"
}
```

#### Check Extraction Status

**Endpoint:** `GET /status/{job_id}`

**Response:**
```json
{
  "job_id": "job_123...",
  "status": "processing",
  "progress": 65,
  "progress_message": "Extracting data...",
  "total_rows_extracted": 42,
  "is_completed": false
}
```

**Status Values:**
- `pending` - Job created, waiting
- `processing` - Currently extracting
- `completed` - Finished successfully
- `failed` - Error occurred

---

## 5. Support APIs

### 5.1 WhatsApp Notification (WAAPI)

**Endpoint:** `POST https://waapi.app/api/v1/instances/58129/client/action/send-message`

**Headers:**
```
Authorization: Bearer {WAAPI_BEARER_TOKEN}
Content-Type: application/json
```

**Request:**
```json
{
  "chatId": "120363212064732206@g.us",
  "message": "🆕 New Support Request\n\nFrom: John Doe\nEmail: john@example.com\nSubject: Technical support\nMessage: Need help with file upload\n\nTimestamp: 2025-12-22 10:30:00"
}
```

---

### 5.2 Google Sheets Webhook

**Endpoint:** `POST https://n8n.getaichatbots.marketing/webhook/support-form`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Technical support",
  "message": "Need help with file upload",
  "fileCount": 2,
  "timestamp": "2025-12-22T10:30:00Z"
}
```

---

## 6. Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "error_code": "VALIDATION_ERROR"
}
```

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Request completed |
| 201 | Created | Resource created |
| 202 | Accepted | Job queued for processing |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Token expired/invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Backend issue |
| 502 | Bad Gateway | Proxy/gateway error |
| 503 | Unavailable | Service temporarily down |
| 504 | Timeout | Request took too long |

---

## 7. Session ID Formats

| Type | Format | Example |
|------|--------|---------|
| Main Session | `session_` + 20 hex chars | `session_a1b2c3d4e5f6g7h8i9j0` |
| Table Session | `table_{prefix}_{timestamp}_{random}` | `table_old_ls5abc_f3d2a1b4c5` |

---

## 8. Environment Variables

### Frontend (.env)
```bash
VITE_OPENAI_API_KEY=your_openai_key
VITE_WAAPI_BEARER_TOKEN=your_waapi_token
```

### Backend (External)
```bash
JWT_SECRET=secret_key
DATABASE_URL=postgresql://...
GEMINI_API_KEY=google_gemini_key
```

---

## 9. Rate Limits & Timeouts

| Service | Timeout | Retry Logic |
|---------|---------|-------------|
| Backend Auth | 30s | No retry |
| Chat Query | No limit | 5 retries, exponential backoff |
| File Upload | No limit | No retry |
| WAAPI | 30s | No retry |

---

## 10. Flow Diagrams

### Authentication Flow
```
User → Login Form → POST /api/login → JWT Token → localStorage
                                                        ↓
                                               Protected Routes
```

### File Comparison Flow
```
User Upload → n8n Webhook → AI Processing → Database Storage
                                                    ↓
                                           Chat Session Enabled
                                                    ↓
                              User Query → n8n RAG Agent → Response
```

### Support Request Flow
```
User Form → Validation → Parallel Submission
                              ├── WAAPI → WhatsApp Team Alert
                              └── n8n → Google Sheets Logging
```

---

*Documentation maintained by Nova Insights development team.*
