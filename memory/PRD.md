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
