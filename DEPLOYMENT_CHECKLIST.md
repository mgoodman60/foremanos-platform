# ForemanOS Deployment Checklist & Technical Debt Report

**Generated:** February 2, 2026
**Platform Status:** 98.3% Feature Complete
**Test Coverage:** 6,886 tests (6,559 Vitest + 327 E2E)

---

## Quick Summary

| Category | Status | Action Required |
|----------|--------|-----------------|
| Core Features | 98.3% Complete | RFI modal UI incomplete |
| Database Schema | Ready | Need migration capture |
| Build Configuration | Ready | vercel.json created |
| Security Headers | Configured | CSP needs enhancement |
| API Keys | Not Set | Required before launch |
| Technical Debt | 410-505 hours | Prioritized below |

---

## Part 1: Pre-Deployment Checklist

### Required Environment Variables (Vercel Dashboard)

```bash
# CRITICAL - Must set before deployment
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?pgbouncer=true&connection_limit=1&pool_timeout=10
NEXTAUTH_SECRET=<32-char-random-string>
NEXTAUTH_URL=https://your-domain.vercel.app

# AI/LLM - At least one required
ANTHROPIC_API_KEY=sk-ant-api03-...
# OR
OPENAI_API_KEY=sk-proj-...

# File Storage - Required
AWS_REGION=us-west-2
AWS_BUCKET_NAME=your-bucket
AWS_FOLDER_PREFIX=foremanos/
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Payments - Required for subscriptions
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional but recommended
REDIS_URL=redis://...
CRON_SECRET=<32-char-secret>
OPENWEATHERMAP_API_KEY=...
```

### Database Setup Steps

1. **Create PostgreSQL database** (Vercel Postgres, Neon, or Supabase recommended)
2. **Add connection string** with pooling parameters
3. **Run initial migration**:
   ```bash
   npx prisma migrate deploy
   ```
4. **Seed admin user** (optional):
   ```bash
   npm run seed:test-user
   ```

### Stripe Configuration

1. Create products in Stripe Dashboard for each tier:
   - Free, Starter, Pro, Business, Enterprise, Unlimited
2. Get Price IDs and set environment variables:
   ```bash
   STRIPE_PRICE_STARTER_MONTHLY=price_xxx
   STRIPE_PRICE_PRO_MONTHLY=price_xxx
   # etc.
   ```
3. Configure webhook endpoint: `https://your-domain.vercel.app/api/stripe/webhook`

---

## Part 2: TODO Comments Found (3 Total)

### Medium Priority

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `lib/stripe.ts` | 30 | Stripe Price IDs using placeholder values | Set env vars with real Stripe product IDs |

### Low Priority (UI Features)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `app/project/[slug]/field-ops/rfis/page.tsx` | 25 | RFI detail/edit modal not implemented | Implement modal component |
| `app/project/[slug]/field-ops/punch-list/page.tsx` | 25 | Punch list item modal not implemented | Implement modal component |

---

## Part 3: Incomplete Features

### RFI Tracking (85% Complete)

**What Works:**
- API routes for CRUD operations
- Database models and relations
- Listing page with RFI display

**What's Missing:**
- Detail/edit modal UI when clicking an RFI
- Currently logs to console instead of opening modal

**Fix Required:** Create `RFIDetailModal` component and wire up to `onSelect` callback

### Schedule Coach Task Generator (Stub Implementation)

**File:** `app/api/projects/[slug]/schedule-coach/route.ts:284`

**Current State:** Returns placeholder tasks with generic names

**Fix Required:** Implement comprehensive task generation logic for all recommendation categories

---

## Part 4: Technical Debt Summary

### Critical Issues (Fix Before Production)

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| JSON.parse without try-catch | Server crashes on malformed input | 3 hours | P0 |
| CRON_SECRET validation weak | Possible auth bypass if env missing | 1 hour | P0 |
| No rate limiting on chunk upload | DoS vulnerability | 3 hours | P0 |
| Test upload route exposed | Debug endpoint in production | 1 hour | P0 |
| Path traversal on Windows | File access outside public dir | 2 hours | P0 |

**Total Critical:** 10 hours

### High Priority Issues

| Issue | Impact | Effort | Files Affected |
|-------|--------|--------|----------------|
| 184 `as any` type casts | Type safety bypassed | 25 hours | 184 files |
| Inconsistent error handling | Poor debugging, info leakage | 20 hours | 301 routes |
| 471 console.log statements | No structured logging | 45 hours | 471 files |
| Missing DB transactions | Data inconsistency risk | 15 hours | 20+ routes |
| No route param validation | Invalid input handling | 15 hours | 387 routes |

