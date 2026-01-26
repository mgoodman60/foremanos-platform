# ForemanOS - Developer Onboarding Guide

## Your Role

You are a senior full-stack developer and designer joining the ForemanOS project. Your responsibilities:

- Brainstorm and design new features
- Write clean, production-ready code
- Audit and improve existing code
- Identify bugs and technical debt
- Suggest architectural improvements

## Important: You Cannot Test Locally

You **CANNOT** run or test code locally. A separate system (DeepAgent) handles:
- Pulling from GitHub
- Running database migrations
- Testing builds
- Deploying to production (foremanos.site)

### Workflow
1. You write/modify code
2. User commits and pushes to GitHub
3. User tells DeepAgent "pull and deploy"
4. DeepAgent tests, fixes issues if needed, deploys

---

## Project Overview

**ForemanOS** is an AI-powered construction project management platform helping general contractors, project managers, and field teams manage:
- Documents (plans, specs, schedules)
- Schedules (Gantt, 3-week lookahead, critical path)
- Budgets (cost codes, change orders, EVM)
- MEP Submittals (workflow, quantity verification)
- Daily Reports (field logging, photos)
- Room Management (finishes, fixtures)

### Target Users
- General Contractors
- Project Managers
- Superintendents
- Field Engineers
- Subcontractors (limited access)

### Core Value Proposition
- AI chat that answers questions about project documents
- Automatic data extraction from uploaded documents
- Real-time project dashboards and reporting
- Streamlined submittal and change order workflows

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth.js (credentials provider) |
| Styling | Tailwind CSS + shadcn/ui |
| File Storage | AWS S3 |
| AI/LLM | Anthropic Claude / OpenAI |
| Toasts | Sonner |
| Icons | Lucide React |
| Data Fetching | React hooks + SWR |

---

## Project Structure

```
foremanos/
├── app/                      # Next.js App Router
│   ├── api/                  # 200+ API routes
│   │   ├── auth/            # NextAuth endpoints
│   │   ├── chat/            # AI chat with RAG
│   │   ├── projects/[slug]/ # Project-specific APIs
│   │   │   ├── budget/
│   │   │   ├── schedule/
│   │   │   ├── mep/
│   │   │   ├── documents/
│   │   │   ├── daily-reports/
│   │   │   ├── crews/
│   │   │   ├── rooms/
│   │   │   └── ...
│   │   ├── admin/
│   │   └── documents/
│   ├── dashboard/           # User dashboard
│   ├── project/[slug]/      # Dynamic project pages
│   │   ├── page.tsx         # Main project view
│   │   ├── budget/
│   │   ├── schedule/
│   │   ├── mep/
│   │   ├── reports/
│   │   ├── rooms/
│   │   └── models/          # 3D CAD/BIM viewer
│   ├── admin/
│   └── layout.tsx
│
├── components/
│   ├── ui/                  # shadcn/radix primitives
│   ├── chat/
│   ├── budget/
│   ├── schedule/
│   ├── submittals/
│   ├── landing/
│   └── ...
│
├── lib/                      # Utilities & services
│   ├── db.ts                # Prisma client singleton
│   ├── auth-options.ts      # NextAuth config
│   ├── s3.ts                # AWS S3 operations
│   ├── rag.ts               # RAG system for AI chat
│   ├── email-service.ts
│   ├── schedule-extractor-ai.ts
│   ├── budget-parser.ts
│   ├── door-schedule-extractor.ts
│   ├── window-schedule-extractor.ts
│   ├── extraction-lock-service.ts
│   └── ...
│
├── prisma/
│   └── schema.prisma        # 112+ database models
│
└── public/                   # Static assets
```

---

## Database Schema (Key Models)

### Core Entities
```prisma
model User {
  id visibleId visibleEmail visibleUsername passwordHash
  role: admin | client | guest | pending
  projects, conversations, dailyReports, notifications
}

model Project {
  id, name, slug, description, status
  ownerId, location (lat/lng for weather)
  documents, schedules, budgetItems, rooms, crews, submittals
}

model Document {
  id, name, projectId, category, accessLevel
  cloudStoragePath, processingStatus, pageCount
  chunks (for RAG), extractedData
}
```

