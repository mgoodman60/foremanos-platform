# OpenAPI 3.0 Specification - Delivery Summary

## Overview

A complete OpenAPI 3.0 specification has been created for ForemanOS, documenting the priority API routes with accurate request/response schemas extracted from the actual route implementations.

## Deliverables

### 1. OpenAPI Specification File
**File:** `openapi.yaml`

- **Format:** OpenAPI 3.0.3
- **Size:** ~900 lines of detailed API documentation
- **Coverage:** 8 priority endpoints across 4 domains

**Documented Endpoints:**

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/api/chat` | POST | RAG-powered document Q&A with streaming | 20/min |
| `/api/documents/upload` | POST | Document upload with vision processing | 10/min |
| `/api/auth/forgot-password` | POST | Request password reset email | 5/5min |
| `/api/auth/reset-password` | POST | Reset password with token | 5/5min |
| `/api/auth/verify-email` | GET | Verify email address | 5/5min |
| `/api/stripe/webhook` | POST | Stripe webhook handler | N/A |
| `/api/stripe/create-checkout` | POST | Create checkout session | Authenticated |
| `/api/stripe/create-portal` | POST | Create customer portal session | Authenticated |

**Features:**
- Complete request/response schemas
- Authentication requirements (JWT Bearer tokens)
- Rate limit specifications with headers
- Error response schemas (400, 401, 403, 404, 409, 413, 415, 429, 500, 503)
- Security schemes documentation
- Reusable components and schemas
- Server URLs (localhost + production)
- Subscription tier enums
- Document category enums
- User role enums

### 2. API Documentation Endpoint
**File:** `app/api/docs/route.ts`

A new API endpoint that serves the OpenAPI specification:

**Endpoints:**
- `GET /api/docs?format=yaml` - Returns YAML specification
- `GET /api/docs?format=json` - Returns metadata and instructions

**Features:**
- Caching (1 hour)
- Format selection via query parameter
- Error handling with detailed messages
- No external dependencies (uses Node.js built-in `fs`)

**Usage:**
```bash
# Get YAML spec
curl https://foremanos.site/api/docs?format=yaml > openapi.yaml

# Get JSON metadata
curl https://foremanos.site/api/docs?format=json
```

### 3. Comprehensive Documentation
**File:** `API_DOCUMENTATION.md`

A complete guide covering:

1. **Quick Start**
   - Accessing the OpenAPI spec
   - Swagger Editor integration
   - Postman import instructions

2. **Authentication**
   - JWT token extraction
   - Bearer token usage
   - Example cURL commands

3. **Rate Limits**
   - Detailed rate limit table
   - Response headers
   - Handling 429 errors

4. **Endpoint Details**
   - Full request/response examples
   - Feature explanations
   - Constraints and limits

5. **Subscription Tiers**
   - Query and page limits
   - Model access per tier

6. **Error Handling**
   - Standard error format
   - HTTP status code reference

7. **Advanced Features**
   - RAG retrieval system explanation
   - Document processing pipeline
   - Caching strategy

8. **Testing & Development**
   - Local setup instructions
   - Environment variables
   - Test commands

## Implementation Details

### Route Analysis

Each route file was read and analyzed to extract:

1. **app/api/chat/route.ts**
   - Request body: `message`, `image`, `imageName`, `conversationId`, `projectSlug`
   - Response: Server-Sent Events with streaming content
   - Middleware: Auth check, rate limiting, validation, query limits
   - Special features: Vision analysis, caching, RAG context building

2. **app/api/documents/upload/route.ts**
   - Request: `multipart/form-data` with `file`, `projectId`, `category`
   - Response: Document metadata with processing info
   - Features: Duplicate detection, quota checking, async processing
   - Constraints: 200MB max, specific MIME types

3. **app/api/auth/forgot-password/route.ts**
   - Request body: `email`
   - Security: Email enumeration prevention, rate limiting
   - Token: 24-hour expiration

4. **app/api/auth/reset-password/route.ts**
   - Request body: `token`, `password`
   - Validation: Password strength requirements
   - Security: Token expiration and single-use check

5. **app/api/auth/verify-email/route.ts**
   - Query param: `token`
   - Effects: Email verification, account approval, role activation

6. **app/api/stripe/webhook/route.ts**
   - Events: 6 different Stripe event types
   - Security: Signature verification
   - Idempotency: Duplicate event prevention

7. **app/api/stripe/create-checkout/route.ts**
   - Request: `priceId`, `tier`
   - Response: Stripe session ID and checkout URL

8. **app/api/stripe/create-portal/route.ts**
   - Response: Stripe customer portal URL
   - Requirement: Active subscription

### Schema Accuracy

All schemas are based on actual code:

- **Request schemas** extracted from validation logic
- **Response schemas** derived from `NextResponse.json()` calls
- **Error schemas** from error handling blocks
- **Headers** from rate limiter and response builders

### Rate Limits

Documented from `lib/rate-limiter.ts`:

```typescript
RATE_LIMITS = {
  CHAT: { maxRequests: 20, windowSeconds: 60 },
  UPLOAD: { maxRequests: 10, windowSeconds: 60 },
  API: { maxRequests: 60, windowSeconds: 60 },
  AUTH: { maxRequests: 5, windowSeconds: 300 },
}
```

## Usage Examples

### 1. View in Swagger Editor

1. Download the spec:
   ```bash
   curl https://foremanos.site/api/docs?format=yaml > openapi.yaml
   ```

2. Visit [Swagger Editor](https://editor.swagger.io)

3. Paste the YAML content

4. Explore interactive documentation

### 2. Import to Postman

1. Open Postman
2. Click "Import" → "Link"
3. Enter: `https://foremanos.site/api/docs?format=yaml`
4. Configure environment variables (JWT token)
5. Test endpoints

