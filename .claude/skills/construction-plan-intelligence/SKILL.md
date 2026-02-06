---
name: construction-plan-intelligence
description: >
  Enhance ForemanOS construction document processing pipeline — vision extraction,
  RAG retrieval, material takeoffs, and cross-reference resolution for construction
  plans (PDF). Triggers when working on: document-processor-batch.ts (vision prompts),
  intelligence-orchestrator.ts (Phase A/B/C pipeline), rag.ts (scoring/retrieval),
  takeoff-memory-service.ts (material quantities), symbol-learner.ts (symbol recognition),
  or any Prisma schema changes to Document/DocumentChunk/DrawingType/SheetLegend/MaterialTakeoff.
  Also triggers for: new extraction modules, plan processing improvements, RAG tuning
  for construction queries, or material takeoff accuracy work.
---

# Construction Plan Intelligence Skill

Sharpen ForemanOS's existing extraction pipeline for construction plan PDFs. The infrastructure
exists — this skill addresses 10 specific gaps in extraction quality, cross-referencing,
takeoff accuracy, and RAG retrieval.

## Codebase Map

| File | Role | Lines |
|------|------|-------|
| `lib/document-processor-batch.ts` | Vision extraction, per-page processing | ~500 |
| `lib/intelligence-orchestrator.ts` | Phase A/B/C pipeline | ~520 |
| `lib/rag.ts` | Keyword scoring, retrieval, context gen | ~2000 |
| `lib/takeoff-memory-service.ts` | Takeoff context for RAG | ~556 |
| `lib/symbol-learner.ts` | Runtime symbol pattern matching | ~401 |
| `lib/document-processor.ts` | Main processing entry point | ~897 |
| `lib/title-block-extractor.ts` | Phase A.1 | — |
| `lib/legend-extractor.ts` | Phase A.2 | — |
| `lib/scale-detector.ts` | Phase A.3 | — |
| `lib/drawing-classifier.ts` | Phase A.4 | — |
| `lib/spatial-correlation.ts` | Phase C spatial work | — |

## Assets

| File | Purpose | Entries |
|------|---------|--------|
| `assets/construction_symbols_library.json` | Baseline symbol vocabulary organized by CSI MasterFormat division | 230 symbols across 26 categories |

### Symbol Library Usage

The symbol library (`construction_symbols_library.json`) serves three roles:

1. **Vision prompt injection (Gap 1):** During two-pass extraction, after the lightweight
   classification determines discipline, load only the relevant division's symbols into the
   main extraction prompt. E.g., mechanical plan gets Division 23 symbols (17 entries) +
   Common Hatch Patterns, not all 230. Each entry has a `vision_hints` field written
   specifically for guiding the vision model on what to look for visually.

2. **Symbol learner baseline (Gap 10):** Load as initial vocabulary in `symbol-learner.ts`
   before runtime pattern matching begins. Symbols matched against this library receive
   +25 confidence boost. Cross-validate against `SheetLegend.legendEntries` for per-project
   ground truth.

3. **Assembly resolution (Gap 5):** The CSI division structure maps directly to the
   MasterFormat keynote resolution chain. Symbol IDs use `D{division}-{category}-{seq}`
   format enabling programmatic lookup by division number.

**Division-to-discipline mapping for prompt injection:**

| Discipline | Load Divisions |
|-----------|---------------|
| Architectural Floor Plan | 01, 02, 08, 09, 10, 12, 14 + Hatch + Lines + ADA + Life Safety |
| Architectural RCP | 01, 09, 23 (diffusers only), 26 (lights only) |
| Structural | 01, 03, 04, 05, 06 + Hatch + Lines |
| Mechanical (HVAC) | 01, 23 + Hatch |
| Electrical | 01, 26, 27, 28 |
| Plumbing | 01, 22 + Hatch |
| Fire Protection | 01, 21 |
| Civil / Site | 01, 31, 32, 33 + Lines |