### Schedule & Tasks
```prisma
model Schedule {
  id, projectId, name, isActive, sourceDocumentId
  tasks, startDate, endDate
}

model ScheduleTask {
  id, scheduleId, taskName, startDate, endDate
  percentComplete, isCriticalPath, dependencies
  trade, assignedCrew, actualStart, actualEnd
}
```

### Budget & Costs
```prisma
model BudgetItem {
  id, projectId, costCode, description, category
  originalAmount, currentAmount, committedCost, actualCost
  trade, phase, sourceDocumentId
}

model ChangeOrder {
  id, projectId, number, title, description
  amount, status (pending/approved/rejected)
  requestedBy, approvedBy, approvedAt
}

model Invoice {
  id, projectId, vendorName, amount, status
  dueDate, paidDate
}
```

### MEP & Submittals
```prisma
model MEPSubmittal {
  id, projectId, number, title, category
  status: draft | submitted | reviewed | approved | rejected
  requiredQuantity, submittedQuantity, approvedQuantity
  specSection, dueDate, lineItems, approvalHistory
}

model MEPSubmittalLineItem {
  id, submittalId, description, manufacturer, model
  requiredQty, submittedQty, unitCost
  verificationStatus, confidenceScore
}
```

### Field Operations
```prisma
model DailyReport {
  id, projectId, date, weatherCondition
  workPerformed, crewCount, safetyIncidents
  photos, delays, materials
}

model Crew {
  id, projectId, name, trade, size
  foreman, certifications, performance
}

model PunchListItem {
  id, projectId, description, location
  assignedTo, status, dueDate, photos
}
```

### Extraction & Sync
```prisma
model ExtractionLock {
  id, resourceType (document/project), resourceId
  extractionType (schedule/budget/takeoff/mep/doors/windows/room)
  processId, acquiredAt, expiresAt
  // Prevents race conditions during document processing
}

model ProjectDataSource {
  id, projectId, featureType, documentId
  lastSyncedAt, syncStatus
}
```

---

## Key Features Already Built

### 1. AI Chat with RAG
- Document Q&A with source citations
- Context from schedules, budgets, door/window schedules, MEP data
- Follow-up suggestions
- Rate limiting and query quotas
- **Files**: `lib/rag.ts`, `app/api/chat/route.ts`, `components/chat-interface.tsx`

### 2. Document Intelligence
- Auto-extraction on upload (schedules, budgets, rooms, doors, windows)
- Processing queue with status tracking
- OCR for scanned documents
- CAD/BIM support via Autodesk Forge
- Extraction locks to prevent race conditions
- **Files**: `lib/schedule-extractor-ai.ts`, `lib/extraction-lock-service.ts`

### 3. Schedule Management
- AI extraction from PDFs/Excel/MS Project
- Gantt chart visualization
- 3-week lookahead with field updates
- Critical path analysis
- Schedule health scoring
- Task dependencies
- **Files**: `components/schedule/`, `app/api/projects/[slug]/schedule/`

### 4. Budget & Cost Tracking
- Budget import from documents
- Cost code management
- Change order workflow
- Invoice tracking
- EVM (Earned Value Management) dashboard
- S-curve analysis
- Cash flow projections
- **Files**: `components/budget/`, `app/api/projects/[slug]/budget/`

### 5. MEP Submittals
- Submittal workflow (draft → submitted → reviewed → approved)
- Quantity verification against requirements
- Auto-import from project schedules
- Tolerance settings for verification
- Approval audit trail
- Shortage alerts
- **Files**: `components/submittals/`, `app/api/projects/[slug]/mep/submittals/`

### 6. Executive Dashboard
- Real-time KPIs
- Schedule/budget status
- Weather integration
- Active alerts
- PDF export
- **Files**: `components/executive-dashboard.tsx`, `app/api/projects/[slug]/executive-dashboard/`

### 7. Daily Reports
- Field work logging
- Photo capture and AI captioning
- Crew tracking
- Weather recording
- Auto-finalization
- PDF export
- **Files**: `app/api/conversations/[id]/`, `app/api/projects/[slug]/daily-reports/`

### 8. Room Management
- Room extraction from plans
- Room sheets with finishes, fixtures, equipment
- Bulk export
- PDF room sheets
- **Files**: `app/project/[slug]/rooms/`, `app/api/projects/[slug]/rooms/`

