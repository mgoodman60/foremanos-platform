# Query-to-Sheet-Type Routing

## Integration Point

Extend `detectQueryIntent()` (line 487, rag.ts) to return sub-intents when the primary
intent is `plans_drawings`. Apply sheet-type discipline multiplier in
`calculateRelevanceScore()` (line 675) or as a post-scoring adjustment.

## Sub-Intent Classification

When `plans_drawings` intent is detected, further classify:

```typescript
function detectSheetTypeIntent(query: string): string[] {
  const lower = query.toLowerCase();
  const sheetTypes: string[] = [];

  // Ceiling → RCP sheets
  if (/\b(ceiling|rcp|reflected|ceiling height|soffit|bulkhead|cloud|cove)\b/.test(lower)) {
    sheetTypes.push('reflected_ceiling'); // A-series RCP
  }

  // Structural → S-series
  if (/\b(foundation|footing|beam|column|slab|rebar|reinforc|structural|framing|joist|concrete strength|f'c|bearing|shear wall|moment frame)\b/.test(lower)) {
    sheetTypes.push('structural'); // S-series
  }

  // Site/Civil → C-series
  if (/\b(site|grading|grade|elevation point|contour|parking|curb|storm|sanitary sewer|water main|utility|setback|lot line|impervious)\b/.test(lower)) {
    sheetTypes.push('civil'); // C-series
  }

  // Mechanical → M-series
  if (/\b(hvac|duct|diffuser|ahu|rtu|vav|mechanical|air handler|cfm|tonnage|refrigerant|thermostat|damper)\b/.test(lower)) {
    sheetTypes.push('mechanical'); // M-series
  }

  // Electrical → E-series
  if (/\b(panel|circuit|outlet|receptacle|switch|conduit|wire|amp|volt|transformer|lighting fixture|electrical|emergency power|generator)\b/.test(lower)) {
    sheetTypes.push('electrical'); // E-series
  }

  // Plumbing → P-series
  if (/\b(plumbing|pipe size|fixture|water closet|lavatory|drain|cleanout|water heater|backflow|fixture unit|sanitary|vent pipe)\b/.test(lower)) {
    sheetTypes.push('plumbing'); // P-series
  }

  // Fire protection → FP-series
  if (/\b(sprinkler|fire alarm|fire protection|standpipe|fire pump|facp|pull station|horn.*strobe|smoke detect)\b/.test(lower)) {
    sheetTypes.push('fire_protection'); // FP-series
  }

  // Elevations → A-series elevations
  if (/\b(elevation|exterior|facade|building face|cladding|storefront|curtain wall)\b/.test(lower)) {
    sheetTypes.push('elevation'); // A-series elevations
  }

  // Sections → A-series or S-series sections
  if (/\b(section|wall section|building section|cross section|assembly)\b/.test(lower)) {
    sheetTypes.push('section');
  }

  // Details → detail sheets
  if (/\b(detail|typical|connection|flashing|waterproof|sealant|expansion joint)\b/.test(lower)) {
    sheetTypes.push('detail');
  }

  // Schedules → schedule sheets
  if (/\b(door schedule|window schedule|finish schedule|hardware|room finish|panel schedule|equipment schedule)\b/.test(lower)) {
    sheetTypes.push('schedule');
  }

  // Life safety → LS sheets
  if (/\b(egress|exit|life safety|occupant load|fire rating|area of refuge|accessible route)\b/.test(lower)) {
    sheetTypes.push('life_safety');
  }

  // Roof → roof plans
  if (/\b(roof|roofing|parapet|scupper|roof drain|slope.*roof|cricket|saddle)\b/.test(lower)) {
    sheetTypes.push('roof_plan');
  }

  return sheetTypes;
}
```

## Sheet Number Prefix Mapping

Use this to match detected sheet types against chunk sheetNumber:

| Sheet Type | Prefix Pattern | Common Formats |
|-----------|----------------|----------------|
| architectural_floor | `A-1xx`, `A-2xx` | A-101, A-102, A-201 |
| reflected_ceiling | `A-1xxR`, `RCP` prefix | A-101R, A-201R, RCP-1 |
| elevation | `A-3xx`, `A-4xx` | A-301, A-401 |
| section | `A-5xx`, `A-6xx` | A-501, A-601 |
| detail | `A-7xx`, `A-8xx`, `A-9xx` | A-701, A-801 |
| structural | `S-xxx` | S-001, S-101, S-201 |
| mechanical | `M-xxx` | M-001, M-101, M-201 |
| electrical | `E-xxx` | E-001, E-101, E-201 |
| plumbing | `P-xxx` | P-001, P-101, P-201 |
| fire_protection | `FP-xxx` | FP-101, FP-201 |
| civil | `C-xxx` | C-001, C-101 |
| landscape | `L-xxx` | L-101, L-201 |
| general | `G-xxx` | G-001, G-002 |
| life_safety | `A-xxxLS`, `LS-xxx` | A-101LS, LS-101 |

## Scoring Enhancement

```typescript
function applySheetTypeBoost(
  score: number,
  chunkSheetNumber: string | null,
  chunkDiscipline: string | null,
  sheetTypeIntents: string[]
): number {
  if (!chunkSheetNumber || sheetTypeIntents.length === 0) return score;

  const prefix = chunkSheetNumber.charAt(0).toUpperCase();

  const prefixToDiscipline: Record<string, string[]> = {
    'A': ['architectural_floor', 'reflected_ceiling', 'elevation', 'section', 'detail', 'life_safety', 'roof_plan'],
    'S': ['structural'],
    'M': ['mechanical'],
    'E': ['electrical'],
    'P': ['plumbing'],
    'C': ['civil'],
    'L': ['landscape'],
    'G': ['general'],
  };

  const matchingTypes = prefixToDiscipline[prefix] || [];

  // Strong boost: sheet prefix matches query intent
  if (sheetTypeIntents.some(intent => matchingTypes.includes(intent))) {
    return score * 1.3;
  }

  // Penalty: query clearly targets a different discipline
  if (sheetTypeIntents.length === 1 && !matchingTypes.includes(sheetTypeIntents[0])) {
    return score * 0.7; // 30% penalty for wrong discipline
  }

  return score;
}
```

Insert this call after `applyCategoryBoost()` at line 439 of rag.ts.

## Field Language Translation

Superintendents and field workers don't always use drawing-label terminology.
Add these to `extractKeywords()` synonym expansion:

| Field Language | Drawing Language | Target Sheet Type |
|---------------|-----------------|-------------------|
| "how thick is the slab" | slab thickness | structural (S-series) |
| "what size beam" | beam designation | structural (S-series) |
| "ceiling height" | ceiling height, RCP | reflected_ceiling (A-xxxR) |
| "what size pipe" | pipe size | plumbing/mechanical (P/M-series) |
| "how many outlets" | receptacle count | electrical (E-series) |
| "door hardware" | hardware group | door schedule sheet |
| "wall rating" | fire rating | wall type schedule, general notes |
| "what's the grade" | finish grade elevation | civil (C-series) |
| "parking spaces" | parking count | site plan (C-series) |
| "roof slope" | roof slope | roof plan (A-series roof) |
| "fire rated" | fire rating, UL assembly | life safety, general notes |
| "ADA clearance" | accessible clearance | architectural floor plan |
