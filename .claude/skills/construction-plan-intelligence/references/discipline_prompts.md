# Discipline-Specific Vision Prompts

Replace `getVisionPrompt()` (line 251, document-processor-batch.ts) with a two-pass system.

## Pass 1: Lightweight Classification

Cost: ~$0.0002/page (Haiku, tiny prompt, tiny response).
Insert before the main vision call in the per-page loop.

```
Classify this construction document page.
Return ONLY this JSON — no other text:
{
  "sheetNumber": "from title block or header",
  "discipline": "Architectural|Structural|Mechanical|Electrical|Plumbing|Civil|General|Specification|Schedule|Cover",
  "drawingType": "floor_plan|elevation|section|detail|schedule|specification|cover|site_plan|reflected_ceiling|roof_plan|diagram|general_notes",
  "confidence": 0.0-1.0
}
```

If confidence < 0.6 or discipline is "General", fall back to the current generic prompt.
Otherwise, select the discipline-specific prompt below.

## Pass 2: Discipline-Specific Prompts

### Architectural Floor Plan / RCP

```
ARCHITECTURAL PLAN EXTRACTION - Page {pageNum} of {fileName}

You are analyzing an architectural floor plan or reflected ceiling plan.

EXTRACT IN THIS PRIORITY ORDER:

1. SHEET IDENTIFICATION:
   - Sheet number (from title block, e.g., "A-201")
   - Sheet title
   - Scale(s) — for EACH scale on the page, note what area/detail it applies to

2. ROOMS AND SPACES (highest priority):
   - Room number, name, and area (SF) for every labeled space
   - Ceiling heights (especially on RCP sheets)
   - Floor finish callouts or keynotes

3. DOORS AND WINDOWS:
   - Every door tag (D1, D101, etc.) with swing direction if visible
   - Every window tag (W1, W101, etc.)
   - Hardware group references if shown

4. PARTITION AND WALL TYPES:
   - Wall type codes (WT-1, A1, etc.) — these reference wall type schedules
   - Fire-rated partition indicators (1-HR, 2-HR)
   - Partition centerline dimensions

5. KEYNOTES AND CALLOUTS:
   - Every keynote number with its meaning (from keynote legend if on this sheet)
   - Detail bubbles: number/sheet format (e.g., "3/A-501")
   - Section cut references
   - Elevation markers

6. DIMENSIONS:
   - All dimension strings exactly as shown
   - For each dimension, note which scale applies (if multiple scales on sheet)
   - Overall building dimensions vs. partition dimensions

7. GRID LINES: All grid designations (letters and numbers)

8. GENERAL NOTES: Any text blocks, especially ADA requirements, clearances

RESPOND WITH VALID JSON:
{
  "sheetNumber": "",
  "sheetTitle": "",
  "scales": [{"scale": "1/4\" = 1'-0\"", "appliesTo": "floor plan"}, {"scale": "1-1/2\" = 1'-0\"", "appliesTo": "enlarged restroom plan"}],
  "discipline": "Architectural",
  "drawingType": "floor_plan|reflected_ceiling",
  "rooms": [{"number": "101", "name": "LOBBY", "area": "450 SF", "ceilingHeight": "9'-0\"", "floorFinish": "CT-1"}],
  "doors": [{"tag": "D101", "swingDirection": "in", "wallType": "WT-1", "hardwareGroup": "HG-3"}],
  "windows": [{"tag": "W101", "type": "A"}],
  "wallTypes": [{"code": "WT-1", "fireRating": "1-HR", "locations": "corridor walls"}],
  "keynotes": [{"number": "5", "meaning": "GWB assembly per detail 3/A-501", "csiSection": "09 21 16"}],
  "detailBubbles": [{"number": "3", "targetSheet": "A-501", "description": "window head detail"}],
  "sectionCuts": [{"mark": "A", "targetSheet": "A-301"}],
  "elevationMarkers": [{"mark": "1", "targetSheet": "A-401", "direction": "north"}],
  "dimensions": [{"value": "15'-6\"", "label": "room width", "associatedScale": "1/4\" = 1'-0\""}],
  "gridLines": ["A", "B", "1", "2"],
  "notes": ["note text"],
  "legendEntries": [{"symbol": "", "meaning": ""}],
  "titleBlock": {"project": "", "drawn_by": "", "date": "", "revision": "", "revisionDate": ""},
  "textContent": "any remaining text",
  "continuationNotes": ["SEE SHEET A-202 FOR CONTINUATION"],
  "revisionClouds": [{"revNumber": "2", "description": "revised partition layout at grid B-3"}]
}
```

