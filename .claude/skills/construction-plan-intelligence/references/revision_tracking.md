# Revision Delta Tracking

## Current State

- `DocumentChunk.revision` (String?) exists — populated from title block
- Vision prompt (line 273) mentions "revision clouds or highlighted changes"
- No comparison logic between document versions

## Revision Indicators to Extract

### Title Block Revision Data
Already extracted in titleBlock JSON. Enhance to capture:
```json
{
  "revision": "3",
  "revisionDate": "2025-12-15",
  "revisionHistory": [
    {"rev": "1", "date": "2025-06-01", "description": "ISSUED FOR PERMIT"},
    {"rev": "2", "date": "2025-09-15", "description": "ADDENDUM 1"},
    {"rev": "3", "date": "2025-12-15", "description": "ISSUED FOR CONSTRUCTION"}
  ]
}
```

### Revision Clouds
- Visual: irregular curved boundary around changed content
- Often accompanied by revision triangle (delta symbol with number)
- The discipline-specific prompts (Gap 1) now include `revisionClouds` in their JSON schema
- Each revision cloud should capture: rev number, approximate location, description of change

### ASI / Bulletin Indicators
- "ASI #3" or "BULLETIN #2" annotations indicate changes from supplemental issuances
- Regex: `/\b(ASI|BULLETIN|SK)\s*#?\s*(\d+)/gi`

## Comparison Logic

When a new document is uploaded to a project that replaces an existing plan set:

```
1. Detect replacement:
   - Same document name pattern (e.g., "Architectural Plans" replacing "Architectural Plans")
   - Or explicit user action (re-upload / version)
   - Check Document.fileHash vs Document.lastProcessedHash

2. After new document is processed, for each new DocumentChunk:
   a. Find corresponding old chunk by sheetNumber match
   b. Compare:
      - revision field (new > old = this sheet was revised)
      - revisionClouds presence (new has clouds = changes on this sheet)
      - Content diff: significant text differences in extracted content
        Simple approach: Jaccard similarity on extracted keywords
        If similarity < 0.85 = significant change
   c. Flag changed chunks:
      - Store metadata: { revisionDelta: true, previousRevision: "2", newRevision: "3", changeType: "content|cloud|both" }

3. For unchanged sheets (same revision, no clouds, content similarity > 0.95):
   - Carry forward extraction data from previous version (avoid re-processing cost)
   - Flag as { revisionDelta: false, carriedForward: true }
```

## RAG Enhancement

When user asks "what changed" / "what's different" / "revisions" / "delta":

```
Detect revision-related query:
  Regex: /\b(chang|revis|delta|differ|new|update|addendum|asi|bulletin|what's new)\b/i

Boost chunks where:
  - revisionDelta = true → score × 2.0
  - revisionClouds is non-empty → score × 1.8
  - revision field matches query (e.g., "Rev 3 changes") → score × 1.5
```

## Cost Optimization

Re-processing an entire plan set is expensive. Use revision tracking to:
- Only re-run vision extraction on sheets with new revision numbers
- Carry forward extraction for unchanged sheets
- Estimated savings: 40-60% of processing cost on typical revisions
  (most revisions change 10-30% of sheets)
