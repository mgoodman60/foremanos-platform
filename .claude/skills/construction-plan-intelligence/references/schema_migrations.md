# Schema Migrations

New Prisma models required for Gaps 2 and 6. Add to `prisma/schema.prisma`.

## DrawingCrossReference (Gap 2)

```prisma
model DrawingCrossReference {
  id              String   @id @default(cuid())
  projectId       String
  sourceDocId     String
  sourceChunkId   String
  sourceSheet     String              // Sheet where reference appears (e.g., "A-201")
  sourceElement   String              // What was referenced (e.g., "Detail 3/A-501")
  targetDocId     String?             // May be null if target not found
  targetChunkId   String?             // May be null if target not found
  targetSheet     String              // Target sheet number (e.g., "A-501")
  targetElement   String?             // Specific element on target (e.g., "Detail 3")
  referenceType   String              // detail|section|elevation|door_schedule|window_schedule|wall_type|keynote|spec_section
  context         String?             // Description of what the reference pertains to
  resolved        Boolean  @default(false)  // True if target was found and linked
  confidence      Float    @default(0)
  createdAt       DateTime @default(now())

  Project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([sourceDocId])
  @@index([sourceChunkId])
  @@index([targetDocId])
  @@index([targetChunkId])
  @@index([targetSheet])
  @@index([referenceType])
  @@index([projectId, sourceSheet])
  @@index([projectId, targetSheet])
}
```

Add to Project model relations:
```prisma
DrawingCrossReference DrawingCrossReference[]
```

## SheetContinuity (Gap 6)

```prisma
model SheetContinuity {
  id              String   @id @default(cuid())
  projectId       String
  documentId      String
  groupId         String              // Shared ID for all sheets in a continuation group
  sheetNumber     String
  continuationType String             // "match_line"|"zone"|"area"|"see_sheet"|"key_plan"
  adjacentSheets  String[]            // Sheet numbers this sheet connects to
  zoneLabel       String?             // e.g., "AREA A", "ZONE 1", "NORTH WING"
  floorLevel      String?             // e.g., "2ND FLOOR", "LEVEL 3"
  sortOrder       Int      @default(0) // For ordering within the group
  createdAt       DateTime @default(now())

  Document        Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  Project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, documentId, sheetNumber])
  @@index([projectId])
  @@index([documentId])
  @@index([groupId])
  @@index([floorLevel])
}
```

Add to Document model relations:
```prisma
SheetContinuity SheetContinuity[]
```

Add to Project model relations:
```prisma
SheetContinuity SheetContinuity[]
```

## Migration Steps

1. Add models to schema.prisma
2. Run `npx prisma migrate dev --name add_cross_references_and_continuity`
3. Update document-processor imports
4. Add post-processing calls in intelligence-orchestrator.ts after Phase B
