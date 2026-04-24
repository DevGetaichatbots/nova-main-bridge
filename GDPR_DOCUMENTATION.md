# Nova Insights - GDPR Compliance Documentation

**Last Updated:** December 22, 2025  
**Application:** Nova Insights - AI-Powered Project Schedule Analysis  
**Architecture:** React Frontend + External Flask Backend  
**Status:** Frontend-Only Application (Backend hosted separately)

---

## Executive Summary

Nova Insights processes user data including authentication credentials, uploaded PDF/document files, extracted task data, and chat interactions with AI services. This document outlines GDPR compliance requirements, critical data protection cases, and implementation status.

---

## 1. Data Processing Overview

### 1.1 Data Types Collected

| Data Category | Data Points | Storage Location | Retention |
|---------------|-------------|------------------|-----------|
| **User Account** | Name, Email, Password (hashed) | External PostgreSQL | Until account deletion |
| **Company Info** | Company name, Address, Industry, Phone | External PostgreSQL | Until account deletion |
| **Uploaded Files** | PDF, DOC, DOCX, TXT documents | Temporary processing | Session-based |
| **Extracted Data** | Task names, dates, durations, responsible parties | External database | Session-based |
| **Chat History** | User queries, AI responses | localStorage (client) | Session-based |
| **Session Data** | Session IDs, timestamps | localStorage + backend | Cleared on logout |
| **Support Requests** | Name, email, phone, message, attachments | WhatsApp + Google Sheets | Indefinite |

### 1.2 Data Flow Architecture

```
User Browser (Frontend)
        │
        ├── Auth Data ──────► External Backend (PostgreSQL)
        │                     https://nova-insights-backend-nordic-ai.replit.app
        │
        ├── File Uploads ───► n8n Webhook → AI Processing
        │                     https://kasras.app.n8n.cloud/webhook/...
        │
        ├── Chat Queries ───► n8n RAG AI Agent → OpenAI/Gemini
        │                     https://kasras.app.n8n.cloud/webhook/...
        │
        └── Support Data ───► WAAPI (WhatsApp) + Google Sheets
                              https://waapi.app/api/...
```

---

## 2. Critical GDPR Cases

### CASE 1: Third-Party Data Sharing (CRITICAL)

**GDPR Articles:** Art. 28 (Processor obligations), Art. 13-14 (Information obligations)

**Current Third-Party Processors:**

| Service | Data Shared | Purpose | GDPR Status |
|---------|-------------|---------|-------------|
| **OpenAI API** | Chat messages, file content | AI response generation | ⚠️ Requires DPA |
| **Google Gemini** | Document content | PDF extraction | ⚠️ Requires DPA |
| **n8n Cloud** | Queries, session IDs, files | Workflow automation | ⚠️ Requires DPA |
| **WAAPI** | Support messages, user info | WhatsApp notifications | ⚠️ Requires DPA |
| **Google Sheets** | Support request data | Request tracking | ⚠️ Requires DPA |
| **Replit Hosting** | All application data | Infrastructure | Check Terms |

**Risk:** User data transmitted to US-based processors without explicit consent.

**Required Actions:**
1. Obtain signed Data Processing Agreements (DPAs) from all processors
2. Add explicit user consent for AI processing during signup
3. Document all third-party services in Privacy Policy
4. Enable "zero retention" option on OpenAI if available

---

### CASE 2: User Consent Mechanisms (CRITICAL)

**GDPR Articles:** Art. 6 (Lawfulness), Art. 7 (Consent conditions)

**Current State:** No explicit consent collection during signup or file upload.

**Required Consents:**
- [ ] Essential processing consent (account creation)
- [ ] AI processing consent (OpenAI, Gemini data sharing)
- [ ] Third-party sharing consent (n8n, WAAPI, Google Sheets)
- [ ] Cookie/localStorage consent

**Implementation Needed:**
```jsx
// During signup, add consent checkboxes:
☐ I consent to my data being processed for account management (required)
☐ I consent to AI processing of my uploaded documents
☐ I consent to third-party services for support notifications
```

---

### CASE 3: Right to Erasure / Account Deletion (CRITICAL)

**GDPR Article:** Art. 17 (Right to erasure)

**Current State:** No account deletion feature exists.

**Required Implementation:**
1. Add "Delete Account" button in Profile Settings
2. Cascade delete all user data:
   - User profile (PostgreSQL)
   - Uploaded files (temporary storage)
   - Extracted task data
   - Chat history (localStorage)
   - Session data
3. Send confirmation email
4. Log deletion for audit trail

**Data to Delete:**
```
users table → User account record
dalux_combined_updated → All session data for user
extraction_jobs → All job records for user
localStorage → Clear all client-side data
Third-party → Request deletion from processors
```

---

### CASE 4: Data Portability (HIGH PRIORITY)

**GDPR Article:** Art. 20 (Right to data portability)

**Current State:** No data export feature.

**Required Implementation:**
- "Download My Data" button in Profile Settings
- Export format: JSON or CSV
- Include: Profile, uploaded files metadata, chat history, extracted data

---

### CASE 5: Privacy Policy & Terms (CRITICAL)

**GDPR Articles:** Art. 13-14 (Information obligations)

**Current State:** No privacy policy or terms of service pages.

**Required Sections:**
1. Data Controller identity and contact
2. Types of data collected
3. Processing purposes and legal basis
4. Third-party recipients (all 6 services listed)
5. Data retention periods
6. User rights (access, rectification, erasure, portability)
7. International data transfers (US-based processors)
8. Complaint procedures

