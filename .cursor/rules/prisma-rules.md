# prisma/ — Database schema

When editing `prisma/schema.prisma` or Prisma-dependent code:

- **Sync schema**: `npx prisma db push` to apply changes; `npx prisma generate` to regenerate the client (build runs this).
- **Conventions**: JSON fields may need `as unknown as Type`; relation filters use PascalCase model names (`Document`, not `document`). `InputJsonValue` does not accept `Record<string, unknown>`.
- **Cascade rules**: Document deletion cascades to MaterialTakeoff; SetNull on DoorScheduleItem, WindowScheduleItem, FinishScheduleItem, FloorPlan, Room.sourceDocumentId. Do not change without checking CLAUDE.md/AGENTS.md.

See [docs/agents/database-schema.md](../../docs/agents/database-schema.md) for full schema and model notes.
