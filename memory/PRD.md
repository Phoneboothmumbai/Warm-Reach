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
- [ ] AWS SES email sending
- [ ] Message scheduling with cron jobs

## P0 Features Completed
- [x] AI message generation (OpenAI GPT-5.2 via Emergent LLM Key)
- [x] WhatsApp Business Cloud API integration (settings & sending)

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

---

## Update: Sample CSV Template & WhatsApp Integration (Dec 2025)

### Features Added

#### 1. Sample CSV Template Download
- New endpoint: `GET /api/blueprints/import/template`
- Returns downloadable CSV with 5 pre-filled sample blueprints
- Covers email, whatsapp, and linkedin channels
- Includes proper placeholders ({{first_name}}, {{company_name}}, etc.)
- Download button added to Blueprints page Import dialog

#### 2. WhatsApp Business Cloud API Integration
- New Settings > Integrations tab in frontend
- WhatsApp configuration form with:
  - Phone Number ID input
  - Access Token input (masked with show/hide toggle)
  - Verify & Save button
  - Link to Meta documentation
- Backend endpoints:
  - `GET /api/settings/whatsapp` - Check configuration status
  - `POST /api/settings/whatsapp` - Save and validate credentials
  - `DELETE /api/settings/whatsapp` - Remove configuration
  - `POST /api/whatsapp/send` - Send WhatsApp message
- Credential validation via Meta Graph API before saving
- Credentials stored per-tenant (multi-tenant safe)

#### 3. WhatsApp Message Sending
- Endpoint: `POST /api/whatsapp/send`
- Uses Meta's official Cloud API (v19.0)
- Rate limit enforcement (10 messages/day)
- Requires user's own WhatsApp Business API credentials

### API Endpoints Added
- `GET /api/blueprints/import/template` - Download sample CSV
- `GET /api/settings/whatsapp` - Get WhatsApp config status
- `POST /api/settings/whatsapp` - Save WhatsApp credentials
- `DELETE /api/settings/whatsapp` - Remove WhatsApp config
- `POST /api/whatsapp/send` - Send WhatsApp message

### Test Results
- Backend: 100% (15/15 tests passed)
- Frontend: 100% (all UI components verified)

### Integration Notes
- WhatsApp requires real Meta Business API credentials to send messages
- Users obtain credentials from Meta Developer Dashboard
- AWS SES and LinkedIn integrations still planned for future

---

## Update: Parallel WhatsApp Integration (Dec 2025)

### Architecture: Two Completely Separate WhatsApp Paths

```
WhatsApp Layer
│
├── Cloud API Connector (Primary, Safe)
│   ├── API-based sending via Meta Graph API
│   ├── Webhook-based receiving
│   └── Collections: wa_cloud_messages, wa_cloud_contacts
│
└── WhatsApp Web Connector (Secondary, Risk-Gated)
    ├── QR Scan Authentication via Baileys
    ├── Node.js Microservice (wa-web-service)
    ├── Redis for session storage
    └── Collections: wa_web_messages, wa_web_contacts, wa_web_sessions
```

### Key Design Decisions
1. **Complete Data Isolation**: Cloud API and Web have separate database collections
2. **No Data Sync**: Messages never cross between integrations
3. **Separate Inboxes**: Each integration has its own chat view
4. **Risk Controls for Web**: Requires explicit risk acceptance, stricter rate limits

### Cloud API Endpoints (Phase 1 - Complete)
- `POST /api/wa/cloud/send` - Send message via Cloud API
- `GET /api/wa/cloud/inbox` - Get Cloud API contacts
- `GET /api/wa/cloud/chat/{contact_id}` - Get chat thread
- `GET/POST /api/whatsapp/webhook` - Webhook for message status/receiving

