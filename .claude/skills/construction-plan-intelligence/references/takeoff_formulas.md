# Material Takeoff Formulas & Waste Factors

## Integration Point

These formulas connect extracted spatial data (DocumentChunk.dimensions, rooms, counts)
to TakeoffLineItem records. Call after Phase B extraction completes, or on-demand.

The existing `takeoff-memory-service.ts` TAKEOFF_CATEGORIES already has waste factors.
This reference provides the *calculation logic* that's missing — how to go from extracted
plan data to material quantities.

## Concrete (Division 03)

### Slabs on Grade
```
Volume (CY) = Length(ft) × Width(ft) × Thickness(ft) / 27
Rebar: from structural notes or estimate:
  Light (#3 or #4 @ 18" O.C. E.W.) ≈ 0.8 lb/SF
  Medium (#4 @ 12" O.C. E.W.) ≈ 1.5 lb/SF
  Heavy (#5 @ 12" O.C. E.W.) ≈ 2.5 lb/SF
Vapor barrier: SF = slab area
Granular fill: Volume(CY) = Length × Width × DepthOfFill(ft) / 27
Waste factor: 8% (subgrade irregularity, over-excavation)
```

### Spread Footings
```
Volume each (CY) = L(ft) × W(ft) × D(ft) / 27
Total = volume_each × count
Rebar: calculate from callout (#5 @ 12" E.W. → count bars each direction, multiply by length, convert to lbs)
  Bar weights: #3=0.376, #4=0.668, #5=1.043, #6=1.502, #7=2.044, #8=2.670 lb/ft
Formwork: SF = perimeter × depth × count
Waste factor: 5% concrete, 8% rebar (laps + waste cuts)
```

### Continuous Footings
```
Volume (CY) = Width(ft) × Depth(ft) × TotalLength(ft) / 27
Total length: sum all continuous footing runs from plan
Rebar: longitudinal bars (count × total length) + ties (total length / spacing × tie length)
Waste factor: 5% concrete, 8% rebar
```

### Elevated Slabs
```
Volume (CY) = Area(SF) × Thickness(ft) / 27
Formwork: SF = slab area (bottom form) + edges (perimeter × depth)
Shoring: covered area (use slab SF)
Rebar: from structural schedule or estimate 2-4 lb/SF
Waste factor: 5% concrete, 10% formwork
```

### Concrete Walls
```
Volume (CY) = TotalLength(ft) × Height(ft) × Thickness(ft) / 27
Formwork: SF = 2 × TotalLength × Height (both sides)
Rebar: horizontal + vertical from callout
Waste factor: 5% concrete, 10% formwork
```

## Structural Steel (Division 05)

```
Beams: Weight(lbs) = designation_weight(plf) × length(ft) × count
  e.g., W16x40 means 40 lbs/ft: 40 × 24' × 8 beams = 7,680 lbs
Columns: Weight(lbs) = designation_weight(plf) × height(ft) × count
Connection material: estimate 8-12% of member weight
Misc steel (lintels, angles, plates): estimate 5-8% of structural steel weight
Waste factor: 3% (precision fabrication)
```

## Metal Stud Framing (Division 05/09)

```
Wall SF = TotalLinearFeet × Height
Studs: TotalLF / spacing_factor × height
  16" O.C. → divide LF by 1.33
  24" O.C. → divide LF by 2.0
Track (top + bottom): 2 × TotalLF
Add per opening: 2 jack studs + 1 header track
Waste factor: 10% studs, 5% track
```

## Drywall / GWB (Division 09)

```
Wall SF = perimeter_of_walls × height - opening_areas
  Multiply by 2 for both sides (unless one-sided condition)
  Multiply by layer_count (1 or 2 layers per wall type)
Ceiling SF = floor_area (for ceiling GWB)
Joint compound: ~0.06 gal/SF
Tape: ~1.1 LF/SF
Corner bead: LF = count_outside_corners × height
Waste factor: 10% rectangular rooms, 15% irregular layouts
```

## Flooring (Division 09)

```
Tile (ceramic/porcelain): SF = floor_area × waste_factor
  Standard layout: 10% waste
  Diagonal layout: 15% waste
  Large format (24x24+): 12% waste
Carpet: SY = floor_area / 9 × 1.08 (8% waste for seaming)
VCT/LVT: SF = floor_area × 1.10
Hardwood: SF = floor_area × 1.10 (tongue waste) to 1.15 (diagonal)
```

## Paint (Division 09)

```
Wall paint SF = perimeter × height - openings (both sides if applicable)
Ceiling paint SF = floor_area
Coverage per gallon: ~350 SF/gal (one coat), plan for 2 coats
Primer: same SF, ~400 SF/gal
Gallons = total_SF / coverage × coats
Waste factor: 5%
```

## MEP Rough Quantities

### Electrical
```
Receptacles: count from plan × box + device + plate per each
Wire: home_run_distance × circuit_count × 1.15 (routing waste)
Conduit: same as wire footage, sized per circuit
Panels: count from plan or schedule
Waste factor: 10% wire, 5% conduit
```

### Plumbing
```
Fixtures: count from plan per type
Fixture units: per local code (residential water closet = 4 FU, lavatory = 1 FU)
Pipe: estimate from routing. Rule of thumb: 15-25 LF per fixture for supply, 10-20 LF for DWV
Waste factor: 10% pipe, 5% fittings estimate
```

### Mechanical
```
Equipment: count from plan/schedule
Ductwork: LF from routing, convert to weight:
  Galvanized sheet metal: ~1.5 lb/SF of duct surface
  Duct surface SF = perimeter(ft) × length(ft)
Diffusers: count from plan
Waste factor: 10% ductwork, 5% insulation
```

## Sanity Checks (validation_rules)

Flag if any of these are exceeded:

| Check | Red Flag |
|-------|----------|
| Concrete volume | > 50 CY per 1,000 SF footprint (single story) |
| Rebar weight | > 10 lbs/SF of slab |
| Steel weight | > 15 PSF of floor area |
| Stud count | > wall_LF × 1.2 (more studs than possible at 10" O.C.) |
| GWB area | > 4 × floor_area (assumes reasonable room proportions) |
| Pipe LF | > 40 LF per fixture (excessive routing) |
| Wire LF | > 200 LF per circuit (excessive home run) |
| Duct LF | > 3 × floor_area_SF^0.5 (rough proportionality) |
| Wall height | > 20' without explicit high-wall callout |
| Slab thickness | > 12" for SOG without being a mat foundation |
| Footing depth | > 48" without being a caisson/drilled pier |

When a sanity check fails, include a warning in the takeoff output:
"⚠️ [material] quantity appears high — verify [specific dimension/count] from Sheet [number]"