## Processing Flow (Current)

```
Upload → S3 → processDocument() → classifyDocument()
  → PDF? → processDocumentBatch() [per-page]:
      convertPdfToImages() → getVisionPrompt() [GENERIC] → vision API → parseJSON
      → formatVisionData() → store DocumentChunk
  → Post-processing:
      runIntelligenceExtraction(phases: ['A','B','C'])
        Phase A: title blocks, scales, legends, drawing classification
        Phase B: dimensions, annotations, callouts, rooms
        Phase C: spatial correlation, MEP tracing, symbol learning
  → extractRoomData(), extractScheduleData(), syncFeatures()
```

## 10 Gaps — Implementation Guide

### Gap 1: Discipline-Specific Vision Prompts

**Problem:** `getVisionPrompt()` (line 251, document-processor-batch.ts) sends identical
instructions for every page type. Structural foundation plans get asked for rooms and doors.

**Fix:** Two-pass extraction. Before the main vision call, run a lightweight classification
call (~$0.0002/page) to determine discipline and drawing type, then select the appropriate
prompt template.

**Integration point:** Inside the per-page loop in `processDocumentBatch()`, before the
main `analyzeWithSmartRouting()` call.

**Reference:** Read `references/discipline_prompts.md` for all prompt templates.
Load relevant symbol subsets from `assets/construction_symbols_library.json` using
the division-to-discipline mapping in the Assets section above.

### Gap 2: Cross-Reference Resolution

**Problem:** `DocumentChunk.crossReferences` (Json?) is populated but never resolved.
Detail bubble "3/A-501" on Sheet A-201 is stored as text, not linked to Sheet A-501.

**Fix:** Post-processing step after Phase B (after line 414 in intelligence-orchestrator.ts)
that builds a project-level adjacency map. New `DrawingCrossReference` Prisma model.

**RAG enhancement:** In `retrieveRelevantDocuments()`, after initial scoring, check
high-scoring chunks' cross-references and pull in referenced chunks with +40 score boost.

**Reference:** Read `references/cross_reference_patterns.md` for pattern formats and
resolution logic. Read `references/schema_migrations.md` for the new Prisma model.

### Gap 3: Material Takeoff Formulas

**Problem:** `takeoff-memory-service.ts` reads/formats DB data but has no calculation
logic connecting extracted dimensions to material quantities.

**Fix:** Add formula engine that takes extracted spatial data (dimensions, rooms, counts
from DocumentChunk) and produces TakeoffLineItem records with show-your-work math.

**Integration point:** New function called after Phase B extraction completes, or
on-demand when takeoff context is requested.

**Reference:** Read `references/takeoff_formulas.md` for all formulas, waste factors,
and sanity checks.

### Gap 4: RAG Sheet-Type Routing

**Problem:** `detectQueryIntent()` (line 487, rag.ts) has 6 broad categories.
"Ceiling height in Room 201" and "foundation depth at grid C-3" both get the same
`plans_drawings` intent with no sheet-type discrimination.

**Fix:** Add sub-classification within `plans_drawings` that maps query content to
specific sheet types, then apply discipline multiplier in `calculateRelevanceScore()`.

**Integration point:** Extend `detectQueryIntent()` to return sub-intents. Add
sheet-type boost logic after `applyCategoryBoost()` at line 439.

**Reference:** Read `references/query_routing.md` for the complete mapping table.

### Gap 5: Assembly Identification

**Problem:** System extracts individual elements but doesn't understand that wall type
"WT-1" is an assembly of studs + gypsum + insulation + cladding.

**Fix:** Post-processing that recognizes assembly identifiers (wall types, ceiling types,
floor assemblies) and follows references to schedules/legends for component lists.
Enables accurate multi-material takeoffs from a single wall dimension.

**Reference:** Read `references/assembly_patterns.md` for assembly types and
component resolution logic.

### Gap 6: Multi-Page Drawing Continuity