### Structural Plan

```
STRUCTURAL PLAN EXTRACTION - Page {pageNum} of {fileName}

You are analyzing a structural drawing (foundation plan, framing plan, or structural detail).

EXTRACT IN THIS PRIORITY ORDER:

1. SHEET IDENTIFICATION:
   - Sheet number (S-series expected)
   - Title, scale(s) with area association

2. STRUCTURAL MEMBERS (highest priority):
   - Beam designations: W-shapes (W16x40), HSS (HSS6x6x1/2), C-channels, angles
   - Column designations with grid locations
   - Joist marks and spacing
   - Slab thickness and reinforcement callouts
   - Foundation sizes (spread footings: L×W×D, continuous footings: W×D)

3. REBAR AND REINFORCEMENT:
   - Bar sizes (#4, #5, #6...) with spacing (@ 12" O.C., @ 16" O.C.)
   - Rebar placement (top/bottom, each way, continuous)
   - WWF/welded wire designations
   - Lap splice lengths
   - Dowel callouts

4. DIMENSIONS AND ELEVATIONS:
   - All dimension strings
   - Top of steel (T.O.S.) elevations
   - Bottom of footing (B.O.F.) elevations
   - Finish floor (F.F.) elevations
   - Slab edge elevations

5. STRUCTURAL NOTES:
   - Concrete strength (f'c = 4000 PSI)
   - Steel grade (A992, A36)
   - Soil bearing capacity
   - Special inspection requirements
   - Load values (PSF live, dead, total)

6. CONNECTION DETAILS AND REFERENCES:
   - Detail bubbles with target sheets
   - Typical connection callouts
   - Section cuts

7. GRID LINES: All grid designations

RESPOND WITH VALID JSON:
{
  "sheetNumber": "",
  "sheetTitle": "",
  "scales": [{"scale": "", "appliesTo": ""}],
  "discipline": "Structural",
  "drawingType": "foundation_plan|framing_plan|structural_detail|structural_section",
  "members": [{"designation": "W16x40", "mark": "B-1", "gridLocation": "A-1 to A-3", "length": "24'-0\""}],
  "columns": [{"mark": "C-1", "size": "W10x49", "gridLocation": "A-1", "baseElev": "100.00", "topElev": "112.00"}],
  "slabs": [{"thickness": "6\"", "reinforcement": "#4 @ 12\" O.C. E.W.", "area": "main floor", "concrete": "4000 PSI"}],
  "footings": [{"type": "spread|continuous|mat", "size": "4'-0\" x 4'-0\" x 12\"", "rebar": "#5 @ 12\" O.C. E.W.", "gridLocation": "A-1"}],
  "rebar": [{"size": "#5", "spacing": "12\" O.C.", "placement": "bottom E.W.", "location": "slab on grade"}],
  "elevations": [{"label": "T.O.S.", "value": "112.50", "location": "grid A-1"}],
  "structuralNotes": [{"category": "concrete_strength|steel_grade|soil_bearing|loading|inspection", "text": ""}],
  "detailBubbles": [{"number": "", "targetSheet": "", "description": ""}],
  "dimensions": [{"value": "", "label": "", "associatedScale": ""}],
  "gridLines": [],
  "titleBlock": {"project": "", "date": "", "revision": "", "revisionDate": ""},
  "textContent": ""
}
```

### MEP — Mechanical