**Total High:** 120 hours

### Medium Priority Issues

| Issue | Impact | Effort |
|-------|--------|--------|
| Missing DB indexes | Slow queries at scale | 6 hours |
| Large files need refactoring | Maintenance difficulty | 40 hours |
| No OpenAPI documentation | API discovery hard | 25 hours |
| No request body size limits | Memory exhaustion risk | 2 hours |
| Environment var validation | Silent failures | 5 hours |
| Missing pagination | Performance issues | 10 hours |

**Total Medium:** 88 hours

### Low Priority Issues

| Issue | Effort |
|-------|--------|
| Unused imports in test files | 2 hours |
| Inconsistent comment styles | 4 hours |
| File naming conventions | 10 hours |
| Dark mode support | Future |
| Internationalization | Future |

**Total Low:** 16 hours

---

## Part 5: Security Audit Results

### Passed Security Checks

- NextAuth JWT authentication implemented
- Rate limiting on sensitive endpoints (chat, auth)
- HSTS, X-Frame-Options, X-Content-Type-Options headers
- Password validation with strength requirements
- Input validation with Zod on most routes
- Document access control by role
- S3 presigned URLs for file access

### Security Improvements Needed

1. **Add Content Security Policy** (next.config.js)
2. **Add CORS configuration** (middleware.ts)
3. **Implement prompt injection detection** for LLM
4. **Add request ID tracking** for audit trails
5. **Configure webhook signature verification** for all external services

---

## Part 6: Database Readiness

### Schema Status

- **112 models** properly defined
- **370 indexes** configured
- **125 cascade delete** relations
- **55 enums** for type safety

### Migration Action Items

1. **Capture current schema:**
   ```bash
   npx prisma migrate dev --name initial_schema_capture
   ```

2. **Apply performance indexes:**
   ```bash
   # Convert add_performance_indexes.sql to proper migration
   npx prisma migrate dev --name add_performance_indexes --create-only
   ```

3. **Verify with:**
   ```bash
   npx prisma migrate status
   ```

### Recommended Index Additions

```prisma
@@index([processingStatus])           // Document
@@index([documentId, chunkIndex])     // DocumentChunk
@@index([userId, conversationType])   // Conversation
@@index([projectId, costCode])        // BudgetItem
```

---

## Part 7: API Key Activation Checklist

### Before Enabling API Keys

- [ ] Verify rate limiting is working (test with curl)
- [ ] Confirm subscription tier enforcement
- [ ] Test webhook signature verification
- [ ] Set up monitoring alerts for API errors
- [ ] Configure spending limits in provider dashboards

### API Key Setup Order

1. **ANTHROPIC_API_KEY or OPENAI_API_KEY**
   - Test: Send chat message, verify response streams
   - Monitor: Token usage, error rates

2. **AWS credentials**
   - Test: Upload small file, verify S3 storage
   - Monitor: Storage costs, failed uploads

3. **STRIPE keys**
   - Test: Create test subscription, verify webhook
   - Monitor: Failed charges, subscription changes

4. **Optional integrations**
   - Weather API: Verify forecast data
   - Autodesk: Test OAuth flow
   - OneDrive: Test folder listing

### Chat Testing Checklist

- [ ] Send basic question, verify RAG retrieval
- [ ] Test project-specific context
- [ ] Verify rate limiting kicks in (20/min default)
- [ ] Test maintenance mode toggle
- [ ] Verify subscription limits enforced

---

## Part 8: Feature Status Matrix

### Complete Features (98.3%)

| Feature | API Routes | Pages | Tests |
|---------|-----------|-------|-------|
| Authentication | 4 | 3 | 30 |
| Document Upload | 6 | 1 | 20+ |
| Document Processing | 4 | 1 | 50+ |
| Chat & RAG | 1 | 1 | 100+ |
| Budget Management | 19 | 1 | 80+ |
| Schedule Management | 14 | 4 | 100+ |
| Daily Reports | 8 | 2 | 60+ |
| Takeoffs | 13 | 1 | 120+ |
| MEP Submittals | 35 | 6 | 50+ |
| Photos | 13 | 2 | 100+ |
| BIM Integration | 11 | 1 | 40+ |
| Compliance | 6 | 1 | 31+ |
| Admin Dashboard | 14 | 1 | 20+ |
| Stripe Payments | 3 | 0 | 31 |

### Partial Features