**Problem:** Large floor plans span multiple sheets (A-101, A-102) with match lines.
System processes each independently — room counts and dimensions may be incomplete.

**Fix:** Post-processing step after all sheets are extracted that detects continuation
indicators and groups spatially adjacent sheets. New `SheetContinuity` model.
RAG enhancement: when any sheet in a continuation group scores high, pull all group
members.

**Reference:** Read `references/continuity_patterns.md` for detection logic.
Read `references/schema_migrations.md` for the new Prisma model.

### Gap 7: Revision Delta Tracking

**Problem:** `DocumentChunk.revision` field exists, vision prompt mentions revision
clouds, but no comparison logic exists between document versions.

**Fix:** When a new plan set is uploaded, compare against previous version's chunks
by sheet number. Flag chunks where content differs significantly. Store revision
metadata for RAG boosting when users ask "what changed."

**Reference:** Read `references/revision_tracking.md` for detection and comparison logic.

### Gap 8: Multi-Scale Context Association

**Problem:** `DocumentChunk` has `hasMultipleScales` and `scaleData` but the vision
prompt doesn't ask the model to associate specific scales with specific extracted elements.

**Fix:** Enhance the discipline-specific prompts (Gap 1) to request per-element scale
association. Add validation in Phase A that checks dimension values against their
associated scale for plausibility.

**Reference:** Addressed within `references/discipline_prompts.md` (scale extraction
instructions) and `references/validation_rules.md` (scale plausibility checks).

### Gap 9: Specification-Drawing Linkage

**Problem:** No explicit linking between spec documents and drawing keynotes. RAG gives
a generic 1.2x related-category boost between plans_drawings and specifications.

**Fix:** Build CSI MasterFormat mapping so keynote "09 21 16" extracted from a drawing
automatically links to the corresponding spec section. Enhance RAG to follow these
links during retrieval.

**Reference:** Read `references/assembly_patterns.md` (keynote-to-CSI section) for
the MasterFormat mapping.

### Gap 10: Symbol-Legend Validation

**Problem:** `symbol-learner.ts` runs regex patterns against chunk text but never
validates matches against `SheetLegend.legendEntries` — the architect's ground truth.

**Fix:** After `learnFromDocument()` runs, cross-check extracted symbols against
SheetLegend entries for the same sheet. Confirmed matches get confidence boost.
Contradictions get flagged. Unmatched legend entries become new learned symbols.

**Integration point:** Modify `learnFromDocument()` (line 182, symbol-learner.ts)
to query SheetLegend for the same documentId after initial regex extraction.

**Reference:** Load baseline vocabulary from `assets/construction_symbols_library.json`
before runtime matching. Logic described inline above — the fix is a ~30 line addition
to the existing function plus a library loader (~50 lines).

## Implementation Priority

Execute in this order — each gap builds on previous ones:

1. **Gap 1** (Discipline prompts) — Foundation for everything else. Better extraction
   data improves all downstream processing.
2. **Gap 8** (Multi-scale context) — Included in Gap 1's prompt redesign.
3. **Gap 10** (Symbol-legend validation) — Quick win, ~30 lines.
4. **Gap 2** (Cross-reference resolution) — Requires schema migration.
5. **Gap 6** (Multi-page continuity) — Requires schema migration, pairs with Gap 2.
6. **Gap 4** (RAG sheet-type routing) — Benefits from Gap 1's better classification data.
7. **Gap 7** (Revision tracking) — Independent, can be done anytime.
8. **Gap 5** (Assembly identification) — Depends on Gaps 2 and 4.
9. **Gap 9** (Spec-drawing linkage) — Depends on Gap 5's assembly work.
10. **Gap 3** (Takeoff formulas) — Last because it benefits from all other improvements.

## Schema Changes Required

Read `references/schema_migrations.md` before making any Prisma schema changes.
Two new models needed: `DrawingCrossReference` and `SheetContinuity`.