---

### CASE 6: Cookie/localStorage Consent (HIGH PRIORITY)

**GDPR/ePrivacy:** Cookie consent requirements

**Current localStorage Usage:**
- `accessToken` - JWT authentication token
- `user` - User profile data
- `i18nextLng` - Language preference
- Session data for file uploads
- Chat history

**Required Implementation:**
- Cookie consent banner on first visit
- Categorize as Essential vs Functional
- Allow users to manage preferences
- Store consent record

---

## 3. Security Implementation Status

### Current Security Measures ✅

| Measure | Status | Details |
|---------|--------|---------|
| Password Hashing | ✅ Implemented | bcrypt with salt |
| JWT Authentication | ✅ Implemented | 7-day expiry |
| XSS Protection | ✅ Implemented | DOMPurify sanitization |
| HTTPS | ✅ Production | TLS encryption in transit |
| Input Validation | ✅ Partial | File type validation, email validation |
| Role-Based Access | ✅ Implemented | Admin/User roles |

### Security Gaps ⚠️

| Gap | Risk Level | Recommendation |
|-----|------------|----------------|
| No rate limiting | Medium | Implement API rate limiting |
| No database encryption at rest | Medium | Enable PostgreSQL encryption |
| No audit logging | High | Log all data access events |
| No token revocation | Medium | Implement JWT blacklist on logout |
| CORS configuration | Low | Restrict to specific domains |

---

## 4. Role-Based Access Control

### User Roles

| Role | Access Level | Permissions |
|------|-------------|-------------|
| **Guest** | Public | View homepage, login/signup |
| **User** | Authenticated | Upload files, chat, profile management, support |
| **Admin** | Full access | All user permissions + Admin Portal (user management) |

### Protected Routes

| Route | Required Role | Description |
|-------|--------------|-------------|
| `/` | Guest/User | Homepage with file upload |
| `/login` | Guest | Login page |
| `/signup` | Guest | Registration page |
| `/support` | Guest/User | Support request form |
| `/profile` | User | Profile settings |
| `/admin` | Admin | User management portal |
| `/forgot-password` | Guest | Password reset flow |

### Admin Portal Permissions

- View all users with pagination
- Create new users with company info
- Edit user details and roles
- Delete users
- Search and filter users

---

## 5. Data Retention Policies

### Recommended Retention Periods

| Data Type | Retention Period | Cleanup Method |
|-----------|------------------|----------------|
| User accounts | Until deletion request | Manual or auto after 2 years inactive |
| Uploaded files | Session-based | Auto-delete after session end |
| Extracted data | 90 days | Scheduled cleanup job |
| Chat history | Session-based | Cleared on logout/session end |
| Support requests | 3 years | Legal requirement |
| Audit logs | 2 years | Archive then delete |

---

## 6. International Data Transfers

### Data Transfer Destinations

| Processor | Location | Transfer Mechanism |
|-----------|----------|-------------------|
| OpenAI | United States | Standard Contractual Clauses (SCCs) required |
| Google (Gemini) | United States | Google Cloud DPA |
| n8n Cloud | Europe/US | Check n8n terms |
| WAAPI | Unknown | Verify location, obtain DPA |
| Replit | United States | Replit Terms of Service |

**Action Required:** Ensure all US-based transfers have appropriate safeguards (SCCs, DPAs) following Schrems II requirements.

---

## 7. Breach Response Plan

### Incident Response Timeline

| Timeframe | Action |
|-----------|--------|
| 0-4 hours | Identify and contain breach |
| 4-24 hours | Assess scope and affected users |
| 24-72 hours | Notify supervisory authority (if required) |
| Within 72 hours | Notify affected users (high-risk breaches) |
| Post-incident | Document lessons learned, update procedures |

### Current Monitoring

- ✅ WhatsApp error alerts for API failures
- ⚠️ No dedicated security incident detection
- ⚠️ No audit trail for data access

---

## 8. Compliance Checklist Summary

| Requirement | Status | Priority |
|-------------|--------|----------|
| Privacy Policy | ❌ Missing | CRITICAL |
| Terms of Service | ❌ Missing | CRITICAL |
| User Consent Mechanisms | ❌ Missing | CRITICAL |
| Account Deletion | ❌ Missing | CRITICAL |
| Data Export | ❌ Missing | HIGH |
| Cookie Consent Banner | ❌ Missing | HIGH |
| Data Processing Agreements | ❌ Missing | CRITICAL |
| Audit Logging | ❌ Missing | HIGH |
| Breach Response Plan | ⚠️ Partial | MEDIUM |
| Data Retention Policies | ⚠️ Partial | MEDIUM |

---

## 9. Recommended Implementation Roadmap

### Phase 1: Critical (Weeks 1-2)
1. Create Privacy Policy page
2. Create Terms of Service page
3. Add consent checkboxes to signup form
4. Obtain DPAs from third-party processors

### Phase 2: High Priority (Weeks 3-4)
1. Implement account deletion feature
2. Add data export functionality
3. Create cookie consent banner
4. Add audit logging

### Phase 3: Medium Priority (Weeks 5-6)
1. Implement data retention automation
2. Create breach response documentation
3. Security hardening (rate limiting, CORS)
4. Regular compliance audits

---

## 10. Contact Information

**Data Controller:** [Company Name]  
**Data Protection Contact:** [Email]  
**Supervisory Authority:** [Relevant EU Authority]

---

*This document should be reviewed and updated quarterly or when significant changes are made to data processing activities.*
