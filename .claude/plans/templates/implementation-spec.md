# Implementation Spec Sheet

> Bridge document for full-stack features. Team 3 (Back-End API) builds to this spec, then Team 1 (UI/UX) consumes it.

---

## Feature Summary

<!-- One paragraph: what this feature does and why it exists -->

---

## API Contract

### Endpoints

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| `GET` | `/api/...` | Required | API (60/min) | ... |
| `POST` | `/api/...` | Required | API (60/min) | ... |

### Request/Response Shapes

**`POST /api/...`**

Request:
```typescript
{
  field: string;
  optionalField?: number;
}
```

Response (200):
```typescript
{
  id: string;
  createdAt: string;
  // ...
}
```

Error responses:
| Status | Condition |
|--------|-----------|
| 400 | Invalid input (validation failure) |
| 401 | Not authenticated |
| 403 | Not authorized for this resource |
| 404 | Resource not found |
| 429 | Rate limit exceeded |

---

## Schema Changes

### New Models

```prisma
model NewModel {
  id        String   @id @default(cuid())
  // fields...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Modified Models

| Model | Change | Migration Notes |
|-------|--------|-----------------|
| `ExistingModel` | Add `newField String?` | Nullable — no data migration needed |

### Indexes

```prisma
@@index([projectId, createdAt])
```

---

## UI Requirements

### Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/project/[slug]/...` | `NewFeaturePage` | ... |

### Components

| Component | Props | Notes |
|-----------|-------|-------|
| `FeatureCard` | `data: FeatureData` | Uses design tokens, responsive |
| `FeatureForm` | `onSubmit: (data) => void` | Validation, error states |

### User Flow

1. User navigates to...
2. User clicks...
3. System shows...
4. On success...

### Design References

- Colors: `lib/design-tokens.ts`
- Components: Shadcn/Radix UI primitives from `components/ui/`
- Patterns: Match existing project pages (e.g., `app/project/[slug]/page.tsx`)

---

## Acceptance Criteria

- [ ] API returns correct response shapes for all endpoints
- [ ] Validation rejects invalid inputs with descriptive errors
- [ ] UI renders correctly on desktop and mobile
- [ ] ARIA labels present on all interactive elements
- [ ] Unit tests cover API routes (happy path + error cases)
- [ ] E2E test covers the primary user flow

---

## Dependencies

| Dependency | Required? | Fallback |
|------------|-----------|----------|
| PostgreSQL | Yes | None |
| ... | No | ... |

**Environment variables needed:**
- `EXISTING_VAR` — already configured
- `NEW_VAR` — needs to be added to `.env`