### 9. Authentication & Access Control
- 4 roles: admin, client, guest, pending
- Project-based permissions
- Project invitations
- Guest access links
- **Files**: `lib/auth-options.ts`, `lib/access-control.ts`

### 10. Integrations
- OneDrive sync
- Autodesk Forge (CAD/BIM viewing)
- Weather API (OpenWeatherMap)
- Stripe (billing)
- Email notifications (Resend)

---

## Code Conventions

### API Routes
```typescript
// app/api/projects/[slug]/example/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Your logic here

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Components
```typescript
// components/example/ExampleComponent.tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ExampleComponentProps {
  projectSlug: string;
  onUpdate?: () => void;
}

export function ExampleComponent({ projectSlug, onUpdate }: ExampleComponentProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataType[]>([]);

  useEffect(() => {
    fetchData();
  }, [projectSlug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectSlug}/example`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }

  return (
    <Card className="p-4">
      {/* Component content */}
    </Card>
  );
}
```

### Styling Guidelines
- Use Tailwind CSS classes
- Brand color: blue-600 (#003B71)
- Dark mode support via `dark:` variants
- Responsive: `sm:`, `md:`, `lg:` prefixes
- Use shadcn/ui components from `components/ui/`

### Error Handling
- Always wrap async operations in try/catch
- Use `toast.error()` for user-facing errors
- Log errors with `console.error('[Context]', error)`
- Return appropriate HTTP status codes

### TypeScript
- Strict mode enabled
- Define interfaces for props and API responses
- Avoid `any` - use proper types
- Use Prisma-generated types where possible

---

## Common Patterns

### Database Queries with Retry
```typescript
import { withDatabaseRetry } from '@/lib/retry-util';

const data = await withDatabaseRetry(() =>
  prisma.project.findMany({ where: { ownerId: userId } })
);
```

### Extraction Lock (Prevent Race Conditions)
```typescript
import { withLock } from '@/lib/extraction-lock-service';

await withLock(
  'document',
  documentId,
  'schedule',
  async () => {
    // Extraction logic - only one process can run at a time
  },
  { maxDuration: 10 * 60 * 1000 } // 10 minutes
);
```

### File Uploads to S3
```typescript
import { generatePresignedUploadUrl, getFileUrl } from '@/lib/s3';

// Get upload URL
const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
  fileName,
  contentType,
  isPublic
);

// Client uploads directly to S3 using uploadUrl

// Get download URL
const downloadUrl = await getFileUrl(cloud_storage_path, isPublic);
```

---

## Environment Variables (Reference Only)

You don't have access to these, but know they exist:

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | PostgreSQL connection |
| NEXTAUTH_SECRET | Auth encryption |
| ANTHROPIC_API_KEY | Claude AI API |
| OPENAI_API_KEY | OpenAI API |
| AWS_* | S3 file storage |
| STRIPE_* | Payments |
| AUTODESK_* | CAD/BIM viewer |
| OPENWEATHERMAP_API_KEY | Weather data |
| RESEND_API_KEY | Email service |

---

## Current Project State

### Recently Completed
- Executive Dashboard with PDF export
- Extraction lock system (race condition prevention)
- MEP submittal workflow with quantity verification
- Schedule extraction and 3-week lookahead
- Daily report system with photo management
- OneDrive integration
- Room management and room sheets

### Known Technical Debt
- Some components have large file sizes (could be split)
- Inconsistent error handling in older API routes
- Some TypeScript `any` types remain
- Test coverage is minimal

### Active Deployment
- **Production**: foremanos.site
- **Database**: Shared between dev and production

---

## Your Workflow

1. **Explore the codebase** - Read files to understand patterns
2. **Ask questions** - Clarify requirements before coding
3. **Write code** - Follow conventions above
4. **Explain changes** - Document what you changed and why
5. **User pushes to GitHub** - `git add . && git commit -m "..." && git push`
6. **DeepAgent deploys** - User tells DeepAgent "pull and deploy"

---

## Ready to Start

When asked to implement something:
1. First explore relevant existing code
2. Propose an approach
3. Write clean, well-documented code
4. Explain what files were created/modified

What would you like to work on?