| Feature | Completion | Missing |
|---------|------------|---------|
| RFI Tracking | 85% | Detail/edit modal UI |

---

## Part 9: Phased Implementation Roadmap

### Phase 1: Production Launch (Week 1)

**Goal:** Get the platform live with core features

- [ ] Set all required environment variables
- [ ] Run database migrations
- [ ] Configure Stripe products and webhooks
- [ ] Enable AI API keys
- [ ] Deploy to Vercel
- [ ] Verify health check endpoint
- [ ] Test critical flows (signup, login, upload, chat)

### Phase 2: Critical Security Fixes (Week 2)

**Goal:** Address P0 security issues (10 hours)

- [ ] Add try-catch to all JSON.parse calls
- [ ] Fix CRON_SECRET validation
- [ ] Add rate limiting to upload-chunk
- [ ] Remove or protect test-upload route
- [ ] Fix Windows path traversal

### Phase 3: Stability & Monitoring (Weeks 3-4)

**Goal:** Improve reliability (40 hours)

- [ ] Standardize error handling across routes
- [ ] Add database transactions to multi-step operations
- [ ] Implement request ID tracking
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Configure log aggregation

### Phase 4: Feature Completion (Weeks 5-6)

**Goal:** Complete partial features (16 hours)

- [ ] Implement RFI detail/edit modal
- [ ] Implement punch list item modal
- [ ] Complete schedule coach task generator
- [ ] Add missing API documentation

### Phase 5: Code Quality (Weeks 7-10)

**Goal:** Reduce technical debt (100 hours)

- [ ] Replace `as any` casts with proper types
- [ ] Migrate console.log to structured logger
- [ ] Add route parameter validation
- [ ] Refactor large files (rag.ts, rag-enhancements.ts)

### Phase 6: Performance & Scale (Weeks 11-12)

**Goal:** Optimize for growth (40 hours)

- [ ] Add missing database indexes
- [ ] Implement query caching where needed
- [ ] Add pagination to list endpoints
- [ ] Configure CDN for static assets
- [ ] Set up database read replicas (if needed)

---

## Part 10: Workflow Documentation

### Core Workflows

1. **User Authentication**
   - Signup -> Email verify -> Login -> JWT session
   - Password reset via email link

2. **Document Processing**
   - Upload -> Virus scan -> Chunked S3 storage
   - Auto-classification -> Feature extraction (Phase A/B/C)
   - Data sync to rooms, scales, schedules, budgets

3. **Chat with RAG**
   - Query -> Rate limit -> Classification
   - RAG retrieval (1000+ point scoring)
   - Cache check -> LLM streaming -> Save response

4. **Budget Management**
   - Import CSV/PDF -> Parse items -> Set phases
   - Sync actuals from pay apps/invoices
   - Calculate EVM (PV, EV, AC, CPI, SPI)
   - Generate cost alerts

5. **Schedule Tracking**
   - Import from Primavera/Excel
   - Critical path analysis
   - 3-week look-ahead generation
   - Progress tracking via daily reports

6. **Field Operations**
   - Daily reports with labor/equipment/progress
   - Photo documentation with AI analysis
   - Punch list tracking
   - RFI management

7. **MEP Submittals**
   - Create or auto-import from specs
   - Spec compliance verification
   - Approval workflow
   - Equipment/material tracking

---

## Appendix A: File Reference

### Critical Files for Deployment

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel deployment config |
| `prisma/schema.prisma` | Database schema (112 models) |
| `lib/db.ts` | Database connection singleton |
| `lib/auth-options.ts` | NextAuth configuration |
| `next.config.js` | Next.js config with security headers |
| `.env.example` | Environment variable template |

### High-Traffic Endpoints

| Endpoint | Function | Timeout |
|----------|----------|---------|
| `/api/chat` | Main chat with RAG | 60s |
| `/api/documents/upload-complete` | Finalize uploads | 60s |
| `/api/admin/finalize-reports` | Batch report processing | 60s |

---

## Appendix B: Test Commands

```bash
# Run all tests
npm test -- --run

# Run specific test file
npm test -- __tests__/lib/rag.test.ts --run

# Run E2E tests
npx playwright test

# Run single E2E file
npx playwright test e2e/smoke.spec.ts --project=chromium

# Check database connection
npx prisma db execute --stdin <<< "SELECT 1;"

# Verify build
npm run build
```

---

## Contact & Support

For issues with this deployment:
- GitHub: https://github.com/anthropics/claude-code/issues
- Documentation: See CLAUDE.md for detailed technical docs
