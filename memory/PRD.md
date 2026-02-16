# WarmReach - Warm Outreach Engine SaaS

## Original Problem Statement
Build a context-aware, controlled outreach SaaS that helps B2B service companies proactively create demand via Email, WhatsApp, and LinkedIn, without spamming, bans, or brand damage. The system must behave like a disciplined junior sales assistant, not a growth-hack bot.

## Core Automation Loop (Set & Forget)
- Auto-generate and send messages to 10 random contacts via WhatsApp and 10 via Email per day
- Messages only during business hours (9 AM - 6 PM)
- Maximum 2 messages per contact per month
- System runs daily without manual intervention
- Approval workflow: user approves messages once, then added to automated queue

## Architecture

### Backend (FastAPI + MongoDB)
- `/api/auth/*` - Authentication (JWT-based)
- `/api/contacts/*` - Contact CRUD with context flags
- `/api/blueprints/*` - Message blueprint management
- `/api/messages/*` - Message generation and approval
- `/api/inbox/*` - Reply handling and sentiment
- `/api/analytics/*` - Dashboard metrics
- `/api/settings/*` - Tenant and user management
- `/api/admin/*` - Super Admin endpoints
- `/api/pages/*` - CMS for static pages
- `/api/wa/*` - WhatsApp integrations (Cloud API & Web)

### Frontend (React + Tailwind + Shadcn)
- Login/Register with tabs
- Dashboard with metrics and rate limits
- Contacts page with CRUD, search, filters, CSV import
- Blueprints page with channel/intent/angle/tone
- Messages page with generation and approval workflow
- Inbox page for reply sentiment classification
- Settings page with approval modes
- WhatsApp page with Cloud API and Web Login tabs
- Super Admin Portal (/admin) with CMS

### Microservice
- `/app/wa-web-service/` - Node.js service for WhatsApp Web (Baileys)

## User Personas
1. **Owner** - Full access, manages tenant settings
2. **Admin** - Manages blueprints and users
3. **Sales User** - Creates contacts, generates messages
4. **Read-Only** - View-only access
5. **Super Admin** - Platform-wide management (is_super_admin flag)

## What's Been Implemented

### Phase 0-5: Core MVP (Complete)
- [x] Multi-tenant authentication (JWT)
- [x] User roles (Owner, Admin, Sales, ReadOnly)
- [x] Contact database with context flags
- [x] CSV import with deduplication
- [x] Blueprint engine with channel/intent/angle/tone
- [x] AI message generation (OpenAI GPT-5.2 via Emergent LLM Key)
- [x] Message approval workflow
- [x] Inbox for reply sentiment
- [x] Dashboard with metrics and rate limits
- [x] Settings with approval modes
- [x] Audit logging
- [x] Dark/Light mode

### WhatsApp Integration (Complete)
- [x] WhatsApp Business Cloud API (settings, sending)
- [x] WhatsApp Web via Baileys (QR login, sending)
- [x] Separate data collections for each integration
- [x] Risk controls for WhatsApp Web

### SaaS Features (Complete)
- [x] Landing page with dynamic pricing
- [x] Super Admin Portal with:
  - Dashboard with platform metrics
  - Tenant management
  - User management (with password reset)
  - Plans/Pricing management
  - Subscriptions overview
  - CMS for static pages (Privacy, Terms, Contact)

### February 9, 2026 Updates
- [x] Fixed Super Admin credentials (ck@motta.in with is_super_admin: true)
- [x] Fixed is_super_admin not returned in login response
- [x] Fixed API prefix bug in SuperAdminPage.js (${API}/admin -> ${API}/api/admin)
- [x] Fixed get_super_admin function (using current_user["id"] instead of current_user["sub"])
- [x] Verified CMS Pages functionality working

### February 10, 2026 Updates
- [x] Business Profile feature for tenant-specific AI context
- [x] Custom Intents, Angles, CTAs management in Settings
- [x] Blueprint generator with Message Length and CTA options

### December 12, 2025 Updates (Current Session)
- [x] **AI Content Isolation Fix VERIFIED** - AI prompts now use ONLY tenant's Business Profile data
- [x] Tested with restaurant business profiles - NO IT/technology contamination
- [x] Proper error handling for tenants without business profiles
- [x] Fixed CTA dropdown sync with custom options
- [x] Changed `cta_type` from enum to string to support custom CTAs
- [x] Added paragraph spacing instructions to AI prompts
- [x] **Uncapped Message Generation** - Messages now auto-schedule into future (max 2/contact/month)
- [x] **Batch limit**: 50 messages per request
- [x] **Pause/Resume per Contact** - Scheduled dates shift forward when resumed
- [x] **Messages Page Grouped View** - Collapsible contact groups with message counts
- [x] **Contacts Page Integration** - "View Messages" and "Pause Outreach" in 3-dot menu
- [x] **Bulk Blueprint Delete** - New optimized bulk delete API endpoint
- [x] **AI Instructions** - Custom instructions for message & blueprint generation in Settings

### February 16, 2026 Updates
- [x] **WhatsApp Phone Number Formatting Fix VERIFIED** - Fixed bug where Indian phone numbers were sent without +91 country code
  - Added `format_phone_for_whatsapp()` function in `scheduler.py`
  - Handles all Indian number formats: 10-digit, with trunk prefix (0), with 91 prefix, with spaces/dashes
  - All 25 test cases passed (100% success rate)
  - Test files: `/app/backend/tests/test_phone_formatting.py`, `/app/backend/tests/test_whatsapp_phone_integration.py`

## P0 Features Remaining
- [ ] AWS SES email sending integration
- [ ] Full automation scheduler (10 WhatsApp + 10 email per day)

## P1 Features (Phase 6-7)
- [ ] LinkedIn API for company page post scheduling
- [ ] Webhook for email/WhatsApp replies
- [ ] Reply sentiment auto-classification with AI
- [ ] Bounce handling

## P2 Features (Phase 8-9)
- [ ] Analytics dashboard with charts
- [ ] A/B testing for blueprints
- [ ] Team collaboration features
- [ ] Webhook notifications
- [ ] Backend refactoring (split server.py into routers/services/models)

## Technical Debt
- `backend/server.py` is >4500 lines and needs refactoring into:
  - `backend/routers/` - API route handlers
  - `backend/services/` - Business logic
  - `backend/models/` - Pydantic models
  - `backend/core/` - Config, auth, dependencies

## Database Collections
- `users` - User accounts (with is_super_admin flag)
- `tenants` - Multi-tenant organizations
- `contacts` - Contact database
- `blueprints` - Message templates
- `messages` - Generated messages
- `replies` - Inbound replies
- `audit_logs` - Audit trail
- `plans` - Pricing plans
- `subscriptions` - Tenant subscriptions
- `pages` - CMS static pages
- `wa_cloud_messages`, `wa_cloud_contacts` - WhatsApp Cloud API
- `wa_web_messages`, `wa_web_contacts`, `wa_web_sessions` - WhatsApp Web

## Key Credentials
- Super Admin: ck@motta.in / Charu@123@
- Emergent LLM Key: Available in backend/.env
- Live domain: warmreach.in (deployed on Vultr)

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key (text generation)
- @whiskeysockets/baileys (WhatsApp Web)
- Redis (session persistence)
- Meta WhatsApp Business Cloud API (pending user credentials)
- AWS SES (pending implementation)
