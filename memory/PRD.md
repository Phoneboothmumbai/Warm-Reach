# WarmReach - Warm Outreach Engine SaaS

## Original Problem Statement
Build a context-aware, controlled outreach SaaS that helps B2B service companies proactively create demand via Email, WhatsApp, and LinkedIn, without spamming, bans, or brand damage. The system must behave like a disciplined junior sales assistant, not a growth-hack bot.

## MVP Scope (Phases 0-5)
- Phase 0: Multi-tenant foundation with user roles
- Phase 1: Contact database with context flags
- Phase 2: Template/Blueprint engine with metadata
- Phase 3: AI message generation (template replacement for MVP)
- Phase 4: Scheduler & rate limiter
- Phase 5: Approval modes

## Architecture

### Backend (FastAPI + MongoDB)
- `/api/auth/*` - Authentication (JWT-based)
- `/api/contacts/*` - Contact CRUD with context flags
- `/api/blueprints/*` - Message blueprint management
- `/api/messages/*` - Message generation and approval
- `/api/inbox/*` - Reply handling and sentiment
- `/api/analytics/*` - Dashboard metrics
- `/api/settings/*` - Tenant and user management
- `/api/audit-logs` - Audit trail

### Frontend (React + Tailwind + Shadcn)
- Login/Register with tabs
- Dashboard with metrics and rate limits
- Contacts page with CRUD, search, filters, CSV import
- Blueprints page with channel/intent/angle/tone
- Messages page with generation and approval workflow
- Inbox page for reply sentiment classification
- Settings page with approval modes

## User Personas
1. **Owner** - Full access, manages tenant settings
2. **Admin** - Manages blueprints and users
3. **Sales User** - Creates contacts, generates messages
4. **Read-Only** - View-only access

## Core Requirements (Static)
- Multi-tenant architecture
- Context flags (has_open_support_ticket, recent_inbound_email, do_not_contact, etc.)
- Rate limits: Email 10/day, WhatsApp 10/day, LinkedIn 3/week
- Blueprint-based message generation
- Manual/Auto approval modes
- Sentiment-based contact management

## What's Been Implemented (Jan 2026)
- [x] Multi-tenant authentication (JWT)
- [x] User roles (Owner, Admin, Sales, ReadOnly)
- [x] Contact database with context flags
- [x] CSV import with deduplication
- [x] Blueprint engine with channel/intent/angle/tone
- [x] Message generation with template replacement
- [x] Message approval workflow
- [x] Inbox for reply sentiment
- [x] Dashboard with metrics and rate limits
- [x] Settings with approval modes
- [x] Audit logging
- [x] Dark/Light mode with system preference
- [x] Royal Blue (#4169E1) + Olive Green (#6B8E23) palette

## P0 Features Remaining
- [ ] Actual AI message generation (OpenAI GPT-5.2 integration)
- [ ] AWS SES email sending
- [ ] WhatsApp Business Cloud API integration
- [ ] Message scheduling with cron jobs

## P1 Features (Phase 6-7)
- [ ] LinkedIn post scheduling
- [ ] Webhook for email/WhatsApp replies
- [ ] Reply sentiment auto-classification with AI
- [ ] Bounce handling

## P2 Features (Phase 8-9)
- [ ] Analytics dashboard with charts
- [ ] A/B testing for blueprints
- [ ] Team collaboration features
- [ ] Webhook notifications

## Next Tasks
1. Integrate OpenAI GPT-5.2 for AI message generation
2. Implement AWS SES email sending
3. Add WhatsApp Business Cloud API
4. Build message scheduler with background tasks
5. Add charts to analytics dashboard

---

## Update: Batch Message Generation (Feb 2026)

### What Was Requested
User reported issues with the original message generation:
1. Same message generated over and over (no variation)
2. Manual selection of contact and blueprint each time
3. Only one message at a time

### What Was Implemented

#### Backend Changes (/app/backend/server.py)
- Added `/api/messages/generate-batch` endpoint
- Integrated OpenAI GPT-5.2 via Emergent LLM key for unique message generation
- AI generates personalized, unique messages using:
  - Contact information (name, company, job title)
  - Blueprint structure and metadata (intent, angle, tone)
  - Previous messages sent to avoid repetition
- Content hash deduplication to prevent identical messages
- Auto-selection of eligible contacts (not blacklisted, not in cooldown)
- Auto-selection of blueprints based on channel preference
- Rate limit enforcement during batch generation

#### Frontend Changes (/app/frontend/src/pages/MessagesPage.js)
- "Generate Batch" button in header
- Batch generation dialog with:
  - Number of messages to generate (1-50)
  - Optional channel filter (Email/WhatsApp/LinkedIn)
  - Optional blueprint filter
  - Clear explanation of how it works
- Bulk approve functionality (Select All + Approve All)
- Checkbox selection for individual message approval
- Delete button for messages before approval

### Test Results
- Backend: 100% (20/20 tests passed)
- AI Integration: Working with real OpenAI GPT-5.2
- Batch Generation: Working correctly

### Still MOCKED
- Email sending (AWS SES)
- WhatsApp sending (Cloud API)
- Messages stored in DB but not actually sent

---

## Update: Bulk Blueprint & AI Generation (Feb 2026)

### Features Added

#### 1. CSV Blueprint Import
- Upload CSV with blueprints
- Required columns: name, channel, structure
- Optional: intent, angle, tone, description, cooldown_days
- All imported blueprints require approval

#### 2. AI Blueprint Generation (Single)
- Select channel, intent, angle, tone
- Optional: industry, target_role, additional_context
- AI generates professional outreach template
- Requires approval before use

#### 3. AI Blueprint Generation (Batch)
- Multi-select channels, intents, angles
- Generates all combinations (e.g., 2×3×3 = 18 blueprints)
- All require approval

#### 4. Bulk Approve
- Select multiple pending blueprints
- Approve all at once

### API Endpoints Added
- `POST /api/blueprints/generate-ai` - Single AI blueprint
- `POST /api/blueprints/generate-batch-ai` - Batch AI generation
- `POST /api/blueprints/import` - CSV import
- `POST /api/blueprints/approve-bulk` - Bulk approve

### Test Results
- Backend: 100% (24/24 tests passed)
- All new features verified working
