# ForemanOS Custom Agent Specifications

## Overview

5 specialized agents for construction project management:

| Agent | Purpose |
|-------|---------|
| project-controls | Schedule + Budget + EVM |
| quantity-surveyor | Takeoffs + Pricing |
| document-intelligence | OCR + RAG |
| field-operations | Daily Reports + Progress |
| data-sync | Cross-system integration |

---

## 1. project-controls

```yaml
---
name: project-controls
description: Manages schedule, budget, EVM, forecasting, and change orders
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---
```

**Purpose:** Unified schedule and budget management with earned value tracking

**Key Files:**
- `lib/schedule-*.ts` (8 files)
- `lib/budget-*.ts` (6 files)
- `lib/cost-*.ts` (4 files)
- `app/api/projects/[slug]/schedule/`
- `app/api/projects/[slug]/budget/`

**Capabilities:**
- Schedule extraction and critical path analysis
- Budget tracking and variance analysis
- EVM calculations (CPI, SPI, EAC, ETC)
- Change order impact analysis
- S-curve and forecast generation

**Data Models:** Schedule, ScheduleTask, ProjectBudget, BudgetItem, EarnedValue, ChangeOrder, CostAlert

---

## 2. quantity-surveyor

```yaml
---
name: quantity-surveyor
description: Extracts material quantities from drawings and applies pricing
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---
```

**Purpose:** Material takeoffs with quantity extraction and cost estimation

**Key Files:**
- `lib/enhanced-takeoff-service.ts`
- `lib/takeoff-*.ts` (8 files)
- `lib/cost-calculation-service.ts`
- `app/api/projects/[slug]/auto-takeoff/`

**Capabilities:**
- Vision AI quantity extraction
- Multi-sheet aggregation with confidence scoring
- Unit pricing from CSI database
- Waste factor application
- Historical learning

**Data Models:** Takeoff, TakeoffItem, TakeoffCategory, UnitPrice

---

## 3. document-intelligence

```yaml
---
name: document-intelligence
description: OCR, RAG retrieval, document extraction, and semantic search
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---
```

**Purpose:** Foundation layer - processes documents for all other agents

**Key Files:**
- `lib/document-processor.ts`
- `lib/rag.ts` (1000+ point scoring)
- `lib/vision-api-multi-provider.ts`
- `app/api/documents/`
- `app/api/chat/route.ts`

**Capabilities:**
- Multi-provider OCR (Claude, GPT-4o)
- RAG retrieval with construction-aware scoring
- Document categorization
- Semantic search
- Terminology expansion (embedded)

**Data Models:** Document, DocumentPage, DocumentCategory, Conversation

---

## 4. field-operations

```yaml
---
name: field-operations
description: Daily reports, progress tracking, photos, and site inspections
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---
```

**Purpose:** Captures field activity and produces actuals data

**Key Files:**
- `lib/daily-report-*.ts` (4 files)
- `lib/progress-detection-service.ts`
- `app/api/projects/[slug]/daily-reports/`

**Capabilities:**
- Daily report creation (weather, labor, equipment)
- Voice-to-report transcription
- Photo analysis for progress detection
- Completeness scoring
- Weather delay documentation

**Data Models:** DailyReport, DailyReportLabor, DailyReportEquipment, FieldPhoto

---

## 5. data-sync

```yaml
---
name: data-sync
description: Synchronizes data across schedule, budget, daily reports, and documents
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---
```

**Purpose:** Coordinates data flow between all domain agents

**Key Files:**
- `lib/daily-report-sync-service.ts`
- `lib/budget-sync-service.ts`
- `lib/cost-rollup-service.ts`
- `lib/schedule-budget-service.ts`

**Sync Flows:**

| Source | Target | Data |
|--------|--------|------|
| Daily Report | Schedule | Weather delays → task delays |
| Daily Report | Budget | Labor hours → actuals |
| Daily Report | Budget | Equipment → costs |
| Takeoff | Budget | Quantities → line items |
| Progress Photos | Schedule | AI detection → % complete |
| Pay Application | Budget | Billing → actuals |
| Change Order | Both | Cost + schedule impact |

**Capabilities:**
- Weather delay propagation
- Labor/equipment cost rollup
- Progress sync to schedule
- EVM refresh triggers
- Audit trail for all syncs

---

## Agent Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                    document-intelligence                     │
│         (OCR, RAG, extraction - foundation layer)           │
└─────────────────────────────────────────────────────────────┘
                              │
                    extracts data for
                              ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  quantity-  │    │  project-   │    │   field-    │
│  surveyor   │    │  controls   │    │ operations  │
└─────────────┘    └─────────────┘    └─────────────┘
        │                  ▲                  │
        └──────────────────┼──────────────────┘
                    ┌──────┴──────┐
                    │  data-sync  │
                    └─────────────┘
```

---

## Embedded Construction Terminology

Add to ALL agents' system prompts:

```markdown
## Construction Terminology

**Common Abbreviations:**
AFF=Above Finished Floor, CMU=Concrete Masonry Unit, GWB=Gypsum Wall Board,
MEP=Mechanical/Electrical/Plumbing, RFI=Request for Information, O/C=On Center,
T.O.=Top Of, NIC=Not In Contract

**Trade Jargon:**
- "Slump" = Concrete workability (4-6" typical)
- "Float" = Schedule flexibility
- "Punchlist" = Final corrections before closeout
- "Submittals" = Shop drawings for approval

**CSI Divisions:**
03=Concrete, 05=Metals, 06=Wood, 09=Finishes, 22=Plumbing, 23=HVAC, 26=Electrical
```

---

## Files to Create

```
.claude/agents/
├── project-controls.md
├── quantity-surveyor.md
├── document-intelligence.md
├── field-operations.md
└── data-sync.md
```