```
MECHANICAL PLAN EXTRACTION - Page {pageNum} of {fileName}

You are analyzing a mechanical/HVAC drawing.

EXTRACT IN THIS PRIORITY ORDER:

1. SHEET IDENTIFICATION: Sheet number (M-series), title, scale(s)

2. EQUIPMENT (highest priority):
   - Equipment tags: AHU, RTU, MAU, ERU, FCU, VAV, FPB, HP, CU, EF
   - For each: tag, capacity (tons/CFM/BTU), location, serving area
   - Refrigerant piping sizes

3. DUCTWORK:
   - Duct sizes (WxH for rectangular, diameter for round)
   - CFM values at diffusers and branches
   - Duct material callouts (galvanized, flex, lined)
   - Diffuser/grille tags with type and CFM

4. CONTROLS:
   - Thermostat locations
   - Control valve tags
   - Damper types (fire, smoke, balancing, control)
   - Sensor locations

5. PIPING:
   - Pipe sizes and types (chilled water, hot water, condensate, refrigerant)
   - Valve tags and types
   - Insulation callouts

6. SCHEDULES AND NOTES:
   - Equipment schedules (if on this sheet)
   - Mechanical notes and abbreviations
   - Detail/section references

RESPOND WITH VALID JSON:
{
  "sheetNumber": "",
  "sheetTitle": "",
  "scales": [{"scale": "", "appliesTo": ""}],
  "discipline": "Mechanical",
  "drawingType": "mechanical_plan|mechanical_detail|mechanical_schedule",
  "equipment": [{"tag": "AHU-1", "type": "air_handler", "capacity": "10,000 CFM", "location": "Mech Room 101", "servingArea": "2nd Floor East"}],
  "ductwork": [{"size": "24x12", "cfm": "2400", "material": "galvanized", "route": "main trunk from AHU-1"}],
  "diffusers": [{"tag": "SD-1", "type": "square_diffuser", "cfm": "200", "size": "24x24", "room": "101"}],
  "dampers": [{"tag": "FD-1", "type": "fire", "size": "24x12", "location": "at rated wall grid B-3"}],
  "piping": [{"size": "4\"", "type": "chilled_water_supply", "insulation": "1\" fiberglass"}],
  "detailBubbles": [{"number": "", "targetSheet": "", "description": ""}],
  "dimensions": [{"value": "", "label": "", "associatedScale": ""}],
  "notes": [],
  "titleBlock": {"project": "", "date": "", "revision": "", "revisionDate": ""},
  "textContent": ""
}
```

### MEP — Electrical

```
ELECTRICAL PLAN EXTRACTION - Page {pageNum} of {fileName}

You are analyzing an electrical drawing.

EXTRACT IN THIS PRIORITY ORDER:

1. SHEET IDENTIFICATION: Sheet number (E-series), title, scale(s)

2. PANELS AND DISTRIBUTION (highest priority):
   - Panel designations (LP-1, DP-2A, MDP, MCC)
   - Panel locations and fed-from information
   - Voltage and phase (120/208V 3PH, 277/480V 3PH)
   - Main breaker sizes

3. CIRCUITS AND WIRING:
   - Circuit numbers and home runs (arrows with circuit designations)
   - Conduit sizes and types (EMT, RGS, PVC)
   - Wire sizes (12 AWG, 10 AWG, etc.)
   - Number of conductors

4. DEVICES AND FIXTURES:
   - Receptacle types and quantities (duplex, GFI, dedicated, floor)
   - Switch types (single, 3-way, dimmer, occupancy sensor)
   - Lighting fixture types/tags with lamp counts
   - Junction box locations

5. POWER EQUIPMENT:
   - Transformer tags, kVA ratings
   - Disconnect switches
   - Motor connections with HP ratings
   - Generator/UPS connections

6. FIRE ALARM (if shown):
   - Device types: pull stations, smoke detectors, horns/strobes, duct detectors
   - FACP location
   - Notification appliance circuit routing

7. SCHEDULES AND NOTES:
   - Panel schedules (if on this sheet)
   - Fixture schedules
   - Electrical notes, symbols legend

RESPOND WITH VALID JSON:
{
  "sheetNumber": "",
  "sheetTitle": "",
  "scales": [{"scale": "", "appliesTo": ""}],
  "discipline": "Electrical",
  "drawingType": "electrical_plan|electrical_detail|panel_schedule|riser_diagram",
  "panels": [{"tag": "LP-1", "location": "Elec Room 103", "voltage": "120/208V 3PH", "mainBreaker": "225A", "fedFrom": "MDP"}],
  "circuits": [{"number": "1,3", "panel": "LP-1", "description": "lighting circuit", "conductors": "2#12, 1#12G in 3/4\" EMT"}],
  "receptacles": [{"type": "duplex|gfi|dedicated|floor", "count": 5, "circuit": "LP-1/5", "room": "101"}],
  "switches": [{"type": "single|3way|dimmer|occupancy", "count": 2, "circuit": "LP-1/1", "room": "101"}],
  "lightingFixtures": [{"tag": "A", "type": "2x4 LED troffer", "count": 12, "circuit": "LP-1/1,3", "room": "101"}],
  "fireAlarm": [{"type": "pull_station|smoke|horn_strobe|duct_detector", "tag": "", "location": ""}],
  "detailBubbles": [{"number": "", "targetSheet": "", "description": ""}],
  "notes": [],
  "titleBlock": {"project": "", "date": "", "revision": "", "revisionDate": ""},
  "textContent": ""
}
```

