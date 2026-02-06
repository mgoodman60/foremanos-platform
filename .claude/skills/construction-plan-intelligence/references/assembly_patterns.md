# Assembly Patterns & Spec Linkage

## What Is an Assembly

A construction assembly is a group of materials that are installed together as a system.
A single dimension on a plan (e.g., 18 LF of wall) generates material quantities for
every component in the assembly — not just "1 wall."

Example: Wall Type "WT-1" at 18 LF × 10' height =
- Metal studs: 3-5/8" @ 16" O.C. → 135 studs × 10' = 1,350 LF studs
- Track: 2 × 18 LF = 36 LF top + bottom track
- GWB: 18 × 10 × 2 sides = 360 SF (+ 10% waste = 396 SF)
- Insulation: 18 × 10 = 180 SF batt insulation
- Joint compound: 360 SF × 0.06 gal/SF = 21.6 gal
- Tape: 360 SF × 1.1 LF/SF = 396 LF
- Corner bead: per outside corners × 10' each
- Screws: ~1 lb per 100 SF of GWB

## Assembly Identifier Patterns

### Wall Types
- Regex: `/\b(WT|W|PT|P|WA|WB|WC)-?(\d{1,2}[A-Z]?)\b/g`
- Target: Wall type schedule/legend (search DrawingType where type = "schedule" AND subtype = "wall_type")
- If no schedule found, check general notes sheets for wall type diagrams
- Components to extract from schedule: stud size, stud spacing, GWB layers/type, insulation type/thickness, fire rating, STC rating

### Ceiling Types
- Regex: `/\b(CT|CLG|C)-?(\d{1,2}[A-Z]?)\b/g`
- Target: Ceiling type schedule or RCP legend
- Components: grid type (exposed/concealed), tile size, tile type, suspension wire spacing, above-ceiling insulation

### Floor Assemblies
- Regex: `/\b(FL|FT|F)-?(\d{1,2}[A-Z]?)\b/g`
- Target: Floor finish schedule
- Components: finish material, underlayment, adhesive, transition strips

### Roof Assemblies
- Regex: `/\b(RF|RT|R)-?(\d{1,2}[A-Z]?)\b/g`
- Target: Roof assembly detail (typically on detail sheets)
- Components: membrane, insulation (type and R-value), cover board, vapor barrier, deck type

### Exterior Wall Assemblies
- Often shown in wall section details rather than a schedule
- Components: structure (studs/CMU/concrete), sheathing, weather barrier, insulation, air gap, cladding, interior finish

## Resolution Logic

When an assembly identifier is found in a DocumentChunk:

```
1. Extract assembly code (e.g., "WT-1")
2. Search for definition:
   a. SheetLegend entries on same sheet
   b. DocumentChunk where drawingType = "schedule" AND content contains assembly code
   c. DocumentChunk on general notes sheets (G-series, A-001) containing assembly code
3. If found, parse component list from schedule/legend
4. For takeoff: multiply each component by the spatial quantity
   (LF of wall → wall height → SF → per-component quantities using formulas)
5. Store as linked TakeoffLineItems under the same MaterialTakeoff
```

## CSI MasterFormat Mapping (Division Structure)

For keynote → spec section resolution:

| Division | Code | Description | Common Drawing References |
|----------|------|-------------|--------------------------|
| 01 | 01 00 00 | General Requirements | Bid documents, general conditions |
| 02 | 02 00 00 | Existing Conditions | Demo plans, surveys |
| 03 | 03 00 00 | Concrete | Foundation plans, structural |
| 03 30 00 | | Cast-in-Place Concrete | Slabs, walls, footings |
| 04 | 04 00 00 | Masonry | CMU walls, veneer |
| 05 | 05 00 00 | Metals | Structural steel, misc metals |
| 05 12 00 | | Structural Steel Framing | Beams, columns, joists |
| 05 40 00 | | Cold-Formed Metal Framing | Metal studs, light gauge |
| 06 | 06 00 00 | Wood/Plastics/Composites | Wood framing, casework |
| 07 | 07 00 00 | Thermal & Moisture Protection | Roofing, waterproofing, insulation |
| 07 21 00 | | Thermal Insulation | Batt, rigid, spray foam |
| 07 52 00 | | Modified Bituminous Membrane Roofing | Low-slope roofing |
| 07 92 00 | | Joint Sealants | Caulking, expansion joints |
| 08 | 08 00 00 | Openings | Doors, windows, hardware |
| 08 11 00 | | Metal Doors and Frames | HM doors/frames |
| 08 71 00 | | Door Hardware | Hardware groups |
| 09 | 09 00 00 | Finishes | GWB, paint, flooring, ceiling |
| 09 21 16 | | Gypsum Board Assemblies | Drywall, shaft wall |
| 09 22 16 | | Non-Structural Metal Framing | Metal stud walls |
| 09 30 00 | | Tiling | Ceramic, porcelain tile |
| 09 51 00 | | Acoustical Ceilings | ACT, clouds |
| 09 65 00 | | Resilient Flooring | VCT, LVT, sheet vinyl |
| 09 91 00 | | Painting | Interior/exterior paint |
| 10 | 10 00 00 | Specialties | Toilet accessories, signage |
| 21 | 21 00 00 | Fire Suppression | Sprinkler systems |
| 22 | 22 00 00 | Plumbing | Piping, fixtures |
| 23 | 23 00 00 | HVAC | Ductwork, equipment |
| 26 | 26 00 00 | Electrical | Power, lighting |
| 27 | 27 00 00 | Communications | Low voltage, data |
| 28 | 28 00 00 | Electronic Safety/Security | Fire alarm, access control |
| 31 | 31 00 00 | Earthwork | Excavation, grading, fill |
| 32 | 32 00 00 | Exterior Improvements | Paving, curbs, landscaping |
| 33 | 33 00 00 | Utilities | Site utilities |

## Keynote Resolution Chain

```
Drawing keynote "5" on Sheet A-201
  → Keynote legend on A-201 says: "GWB assembly per 09 21 16"
  → CSI Section 09 21 16 = Gypsum Board Assemblies
  → Search uploaded spec documents for section 09 21 16
  → Spec tells you: product (5/8" Type X), installation method, fire rating requirements
```

This chain feeds both:
1. **RAG context** — when someone asks about wall construction, pull both the drawing data AND the spec section
2. **Takeoff accuracy** — spec section tells you the exact product, which drives unit cost
