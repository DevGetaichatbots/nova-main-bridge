# File Version Comparison Application

## Overview
Nova Insights is a React-based web application designed to analyze and compare project schedule files (PDFs). It enables users to upload construction/project management documents, extract task data using AI, and identify project timeline shifts by comparing different versions of schedules. The application also features a Support Center for submitting requests, which are routed to WhatsApp for team notifications and Google Sheets for centralized tracking. The application is powered by Microsoft Azure.

## User Preferences
Preferred communication style: Simple, everyday language. Communicate in English.

## System Architecture

### Frontend
- **Framework**: React 19 with Vite
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS v4
- **State Management**: React hooks
- **UI/UX Decisions**: Advanced Cyan Theme featuring gradient backgrounds, backdrop blur, cyan accents, dark headings, and custom scrollbars across all components (ChatWidget, DataTable, Support, Login, Signup, Modals, Navbar, Home, Stats Cards, File Upload, Saved Files).
- **Internationalization**: Full i18n support using `react-i18next` for Danish (da) and English (en), with Danish as default.
- **Key Libraries**: XLSX for Excel export, react-markdown for AI responses, DOMPurify for security.

### Backend
- **Framework**: Flask (Python) REST API
- **Authentication**: JWT with bcrypt hashing, role-based access control, and HttpOnly secure cookies.
- **Token Storage**: HttpOnly cookies (accessToken on `/`, refreshToken on `/api/`). No tokens in localStorage or API responses.
- **Token Blacklisting**: Redis-based token blacklisting on logout and password change. All middleware checks blacklist before accepting tokens.
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, Referrer-Policy, Permissions-Policy, Cache-Control.
- **CORS**: Restricted to Replit domains and localhost dev servers (no wildcard).
- **Rate Limiting**: Login (5/5min), Signup (5/hour), Forgot Password (3/15min), Verify OTP (5/15min), Company Registration (3/hour).
- **Required Secrets**: JWT_SECRET, JWT_REFRESH_SECRET (app refuses to start without both).
- **Database**: PostgreSQL (for chat persistence, user data, company data, and audit logs)
- **Roles**: guest, user, admin, company_owner, standard_user, read_only_user, super_admin.
- **Multi-tenancy**: Supports company-based multi-tenant architecture with isolated data for users and audit logs.
- **Audit Logging**: Comprehensive audit logging for critical user and system actions with company-scoped and platform-wide views.

### System Design Choices
- **Real-time Communication**: Support requests are routed to WhatsApp for immediate team notifications.
- **AI Integration**: Utilizes OpenAI (GPT-4) for formatting AI responses and intelligent task data parsing, and n8n RAG AI Agent for NLP to SQL conversion.
- **File Processing**: External service for PDF content extraction via Google Gemini API.
- **Chat Persistence**: Migrated from local storage to PostgreSQL for all chat session and message persistence.
- **Caching & Sessions**: Upstash Redis REST API integration for caching, rate limiting, and session management.
- **Task Annotations**: Company-scoped comments/notes system for comparison results with inline editing, tag support, and multi-user visibility.
- **Top Changes Ranking**: Impact-based ranking system showing top 5-10 most impactful changes with explainable rationale. Scores based on change type (Removed/Delayed = highest), duration magnitude, and timeline position. Click-to-highlight links rankings to detailed table rows.
- **Project Health Section**: Visual health indicator with professional pulse icon showing schedule stability status.
- **PDF Export**: Professional PDF generation (`Nova-Insights-Backend/utils/pdf_generator.py`) using ReportLab. Features: professional cover page with Nova Insight logo (`NordicLogo.png`), color-coded grouped tables (Removed/Added/Later/Earlier/Modified), summary sections with purple headers, health sections with green headers, proper Notes column extraction from HTML, diff value color coding, Danish/English i18n support. Three export types: single message PDF, complete session PDF with annotations, and schedule analysis PDF.
- **Schedule Analysis**: Standalone page (`/schedule-analysis`) for single-file delayed activity analysis. Users upload one PDF schedule → backend proxies to Azure `/predictive` endpoint → returns styled HTML report identifying delayed activities. Separate sidebar with analysis session management (create, rename, delete). Emerald/teal color scheme distinct from Chat's cyan. PDF export via `GET /api/schedule/analyses/<id>/pdf` — parses nova-report HTML module cards into professional multi-page PDF with color-coded section headers, delayed activities table, root cause analysis, priority actions, and overview stats. Backend: `Nova-Insights-Backend/routes/schedule.py`, DB table: `schedule_analyses`. Frontend: `src/components/ScheduleAnalysis.jsx`, `src/components/ScheduleAnalysisSidebar.jsx`, `src/services/scheduleService.js`.

### Redis Integration
- **Module**: `Nova-Insights-Backend/utils/redis_client.py`
- **Features**: Cache get/set/delete, rate limiting, session storage, connection health checks
- **Health Endpoint**: `GET /api/redis/health` - tests Redis connectivity
- **Required Secrets**: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- **URL Format**: Must be full Upstash endpoint (e.g., `https://your-instance.upstash.io`)

#### Redis-Enabled Endpoints
- **Login** (`/api/auth/login`): Rate limiting (5 attempts per 5 minutes per IP)
- **User Profile** (`/api/auth/me`): Cached for 5 minutes, auto-invalidates on profile updates
- **Company Registration** (`/api/company/register`): Rate limiting (3 attempts per hour per IP)
- **Chat Sessions**: Cache invalidation on create/delete for session lists

## External Dependencies

### Third-Party Services
- **Azure RAG Agent** (`nova-azure-ai-rag-agent.replit.app`): File upload processing (`/upload`), chat queries (`/query`), and single-file delayed activity analysis (`/predictive`). Uses Azure Document Intelligence for OCR and GPT-4o/5.2 for analysis. **All requests are proxied through the Flask backend** via `/api/chat/proxy/query`, `/api/chat/proxy/upload`, `/api/chat/proxy/upload/progress/<id>`, and `/api/schedule/analyses/<id>/upload` to avoid browser/proxy timeout issues. Backend uses `requests` with 300s timeout; gunicorn configured with 360s worker timeout.
- **OpenAI API**: For AI response formatting and table generation.
- **WAAPI**: For WhatsApp notifications.

### Key NPM Packages
- `axios`: HTTP client
- `react-router-dom`: Routing
- `tailwindcss`: CSS framework
- `uuid`: Unique identifiers
- `xlsx`: Excel export
- `dompurify`: XSS protection
- `openai`: OpenAI API client
- `react-markdown`: Markdown rendering
- `react-i18next`: Internationalization