### WhatsApp Web Endpoints (Phase 2 - Complete)
- `GET /api/wa/web/status` - Get Web session status
- `POST /api/wa/web/enable` - Enable Web integration (owner only)
- `POST /api/wa/web/disable` - Disable Web integration
- `POST /api/wa/web/start` - Start QR login (requires risk acceptance)
- `POST /api/wa/web/disconnect` - Disconnect session
- `POST /api/wa/web/send` - Send message via Web
- `GET /api/wa/web/inbox` - Get Web contacts
- `GET /api/wa/web/chat/{contact_id}` - Get chat thread
- `POST /api/wa/web/webhook` - Internal webhook from Node.js service

### Node.js Microservice (wa-web-service)
- Location: `/app/wa-web-service/`
- Uses Baileys (@whiskeysockets/baileys) for WhatsApp Web
- Redis for session persistence
- Rate limit: 20 messages/hour (stricter than Cloud API)
- Endpoints: `/session/:tenantId/start`, `/session/:tenantId/disconnect`, `/session/:tenantId/send`

### Database Collections Added
- `wa_cloud_messages` - Cloud API messages
- `wa_cloud_contacts` - Cloud API contacts
- `wa_web_messages` - WhatsApp Web messages
- `wa_web_contacts` - WhatsApp Web contacts
- `wa_web_sessions` - WhatsApp Web session state

### Risk Controls for WhatsApp Web
- ✅ Feature disabled by default
- ✅ Owner-only enable/disable
- ✅ Mandatory risk acceptance checkbox
- ✅ Prominent ban warning in UI
- ✅ Stricter rate limits (20/hour vs 10/day)
- ✅ Kill switch capability (disable endpoint)

### Frontend Updates
- New WhatsApp page (`/whatsapp`) with two tabs:
  - "Cloud API" tab - Primary, official integration
  - "Web Login" tab - Secondary, risk-gated integration
- Each tab has separate inbox view
- Integration type badge on each chat
- Connected phone number displayed per inbox



---

## Update: Full Business Context in AI Prompts (Feb 2026)

### What Was Requested
User provided detailed "Brands & Solutions" context to be incorporated into all AI-generated content:
- IT Solutions company + NeoStore retail arm
- Hardware: Apple, Lenovo, Dell, HP
- Cloud: Google Workspace, Microsoft 365, Azure
- Networking: Cisco (Meraki), Ubiquiti, Fortinet, SonicWall
- Backup: Veeam, Acronis, Datto
- Endpoint Management: Jamf, Intune, Kandji
- Monitoring: ConnectWise, NinjaRMM, Domotz

### What Was Implemented

#### Updated Functions in `/app/backend/server.py`:
1. **`generate_ai_message()`** - Full business context with all brands and solutions
2. **`generate_ai_blueprint()`** - Comprehensive context for blueprint generation

#### Key Additions to AI Prompts:
- Complete list of hardware brands (Apple, Dell, HP, Lenovo) with specific product lines
- Cloud & productivity tools (Google Workspace, Microsoft 365, Azure)
- Networking & security vendors (Cisco Meraki, Ubiquiti, Fortinet, SonicWall)
- Backup solutions (Veeam, Acronis, Datto)
- Endpoint management tools (Jamf, Intune, Kandji)
- Instructions to tailor messages based on contact's industry
- Reference relevant brands/solutions contextually

### Test Results
- ✅ AI Blueprint Generation: Working with full context
- ✅ AI Message Generation: Personalized with brand references
- ✅ Industry-specific: Adapts language for Finance, Healthcare, Technology
- ✅ Channel compliance: Email (4-6 lines), WhatsApp (3 lines max)
- ✅ No pricing mentioned
- ✅ No competitor names

### Sample Generated Content
- Email for IT Manager at TechCorp: "Apple/Windows endpoints... Jamf/Intune... NeoStore supports Apple-heavy and hybrid setups"
- WhatsApp for Healthcare: "proactive monitoring + patching across Apple/Windows endpoints"
- Finance risk email: "security, monitoring, and lifecycle management across Apple and Windows"