### MEP — Plumbing

```
PLUMBING PLAN EXTRACTION - Page {pageNum} of {fileName}

You are analyzing a plumbing drawing.

EXTRACT IN THIS PRIORITY ORDER:

1. SHEET IDENTIFICATION: Sheet number (P-series), title, scale(s)

2. FIXTURES (highest priority):
   - Fixture tags: WC (water closet), LAV (lavatory), UR (urinal), SK (sink), DF (drinking fountain)
   - Fixture counts per room
   - ADA fixture designations

3. PIPING:
   - Pipe sizes by system: CW (cold water), HW (hot water), HWR (hot water return)
   - Sanitary waste pipe sizes with slope callouts (1/4"/ft, 1/8"/ft)
   - Vent pipe sizes
   - Storm drain sizes
   - Gas pipe sizes

4. EQUIPMENT:
   - Water heater tags, capacity (gallons, BTU)
   - Pumps: domestic, recirculation, sump
   - Grease interceptors, oil-water separators
   - Backflow preventers

5. CLEANOUTS AND ACCESS:
   - Cleanout locations (CO)
   - Floor drains (FD) with sizes
   - Roof drains (RD) with sizes
   - Overflow drains

6. NOTES AND SCHEDULES:
   - Plumbing fixture schedule (if on this sheet)
   - Fixture unit counts
   - Plumbing notes, pipe material specs

RESPOND WITH VALID JSON:
{
  "sheetNumber": "",
  "sheetTitle": "",
  "scales": [{"scale": "", "appliesTo": ""}],
  "discipline": "Plumbing",
  "drawingType": "plumbing_plan|plumbing_detail|plumbing_riser|plumbing_schedule",
  "fixtures": [{"tag": "WC-1", "type": "water_closet", "count": 2, "room": "201", "ada": false}],
  "piping": [{"size": "4\"", "system": "sanitary_waste", "slope": "1/4\"/ft", "material": "cast iron"}],
  "equipment": [{"tag": "WH-1", "type": "water_heater", "capacity": "100 gal", "btu": "199,000", "location": "Mech 103"}],
  "cleanouts": [{"tag": "CO-1", "size": "4\"", "location": "corridor at grid B-3"}],
  "floorDrains": [{"tag": "FD-1", "size": "4\"", "room": "Mech 103"}],
  "detailBubbles": [{"number": "", "targetSheet": "", "description": ""}],
  "notes": [],
  "titleBlock": {"project": "", "date": "", "revision": "", "revisionDate": ""},
  "textContent": ""
}
```

### Civil / Site Plan

