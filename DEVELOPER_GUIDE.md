# Nova Insights — Developer Guide & Architecture Documentation

**Version:** 2.0  
**Last Updated:** April 2026  
**Author:** Principal Engineering, Nordic AI Group ApS  
**Classification:** Internal — Engineering & Executive Reference

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Architecture Overview](#2-platform-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture Diagram](#4-system-architecture-diagram)
5. [Project Structure](#5-project-structure)
6. [Frontend Application](#6-frontend-application)
7. [Flask Backend (Nova-Insights-Backend)](#7-flask-backend-nova-insights-backend)
8. [Azure RAG Agent Backend](#8-azure-rag-agent-backend)
9. [Database Schema](#9-database-schema)
10. [Authentication & Security](#10-authentication--security)
11. [Multi-Tenant Company Architecture](#11-multi-tenant-company-architecture)
12. [Chat System & AI Integration](#12-chat-system--ai-integration)
13. [Schedule Risk Analysis](#13-schedule-risk-analysis)
14. [PDF Export System](#14-pdf-export-system)
15. [Internationalization (i18n)](#15-internationalization-i18n)
16. [Caching & Rate Limiting (Redis)](#16-caching--rate-limiting-redis)
17. [Audit Logging](#17-audit-logging)
18. [API Reference](#18-api-reference)
19. [Data Flow: End-to-End Request Lifecycle](#19-data-flow-end-to-end-request-lifecycle)
20. [Deployment & Infrastructure](#20-deployment--infrastructure)
21. [Environment Variables & Secrets](#21-environment-variables--secrets)
22. [Coding Conventions & Standards](#22-coding-conventions--standards)
23. [Appendix A: Azure RAG Agent — Complete Backend Guide](#appendix-a-azure-rag-agent--complete-backend-guide)

---

## 1. Executive Summary

**Nova Insights** is an enterprise-grade construction project schedule analysis platform built for Nordic AI Group ApS. It enables project managers, planners, and executives to:

- **Compare** two versions of a project schedule (PDF/CSV) to instantly identify added, removed, delayed, accelerated, and modified tasks.
- **Analyze** a single schedule for delayed activity detection, root cause analysis, and decision support (Schedule Risk).
- **Collaborate** across organizations with company-based multi-tenant architecture, role-based access control, and comprehensive audit logging.
- **Export** professional branded PDF reports with the Nordic AI Group identity.

The platform processes documents using **Azure Document Intelligence** for OCR, **Azure OpenAI GPT-4.1** for intelligent analysis, and returns structured HTML reports with interactive tables, stat cards, and actionable recommendations.

### Key Metrics

| Metric | Value |
|--------|-------|
| Frontend Codebase | ~25,000 lines (React/JSX) |
| Flask Backend Codebase | ~11,000 lines (Python) |
| Azure RAG Agent Codebase | ~6,000 lines (Python) |
| Database Tables | 9 core tables |
| API Endpoints | 60+ REST endpoints |
| Supported Languages | Danish (default), English |
| User Roles | 6 (guest → super_admin) |

---

## 2. Platform Architecture Overview

Nova Insights is a **three-tier architecture** with clear separation of concerns:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USERS (Browser)                                │
│              Desktop / Tablet — React SPA in Preview Pane               │
└──────────┬───────────────────────────────────────────────────────────────┘
           │ HTTPS
┌──────────▼───────────────────────────────────────────────────────────────┐
│                    TIER 1 — FRONTEND (React + Vite)                     │
│                                                                         │
│  React 19 · React Router · Tailwind CSS v4 · i18next (DA/EN)           │
│  Components: Chat, Schedule Risk, Company Portal, Admin, Super Admin    │
│  Dev: Vite dev server (port 5173) · Prod: Static build served by Flask │
└──────────┬───────────────────────────────────────────────────────────────┘
           │ /api/* (REST + HttpOnly Cookies)
┌──────────▼───────────────────────────────────────────────────────────────┐
│                 TIER 2 — FLASK BACKEND (Python)                         │
│                                                                         │
│  Flask 2.3 · Gunicorn (production) · JWT Auth · RBAC                   │
│  Blueprints: auth, chat, company, admin, super_admin, audit, schedule  │
│  Utils: PDF generator (ReportLab), Redis client, Audit logger          │
│  Proxy: All AI requests proxied to Azure RAG Agent (300s timeout)      │
└──────────┬──────────────────┬────────────────────────────────────────────┘
           │ PostgreSQL       │ HTTPS Proxy
┌──────────▼────────┐  ┌─────▼────────────────────────────────────────────┐
│   TIER 3a — DB    │  │   TIER 3b — AZURE RAG AGENT (FastAPI)           │
│                   │  │                                                   │
│  PostgreSQL       │  │  FastAPI · Azure OpenAI GPT-4.1 · pgvector      │
│  Upstash Redis    │  │  Azure Document Intelligence OCR                  │
│                   │  │  Comparison Agent + Predictive Agent              │
│  9 core tables    │  │  HTML Formatter (structured reports)              │
└───────────────────┘  └───────────────────────────────────────────────────┘
```

### Three Backends, One Product

| Component | Technology | Role | Hosting |
|-----------|-----------|------|---------|
| **Frontend** | React 19 + Vite | User interface, client-side rendering | Replit (static build served by Flask in production) |
| **Flask Backend** | Python Flask | Auth, RBAC, DB, PDF generation, API proxy | Replit (Gunicorn, port 5000) |
| **Azure RAG Agent** | Python FastAPI | AI analysis, OCR, LLM orchestration | Separate Replit deployment (`nova-azure-ai-rag-agent.replit.app`) |

---

## 3. Technology Stack

### Frontend

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 19.1 |
| Build Tool | Vite | 6.3 |
| Routing | React Router DOM | 7.8 |
| Styling | Tailwind CSS | 4.1 |
| State Management | React Hooks (useState, useEffect, useMemo, useCallback) | — |
| HTTP Client | Axios | 1.9 |
| Internationalization | react-i18next | 16.5 |
| Excel Export | XLSX (SheetJS) | 0.18 |
| Markdown Rendering | react-markdown | 10.1 |
| PDF Generation (client) | pdfmake | 0.3 |
| Security (XSS) | DOMPurify | 3.2 |
| AI Formatting | OpenAI SDK | 5.7 |
| Unique IDs | uuid | 11.1 |

### Flask Backend

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Flask | 2.3.3 |
| CORS | Flask-CORS | 4.0.0 |
| Database Driver | psycopg2-binary | 2.9.7 |
| Password Hashing | bcrypt | 4.0.1 |
| JWT | PyJWT | 2.8.0 |
| WSGI Server | Gunicorn | 21.2.0 |
| PDF Generation | ReportLab | 4.0.8 |
| HTML Parsing | BeautifulSoup4 | 4.12.2 |
| Redis Client | upstash-redis | 1.0.0 |
| HTTP Client | requests | 2.31.0 |

### Azure RAG Agent

| Category | Technology |
|----------|-----------|
| Framework | FastAPI |
| LLM | Azure OpenAI GPT-4.1 (temperature=0, seed=42) |
| OCR | Azure Document Intelligence (prebuilt-layout) |
| Vector DB | Supabase PostgreSQL + pgvector |
| Embeddings | Azure OpenAI text-embedding-3-small (1536 dimensions) |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Replit | Hosting (frontend + Flask backend) |
| Replit PostgreSQL | Primary database |
| Upstash Redis (REST) | Caching, rate limiting, session management |
| Azure OpenAI | LLM inference (GPT-4.1) |
| Azure Document Intelligence | PDF OCR and table extraction |
| Supabase PostgreSQL | Vector store for schedule data (RAG Agent) |

---

## 4. System Architecture Diagram

```
                           ┌─────────────────┐
                           │   End Users      │
                           │  (Browser SPA)   │
                           └────────┬─────────┘
                                    │
                          HTTPS (Replit Proxy)
                                    │
              ┌─────────────────────▼──────────────────────┐
              │            REACT FRONTEND                   │
              │                                             │
              │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
              │  │   Chat   │  │ Schedule │  │ Company  │ │
              │  │  Widget  │  │   Risk   │  │ Portal   │ │
              │  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
              │       │             │              │        │
              │  ┌────▼─────────────▼──────────────▼────┐  │
              │  │     Services Layer (Axios)            │  │
              │  │  chatService · scheduleService · auth │  │
              │  └──────────────────┬────────────────────┘  │
              └─────────────────────┼───────────────────────┘
                                    │ /api/*
              ┌─────────────────────▼───────────────────────┐
              │          FLASK BACKEND (Python)              │
              │                                              │
              │  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────────┐ │
              │  │ Auth │ │ Chat │ │Company │ │  Admin   │ │
              │  │Routes│ │Routes│ │ Routes │ │  Routes  │ │
              │  └──┬───┘ └──┬───┘ └───┬────┘ └────┬─────┘ │
              │     │        │         │            │        │
              │  ┌──▼────────▼─────────▼────────────▼────┐  │
              │  │          Middleware Layer              │  │
              │  │  JWT Auth · RBAC · Rate Limiting      │  │
              │  └──┬────────────────────┬───────────────┘  │
              │     │                    │                    │
              │  ┌──▼──────────┐   ┌────▼──────────────┐   │
              │  │ PostgreSQL  │   │  Proxy to Azure    │   │
              │  │ (Users,     │   │  RAG Agent         │   │
              │  │  Sessions,  │   │  (/query, /upload, │   │
              │  │  Messages)  │   │   /predictive)     │   │
              │  └─────────────┘   └────────┬───────────┘   │
              │                             │                │
              │  ┌─────────────┐            │                │
              │  │ Upstash     │            │                │
              │  │ Redis       │            │                │
              │  │ (Cache/     │            │                │
              │  │  Rate Limit)│            │                │
              │  └─────────────┘            │                │
              └─────────────────────────────┼────────────────┘
                                            │ HTTPS
              ┌─────────────────────────────▼────────────────┐
              │      AZURE RAG AGENT (FastAPI)               │
              │                                              │
              │  ┌──────────────────┐ ┌───────────────────┐ │
              │  │ Comparison Agent │ │ Predictive Agent  │ │
              │  │ (Two-file diff)  │ │ (Single-file      │ │
              │  │                  │ │  risk analysis)   │ │
              │  └────────┬─────────┘ └────────┬──────────┘ │
              │           │                    │             │
              │  ┌────────▼────────────────────▼──────────┐ │
              │  │         Azure OpenAI GPT-4.1           │ │
              │  │   Azure Document Intelligence (OCR)     │ │
              │  │   Supabase pgvector (Vector Store)      │ │
              │  └────────────────────────────────────────┘ │
              └──────────────────────────────────────────────┘
```

---

## 5. Project Structure

```
nova-insights/
│
├── src/                                    # FRONTEND (React)
│   ├── App.jsx                  (2,396 lines)  # Root component, routing, file upload
│   ├── main.jsx                                 # Entry point, i18n init
│   ├── index.css                                # Global styles, Tailwind config
│   │
│   ├── components/                              # UI Components (36 files)
│   │   ├── ChatWidget.jsx       (3,624 lines)  # Core: chat UI, HTML table parsing, PDF/CSV export
│   │   ├── ComparisonRenderer.jsx  (594 lines) # Markdown comparison rendering, health section
│   │   ├── ScheduleAnalysis.jsx    (554 lines) # Schedule Risk page, single-file analysis
│   │   ├── ScheduleAnalysisSidebar.jsx          # Session management for Schedule Risk
│   │   ├── SuperAdminPortal.jsx (1,768 lines)  # Platform-wide management dashboard
│   │   ├── AdminPortal.jsx      (1,313 lines)  # Company admin user management
│   │   ├── CompanyPortal.jsx    (1,212 lines)  # Company settings, user mgmt, audit logs
│   │   ├── Support.jsx          (1,018 lines)  # Support request form with WhatsApp integration
│   │   ├── Navbar.jsx             (936 lines)  # Navigation with role-based visibility
│   │   ├── Signup.jsx             (887 lines)  # User registration
│   │   ├── Login.jsx              (447 lines)  # Authentication form
│   │   ├── DataTable.jsx                        # Reusable data table component
│   │   ├── FileComparisonModal.jsx              # Two-file upload modal for comparison
│   │   ├── ProgressModal.jsx                    # Upload progress tracking UI
│   │   ├── ChatHistorySidebar.jsx               # Chat session sidebar
│   │   ├── SummaryPanel.jsx                     # Analysis summary panel
│   │   ├── Toast.jsx                            # Notification toast component
│   │   ├── CustomSelect.jsx                     # Styled select dropdown
│   │   ├── LanguageSwitcher.jsx                 # DA/EN language toggle
│   │   ├── ProtectedRoute.jsx                   # Auth route guard
│   │   ├── AdminRoute.jsx                       # Admin role guard
│   │   ├── CompanyOwnerRoute.jsx                # Company owner role guard
│   │   ├── SuperAdminRoute.jsx                  # Super admin role guard
│   │   ├── ForgotPassword.jsx                   # Password recovery
│   │   ├── VerifyOTP.jsx                        # OTP verification
│   │   ├── ResetPassword.jsx                    # Password reset
│   │   ├── UpdateProfile.jsx                    # Profile management
│   │   ├── SavedFilesSection.jsx                # Uploaded files listing
│   │   ├── AboutPage.jsx                        # About page
│   │   ├── ContactPage.jsx                      # Contact page
│   │   ├── SecurityGDPR.jsx                     # Security & GDPR info
│   │   ├── PrivacyPolicyPage.jsx                # Privacy policy
│   │   ├── TermsOfServicePage.jsx               # Terms of service
│   │   ├── Footer.jsx                           # Footer component
│   │   └── NotFound.jsx                         # 404 page
│   │
│   ├── services/                                # API Communication Layer
│   │   ├── chatService.js         (397 lines)  # Chat CRUD, message persistence, annotation API
│   │   ├── scheduleService.js      (93 lines)  # Schedule Risk API calls
│   │   ├── openAIService.js       (173 lines)  # OpenAI formatting integration
│   │   └── GuestOpenAIService.js  (257 lines)  # Guest-mode AI formatting
│   │
│   ├── utils/                                   # Shared Utilities
│   │   ├── apiConfig.js            (40 lines)  # API base URL configuration
│   │   ├── authApi.js              (89 lines)  # Authenticated Axios instance with interceptors
│   │   ├── dataParser.js          (456 lines)  # Table data extraction from AI responses
│   │   ├── errorHandler.js         (72 lines)  # Global error handling
│   │   └── pdfGenerator.js        (547 lines)  # Client-side PDF generation (pdfmake)
│   │
│   └── locales/                                 # Translation Files
│       ├── da.json              (1,109 lines)  # Danish translations
│       └── en.json              (1,107 lines)  # English translations
│
├── Nova-Insights-Backend/                       # FLASK BACKEND (Python)
│   ├── app.py                     (614 lines)  # Flask app, security headers, table creation, seeding
│   ├── config.py                                # Environment configuration
│   ├── app_auth_routes.py                       # Legacy auth routes reference
│   ├── requirements.txt                         # Python dependencies
│   │
│   ├── routes/                                  # API Route Blueprints
│   │   ├── auth.py                (606 lines)  # Login, signup, token refresh, profile
│   │   ├── chat.py              (1,608 lines)  # Sessions, messages, files, annotations, PDF, proxy
│   │   ├── company.py           (1,118 lines)  # Company registration, user management
│   │   ├── admin.py               (621 lines)  # Admin user CRUD
│   │   ├── super_admin.py       (1,109 lines)  # Platform-wide company & user management
│   │   ├── audit.py             (1,348 lines)  # Audit logs, chat history export
│   │   ├── schedule.py            (441 lines)  # Schedule Risk analysis sessions
│   │   ├── forgot_password.py     (121 lines)  # Password recovery flow
│   │   ├── reset_password.py      (128 lines)  # Password reset execution
│   │   ├── verify_otp.py          (150 lines)  # OTP verification
│   │   └── update_profile.py      (170 lines)  # Profile updates
│   │
│   ├── middleware/                               # Request Processing
│   │   ├── auth_middleware.py     (120 lines)  # JWT token validation decorator
│   │   ├── admin_auth.py          (141 lines)  # Admin role verification
│   │   └── error_handler.py        (95 lines)  # Global error handling
│   │
│   └── utils/                                   # Backend Utilities
│       ├── database.py            (146 lines)  # PostgreSQL connection management
│       ├── pdf_generator.py     (1,876 lines)  # ReportLab PDF generation engine
│       ├── redis_client.py        (262 lines)  # Upstash Redis REST client
│       ├── token_manager.py       (134 lines)  # JWT token blacklisting
│       ├── audit_logger.py        (121 lines)  # Audit event recording
│       ├── email_service.py        (92 lines)  # Email notifications
│       ├── validators.py           (70 lines)  # Input validation utilities
│       ├── NordicLogo.png                       # Nordic AI Group logo for PDF exports
│       └── nordicFavIcon.png                    # Favicon / fallback logo
│
├── package.json                                 # NPM dependencies & scripts
├── vite.config.js                               # Vite build configuration
├── index.html                                   # SPA entry point
└── replit.md                                    # Project documentation (auto-loaded)
```

---

## 6. Frontend Application

### 6.1 Routing Architecture

All routing is defined in `src/App.jsx` using React Router v7. Routes are protected by role-based guard components:

| Route | Component | Guard | Description |
|-------|-----------|-------|-------------|
| `/` | Home (App.jsx) | ProtectedRoute | Main chat + file upload page |
| `/login` | Login | — | Authentication |
| `/signup` | Signup | — | Registration |
| `/chat` | App.jsx (chat view) | ProtectedRoute | Chat with comparison results |
| `/schedule-analysis` | ScheduleAnalysis | ProtectedRoute | Single-file risk analysis |
| `/company-portal` | CompanyPortal | CompanyOwnerRoute | Company management |
| `/admin` | AdminPortal | AdminRoute | User administration |
| `/super-admin` | SuperAdminPortal | SuperAdminRoute | Platform-wide management |
| `/support` | Support | ProtectedRoute | Support request submission |
| `/forgot-password` | ForgotPassword | — | Password recovery |
| `/verify-otp` | VerifyOTP | — | OTP verification |
| `/reset-password` | ResetPassword | — | Password reset |
| `/update-profile` | UpdateProfile | ProtectedRoute | Profile management |
| `/about` | AboutPage | — | About Nordic AI Group |
| `/contact` | ContactPage | — | Contact information |
| `/security-gdpr` | SecurityGDPR | — | Security & GDPR documentation |
| `/privacy-policy` | PrivacyPolicyPage | — | Privacy policy |
| `/terms-of-service` | TermsOfServicePage | — | Terms of service |
| `*` | NotFound | — | 404 page |

### 6.2 Core Components

#### ChatWidget.jsx (3,624 lines) — The Heart of the Application

This is the most complex component, responsible for:

1. **Chat session management** — Create, load, rename, delete sessions via sidebar
2. **Message display** — Text, HTML (AI responses), and file-info messages
3. **HTML table parsing** — Extracts tables from Azure agent HTML, renders them in interactive sortable tables with per-section grouping (Added/Removed/Delayed/Accelerated/Modified)
4. **Annotations** — Inline comment/note system per table row (company-scoped)
5. **Export capabilities** — CSV export per section, single-message PDF download, complete session PDF
6. **Copy functions** — Copy table data, copy summary text
7. **Top Changes Ranking** — Impact-based ranking with click-to-highlight
8. **File upload** — Drag-and-drop two-file comparison upload with progress tracking

Key sub-components inside ChatWidget:
- `HtmlMessageContent` — Parses Azure agent HTML, extracts table sections per category, renders interactive tables with Comments column
- `renderGroupedTable()` — Renders a single group (e.g., "Added Tasks") with color-coded header, badge count, and data rows
- `renderAllTableSections()` — Orchestrates all table groups with Results header, PDF/CSV buttons, and summary content below

#### ComparisonRenderer.jsx (594 lines)

Handles older markdown-based comparison responses (pre-HTML format). Features:
- Markdown-to-grouped-table conversion
- Health section rendering with status indicator and stat cards
- Color-coded category grouping

#### ScheduleAnalysis.jsx (554 lines)

Standalone page at `/schedule-analysis` for single-file delayed activity analysis:
- Upload one PDF schedule
- Backend proxies to Azure `/predictive` endpoint
- Returns styled HTML report
- Emerald/teal color scheme (distinct from Chat's cyan)
- Separate session management sidebar

### 6.3 Services Layer

| Service | Responsibilities |
|---------|-----------------|
| `chatService.js` | Session CRUD, message CRUD, file upload, annotation CRUD, proxy query/upload to Azure agent |
| `scheduleService.js` | Schedule Risk analysis CRUD, file upload for predictive analysis |
| `openAIService.js` | OpenAI GPT formatting for AI response beautification |
| `GuestOpenAIService.js` | Same formatting for guest/unauthenticated users |

### 6.4 Design System

**Theme:** Advanced Cyan with professional dark accents

| Element | Value |
|---------|-------|
| Primary Accent | `#00D6D6` (cyan) |
| Secondary Accent | `#00B4B4` (dark cyan) |
| Dark Heading | `#1c2631` |
| Backgrounds | Gradient whites with backdrop blur |
| Stat Cards | Category-colored (Red=Removed/Delayed, Green=Added, Amber=Modified, Emerald=Accelerated) |
| Scrollbars | Custom styled across all components |
| Branding | Nordic AI Group ApS logo in navbar and PDF exports |

---

## 7. Flask Backend (Nova-Insights-Backend)

### 7.1 Application Architecture

The Flask backend uses a **Blueprint-based modular architecture**:

```python
# app.py — Blueprint registration
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(chat_bp, url_prefix='/api/chat')
app.register_blueprint(company_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api')
app.register_blueprint(super_admin_bp, url_prefix='/api')
app.register_blueprint(audit_bp, url_prefix='/api')
app.register_blueprint(schedule_bp, url_prefix='/api/schedule')
app.register_blueprint(forgot_password_bp, url_prefix='/api')
app.register_blueprint(reset_password_bp, url_prefix='/api')
app.register_blueprint(verify_otp_bp, url_prefix='/api')
app.register_blueprint(update_profile_bp, url_prefix='/api')
```

### 7.2 Request Processing Pipeline

Every request passes through:

1. **CORS check** — Restricted to Replit domains and localhost
2. **Security headers** — X-Content-Type-Options, X-Frame-Options, HSTS, etc.
3. **JWT validation** (protected routes) — Extracts token from HttpOnly cookie, verifies signature, checks blacklist
4. **Role authorization** — Verifies user has required role for the endpoint
5. **Rate limiting** (select endpoints) — Redis-based request throttling
6. **Route handler** — Business logic execution
7. **Audit logging** (critical actions) — Records who did what and when

### 7.3 AI Proxy Architecture

All AI requests from the frontend are **proxied through the Flask backend** to the Azure RAG Agent. This design prevents browser/proxy timeout issues and keeps the Azure agent URL private:

| Frontend Calls | Flask Proxy | Azure RAG Agent |
|---------------|-------------|-----------------|
| `POST /api/chat/proxy/upload` | `POST nova-azure-ai-rag-agent.replit.app/upload` | File processing + OCR |
| `GET /api/chat/proxy/upload/progress/:id` | `GET .../upload/progress/:id` | Upload status polling |
| `POST /api/chat/proxy/query` | `POST .../query` | Comparison analysis |
| `POST /api/schedule/analyses/:id/upload` | `POST .../predictive` | Predictive analysis |
| `GET /api/schedule/analyses/:id/progress` | `GET .../predictive/progress/:id` | Analysis status polling |

Backend proxy timeout: **300 seconds**. Gunicorn worker timeout: **360 seconds**.

---

## 8. Azure RAG Agent Backend

The Azure RAG Agent is a **separate FastAPI application** deployed independently. It contains two AI agents:

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| **Comparison Agent** | Compare two schedules (old vs new) | Two PDF/CSV files | Structured HTML report with 6 sections |
| **Predictive Agent (Nova Insight)** | Delayed activity detection + decision support | One PDF/CSV file | Structured HTML report with 10 data cards |

Both agents use **Azure OpenAI GPT-4.1** with deterministic settings (`temperature=0`, `top_p=0.1`, `seed=42`) for reproducible results. Schedule data is capped at **1.9 MB** per request.

**For the complete Azure RAG Agent technical guide, see [Appendix A](#appendix-a-azure-rag-agent--complete-backend-guide).**

---

## 9. Database Schema

### 9.1 Entity Relationship Overview

```
companies (1) ──────── (N) users
    │                        │
    │                        │ (1)
    │                        │
    │                   (N) chat_sessions ──── (N) chat_messages
    │                        │                        │
    │                   (N) chat_session_files    (N) task_annotations
    │
    └──────── (N) audit_logs
    └──────── (N) schedule_analyses
```

### 9.2 Table Definitions

#### `companies`
```sql
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `users`
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',      -- guest|user|admin|company_owner|standard_user|read_only_user|super_admin
    company_id INTEGER REFERENCES companies(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `chat_sessions`
```sql
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    session_uuid VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `chat_messages`
```sql
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL,       -- 'user' | 'bot'
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- 'text' | 'html' | 'file-info' | 'comparison'
    is_html BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `chat_session_files`
```sql
CREATE TABLE chat_session_files (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    file_type VARCHAR(20) NOT NULL,         -- 'old' | 'new'
    original_filename VARCHAR(500),
    stored_filename VARCHAR(500),
    azure_table_name VARCHAR(255),
    upload_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `task_annotations`
```sql
CREATE TABLE task_annotations (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    task_key VARCHAR(500) NOT NULL,
    comment TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `schedule_analyses`
```sql
CREATE TABLE schedule_analyses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    analysis_uuid VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    filename VARCHAR(500),
    result_html TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `password_reset_otps`
```sql
CREATE TABLE password_reset_otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `refresh_tokens`
```sql
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 10. Authentication & Security

### 10.1 Authentication Flow

```
┌──────────┐     POST /api/auth/login     ┌─────────────┐
│  Client  │ ──────────────────────────▶  │ Flask Auth  │
│          │                               │  Blueprint  │
│          │  ◀────────────────────────── │             │
│          │  Set-Cookie: accessToken      │  Validates  │
│          │  Set-Cookie: refreshToken     │  credentials│
│          │  (HttpOnly, Secure, SameSite) │  via bcrypt │
└──────────┘                               └──────┬──────┘
                                                   │
                                            ┌──────▼──────┐
                                            │ PostgreSQL  │
                                            │ users table │
                                            └─────────────┘
```

### 10.2 Token Architecture

| Token | Storage | Lifetime | Path | Purpose |
|-------|---------|----------|------|---------|
| Access Token | HttpOnly cookie | 24 hours | `/` | API authentication |
| Refresh Token | HttpOnly cookie | 30 days | `/api/` | Access token renewal |

**Critical:** Tokens are **never** returned in API response bodies or stored in localStorage. This prevents XSS token theft.

### 10.3 Token Blacklisting

On logout or password change, tokens are blacklisted in Redis:
- Key format: `blacklist:token:<jti>`
- TTL: Matches token's remaining lifetime
- All middleware checks the blacklist before accepting any token

### 10.4 Security Headers

Applied to every response via `@app.after_request`:

| Header | Value |
|--------|-------|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Strict-Transport-Security | max-age=31536000; includeSubDomains |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |
| Cache-Control | no-store, no-cache, must-revalidate, max-age=0 |

### 10.5 Password Policy

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- Hashed with bcrypt (salt rounds auto-generated)

---

## 11. Multi-Tenant Company Architecture

### 11.1 Role Hierarchy

```
super_admin ────────── Platform-wide access (Nordic AI Group)
    │
company_owner ──────── Full company management
    │
admin ──────────────── User management within company
    │
standard_user ──────── Full feature access within company
    │
read_only_user ─────── View-only access within company
    │
guest ──────────────── Limited access, no persistence
```

### 11.2 Data Isolation

All user data is scoped by `company_id`:
- **Chat sessions** are owned by `user_id` and tagged with `company_id`
- **Annotations** are visible to all users within the same `company_id`
- **Audit logs** are company-scoped (except super_admin who sees all)
- **Schedule analyses** are isolated per user within their company
- **Super Admin** can view and manage all companies and their data

### 11.3 Company Registration Flow

1. User visits `/company-signup`
2. Submits company name, email, phone + admin user details
3. Backend creates `companies` record + first `users` record with `company_owner` role
4. Rate limited: 3 attempts per hour per IP

---

## 12. Chat System & AI Integration

### 12.1 Chat Flow (Two-File Comparison)

```
1. User creates new chat session
   └─▶ POST /api/chat/sessions → returns session_id

2. User uploads two PDF files via FileComparisonModal
   └─▶ POST /api/chat/proxy/upload → proxied to Azure RAG Agent
       └─▶ Returns upload_id for progress polling

3. Frontend polls upload progress
   └─▶ GET /api/chat/proxy/upload/progress/:upload_id
       └─▶ Steps: ocr → embedding → complete

4. User sends comparison query (e.g., "Compare the schedules")
   └─▶ POST /api/chat/proxy/query → proxied to Azure RAG Agent
       └─▶ Azure agent: fetch all chunks → GPT-4.1 → markdown → HTML
       └─▶ Returns structured HTML with tables, sections, stat cards

5. Frontend stores bot response
   └─▶ POST /api/chat/sessions/:id/messages
       └─▶ content_type: 'html', is_html: true

6. ChatWidget.HtmlMessageContent parses the HTML:
   └─▶ Extracts tables per .category-section
   └─▶ Renders interactive tables with Comments column
   └─▶ Renders summary/health sections below tables
```

### 12.2 HTML Parsing Strategy

The Azure RAG Agent returns structured HTML with CSS class-based sections:

| CSS Class | Content |
|-----------|---------|
| `.comparison-results` | Container for all category tables |
| `.category-section` | One table group (e.g., "Added Tasks") |
| `.executive-section` | Recommended Actions cards |
| `.root-cause-section` | Root Cause Analysis |
| `.impact-section` | Impact Assessment |
| `.summary-section` | Summary of Changes with statistics |
| `.health-section` | Project Health dashboard with stat cards |

The frontend's `HtmlMessageContent` component:
1. Finds the `.comparison-results` container
2. Iterates each `.category-section` to extract headers and rows as separate table sections
3. Filters placeholder rows (all cells "...")
4. Pads short rows (fewer cells than headers) with dash placeholders
5. Renders each section as a styled interactive table
6. Renders remaining non-table HTML (executive actions, root cause, etc.) below the tables

### 12.3 Annotation System

Users can add comments/notes to individual table rows:
- **Scoped by company** — all users in the same company see each other's annotations
- **Per-row granularity** — each row has a unique `taskKey` derived from its content
- **Inline editing** — click to edit, with tag support
- **Persisted in PostgreSQL** — survives session reload

---

## 13. Schedule Risk Analysis

### 13.1 Overview

A standalone feature at `/schedule-analysis` for analyzing a single schedule file:

1. User uploads one PDF schedule
2. Backend proxies to Azure RAG Agent's `/predictive` endpoint
3. Agent performs four-phase analysis:
   - **Detection:** Find all delayed activities (start date < reference date AND progress = 0%)
   - **Decision Support:** Classify by type, determine root causes, assign priority
   - **Forcing Assessment:** Evaluate if delayed tasks can be accelerated
   - **Executive Actions:** Synthesize into 3 concrete actions
4. Returns structured HTML report with 10 data cards

### 13.2 Key Differences from Chat

| Aspect | Chat (Comparison) | Schedule Risk (Predictive) |
|--------|-------------------|---------------------------|
| Input | Two files (old + new) | One file |
| Agent | Comparison Agent | Predictive Agent (Nova Insight) |
| Output Format | Markdown → HTML | JSON Schema → HTML |
| Color Scheme | Cyan accents | Emerald/teal accents |
| Session Storage | `chat_sessions` + `chat_messages` | `schedule_analyses` |
| LLM Output | Free-form markdown with tables | Strict JSON schema (11 required fields) |

---

## 14. PDF Export System

### 14.1 Two Export Types

| Button | Scope | Generator |
|--------|-------|-----------|
| **Download PDF** | Single message comparison | `pdf_generator.py` (server-side, ReportLab) |
| **Complete PDF** | Entire chat session with all messages | `pdf_generator.py` (server-side, ReportLab) |

### 14.2 Server-Side PDF Generation

**File:** `Nova-Insights-Backend/utils/pdf_generator.py` (1,876 lines)

Features:
- Professional cover page with Nordic AI Group logo (`NordicLogo.png`)
- Color-coded grouped tables matching the frontend categories
- Summary sections with purple headers
- Health sections with green headers
- Notes column extraction from HTML content
- Diff value color coding (red for delays, green for accelerations)
- Danish/English language support
- Proper page breaks and pagination

### 14.3 PDF API Endpoints

```
GET /api/chat/sessions/:session_id/messages/:message_id/pdf  → Single message PDF
GET /api/chat/sessions/:session_id/pdf                        → Complete session PDF
```

---

## 15. Internationalization (i18n)

### 15.1 Configuration

- **Library:** react-i18next with i18next-browser-languagedetector
- **Default Language:** Danish (`da`)
- **Supported Languages:** Danish (`da`), English (`en`)
- **Translation Files:** `src/locales/da.json` (1,109 lines), `src/locales/en.json` (1,107 lines)

### 15.2 Coverage

All user-facing strings are translated:
- Navigation labels
- Form labels and placeholders
- Error messages
- Button text
- Table headers
- Toast notifications
- PDF export content
- Support form
- Admin/Company portal labels

### 15.3 Usage Pattern

```jsx
const { t, i18n } = useTranslation();
const isDanish = i18n.language === 'da';

// In JSX
<span>{t('chat.newChat')}</span>

// In API calls — language is sent to backend for PDF generation
const response = await api.get(`/sessions/${id}/pdf?language=${i18n.language}`);
```

---

## 16. Caching & Rate Limiting (Redis)

### 16.1 Architecture

Uses **Upstash Redis REST API** (not TCP) for serverless compatibility:

**File:** `Nova-Insights-Backend/utils/redis_client.py`

### 16.2 Rate Limiting Rules

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login (`/api/auth/login`) | 5 attempts | 5 minutes |
| Signup (`/api/auth/signup`) | 5 attempts | 1 hour |
| Forgot Password (`/api/forgot-password`) | 3 attempts | 15 minutes |
| Verify OTP (`/api/verify-otp`) | 5 attempts | 15 minutes |
| Company Registration (`/api/company/register`) | 3 attempts | 1 hour |

### 16.3 Caching

| Data | TTL | Invalidation |
|------|-----|-------------|
| User Profile (`/api/auth/me`) | 5 minutes | On profile update |
| Chat session lists | Varies | On create/delete |

### 16.4 Health Check

```
GET /api/redis/health → { "status": "connected" | "error" }
```

---

## 17. Audit Logging

### 17.1 Overview

**File:** `Nova-Insights-Backend/utils/audit_logger.py`

Comprehensive audit logging for critical user and system actions. Every audit entry records:
- **Who:** User ID, email, role
- **What:** Action type (LOGIN, LOGOUT, CREATE_SESSION, DELETE_USER, etc.)
- **When:** Timestamp
- **Where:** IP address, user agent
- **Context:** Company ID, target resource, additional details

### 17.2 Audit Views

| View | Access | Scope |
|------|--------|-------|
| Company Audit Logs | Company Owner | Own company's actions only |
| Platform Audit Logs | Super Admin | All companies, all actions |
| Chat Histories | Company Owner / Super Admin | Read-only view of chat sessions |

### 17.3 Export

Audit logs and chat histories can be exported as CSV via:
- `GET /api/company/audit-logs/export`
- `GET /api/super-admin/audit-logs/export`
- `GET /api/company/chat-histories/export`

---

## 18. API Reference

### 18.1 Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/signup` | Register new user | No |
| POST | `/login` | Authenticate user | No |
| GET | `/me` | Get current user profile | Yes |
| POST | `/refresh-token` | Refresh access token | Cookie |

### 18.2 Chat (`/api/chat`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/sessions` | List user's chat sessions | Yes |
| POST | `/sessions` | Create new session | Yes |
| GET | `/sessions/:id` | Get session details | Yes |
| PUT | `/sessions/:id` | Rename session | Yes |
| DELETE | `/sessions/:id` | Delete session | Yes |
| GET | `/sessions/:id/messages` | Get session messages | Yes |
| POST | `/sessions/:id/messages` | Save new message | Yes |
| PATCH | `/sessions/:id/messages/:msgId` | Update message | Yes |
| POST | `/sessions/:id/files` | Store file metadata | Yes |
| GET | `/sessions/:id/files/:type` | Get file info | Yes |
| GET | `/sessions/:id/annotations` | List annotations | Yes |
| POST | `/sessions/:id/annotations` | Create annotation | Yes |
| PUT | `/annotations/:id` | Update annotation | Yes |
| DELETE | `/annotations/:id` | Delete annotation | Yes |
| GET | `/sessions/:id/messages/:msgId/pdf` | Download single message PDF | Yes |
| GET | `/sessions/:id/pdf` | Download complete session PDF | Yes |
| POST | `/proxy/query` | Proxy to Azure comparison agent | Yes |
| POST | `/proxy/upload` | Proxy file upload to Azure agent | Yes |
| GET | `/proxy/upload/progress/:id` | Poll upload progress | Yes |

### 18.3 Schedule Risk (`/api/schedule`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/analyses` | List analyses | Yes |
| POST | `/analyses` | Create analysis | Yes |
| GET | `/analyses/:id` | Get analysis details | Yes |
| PATCH | `/analyses/:id` | Update (rename) | Yes |
| DELETE | `/analyses/:id` | Delete analysis | Yes |
| POST | `/analyses/:id/upload` | Upload file for analysis | Yes |
| GET | `/analyses/:id/progress` | Poll analysis progress | Yes |

### 18.4 Company Management (`/api/company`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new company | No (rate limited) |
| GET | `/users` | List company users | Company Owner |
| POST | `/users` | Add user to company | Company Owner |
| PUT | `/users/:id` | Update company user | Company Owner |
| DELETE | `/users/:id` | Remove company user | Company Owner |
| GET | `/info` | Get company details | Company Owner |
| PUT | `/info` | Update company info | Company Owner |

### 18.5 Administration (`/api/admin`, `/api/super-admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | List users | Admin |
| POST | `/admin/users` | Create user | Admin |
| PUT | `/admin/users/:id` | Update user | Admin |
| DELETE | `/admin/users/:id` | Delete user | Admin |
| GET | `/super-admin/dashboard` | Platform dashboard | Super Admin |
| GET | `/super-admin/companies` | List all companies | Super Admin |
| POST | `/super-admin/companies` | Create company | Super Admin |
| PUT | `/super-admin/companies/:id` | Update company | Super Admin |
| DELETE | `/super-admin/companies/:id` | Delete company | Super Admin |
| GET | `/super-admin/users` | List all users | Super Admin |

### 18.6 Audit (`/api/company`, `/api/super-admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/company/audit-logs` | Company audit logs | Company Owner |
| GET | `/company/audit-logs/export` | Export as CSV | Company Owner |
| GET | `/company/chat-histories` | Company chat histories | Company Owner |
| GET | `/super-admin/audit-logs` | All audit logs | Super Admin |
| GET | `/super-admin/chat-histories` | All chat histories | Super Admin |

---

## 19. Data Flow: End-to-End Request Lifecycle

### 19.1 Comparison Analysis Flow

```
Step 1 — File Upload
────────────────────
Browser → POST /api/chat/proxy/upload (Flask)
         → POST /upload (Azure RAG Agent)
         → Azure Document Intelligence OCR (PDF)
         → Compact CSV chunking
         → Store in Supabase pgvector
         ← upload_id for polling

Step 2 — Progress Polling
─────────────────────────
Browser → GET /api/chat/proxy/upload/progress/:id (Flask)
         → GET /upload/progress/:id (Azure RAG Agent)
         ← { status, old_schedule.progress, new_schedule.progress }

Step 3 — Comparison Query
─────────────────────────
Browser → POST /api/chat/proxy/query (Flask)
         → POST /query (Azure RAG Agent)
         → Fetch ALL table chunks from both vector stores
         → Build context string (≤ 1.9 MB)
         → Azure OpenAI GPT-4.1 (temperature=0, seed=42)
         → Markdown → HTML (html_formatter.py)
         ← Structured HTML response

Step 4 — Message Persistence
────────────────────────────
Browser → POST /api/chat/sessions/:id/messages (Flask)
         → INSERT into chat_messages (content_type='html', is_html=true)
         ← message_id

Step 5 — Rendering
──────────────────
ChatWidget.HtmlMessageContent:
  → Parse .comparison-results → extract .category-section tables
  → Filter placeholder "..." rows
  → Pad short rows to match header count
  → Render interactive tables with Comments column
  → Render summary/health HTML sections below
```

### 19.2 Predictive Analysis Flow

```
Step 1 — Upload & Analyze
─────────────────────────
Browser → POST /api/schedule/analyses/:id/upload (Flask)
         → POST /predictive (Azure RAG Agent)
         → OCR → CSV chunks → Context string
         → Azure OpenAI GPT-4.1 (strict JSON schema)
         → Post-processing validation (false positive removal)
         → JSON → HTML (predictive_html_formatter.py)
         ← Structured HTML report

Step 2 — Storage
────────────────
Flask → UPDATE schedule_analyses SET result_html = :html, status = 'complete'

Step 3 — Rendering
──────────────────
ScheduleAnalysis.jsx renders HTML report directly via dangerouslySetInnerHTML
```

---

## 20. Deployment & Infrastructure

### 20.1 Development Environment

| Service | Port | Command |
|---------|------|---------|
| Frontend (Vite) | 5173 | `npm run dev` |
| Backend (Flask) | 5000 | `cd Nova-Insights-Backend && python app.py` |

### 20.2 Production Environment

| Service | Configuration |
|---------|--------------|
| Frontend | Vite builds to `dist/`, served as static files by Flask |
| Backend | Gunicorn with 360s worker timeout, port 5000 |
| Database | Replit PostgreSQL (accessed via `DATABASE_URL`) |
| Redis | Upstash Redis REST API |
| Azure RAG Agent | Separate Replit app (`nova-azure-ai-rag-agent.replit.app`) |

### 20.3 Production Build

```bash
# Frontend build
npm run build  # Outputs to dist/

# Backend serves both API and static frontend
cd Nova-Insights-Backend
gunicorn app:app --bind 0.0.0.0:5000 --timeout 360
```

Flask's catch-all route serves the React SPA:
```python
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')
```

---

## 21. Environment Variables & Secrets

### 21.1 Required Secrets

| Secret | Purpose | Where Used |
|--------|---------|-----------|
| `JWT_SECRET` | Access token signing | Flask auth middleware |
| `JWT_REFRESH_SECRET` | Refresh token signing | Flask token refresh |
| `DATABASE_URL` | PostgreSQL connection string | Flask backend |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint | Rate limiting, caching |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication | Rate limiting, caching |

### 21.2 Auto-Configured (Replit)

| Variable | Purpose |
|----------|---------|
| `REPLIT_DEV_DOMAIN` | Development preview URL |
| `REPLIT_DOMAINS` | Production domain(s) |

### 21.3 Startup Validation

The Flask backend **refuses to start** if `JWT_SECRET` is not set, printing clear instructions for resolution.

---

## 22. Coding Conventions & Standards

### 22.1 Frontend (React/JavaScript)

- **Components:** Functional components with hooks (no class components)
- **State:** React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`)
- **Naming:** PascalCase for components, camelCase for functions/variables
- **Styling:** Tailwind CSS utility classes (no separate CSS files per component)
- **API calls:** Axios via authenticated wrapper (`authApi.js`)
- **Error handling:** Try/catch with user-friendly toast notifications
- **i18n:** All user-facing strings use `t()` function from react-i18next

### 22.2 Backend (Python/Flask)

- **Architecture:** Blueprint-based modular routes
- **Naming:** snake_case for functions/variables, PascalCase for classes
- **DB access:** Direct psycopg2 with context-managed connections
- **Auth:** Decorator-based (`@token_required`, `@admin_required`)
- **Error responses:** Consistent JSON format: `{ "success": bool, "message": str }`
- **Logging:** Print statements with emoji indicators (✅ ❌ ℹ️)

### 22.3 Security Rules

- **Never** store tokens in localStorage or API response bodies
- **Never** expose raw database errors to the client
- **Always** validate and sanitize user input
- **Always** use parameterized SQL queries (no string concatenation)
- **Always** check token blacklist before accepting any JWT
- **Always** scope data queries by `company_id` and `user_id`

---

## Appendix A: Azure RAG Agent — Complete Backend Guide

The following is the complete technical reference for the Azure RAG Agent, the AI-powered backend that performs document processing, schedule comparison, and predictive analysis.

---

### A.1 System Overview

This backend is a FastAPI application that provides AI-powered analysis of construction project schedules. It has two independent agents:

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| **Comparison Agent** | Compares two schedules (old vs new) to find added, removed, delayed, accelerated, and modified tasks | Two PDF or CSV files | Structured HTML report with 6 mandatory sections |
| **Predictive Agent (Nova Insight)** | Analyzes a single schedule to detect delayed activities, perform root cause analysis, and provide decision support | One PDF or CSV file | Structured HTML report with 10 data cards |

Both agents use Azure OpenAI GPT-4.1 as the core LLM, with deterministic settings (`temperature=0`, `top_p=0.1`, `seed=42`) to ensure reproducible results. Both agents send as much schedule data as possible to the LLM (capped at 1.9MB to stay within the model's token limit).

### A.2 File Structure

```
src/
├── main.py                (838 lines)  # FastAPI app, all endpoints, progress tracking, CSV parsing
├── config.py               (39 lines)  # Pydantic settings from environment variables
├── database.py            (327 lines)  # PostgreSQL connection pool, table creation, CRUD operations
├── embeddings.py          (123 lines)  # Azure OpenAI embedding generation with batching and retry
├── vector_store.py        (165 lines)  # VectorStoreManager: create stores, search, fetch all
├── azure_ocr.py           (302 lines)  # Azure Document Intelligence OCR client
├── pdf_processor.py       (487 lines)  # PDF → compact CSV chunks (OCR table extraction)
├── agent.py               (847 lines)  # Comparison Agent: system prompt + RAGAgent class
├── predictive_agent.py    (903 lines)  # Predictive Agent: JSON schema + PredictiveAgent class
├── html_formatter.py     (1176 lines)  # Comparison report → structured HTML
└── predictive_html_formatter.py (778 lines)  # Predictive JSON → structured HTML
```

**Total: ~5,986 lines of Python**

### A.3 Database Layer

Uses **Supabase PostgreSQL** with **pgvector** extension. Connection pooling via `psycopg2.pool.ThreadedConnectionPool` (min: 2, max: 8, SSL required).

**Tables:**

| Table | Purpose |
|-------|---------|
| Vector tables (dynamic) | One per uploaded file, stores schedule data chunks with embeddings |
| `chat_memory` | Conversation history per session |
| `session_metadata` | Original PDF filenames for AI prompt injection |

### A.4 File Processing Pipeline

Both PDF and CSV files are normalized to the same compact CSV chunk format:

```
PDF  ──→  Azure OCR  ──→  Structured Tables  ──→  Compact CSV Chunks (250 rows/chunk)
CSV  ──→  Parse directly  ────────────────────→  Compact CSV Chunks (250 rows/chunk)
```

**PDF Quality-Based Selection:** Tries two extraction paths (structured tables vs raw markdown), scores each using `_data_quality_score()`, and selects the better one.

**Important:** No embeddings are generated for table chunks. They are stored with zero-vector placeholders because the system uses fetch-all retrieval, not similarity search.

### A.5 Comparison Agent

**File: `src/agent.py`** — 847 lines

Produces a mandatory 6-section output:

| Section | Content |
|---------|---------|
| Executive Actions | 3–5 prioritized recommendations with WHY, ROLE, EFFORT, RELATED IDs |
| Comparison Tables | Separate table per category (delayed, accelerated, added, removed, modified) |
| Root Cause Analysis | Why changes/delays occurred, grouped by cause |
| Impact Assessment | Downstream consequences of critical findings |
| Summary of Changes | Statistics overview |
| Project Health | Health score, impact breakdown, stat cards |

**Context retrieval:** Fetches ALL table chunks from both vector stores (not similarity search). Budget split equally between stores, capped at 1.9 MB total.

**Token management:** Auto-retry on context overflow — re-fetches at 85% budget, strips chat history.

### A.6 Predictive Agent (Nova Insight)

**File: `src/predictive_agent.py`** — 903 lines

Uses GPT-4.1's strict JSON schema output with 11 required fields. Four-phase analysis:

1. **Detection (Module A):** Delayed activity detection — `Startdato < reference_date AND progress = 0%`
2. **Decision Support:** Root cause classification, priority assignment (CRITICAL_NOW / IMPORTANT_NEXT / MONITOR)
3. **Forcing Assessment (Module F):** Rule-based evaluation of acceleration viability
4. **Executive Actions:** Synthesizes into 3 concrete actions with WHO, WHAT, WHEN, manpower indicators

**Post-processing validation:** Schema validation → false positive removal (days_overdue ≤ 0) → cascading cleanup → recount statistics.

### A.7 HTML Formatting Layer

**Comparison Formatter** (`html_formatter.py` — 1,176 lines): Converts markdown → structured HTML with styled section cards, color-coded category tables, priority badges, and health dashboard with stat cards. Counts actual table rows and overrides LLM-claimed counts for consistency.

**Predictive Formatter** (`predictive_html_formatter.py` — 778 lines): Converts JSON → 10 HTML data cards (hero section, executive actions, management conclusion, delayed activities table, root cause cards, priority actions, resource assessment, forcing assessment gauges, area summary bars).

### A.8 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| POST | `/upload` | Upload two files for comparison |
| GET | `/upload/progress/:id` | Poll upload status |
| POST | `/query` | Query comparison agent |
| POST | `/predictive` | Upload one file for predictive analysis |
| GET | `/predictive/progress/:id` | Poll analysis status |

### A.9 LLM Configuration

```python
temperature = 0        # Fully deterministic
top_p = 0.1            # Narrow sampling
seed = 42              # Fixed seed for reproducibility
max_tokens = 32768     # Max output tokens
MAX_CONTEXT_BYTES = 1_900_000   # ~1.9 MB context cap
MAX_MODEL_TOKENS = 1_047_576    # GPT-4.1 context window
```

**These values must NOT be changed** — they ensure consistent, reproducible analysis results.

### A.10 Key Design Decisions

1. **Fetch-All vs Similarity Search:** All schedule data is fetched and sent to the LLM. Construction schedule comparison requires seeing every row — similarity search would miss silently removed tasks.

2. **Compact CSV Format:** Both PDF and CSV inputs normalized to identical semicolon-separated format, ensuring identical LLM behavior regardless of input format.

3. **Zero-Vector Storage:** Table chunks stored with placeholder embeddings since no similarity search is performed. Saves API cost and processing time.

4. **Strict JSON Schema (Predictive):** Guarantees output structure via GPT-4.1's `response_format: json_schema` with `strict: True`, enabling reliable HTML rendering without fragile regex parsing.

5. **Count Consistency Override:** HTML formatter counts actual parsed table rows and overrides LLM-claimed counts, since LLM may analyze more tasks internally than it outputs due to token limits.

6. **Session Metadata:** Original PDF filenames stored and injected into AI prompts so the LLM can reference real document names in its analysis.

---

*This document is maintained by the Engineering team at Nordic AI Group ApS. For questions, contact the development team or refer to the project's `replit.md` for the latest configuration details.*
