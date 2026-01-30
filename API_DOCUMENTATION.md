# ForemanOS API Documentation

This document provides a comprehensive guide to the ForemanOS API, including authentication, rate limits, and detailed endpoint specifications.

## Overview

ForemanOS is an AI-powered construction project management platform built with Next.js 14.2, Prisma ORM, and PostgreSQL. The API provides access to:

- **RAG-powered chat** for document Q&A
- **Document upload and processing** with vision AI
- **Authentication and user management**
- **Stripe payment integration**
- **385+ API routes** organized by feature domain

## Quick Start

### 1. Access the OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

```bash
# YAML format (recommended)
GET https://foremanos.site/api/docs?format=yaml

# JSON format (metadata only)
GET https://foremanos.site/api/docs?format=json
```

Or access the static file directly:
```bash
openapi.yaml
```

### 2. View Interactive Documentation

Use Swagger Editor to visualize the API:

1. Visit [Swagger Editor](https://editor.swagger.io)
2. Download the YAML spec from `/api/docs?format=yaml`
3. Paste the content into Swagger Editor
4. Explore endpoints, schemas, and try API calls

### 3. Test with Postman

Import the OpenAPI spec into Postman:

1. Open Postman
2. Click "Import" → "Link"
3. Enter: `https://foremanos.site/api/docs?format=yaml`
4. Configure authentication (see below)

## Authentication

Most API endpoints require JWT authentication via NextAuth.

### Getting a Token

1. **Sign up/Login via the web interface**
   - Visit `https://foremanos.site/login`
   - Create an account and verify email
   - Login to receive a session

2. **Extract JWT token**
   - Open browser DevTools → Application → Cookies
   - Find the `next-auth.session-token` cookie
   - Use this value as your Bearer token

### Using the Token

Include the token in the `Authorization` header:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

Example with cURL:
```bash
curl -X POST https://foremanos.site/api/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the clearance height?","projectSlug":"demo-project"}'
```

## Rate Limits

All endpoints are rate-limited to prevent abuse:

| Endpoint Type | Limit | Window | Identifier |
|--------------|-------|--------|------------|
| Chat API | 20 requests | 1 minute | User ID or IP |
| Upload API | 10 requests | 1 minute | User ID or IP |
| Auth API | 5 requests | 5 minutes | IP address |
| General API | 60 requests | 1 minute | User ID or IP |

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1706745600
Retry-After: 42
```

### Handling Rate Limits

When you exceed the limit (HTTP 429):

```json
{
  "error": "Too many requests. Please slow down and try again in a moment.",
  "retryAfter": 42
}
```

Wait for the `retryAfter` seconds before retrying.

## Priority API Endpoints

### 1. Chat API - POST /api/chat

**RAG-powered document Q&A with streaming responses.**

**Request:**
```json
{
  "message": "What is the clearance height for the HVAC duct in room 201?",
  "projectSlug": "senior-care-facility-2024",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "image": "data:image/png;base64,iVBORw0KG..."
}
```

**Response:** Server-Sent Events (SSE) stream

```
data: {"conversationId":"550e8400-e29b-41d4-a716-446655440000"}

data: {"content":"The clearance"}

data: {"content":" height for"}

data: {"content":" the HVAC duct..."}

data: {"metadata":{"citations":[...],"followUpSuggestions":[...]}}
```

**Features:**
- Streaming responses for real-time feedback
- Vision analysis for images
- Conversation history tracking
- Query caching for common questions
- 12-20 document chunks retrieved per query

**Rate Limit:** 20/minute

### 2. Document Upload - POST /api/documents/upload

**Upload construction documents for AI processing.**

**Request:** `multipart/form-data`

```bash
curl -X POST https://foremanos.site/api/documents/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@floor-plan.pdf" \
  -F "projectId=550e8400-e29b-41d4-a716-446655440000" \
  -F "category=architectural"
```

**Response:**
```json
{
  "Document": {
    "id": "doc_123",
    "name": "floor-plan",
    "fileName": "floor-plan.pdf"
  },
  "message": "Document uploaded successfully. Processing in background...",
  "processingInfo": {
    "estimatedPages": 24,
    "processorType": "vision",
    "remainingPages": 976,
    "tier": "pro"
  }
}
```

**Features:**
- Duplicate detection via file hash
- Automatic classification (architectural, MEP, civil, etc.)
- Vision-based PDF processing
- Subscription quota enforcement
- Async background processing

**Constraints:**
- Max file size: 200MB
- Allowed types: PDF, JPEG, PNG, TIFF, DOCX, TXT
- Rate limit: 10/minute

### 3. Auth Endpoints

#### Forgot Password - POST /api/auth/forgot-password

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent."
}
```

**Security:** Always returns success to prevent email enumeration.

#### Reset Password - POST /api/auth/reset-password

**Request:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "password": "NewP@ssw0rd123"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### Verify Email - GET /api/auth/verify-email

**Request:**
```bash
GET /api/auth/verify-email?token=v1e2r3i4f5y6t7o8k9e0n
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully! You can now login.",
  "User": {
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

### 4. Stripe Integration

#### Create Checkout Session - POST /api/stripe/create-checkout

**Request:**
```json
{
  "priceId": "price_1234567890abcdef",
  "tier": "pro"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_1234567890",
  "url": "https://checkout.stripe.com/pay/cs_test_1234567890"
}
```

**Flow:**
1. User selects a subscription tier
2. API creates Stripe checkout session
3. User is redirected to `url` for payment
4. After payment, Stripe webhook updates user account
5. User is redirected back to app

#### Create Portal Session - POST /api/stripe/create-portal

**Request:** Empty body

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

**Allows users to:**
- Update payment methods
- View invoices
- Cancel subscription
- Update billing information

#### Webhook Handler - POST /api/stripe/webhook

**Handles events:**
- `checkout.session.completed` - New subscription
- `customer.subscription.updated` - Subscription changes
- `customer.subscription.deleted` - Cancellation
- `invoice.paid` - Successful payment
- `invoice.payment_failed` - Failed payment

**Security:** Requires valid Stripe signature header.

## Subscription Tiers

| Tier | Monthly Queries | Pages/Month | Model Access |
|------|----------------|-------------|--------------|
| Free | 10 | 50 | GPT-4o Mini |
| Starter | 100 | 500 | GPT-4o |
| Pro | 1,000 | 2,000 | GPT-4o, o1-mini |
| Team | 5,000 | 10,000 | All models |
| Business | 25,000 | 50,000 | All models |
| Enterprise | Unlimited | Unlimited | All models |

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "details": "Additional context (dev mode only)"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created (e.g., document uploaded) |
| 400 | Bad Request | Invalid parameters or missing required fields |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions or quota exceeded |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource (e.g., duplicate document) |
| 413 | Payload Too Large | File exceeds 200MB limit |
| 415 | Unsupported Media Type | Invalid file type |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Maintenance mode or service issue |

## Advanced Features

### RAG Retrieval System

The chat API uses a sophisticated RAG (Retrieval-Augmented Generation) system:

**Scoring System:**
- 1000+ point scoring with construction terminology
- 60+ construction phrases recognized
- 25+ measurement patterns
- Notes section prioritization
- Adaptive chunk retrieval (12-20 chunks based on query type)

**Two-Pass Retrieval:**
1. **First Pass:** Initial semantic search
2. **Second Pass:** Cross-reference bundling with related content

**Vision Processing:**
- Scale detection (multiple scales, scale bars)
- Grid reference extraction
- Abbreviation expansion (180+ construction abbreviations)
- Isometric view interpretation
- MEP system topology reconstruction

### Document Processing Pipeline

When a document is uploaded:

1. **Upload to S3** - Stored in AWS S3 with signed URLs
2. **Duplicate Detection** - File hash comparison
3. **Classification** - Auto-categorize by content
4. **Queue Processing** - Background job with retry logic
5. **Vision Analysis** - Extract text, images, metadata
6. **Chunk Creation** - Split into searchable chunks
7. **Embedding Generation** - Create vector embeddings for RAG

### Caching Strategy

Queries are cached to reduce costs:
- **Simple queries:** Cached for 7 days
- **Moderate queries:** Cached for 3 days
- **Complex queries:** Cached for 1 day
- Cache key: Query + Project + Documents

## Testing

### Smoke Tests

Run basic API health checks:

```bash
npm test -- __tests__/smoke --run
```

### Integration Tests

Test chat API with real scenarios:

```bash
npm test -- __tests__/api/chat/integration --run
```

### E2E Tests

Run Playwright tests:

```bash
npx playwright test e2e/smoke.spec.ts --project=chromium
```

## Development

### Local Setup

1. **Clone repository**
   ```bash
   git clone https://github.com/yourorg/foremanos.git
   cd foremanos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Setup database**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Access API**
   ```
   http://localhost:3000/api/docs?format=yaml
   ```

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - 32-char random string
- `NEXTAUTH_URL` - http://localhost:3000

Optional:
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` - AI providers
- `STRIPE_SECRET_KEY` - Payments
- `AWS_REGION`, `AWS_BUCKET_NAME` - S3 storage
- `REDIS_URL` - Caching (fallback to in-memory)

## Support

- **Documentation:** This file and `openapi.yaml`
- **Issues:** GitHub Issues
- **Email:** support@foremanos.site

## License

Proprietary - All rights reserved
