# Nova Insights - Frontend Documentation

**Last Updated:** December 22, 2025  
**Version:** 2.0.0  
**Framework:** React 19 + Vite  
**Backend:** External Flask API (https://nova-insights-backend-nordic-ai.replit.app)

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [System Architecture](#2-system-architecture)
3. [Pages & Components](#3-pages--components)
4. [API Endpoints](#4-api-endpoints)
5. [File Upload & Comparison Flow](#5-file-upload--comparison-flow)
6. [Chat System](#6-chat-system)
7. [Authentication & Role-Based Access](#7-authentication--role-based-access)
8. [Support System](#8-support-system)
9. [Internationalization (i18n)](#9-internationalization-i18n)
10. [Error Handling](#10-error-handling)
11. [Project Structure](#11-project-structure)

---

## 1. Application Overview

**Nova Insights** is an AI-powered project schedule analysis platform that enables users to:

- Upload and compare construction/project schedule files (PDF, DOC, DOCX, TXT)
- Extract task data using AI (Google Gemini)
- Chat with an intelligent AI assistant about their schedules
- Track project timeline changes and modifications
- Submit support requests with file attachments

**Key Features:**
- Drag-and-drop file upload with real-time progress tracking
- AI-powered document extraction and analysis
- Intelligent chatbot with NLP to SQL conversion
- Multi-language support (Danish/English)
- Role-based access control (User/Admin)
- Support center with WhatsApp notifications

---

## 2. System Architecture

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI Framework |
| Vite | 6.x | Build Tool |
| Tailwind CSS | 4.x | Styling |
| React Router DOM | 6.x | Routing |
| Axios | Latest | HTTP Client |
| react-i18next | Latest | Internationalization |
| OpenAI SDK | 5.7.x | AI Response Formatting |
| XLSX | 0.18.x | Excel Export |
| DOMPurify | Latest | XSS Protection |
| UUID | Latest | Unique ID Generation |

### External Services

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                        │
│                    Port 5000 (Dev Server)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   BACKEND     │   │   n8n CLOUD   │   │   WAAPI       │
│   Flask API   │   │   Webhooks    │   │   WhatsApp    │
│   PostgreSQL  │   │   RAG AI      │   │   Alerts      │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │
        │                     ├── Google Gemini
        │                     └── OpenAI GPT-4
        │
        └── User Auth, Admin Management
```

---

## 3. Pages & Components

### 3.1 Public Pages

| Page | Route | Component | Description |
|------|-------|-----------|-------------|
| Home | `/` | `App.jsx` | Main dashboard with file upload, chat widget, session management |
| Login | `/login` | `Login.jsx` | User authentication |
| Signup | `/signup` | `Signup.jsx` | User registration with password strength |
| Support | `/support` | `Support.jsx` | Support request form with file attachments |
| Forgot Password | `/forgot-password` | `ForgotPassword.jsx` | Password reset initiation |
| Verify OTP | `/verify-otp` | `VerifyOTP.jsx` | 6-digit code verification |
| Reset Password | `/reset-password` | `ResetPassword.jsx` | New password creation |
| 404 Not Found | `*` | `NotFound.jsx` | Error page for invalid routes |

### 3.2 Protected Pages (Authenticated Users)

| Page | Route | Component | Required Role |
|------|-------|-----------|---------------|
| Home (Full) | `/` | `App.jsx` | User |
| Profile | `/profile` | `UpdateProfile.jsx` | User |
| Admin Portal | `/admin` | `AdminPortal.jsx` | Admin |

### 3.3 Key Components

| Component | Purpose |
|-----------|---------|
| `Navbar.jsx` | Navigation bar with auth state, language switcher, logout |
| `Footer.jsx` | Footer with Azure badge, copyright |
| `ChatWidget.jsx` | AI chat interface with session management |
| `FileComparisonModal.jsx` | File upload modal for schedule comparison |
| `DataTable.jsx` | Task comparison data display |
| `ProgressModal.jsx` | File processing progress indicator |
| `LanguageSwitcher.jsx` | DA/EN language toggle |
| `CustomSelect.jsx` | Styled dropdown component |
| `Toast.jsx` | Notification toast component |
| `ProtectedRoute.jsx` | Route guard for authenticated users |
| `AdminRoute.jsx` | Route guard for admin users |

---

## 4. API Endpoints

### 4.1 Authentication APIs (External Backend)

**Base URL:** `https://nova-insights-backend-nordic-ai.replit.app`

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/signup` | POST | User registration | No |
| `/api/login` | POST | User authentication | No |
| `/api/logout` | POST | User logout | Yes |
| `/api/verify-token` | GET | Token validation | Yes |
| `/api/health` | GET | API health check | No |
| `/api/forgot-password` | POST | Request password reset | No |
| `/api/verify-otp` | POST | Verify OTP code | No |
| `/api/reset-password` | POST | Reset password | No |
| `/api/user/profile` | PUT | Update user profile | Yes |
| `/api/admin/users` | GET | List all users (paginated) | Admin |
| `/api/admin/users` | POST | Create new user | Admin |
| `/api/admin/users/:id` | PUT | Update user | Admin |
| `/api/admin/users/:id` | DELETE | Delete user | Admin |

### 4.2 Chat APIs (n8n Webhooks)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://kasras.app.n8n.cloud/webhook/bf4dd093-bb02-472c-9454-7ab9af97bd1d` | POST | Guest user chat |
| `https://kasras.app.n8n.cloud/webhook/chat` | POST | Logged-in user chat |
| `https://kasras.app.n8n.cloud/webhook/34126e6a-c655-45c8-ab3a-68d7fbbb51bb` | POST | Session-based query |

**Session Query Request:**
```javascript
FormData:
- query: "User question"
- vs_table: "session_id"
- language: "da" | "en"
- old_session_id: "table_old_xxx" (optional)
- new_session_id: "table_new_xxx" (optional)
```

**Response:**
```json
{
  "output": "AI response text or HTML table",
  "isHtmlTable": true/false,
  "tableCount": 0,
  "originalOutput": "Raw AI response"
}
```

### 4.3 File Upload API (n8n Webhook)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://kasras.app.n8n.cloud/webhook/6562c1a4-2c5d-43d3-b155-27904ac051e8` | POST | Upload schedule files |

**Request:**
```javascript
FormData:
- session_id: "session_xxx"
- old_session_id: "table_old_xxx"
- old_schedule: File
- new_session_id: "table_new_xxx"
- new_schedule: File
```

### 4.4 File Extraction APIs (External Service)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://nordic-file-versionfile-attachment-frontend-nordic-ai.replit.app/extract-tasks` | POST | Submit PDF for extraction |
| `https://nordic-file-versionfile-attachment-frontend-nordic-ai.replit.app/status/{jobId}` | GET | Check extraction status |

### 4.5 Support APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://waapi.app/api/v1/instances/58129/client/action/send-message` | POST | WhatsApp notification |
| `https://n8n.getaichatbots.marketing/webhook/support-form` | POST | Google Sheets logging |

---

## 5. File Upload & Comparison Flow

### 5.1 Complete Upload Flow

```
1. User clicks "Upload" or drags files
         │
         ▼
2. Validation (login required, file limit check, file type)
         │
         ▼
3. FileComparisonModal opens
         │
         ▼
4. User selects OLD schedule file (PDF/DOC/DOCX/TXT)
         │
         ▼
5. User selects NEW schedule file
         │
         ▼
6. Click "Start Comparison"
         │
         ▼
7. Files uploaded to n8n webhook
   - Generates session_id, old_session_id, new_session_id
         │
         ▼
8. n8n processes files with AI
         │
         ▼
9. Success → Chat widget opens
   - User can ask questions about schedules
         │
         ▼
10. Session active until user clicks "End Session"
```

### 5.2 Session Management

**Session ID Format:** `session_` + 20 random hex characters

**Limits:**
- Maximum 2 files per session
- Session data stored in localStorage
- Session ends on logout or manual end

**Session States:**
- No Session → "Start a session to upload files"
- Session Active → "Session active! Files: X & Y"
- Files Uploaded → Chat enabled for comparison

---

## 6. Chat System

### 6.1 Chat Widget Features

| Feature | Description |
|---------|-------------|
| Session-based chat | Requires active session with uploaded files |
| AI-powered responses | Uses n8n RAG agent with Gemini/GPT-4 |
| HTML table rendering | Displays data tables with export functionality |
| Language support | Passes current language (DA/EN) to backend |
| Retry logic | 5 retries with exponential backoff for failures |
| Export to CSV | Export chat tables to CSV files |

### 6.2 Chat Flow

```
1. User uploads files → Session created
         │
         ▼
2. Chat widget enabled
         │
         ▼
3. User types question
         │
         ▼
4. sendFollowUpQuery() called
   - FormData: query, vs_table (session_id), language
         │
         ▼
5. n8n RAG Agent processes:
   - NLP → SQL conversion
   - Query database
   - Format response
         │
         ▼
6. Response returned:
   - Plain text or HTML table
   - isHtmlTable flag for rendering
         │
         ▼
7. Chat widget displays response
   - Markdown rendering for text
   - DOMPurify sanitization for HTML
```

### 6.3 End Session

When user ends session:
1. API call to end session
2. Clear localStorage session data
3. Clear chat history
4. Reset file upload state
5. Disable chat input

---

## 7. Authentication & Role-Based Access

### 7.1 User Roles

| Role | Description | Access |
|------|-------------|--------|
| **Guest** | Unauthenticated visitor | Login, Signup, Support, View homepage |
| **User** | Authenticated user | All guest + File upload, Chat, Profile |
| **Admin** | Administrator | All user + Admin Portal |

### 7.2 Authentication Flow

```
Login Flow:
1. User enters email/password
2. POST /api/login
3. Receive JWT token + user object
4. Store in localStorage:
   - accessToken: JWT token
   - user: { id, email, name, role }
5. Redirect to homepage

Token Validation:
- Token expiry: 7 days
- Stored in localStorage
- Sent as Bearer token in Authorization header
```

### 7.3 Route Protection

```jsx
// Protected Route (authenticated users)
<ProtectedRoute>
  <Component />
</ProtectedRoute>

// Admin Route (admin only)
<AdminRoute>
  <AdminPortal />
</AdminRoute>
```

### 7.4 Admin Portal Features

| Feature | Description |
|---------|-------------|
| User List | Paginated list with search and filters |
| Add User | Create new users with company info |
| Edit User | Update user details, role, password |
| Delete User | Remove users with confirmation |
| Search | Search by name or email |
| Filter | Filter by role (Admin/User) |
| Pagination | 10 users per page, navigation controls |

**Admin API Headers:**
```javascript
{
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json"
}
```

---

## 8. Support System

### 8.1 Support Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | Text | Yes | Min 1 character |
| Email | Email | Yes | Valid email format |
| Phone | Text | No | Numbers, spaces, hyphens only |
| Subject | Select | Yes | Predefined options |
| Priority | Select | No | Low/Medium/High |
| Message | Textarea | Yes | Min 1 character |
| Attachments | Files | No | Images + PDF/DOC/DOCX |

### 8.2 Submission Flow

```
1. User fills form
         │
         ▼
2. Validation (all fields, file types)
         │
         ▼
3. Parallel API calls:
   ├── WAAPI → WhatsApp notification to team
   └── n8n → Google Sheets logging
         │
         ▼
4. Success/Partial Success/Failure handling
         │
         ▼
5. Toast notification to user
```

### 8.3 File Type Restrictions

**Allowed Files:**
- Images: JPG, PNG, GIF, WEBP
- Documents: PDF, DOC, DOCX

---

## 9. Internationalization (i18n)

### 9.1 Supported Languages

| Language | Code | Default |
|----------|------|---------|
| Danish | `da` | Yes |
| English | `en` | No |

### 9.2 Configuration

**File:** `src/i18n.js`

```javascript
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { da, en },
    fallbackLng: 'da',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng'
    }
  });
```

### 9.3 Translation Files

| File | Purpose |
|------|---------|
| `src/locales/da.json` | Danish translations |
| `src/locales/en.json` | English translations |

### 9.4 Usage in Components

```jsx
import { useTranslation } from 'react-i18next';

const Component = () => {
  const { t, i18n } = useTranslation();
  
  return <h1>{t('navbar.home')}</h1>;
};
```

### 9.5 Language Switcher

Located in Navbar, toggles between DA/EN with cyan background styling.

---

## 10. Error Handling

### 10.1 Global Error Handler

**File:** `src/utils/errorHandler.js`

**Features:**
- Captures API errors
- Sends WhatsApp alerts to team
- Formats error details for debugging

### 10.2 Error Alert Format

```
🔔 File Comparison Error Alert

*Project:* File Comparison
*API Endpoint:* POST /api/endpoint
*Status Code:* 500
*Method:* POST

*Error Details:*
Error message here

*Error Code:* UNKNOWN_ERROR
*Timestamp:* 2025-12-22 10:30:00
*Request ID:* req_123456789

_Please check logs for more details_
```

### 10.3 Retry Logic

Chat service implements retry logic:
- 5 maximum retries
- Exponential backoff (5s, 10s, 15s, 20s, 25s)
- Retries on: timeout, 502, 503, 504, 524, network errors

### 10.4 User-Facing Errors

| Error Type | User Message |
|------------|--------------|
| Network Error | "Network error. Please try again." |
| Invalid Credentials | "Invalid email or password" |
| Session Expired | Redirect to login |
| File Type Error | "Only PDF, DOC, DOCX, TXT files are allowed" |
| File Limit | "You have already uploaded 2 files in this session" |

---

## 11. Project Structure

```
nova-insights-frontend/
├── public/
│   ├── favicon.ico
│   ├── logo.png
│   ├── NordicLogo.svg
│   ├── azure-badge.jpg
│   └── _redirects
│
├── src/
│   ├── components/
│   │   ├── AdminPortal.jsx      # Admin user management
│   │   ├── AdminRoute.jsx       # Admin route protection
│   │   ├── ChatWidget.jsx       # AI chat interface
│   │   ├── CustomSelect.jsx     # Styled select dropdown
│   │   ├── DataTable.jsx        # Task comparison table
│   │   ├── FileComparisonModal.jsx  # File upload modal
│   │   ├── Footer.jsx           # Page footer
│   │   ├── ForgotPassword.jsx   # Password reset
│   │   ├── LanguageSwitcher.jsx # DA/EN toggle
│   │   ├── Login.jsx            # Login page
│   │   ├── Navbar.jsx           # Navigation bar
│   │   ├── NotFound.jsx         # 404 page
│   │   ├── ProgressModal.jsx    # Processing progress
│   │   ├── ProtectedRoute.jsx   # Auth route protection
│   │   ├── ResetPassword.jsx    # New password form
│   │   ├── SavedFilesSection.jsx # Uploaded files list
│   │   ├── Signup.jsx           # Registration page
│   │   ├── Support.jsx          # Support request form
│   │   ├── Toast.jsx            # Notification toasts
│   │   ├── UpdateProfile.jsx    # Profile settings
│   │   └── VerifyOTP.jsx        # OTP verification
│   │
│   ├── hooks/
│   │   └── useSessionUploadState.js  # Session file tracking
│   │
│   ├── locales/
│   │   ├── da.json              # Danish translations
│   │   └── en.json              # English translations
│   │
│   ├── services/
│   │   ├── chatService.js       # Chat API integration
│   │   ├── GuestOpenAIService.js # Guest AI formatting
│   │   └── openAIService.js     # OpenAI integration
│   │
│   ├── utils/
│   │   ├── apiConfig.js         # API URL configuration
│   │   ├── dataParser.js        # Data parsing utilities
│   │   └── errorHandler.js      # Error handling/alerts
│   │
│   ├── App.jsx                  # Main application component
│   ├── i18n.js                  # i18n configuration
│   ├── index.css                # Global styles
│   └── main.jsx                 # React entry point
│
├── API_ENDPOINTS.md             # API documentation
├── FRONTEND_OVERVIEW.md         # This file
├── GDPR_DOCUMENTATION.md        # GDPR compliance
├── index.html                   # HTML entry point
├── package.json                 # Dependencies
├── replit.md                    # Replit project info
├── tailwind.config.js           # Tailwind configuration
└── vite.config.js               # Vite configuration
```

---

## 12. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_OPENAI_API_KEY` | OpenAI API for response formatting | Yes |
| `VITE_WAAPI_BEARER_TOKEN` | WhatsApp API for error alerts | Yes |

---

## 13. Development

### Running the Project

```bash
npm run dev
```

This starts the Vite dev server on port 5000.

### Building for Production

```bash
npm run build
```

### Theme

The application uses a **Cyan Theme** (#00D6D6) consistently across all components with:
- Gradient backgrounds
- Backdrop blur effects
- Cyan accents and borders
- Dark headings (#1c2631)
- Custom scrollbars

---

## 14. Quick Reference

### Starting a Session

1. Login to your account
2. On homepage, you'll see "No active session"
3. Click "Start Chat" to create a session
4. Upload files using the file upload area
5. Chat becomes available after file upload

### Uploading Files

1. Drag and drop files or click to browse
2. Select OLD schedule file
3. Select NEW schedule file
4. Click "Start Comparison"
5. Wait for AI processing (1-3 minutes)

### Using Chat

1. After files are uploaded, chat is enabled
2. Type your question about the schedules
3. AI responds with analysis or data tables
4. Export tables to CSV if needed
5. End session when finished

### Admin Access

1. Login with admin account
2. Click "Admin" in navbar
3. Manage users, create accounts, change roles

---

*Documentation maintained by the Nova Insights development team.*
