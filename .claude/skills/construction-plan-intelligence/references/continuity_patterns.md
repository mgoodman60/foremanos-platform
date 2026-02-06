# Multi-Page Drawing Continuity

## Detection Patterns

Large buildings split floor plans across multiple sheets. Indicators:

### Match Lines
- Visual: dashed/dotted line with annotation across the drawing
- Text: "MATCH LINE", "M.L.", or "SEE SHEET A-102"
- Regex in chunk content: `/MATCH\s*LINE|SEE\s+SHEET\s+([A-Z]-?\d{3})/gi`
- Regex in callouts: `/CONTINUATION|CONTINUED\s+ON|SEE\s+(SHEET\s+)?[A-Z]-?\d{3}/gi`

### Zone Designators
- Sheet titles often include zone: "2ND FLOOR PLAN - AREA A", "LEVEL 3 - NORTH WING"
- Regex: `/(?:AREA|ZONE|WING|BLDG|BUILDING)\s*([A-Z0-9]+)/i`
- Sheets with same floor level but different zone = continuation group

### Key Plans
- Small diagram on each sheet showing which part of the building this sheet covers
- The vision prompt should note "key plan indicates [zone/area]" in extraction

### Sheet Number Patterns
- Sequential numbers at same level: A-101, A-102, A-103 = likely same floor
- Regex: `/([A-Z])-(\d)(\d{2})/` where digit2 = floor, digit3+4 = sequence
  - A-101, A-102 = 1st floor sheets 01 and 02
  - A-201, A-202 = 2nd floor sheets 01 and 02

## Resolution Algorithm

Run after all sheets in a document are processed (post Phase A classification):

```
1. Group sheets by discipline prefix (A, S, M, E, P, C)
2. Within each discipline:
   a. Group by floor level (from sheet number pattern or title)
   b. Within each floor group:
      - Check for continuation text in chunk content or callouts
      - Check for matching zone labels in titles
      - Check for sequential sheet numbers at same level
   c. If continuation detected:
      - Create SheetContinuity records with shared groupId
      - Parse adjacentSheets from "SEE SHEET" references
      - Set zoneLabel and floorLevel from title/content
3. For structural sheets: S-101/S-102 at same level = continuation
4. For MEP: same logic, M-101/M-102, E-101/E-102, P-101/P-102
```

## RAG Enhancement

In `retrieveRelevantDocuments()`, after scoring:

```
For each high-scoring chunk:
  1. Query SheetContinuity WHERE sheetNumber = chunk.sheetNumber AND projectId = project
  2. If in a continuity group:
     - Query all other SheetContinuity records with same groupId
     - For each adjacent sheet, find its DocumentChunk
     - Add to results with score = source_score * 0.5 (50% inherited)
  3. This ensures "how many rooms on the 2nd floor?" pulls ALL 2nd floor sheets
```

## Takeoff Impact

When calculating quantities for a floor:
- Sum room areas across all continuation sheets for that floor
- Sum wall lengths across all continuation sheets
- Do NOT double-count elements at match lines (elements shown on both sheets)
  - Detect by: same element tag appearing on adjacent sheets near the match line