```
CIVIL/SITE PLAN EXTRACTION - Page {pageNum} of {fileName}

You are analyzing a civil or site drawing.

EXTRACT IN THIS PRIORITY ORDER:

1. SHEET IDENTIFICATION: Sheet number (C-series), title, scale(s)

2. GRADING AND ELEVATIONS (highest priority):
   - Spot elevations (existing and proposed)
   - Contour lines with intervals
   - Finish floor elevations at building entries
   - Top of wall/curb elevations

3. UTILITIES:
   - Storm sewer: pipe sizes, material, slopes, invert elevations, structure types
   - Sanitary sewer: pipe sizes, slopes, invert elevations, manholes
   - Water main: size, material, valves, hydrants, connections
   - Gas, electric, telecom routing

4. SITE FEATURES:
   - Building footprint and setback dimensions
   - Parking counts and stall dimensions
   - Drive aisle widths
   - Curb types and locations
   - Accessible routes and ramps

5. AREAS AND QUANTITIES:
   - Lot area, building footprint area
   - Impervious coverage calculations
   - Landscape area
   - Earthwork cut/fill quantities (if shown)

6. NOTES: Erosion control, construction sequencing, utility notes

RESPOND WITH VALID JSON:
{
  "sheetNumber": "",
  "sheetTitle": "",
  "scales": [{"scale": "", "appliesTo": ""}],
  "discipline": "Civil",
  "drawingType": "site_plan|grading_plan|utility_plan|erosion_control",
  "elevations": [{"label": "FF", "value": "100.50", "location": "main entry"}],
  "utilities": [{"type": "storm|sanitary|water|gas|electric", "size": "12\" RCP", "slope": "0.5%", "invertIn": "95.20", "invertOut": "95.10"}],
  "siteFeatures": [{"type": "parking|curb|sidewalk|ramp", "dimension": "", "count": null}],
  "areas": [{"label": "lot_area|building_footprint|impervious|landscape", "value": "15,000 SF"}],
  "detailBubbles": [{"number": "", "targetSheet": "", "description": ""}],
  "dimensions": [{"value": "", "label": "", "associatedScale": ""}],
  "notes": [],
  "titleBlock": {"project": "", "date": "", "revision": "", "revisionDate": ""},
  "textContent": ""
}
```

### Schedule Page (any discipline)

```
SCHEDULE EXTRACTION - Page {pageNum} of {fileName}

You are analyzing a schedule page (door schedule, window schedule, finish schedule,
equipment schedule, panel schedule, etc.).

CRITICAL: Extract ALL rows and columns. Do not summarize or skip rows.

1. SCHEDULE TYPE: Identify what schedule this is (door, window, finish, equipment, panel, fixture)
2. COLUMN HEADERS: List every column header exactly
3. ROW DATA: Extract every row with all column values
4. NOTES: Any footnotes or general notes below the schedule

RESPOND WITH VALID JSON:
{
  "sheetNumber": "",
  "sheetTitle": "",
  "discipline": "",
  "drawingType": "schedule",
  "scheduleType": "door|window|finish|equipment|panel|fixture|plumbing_fixture|other",
  "columnHeaders": ["MARK", "SIZE", "TYPE", "FRAME", "HARDWARE", "FIRE RATING", "REMARKS"],
  "rows": [
    {"MARK": "D101", "SIZE": "3'-0\" x 7'-0\"", "TYPE": "A", "FRAME": "HM", "HARDWARE": "HG-1", "FIRE RATING": "90 MIN", "REMARKS": "PAIR"}
  ],
  "notes": ["All doors to comply with ADA requirements"],
  "titleBlock": {"project": "", "date": "", "revision": "", "revisionDate": ""},
  "textContent": ""
}
```

### Fallback: Generic (current prompt, improved)

Use the existing `getVisionPrompt()` content for pages that fail classification or
have confidence < 0.6. Add these fields to the existing JSON schema:

```
"scales": [{"scale": "", "appliesTo": ""}],
"continuationNotes": [],
"revisionClouds": [{"revNumber": "", "description": ""}]
```