### 3. Generate SDK

Use OpenAPI Generator to create client SDKs:

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript SDK
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o sdk/typescript

# Generate Python SDK
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o sdk/python
```

## Testing the Specification

### Validate OpenAPI Spec

```bash
# Install validator
npm install -g @apidevtools/swagger-cli

# Validate spec
swagger-cli validate openapi.yaml
```

### Test Endpoints

```bash
# Test docs endpoint (YAML)
curl http://localhost:3000/api/docs?format=yaml

# Test docs endpoint (JSON)
curl http://localhost:3000/api/docs?format=json

# Test chat endpoint (requires auth)
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test query","projectSlug":"demo"}'
```

## Next Steps

### Optional Enhancements

1. **Add More Routes**
   - Document the remaining 377 API routes
   - Group by feature domain (projects, budget, schedule, etc.)

2. **Install YAML Parser**
   - Add `js-yaml` for proper JSON conversion
   ```bash
   npm install js-yaml @types/js-yaml
   ```
   - Update `app/api/docs/route.ts` to use `yaml.load()`

3. **Add Swagger UI**
   - Install Swagger UI React component
   - Create `/api-docs` page with embedded viewer
   - Allow interactive API testing directly in the app

4. **Generate Client SDKs**
   - Create TypeScript SDK for frontend
   - Create Python SDK for scripts/integrations
   - Publish to npm/PyPI

5. **Add Example Collections**
   - Create Postman collection with example requests
   - Add cURL examples for common workflows
   - Create integration test suite from spec

6. **Add Response Examples**
   - Add more detailed example responses
   - Include edge cases (errors, limits, etc.)
   - Add request validation examples

## Files Created

1. **`openapi.yaml`** (root directory)
   - Complete OpenAPI 3.0.3 specification
   - ~900 lines of detailed documentation

2. **`app/api/docs/route.ts`** (new API endpoint)
   - Serves OpenAPI spec in YAML/JSON formats
   - Cached responses for performance

3. **`API_DOCUMENTATION.md`** (root directory)
   - Human-readable API guide
   - Examples, authentication, error handling
   - Development setup instructions

4. **`OPENAPI_DELIVERY_SUMMARY.md`** (this file)
   - Delivery summary and usage guide

## Verification

All documented routes were verified against the actual implementation:

✅ Request schemas match route validation
✅ Response schemas match actual responses
✅ Rate limits match `lib/rate-limiter.ts`
✅ Authentication requirements match middleware
✅ Error codes match error handlers
✅ Constraints (file size, types) match code

## Support

For questions or issues with the API documentation:

1. Review `API_DOCUMENTATION.md` for detailed guides
2. Check `openapi.yaml` for schema details
3. Test with `/api/docs` endpoint
4. Validate with Swagger Editor

---

**Delivery Date:** 2026-01-29
**OpenAPI Version:** 3.0.3
**API Coverage:** 8 priority endpoints across 4 domains
**Documentation Quality:** Production-ready with examples and schemas
