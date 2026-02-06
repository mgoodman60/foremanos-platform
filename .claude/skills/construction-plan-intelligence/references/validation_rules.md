# Validation Rules

## Scale Plausibility (Gap 8)

When a dimension is extracted alongside a scale:

```
Architectural scales and expected dimension ranges:
  1/4" = 1'-0" (1:48)  → room dimensions 8'-30', building dimensions 50'-300'
  1/8" = 1'-0" (1:96)  → building dimensions 100'-600', site dimensions
  1/2" = 1'-0" (1:24)  → enlarged plans: restrooms 6'-15', stairs 8'-20'
  3/4" = 1'-0" (1:16)  → large-scale plans: 4'-12'
  1" = 1'-0"  (1:12)   → cabinet sections, millwork: 1'-6'
  1-1/2" = 1'-0" (1:8) → large details: 6"-4'
  3" = 1'-0"  (1:4)    → connection details: 2"-24"
  Full size (1:1)       → actual dimensions: fractions of inches to 6"

If extracted dimension falls outside expected range for its associated scale:
  → Flag: "Dimension {value} unusual for scale {scale} — verify scale association"
  → Likely cause: wrong scale applied (detail dimension read with plan scale)
```

## Multi-Scale Association Check

When `hasMultipleScales = true` on a chunk:
```
1. Each extracted dimension should have an associatedScale value
2. If a dimension has no associated scale, assign based on proximity:
   - Dimensions within detail bubble boundaries → use detail scale
   - Dimensions in main drawing area → use primary plan scale
3. Cross-check: if two dimensions for the same element use different scales, flag
```

## Structural Sanity

```
Concrete:
  - Slab thickness: 4"-12" for SOG, 6"-16" for elevated, >16" = mat/special
  - Footing width: 12"-60" for spread, >60" = mat foundation
  - Footing depth: 8"-48" for spread, >48" = caisson/pier
  - f'c: 3000-6000 PSI typical, >6000 = high-strength (verify)
  - Column spacing: 15'-40' typical, >40' = long span (verify)

Steel:
  - Beam depths: W8-W36 typical, W40+ = special
  - Column sizes: W8-W14 typical for low-rise
  - Joist spacing: 2'-0" to 6'-0" typical
  - Bay size: 20'-40' typical

Rebar:
  - #3 to #8 typical for buildings, #9-#11 for heavy foundations
  - Spacing: 4" to 18" O.C. typical, <4" = congestion concern
```

## Architectural Sanity

```
Rooms:
  - Ceiling height: 8'-20' typical commercial, >20' = lobby/atrium/warehouse
  - Room area: 50-5000 SF typical, >5000 SF = assembly/warehouse/gym
  - Corridor width: 4'-0" to 8'-0" typical, <4' = verify ADA, >8' = lobby

Doors:
  - Standard widths: 3'-0", 3'-6", 4'-0" (single), 6'-0" (pair)
  - Standard heights: 7'-0", 8'-0"
  - Width <2'-6" or >5'-0" single leaf = verify

Walls:
  - Stud sizes: 2-1/2", 3-5/8", 6" typical, >6" = shaft wall/special
  - Fire ratings: 0, 1-HR, 2-HR typical, 3-HR or 4-HR = special (verify)
```

## MEP Sanity

```
Ductwork:
  - Main trunk: 12x8 to 48x24 typical
  - Branch: 6x6 to 16x12 typical
  - Round: 4" to 24" typical
  - CFM per SF: 0.8-1.5 CFM/SF typical for offices

Electrical:
  - Panel size: 100A-400A typical, >400A = switchboard territory
  - Circuit count per panel: 20-42 typical
  - Receptacle density: 1 per 100 SF minimum (commercial)

Plumbing:
  - Domestic water main: 1" to 4" typical for buildings
  - Sanitary main: 3" to 8" typical
  - Vent main: 2" to 4" typical
  - Fixture units: verify against local code maximums per pipe size
```

## Extraction Completeness Checks

After processing all pages of a document, verify:

```
1. Sheet number sequence: Are there gaps?
   - A-101, A-103 exists but A-102 missing → may be a processing failure
   
2. Expected sheet types present:
   - Architectural set should have: floor plans, RCP, elevations, sections, details, schedules
   - Structural set should have: foundation plan, framing plans, details, notes
   - MEP sets should have: floor plans per discipline, schedules, details, riser diagrams
   
3. Cross-reference targets exist:
   - If Sheet A-201 references "3/A-501" but no A-501 was extracted → flag
   
4. Schedule coverage:
   - If door tags D101-D120 found on plans but door schedule only has D101-D115 → flag
   
5. Legend coverage:
   - If symbols appear on plans that don't match any SheetLegend entry → flag (Gap 10)
```

## Confidence Scoring Framework

Apply to all extracted data:

```
HIGH (≥ 0.85):
  - Value explicitly labeled on drawing (dimension with arrows, room number in box)
  - Value confirmed by multiple sources (plan AND schedule agree)
  - Value matches expected range for building type

MODERATE (0.60-0.84):
  - Value extracted from vision model with moderate certainty
  - Value appears once without cross-confirmation
  - Value slightly outside expected range but plausible

LOW (< 0.60):
  - Value inferred rather than directly extracted
  - Vision model expressed uncertainty
  - Value contradicts other extracted data
  - Value significantly outside expected range
```
