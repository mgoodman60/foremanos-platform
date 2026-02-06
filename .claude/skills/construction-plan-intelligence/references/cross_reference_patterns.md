# Cross-Reference Patterns in Construction Drawings

## Reference Types

### Detail Bubbles
Format: `{detail_number}/{sheet_number}` — e.g., "3/A-501"
- Top number = detail number on target sheet
- Bottom number = sheet where the full-size detail lives
- Regex: `/(\d+)\s*[\/\\]\s*([A-Z]-\d{3})/g`
- Meaning: "Go to Sheet A-501 and look at Detail 3 for the full information"
- Direction: Source sheet (where bubble appears) → Target sheet (where detail is drawn)

### Section Cuts
Format: Section mark with arrows and target sheet — e.g., "A/A-301"
- The cut line on the source sheet shows WHERE the building is sliced
- The target sheet shows the resulting cross-section VIEW
- Regex: `/([A-Z])\s*[\/\\]\s*([A-Z]-\d{3})/g`
- Direction: Source → Target (target has the section view)

### Elevation Markers
Format: Triangle/circle with number and target sheet — e.g., "1/A-401"
- Indicates direction of view and which sheet has the elevation drawing
- Regex: same as detail bubbles, context-dependent
- Differentiated from details by: triangular shape, directional arrow, "ELEV" text nearby

### Door/Window Tags → Schedules
Format: Tag code — e.g., "D101", "W3"
- Regex (doors): `/\bD-?(\d{1,4}[A-Z]?)\b/g`
- Regex (windows): `/\bW-?(\d{1,4}[A-Z]?)\b/g`
- Target: Door schedule sheet or window schedule sheet (find via DrawingType where type = "schedule")
- Direction: Floor plan → Schedule sheet

### Wall Type Codes → Wall Type Legend/Schedule
Format: Type code in/near wall — e.g., "WT-1", "A1", "W1"
- Regex: `/\b(WT|W|PT|P)-?(\d{1,2}[A-Z]?)\b/g`
- Target: Wall type schedule/legend (may be on same sheet or general notes sheet)
- Direction: Floor plan → Wall type schedule

### Keynotes → Keynote Legend → Spec Sections
Format: Number in diamond/hexagon — e.g., "5", "12"
- On-sheet resolution: Match to keynote legend (if present on same sheet)
- Cross-sheet resolution: If no legend on sheet, check general notes sheets (G-series, A-001)
- Spec resolution: Keynote meaning may include CSI section number → links to spec document
- Regex (keynote number): `/\b(\d{1,3})\b/` (context-dependent, must be near keynote symbol)
- Regex (CSI section): `/\b(\d{2})\s*(\d{2})\s*(\d{2})\b/g`

### Specification Section References
Format: CSI MasterFormat number — e.g., "09 21 16"
- 6-digit hierarchical: Division (2 digits) + Section (2 digits) + Subsection (2 digits)
- Regex: `/\b(\d{2})\s+(\d{2})\s+(\d{2})\b/g`
- Target: Specification document with matching section
- Direction: Drawing keynote/note → Specification document

## Resolution Algorithm

Run as post-processing after Phase B completes (after line 414 in intelligence-orchestrator.ts).

```
For each DocumentChunk with crossReferences populated:
  1. Parse crossReferences JSON into structured references
  2. For each reference:
     a. Determine type (detail, section, elevation, door/window, wall type, keynote, spec)
     b. Find target:
        - For sheet references (detail/section/elevation):
          Query DocumentChunk WHERE sheetNumber = targetSheet AND documentId IN (same project docs)
        - For schedule references (door/window tags):
          Query DrawingType WHERE type = "schedule" AND subtype matches
          Then find DocumentChunk for that sheet
        - For keynote references:
          Query SheetLegend for same sheet first, then general notes sheets
        - For spec references:
          Query DocumentChunk WHERE content CONTAINS csiSection AND category = "specifications"
     c. Create DrawingCrossReference record linking source → target
  3. Build adjacency map: for each chunk, list all chunks it references and all chunks that reference it
```

## RAG Integration

In `retrieveRelevantDocuments()` (rag.ts), after initial chunk scoring:

```
For each chunk with score > threshold:
  1. Query DrawingCrossReference WHERE sourceChunkId = chunk.id OR targetChunkId = chunk.id
  2. For each referenced chunk not already in results:
     - Add with score = original_chunk_score * 0.6 (inherit 60% of referencing chunk's score)
     - Add +40 flat bonus for being a direct cross-reference
  3. Cap at 5 additional chunks per source to prevent explosion
```

## New Prisma Model

See `references/schema_migrations.md` for the `DrawingCrossReference` model definition.
