# Database Schema / Prisma — Agent Guide

Use this guide when working on `prisma/schema.prisma`, migrations, or any code that relies on Prisma models and relations.

## Schema location and commands

- **Schema**: `prisma/schema.prisma` — 112 models. Edit here for new tables, columns, or relations.
- **Sync to DB**: `npx prisma db push` — applies schema changes to the database (no migration files in current workflow for push).
- **Regenerate client**: `npx prisma generate` — run after schema changes; the build also runs it.

## Key model groups

- **Users**: User, Account, ActivityLog.
- **Projects**: Project, ProjectPhase, Document.
- **Budget**: ProjectBudget, BudgetItem, Invoice, ChangeOrder, CostAlert.
- **Schedule**: Schedule, ScheduleTask, Milestone, LookAheadSchedule.
- **MEP**: MEPSubmittal, MEPEquipment, MEPSchedule.
- **Field Ops**: DailyReport, FieldPhoto, PunchList, RFI, WeatherDay, CrewTemplate, SMSMapping, DailyReportChunk.
- **Document intelligence**: DocumentChunk, DrawingType, DimensionAnnotation, DetailCallout, SheetLegend, EnhancedAnnotation, MaterialTakeoff, TakeoffLineItem. Room.sourceDocumentId for cross-document dedup.

## Required fields and constraints

- **Document.projectId** and **User.email** are required (non-nullable).
- **Cascade on Document deletion**: MaterialTakeoff -> onDelete Cascade. DoorScheduleItem, WindowScheduleItem, FinishScheduleItem, FloorPlan -> onDelete SetNull. Room.sourceDocumentId -> onDelete SetNull (preserves room, clears source).

## Prisma conventions in code

- JSON fields often require `as unknown as Type` when passing to Prisma.
- Relation filters use PascalCase model names (e.g. `Document`, not `document`).
- InputJsonValue does not accept `Record<string, unknown>` — use `Record<string, string | number | boolean | string[] | null>` or similar.

## References

- [CLAUDE.md](../../CLAUDE.md) — Database Models (Prisma), Cascade Rules, Schema Notes.
- [AGENTS.md](../../AGENTS.md) — Prisma section, Gotchas (Prisma EPERM on Windows).
