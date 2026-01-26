/**
 * Comprehensive Material Takeoff Categories
 * 
 * Covers all major construction divisions:
 * - Structural (concrete, steel, masonry, lumber)
 * - MEP (mechanical, electrical, plumbing)
 * - Finishes (flooring, walls, ceilings)
 * - Sitework (earthwork, paving, utilities)
 */

export interface TakeoffCategory {
  id: string;
  name: string;
  csiDivision: string;
  subCategories: SubCategory[];
  icon: string;
  color: string;
}

export interface SubCategory {
  id: string;
  name: string;
  defaultUnit: string;
  wasteFactorPercent: number;
  laborHoursPerUnit: number;
  keywords: string[];
}

export const TAKEOFF_CATEGORIES: TakeoffCategory[] = [
  // STRUCTURAL
  {
    id: 'concrete',
    name: 'Concrete',
    csiDivision: '03',
    icon: 'Building2',
    color: '#6B7280',
    subCategories: [
      { id: 'slab-on-grade', name: 'Slab on Grade', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 0.8, keywords: ['slab', 'SOG', 'floor slab', 'concrete floor'] },
      { id: 'footings', name: 'Footings', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 1.2, keywords: ['footing', 'foundation', 'FTG', 'spread footing'] },
      { id: 'foundation-walls', name: 'Foundation Walls', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 1.5, keywords: ['foundation wall', 'stem wall', 'basement wall'] },
      { id: 'columns', name: 'Columns', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 2.0, keywords: ['column', 'pier', 'pilaster'] },
      { id: 'beams', name: 'Beams', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 2.5, keywords: ['beam', 'grade beam', 'tie beam', 'lintel'] },
      { id: 'elevated-slab', name: 'Elevated Slab', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 1.5, keywords: ['elevated slab', 'suspended slab', 'deck'] },
      { id: 'curbs', name: 'Curbs & Pads', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['curb', 'equipment pad', 'housekeeping pad'] },
      { id: 'formwork', name: 'Formwork', defaultUnit: 'SFCA', wasteFactorPercent: 10, laborHoursPerUnit: 0.5, keywords: ['form', 'formwork', 'SFCA'] },
    ]
  },
  {
    id: 'rebar',
    name: 'Reinforcing Steel',
    csiDivision: '03',
    icon: 'Grid3X3',
    color: '#374151',
    subCategories: [
      { id: 'rebar-light', name: 'Rebar #3-#5', defaultUnit: 'TON', wasteFactorPercent: 5, laborHoursPerUnit: 20, keywords: ['#3', '#4', '#5', 'rebar', 'reinforcing'] },
      { id: 'rebar-heavy', name: 'Rebar #6+', defaultUnit: 'TON', wasteFactorPercent: 5, laborHoursPerUnit: 18, keywords: ['#6', '#7', '#8', '#9', '#10', '#11'] },
      { id: 'wwf', name: 'Welded Wire Fabric', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.01, keywords: ['WWF', 'welded wire', 'wire mesh', 'WWM'] },
      { id: 'dowels', name: 'Dowels', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['dowel', 'anchor bolt'] },
    ]
  },
  {
    id: 'masonry',
    name: 'Masonry',
    csiDivision: '04',
    icon: 'LayoutGrid',
    color: '#92400E',
    subCategories: [
      { id: 'cmu', name: 'CMU Block', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.08, keywords: ['CMU', 'block', 'concrete block', 'masonry unit'] },
      { id: 'brick', name: 'Brick', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.12, keywords: ['brick', 'face brick', 'veneer'] },
      { id: 'grout', name: 'Grout Fill', defaultUnit: 'CF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['grout', 'cell fill', 'solid grout'] },
    ]
  },
  {
    id: 'steel',
    name: 'Structural Steel',
    csiDivision: '05',
    icon: 'Columns',
    color: '#1F2937',
    subCategories: [
      { id: 'wide-flange', name: 'Wide Flange Beams', defaultUnit: 'TON', wasteFactorPercent: 3, laborHoursPerUnit: 15, keywords: ['W', 'wide flange', 'WF', 'beam'] },
      { id: 'tube-steel', name: 'Tube Steel', defaultUnit: 'TON', wasteFactorPercent: 3, laborHoursPerUnit: 18, keywords: ['HSS', 'tube', 'square tube', 'rectangular tube'] },
      { id: 'angles', name: 'Angles', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['angle', 'L', 'ledger angle'] },
      { id: 'channels', name: 'Channels', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['channel', 'C', 'MC'] },
      { id: 'metal-deck', name: 'Metal Deck', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.02, keywords: ['deck', 'metal deck', 'composite deck', 'B-deck'] },
      { id: 'misc-steel', name: 'Miscellaneous Steel', defaultUnit: 'LBS', wasteFactorPercent: 5, laborHoursPerUnit: 0.01, keywords: ['embed', 'plate', 'bracket', 'hanger'] },
    ]
  },
  {
    id: 'lumber',
    name: 'Wood & Lumber',
    csiDivision: '06',
    icon: 'TreePine',
    color: '#78350F',
    subCategories: [
      { id: 'studs', name: 'Wall Studs', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['stud', '2x4', '2x6', 'wall framing'] },
      { id: 'joists', name: 'Floor/Ceiling Joists', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['joist', '2x10', '2x12', 'floor joist', 'ceiling joist'] },
      { id: 'rafters', name: 'Rafters', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['rafter', 'hip rafter', 'valley rafter'] },
      { id: 'trusses', name: 'Trusses', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.5, keywords: ['truss', 'roof truss', 'floor truss'] },
      { id: 'beams', name: 'Wood Beams', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['beam', 'LVL', 'glulam', 'PSL', 'header'] },
      { id: 'sheathing', name: 'Sheathing/Plywood', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.01, keywords: ['plywood', 'OSB', 'sheathing', 'subfloor'] },
      { id: 'blocking', name: 'Blocking & Nailers', defaultUnit: 'LF', wasteFactorPercent: 15, laborHoursPerUnit: 0.02, keywords: ['blocking', 'nailer', 'fire block'] },
    ]
  },

  // MEP - MECHANICAL
  {
    id: 'hvac',
    name: 'HVAC',
    csiDivision: '23',
    icon: 'Wind',
    color: '#0284C7',
    subCategories: [
      // Ductwork
      { id: 'ductwork-rect', name: 'Rectangular Ductwork', defaultUnit: 'LBS', wasteFactorPercent: 5, laborHoursPerUnit: 0.05, keywords: ['duct', 'rectangular duct', 'supply duct', 'return duct', 'sheet metal'] },
      { id: 'ductwork-round', name: 'Round/Spiral Duct', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['spiral duct', 'round duct', 'pipe duct'] },
      { id: 'flex-duct', name: 'Flexible Duct', defaultUnit: 'LF', wasteFactorPercent: 8, laborHoursPerUnit: 0.08, keywords: ['flex duct', 'flexible duct', 'insulated flex'] },
      
      // Duct Fittings - Rectangular
      { id: 'rect-elbow', name: 'Rectangular Elbow', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.35, keywords: ['elbow', 'duct elbow', '90 elbow', '45 elbow', 'square elbow'] },
      { id: 'rect-tee', name: 'Rectangular Tee/Wye', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.45, keywords: ['duct tee', 'branch', 'wye', 'Y fitting'] },
      { id: 'rect-transition', name: 'Rectangular Transition', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.3, keywords: ['transition', 'reducer', 'increaser', 'trunk reducer'] },
      { id: 'rect-offset', name: 'Rectangular Offset', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.4, keywords: ['offset', 'duct offset', 'S-offset'] },
      { id: 'rect-takeoff', name: 'Rectangular Takeoff', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.25, keywords: ['takeoff', 'tap', 'branch takeoff', 'collar'] },
      
      // Duct Fittings - Round
      { id: 'round-elbow', name: 'Round Elbow', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.2, keywords: ['spiral elbow', 'round elbow', 'adjustable elbow'] },
      { id: 'round-tee', name: 'Round Tee/Wye', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.3, keywords: ['round tee', 'lateral', 'saddle tap'] },
      { id: 'round-reducer', name: 'Round Reducer', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.15, keywords: ['round reducer', 'concentric reducer', 'eccentric reducer'] },
      { id: 'round-coupling', name: 'Duct Coupling/Connector', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['coupling', 'connector', 'sleeve', 'draw band'] },
      { id: 'boot', name: 'Register Boot', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.25, keywords: ['boot', 'register boot', 'end boot', 'stack boot'] },
      
      // Air Terminals
      { id: 'supply-diffuser', name: 'Supply Diffuser', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['diffuser', 'supply diffuser', 'ceiling diffuser', 'linear diffuser', 'slot diffuser'] },
      { id: 'return-grille', name: 'Return Grille', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.4, keywords: ['grille', 'return grille', 'return air', 'egg crate'] },
      { id: 'register', name: 'Register', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.3, keywords: ['register', 'wall register', 'floor register', 'sidewall'] },
      { id: 'louver', name: 'Louver', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['louver', 'outside air', 'intake louver', 'exhaust louver', 'weather louver'] },
      
      // Dampers
      { id: 'volume-damper', name: 'Volume Damper', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.4, keywords: ['volume damper', 'balancing damper', 'manual damper', 'splitter damper'] },
      { id: 'fire-damper', name: 'Fire/Smoke Damper', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.0, keywords: ['fire damper', 'smoke damper', 'combination damper', 'FSD'] },
      { id: 'backdraft-damper', name: 'Backdraft Damper', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['backdraft', 'gravity damper', 'barometric'] },
      { id: 'motorized-damper', name: 'Motorized Damper', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['motorized damper', 'control damper', 'OA damper', 'actuator'] },
      
      // Equipment
      { id: 'ahu', name: 'Air Handling Unit', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 24, keywords: ['AHU', 'air handler', 'air handling'] },
      { id: 'rtu', name: 'Rooftop Unit', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 16, keywords: ['RTU', 'rooftop', 'package unit'] },
      { id: 'split-system', name: 'Split System', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 12, keywords: ['split', 'mini split', 'ductless', 'condenser'] },
      { id: 'vav', name: 'VAV Box', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['VAV', 'variable air volume', 'terminal unit', 'FPB'] },
      { id: 'fan-coil', name: 'Fan Coil Unit', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 6, keywords: ['FCU', 'fan coil', 'unit ventilator'] },
      { id: 'unit-heater', name: 'Unit Heater', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['unit heater', 'gas heater', 'electric heater', 'cabinet heater'] },
      { id: 'exhaust-fan', name: 'Exhaust Fan', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['exhaust fan', 'inline fan', 'roof exhaust', 'centrifugal', 'upblast'] },
      { id: 'erv-hrv', name: 'ERV/HRV', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['ERV', 'HRV', 'energy recovery', 'heat recovery'] },
      
      // Refrigerant Piping
      { id: 'copper-ref', name: 'Refrigerant Piping', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.2, keywords: ['refrigerant', 'ACR', 'suction', 'liquid line', 'line set'] },
      { id: 'ref-fitting', name: 'Refrigerant Fitting', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.25, keywords: ['ref fitting', 'braze fitting', 'copper fitting'] },
      
      // Hydronic
      { id: 'chilled-water', name: 'Chilled Water Pipe', defaultUnit: 'LF', wasteFactorPercent: 8, laborHoursPerUnit: 0.2, keywords: ['chilled water', 'CHW', 'CHWS', 'CHWR'] },
      { id: 'hot-water-hvac', name: 'Hot Water Pipe (HVAC)', defaultUnit: 'LF', wasteFactorPercent: 8, laborHoursPerUnit: 0.2, keywords: ['hot water', 'HW', 'HWS', 'HWR', 'heating hot water'] },
      { id: 'hydronic-fitting', name: 'Hydronic Fitting', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['grooved fitting', 'victaulic', 'press fitting'] },
      
      // Insulation & Supports
      { id: 'duct-insulation', name: 'Duct Insulation', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['duct insulation', 'duct wrap', 'duct liner', 'fiberglass wrap'] },
      { id: 'pipe-insulation-mech', name: 'Pipe Insulation (HVAC)', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.06, keywords: ['pipe insulation', 'chilled water insulation', 'elastomeric'] },
      { id: 'duct-support', name: 'Duct Support/Hanger', defaultUnit: 'EA', wasteFactorPercent: 10, laborHoursPerUnit: 0.2, keywords: ['trapeze', 'hanger', 'strap', 'rod', 'duct support'] },
    ]
  },
  
  // MEP - PLUMBING
  {
    id: 'plumbing',
    name: 'Plumbing',
    csiDivision: '22',
    icon: 'Droplets',
    color: '#0891B2',
    subCategories: [
      // Piping
      { id: 'copper-pipe', name: 'Copper Pipe', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.15, keywords: ['copper', 'type L', 'type M', 'type K', 'water pipe', 'ACR'] },
      { id: 'pvc-pipe', name: 'PVC/CPVC Pipe', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.1, keywords: ['PVC', 'CPVC', 'drain pipe', 'waste pipe', 'schedule 40', 'schedule 80'] },
      { id: 'cast-iron', name: 'Cast Iron Pipe', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['cast iron', 'CI', 'soil pipe', 'no-hub', 'hubless'] },
      { id: 'pex-pipe', name: 'PEX Tubing', defaultUnit: 'LF', wasteFactorPercent: 8, laborHoursPerUnit: 0.08, keywords: ['PEX', 'cross-linked', 'PEX-A', 'PEX-B'] },
      { id: 'steel-pipe', name: 'Black/Galv Steel Pipe', defaultUnit: 'LF', wasteFactorPercent: 8, laborHoursPerUnit: 0.25, keywords: ['black iron', 'galvanized', 'gas pipe', 'threaded pipe', 'schedule 40'] },
      
      // Copper Fittings
      { id: 'copper-elbow-90', name: 'Copper 90° Elbow', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['copper elbow', '90 elbow', '90°', 'copper 90'] },
      { id: 'copper-elbow-45', name: 'Copper 45° Elbow', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['copper 45', '45 elbow', '45°'] },
      { id: 'copper-tee', name: 'Copper Tee', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.18, keywords: ['copper tee', 'copper T'] },
      { id: 'copper-coupling', name: 'Copper Coupling', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.12, keywords: ['copper coupling', 'slip coupling', 'repair coupling'] },
      { id: 'copper-cap', name: 'Copper Cap', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['copper cap', 'end cap'] },
      { id: 'copper-reducer', name: 'Copper Reducer', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['copper reducer', 'reducing coupling', 'bell reducer'] },
      { id: 'copper-adapter', name: 'Copper Adapter', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['copper adapter', 'male adapter', 'female adapter', 'MIP', 'FIP'] },
      { id: 'copper-union', name: 'Copper Union', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['copper union', 'dielectric union'] },
      
      // PVC/CPVC Fittings
      { id: 'pvc-elbow-90', name: 'PVC 90° Elbow', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['pvc elbow', 'pvc 90', '90 degree'] },
      { id: 'pvc-elbow-45', name: 'PVC 45° Elbow', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['pvc 45', '45 degree', '1/8 bend'] },
      { id: 'pvc-tee', name: 'PVC Tee', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.12, keywords: ['pvc tee', 'pvc T', 'sanitary tee'] },
      { id: 'pvc-wye', name: 'PVC Wye', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['pvc wye', 'pvc Y', 'combo wye'] },
      { id: 'pvc-coupling', name: 'PVC Coupling', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.08, keywords: ['pvc coupling', 'slip coupling', 'repair coupling'] },
      { id: 'pvc-reducer', name: 'PVC Reducer', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['pvc reducer', 'reducing bushing', 'reducer bushing'] },
      { id: 'pvc-adapter', name: 'PVC Adapter', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['pvc adapter', 'male adapter', 'female adapter', 'trap adapter'] },
      { id: 'pvc-cleanout', name: 'PVC Cleanout', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.25, keywords: ['cleanout', 'CO', 'clean out', 'access fitting'] },
      { id: 'pvc-p-trap', name: 'P-Trap', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['P-trap', 'P trap', 'trap'] },
      
      // Cast Iron Fittings
      { id: 'ci-elbow', name: 'Cast Iron Elbow', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.25, keywords: ['CI elbow', 'cast iron elbow', 'no-hub elbow'] },
      { id: 'ci-tee', name: 'Cast Iron Tee/Wye', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.3, keywords: ['CI tee', 'CI wye', 'cast iron tee', 'sanitary tee'] },
      { id: 'ci-coupling', name: 'No-Hub Coupling', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['no-hub', 'mission coupling', 'fernco', 'band coupling', 'shielded coupling'] },
      
      // PEX Fittings
      { id: 'pex-elbow', name: 'PEX Elbow', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.08, keywords: ['pex elbow', 'brass elbow'] },
      { id: 'pex-tee', name: 'PEX Tee', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['pex tee', 'brass tee'] },
      { id: 'pex-coupling', name: 'PEX Coupling', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.06, keywords: ['pex coupling', 'brass coupling', 'crimp coupling', 'expansion coupling'] },
      { id: 'pex-manifold', name: 'PEX Manifold', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['manifold', 'pex manifold', 'distribution manifold'] },
      
      // Valves & Specialties
      { id: 'ball-valve', name: 'Ball Valve', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.35, keywords: ['ball valve', 'full port', 'quarter turn'] },
      { id: 'gate-valve', name: 'Gate Valve', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.4, keywords: ['gate valve', 'isolation valve'] },
      { id: 'check-valve', name: 'Check Valve', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.35, keywords: ['check valve', 'swing check', 'spring check', 'backflow'] },
      { id: 'prv', name: 'Pressure Reducing Valve', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.0, keywords: ['PRV', 'pressure regulator', 'pressure reducing'] },
      { id: 'mixing-valve', name: 'Mixing Valve', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.0, keywords: ['mixing valve', 'thermostatic', 'tempering valve'] },
      { id: 'backflow-preventer', name: 'Backflow Preventer', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.0, keywords: ['backflow', 'RPZ', 'DCVA', 'reduced pressure'] },
      
      // Fixtures
      { id: 'water-closet', name: 'Water Closet (Toilet)', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3.5, keywords: ['toilet', 'water closet', 'WC', 'floor mount', 'wall hung'] },
      { id: 'lavatory', name: 'Lavatory', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.5, keywords: ['lavatory', 'lav', 'sink', 'vanity', 'hand sink'] },
      { id: 'urinal', name: 'Urinal', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3.0, keywords: ['urinal', 'wall hung urinal', 'flush valve urinal'] },
      { id: 'service-sink', name: 'Service Sink', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3.0, keywords: ['mop sink', 'service sink', 'janitor sink', 'floor sink'] },
      { id: 'drinking-fountain', name: 'Drinking Fountain', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3.0, keywords: ['drinking fountain', 'water cooler', 'bottle filler'] },
      { id: 'shower', name: 'Shower', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.0, keywords: ['shower', 'shower valve', 'shower head'] },
      
      // Equipment
      { id: 'water-heater', name: 'Water Heater', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['water heater', 'hot water', 'tank water heater', 'tankless'] },
      { id: 'expansion-tank', name: 'Expansion Tank', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['expansion tank', 'thermal expansion'] },
      { id: 'circ-pump', name: 'Circulating Pump', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.0, keywords: ['circulator', 'circ pump', 'recirculating pump'] },
      { id: 'sump-pump', name: 'Sump/Ejector Pump', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.0, keywords: ['sump pump', 'ejector', 'sewage pump', 'lift station'] },
      
      // Supports & Insulation
      { id: 'pipe-hanger', name: 'Pipe Hanger/Support', defaultUnit: 'EA', wasteFactorPercent: 10, laborHoursPerUnit: 0.15, keywords: ['hanger', 'clevis', 'strut', 'pipe support', 'riser clamp', 'u-bolt'] },
      { id: 'pipe-insulation', name: 'Pipe Insulation', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['pipe insulation', 'fiberglass', 'foam insulation', 'armaflex'] },
    ]
  },

  // MEP - ELECTRICAL
  {
    id: 'electrical',
    name: 'Electrical',
    csiDivision: '26',
    icon: 'Zap',
    color: '#F59E0B',
    subCategories: [
      // Conduit & Raceways
      { id: 'emt-conduit', name: 'EMT Conduit', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.06, keywords: ['EMT', 'electrical metallic tubing', 'thin wall'] },
      { id: 'rigid-conduit', name: 'Rigid/IMC Conduit', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.12, keywords: ['rigid', 'IMC', 'intermediate metal conduit', 'GRC'] },
      { id: 'pvc-conduit', name: 'PVC Conduit', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['PVC conduit', 'schedule 40', 'schedule 80', 'electrical PVC'] },
      { id: 'flex-conduit', name: 'Flexible Conduit', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.08, keywords: ['flex', 'FMC', 'LFMC', 'greenfield', 'sealtight'] },
      { id: 'mc-cable', name: 'MC Cable', defaultUnit: 'LF', wasteFactorPercent: 12, laborHoursPerUnit: 0.04, keywords: ['MC cable', 'metal clad', 'armor cable', 'BX'] },
      
      // Conduit Fittings
      { id: 'conduit-elbow', name: 'Conduit Elbow', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['conduit elbow', '90 elbow', '45 elbow', 'sweep'] },
      { id: 'conduit-coupling', name: 'Conduit Coupling', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.05, keywords: ['conduit coupling', 'set screw', 'compression coupling', 'slip coupling'] },
      { id: 'conduit-connector', name: 'Conduit Connector', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.08, keywords: ['connector', 'set screw connector', 'compression connector', 'MC connector'] },
      { id: 'conduit-body', name: 'Conduit Body', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.2, keywords: ['conduit body', 'LB', 'LL', 'LR', 'C body', 'T body'] },
      { id: 'conduit-bushing', name: 'Conduit Bushing', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.05, keywords: ['bushing', 'insulated bushing', 'grounding bushing'] },
      { id: 'locknut', name: 'Locknut', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.03, keywords: ['locknut', 'lock nut'] },
      { id: 'strut-channel', name: 'Strut Channel', defaultUnit: 'LF', wasteFactorPercent: 8, laborHoursPerUnit: 0.08, keywords: ['strut', 'unistrut', 'channel', 'superstrut'] },
      { id: 'strut-fitting', name: 'Strut Fitting', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.05, keywords: ['strut fitting', 'channel nut', 'beam clamp', 'conduit strap'] },
      
      // Wire & Cable
      { id: 'thhn-wire', name: 'THHN/THWN Wire', defaultUnit: 'LF', wasteFactorPercent: 15, laborHoursPerUnit: 0.015, keywords: ['THHN', 'THWN', 'building wire', 'stranded'] },
      { id: 'xhhw-wire', name: 'XHHW Wire', defaultUnit: 'LF', wasteFactorPercent: 15, laborHoursPerUnit: 0.02, keywords: ['XHHW', 'crosslinked'] },
      { id: 'ground-wire', name: 'Ground Wire', defaultUnit: 'LF', wasteFactorPercent: 12, laborHoursPerUnit: 0.01, keywords: ['ground', 'EGC', 'equipment ground', 'bare copper'] },
      { id: 'feeder-cable', name: 'Feeder Cable', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['feeder', 'SER', 'USE', 'large conductor'] },
      { id: 'low-voltage-cable', name: 'Low Voltage Cable', defaultUnit: 'LF', wasteFactorPercent: 12, laborHoursPerUnit: 0.02, keywords: ['cat6', 'cat5', 'data cable', 'communication', 'coax', 'fiber'] },
      
      // Boxes & Enclosures
      { id: 'device-box', name: 'Device Box', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['device box', 'switch box', '4 square', '4-11/16', 'handy box'] },
      { id: 'junction-box', name: 'Junction Box', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.25, keywords: ['junction box', 'J-box', 'pull box', '6x6', '8x8', '12x12'] },
      { id: 'floor-box', name: 'Floor Box', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.0, keywords: ['floor box', 'poke-thru', 'flush floor', 'monument'] },
      
      // Distribution Equipment
      { id: 'panelboard', name: 'Panelboard', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 12, keywords: ['panel', 'panelboard', 'load center', 'breaker panel'] },
      { id: 'switchboard', name: 'Switchboard', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 24, keywords: ['switchboard', 'MDP', 'main distribution'] },
      { id: 'transformer', name: 'Transformer', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['transformer', 'dry type', 'step down'] },
      { id: 'disconnect', name: 'Disconnect Switch', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.5, keywords: ['disconnect', 'safety switch', 'fusible', 'non-fusible'] },
      { id: 'breaker', name: 'Circuit Breaker', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.25, keywords: ['breaker', 'circuit breaker', 'AFCI', 'GFCI breaker'] },
      
      // Devices
      { id: 'receptacle-std', name: 'Standard Receptacle', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.35, keywords: ['receptacle', 'outlet', 'duplex', '15A', '20A'] },
      { id: 'receptacle-gfci', name: 'GFCI Receptacle', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.4, keywords: ['GFCI', 'GFI', 'ground fault'] },
      { id: 'receptacle-special', name: 'Special Receptacle', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.5, keywords: ['twist lock', 'L6-20', 'L14-30', 'welder', 'dryer', '30A', '50A'] },
      { id: 'switch-std', name: 'Light Switch', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['switch', 'single pole', '3-way', '4-way', 'toggle'] },
      { id: 'dimmer', name: 'Dimmer Switch', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.4, keywords: ['dimmer', 'LED dimmer', 'sliding'] },
      { id: 'occupancy-sensor', name: 'Occupancy Sensor', defaultUnit: 'EA', wasteFactorPercent: 3, laborHoursPerUnit: 0.5, keywords: ['occupancy', 'vacancy', 'motion sensor', 'PIR'] },
      
      // Lighting
      { id: 'led-troffer', name: 'LED Troffer', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.75, keywords: ['troffer', '2x2', '2x4', 'lay-in', 'recessed'] },
      { id: 'led-panel', name: 'LED Panel', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.6, keywords: ['LED panel', 'flat panel', 'edge-lit'] },
      { id: 'downlight', name: 'Downlight/Can', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['can light', 'recessed can', 'downlight', '6 inch', '4 inch'] },
      { id: 'linear-fixture', name: 'Linear Fixture', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['linear', 'strip light', 'wrap', 'continuous row'] },
      { id: 'wall-sconce', name: 'Wall Sconce', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.6, keywords: ['sconce', 'wall mount', 'wall light'] },
      { id: 'exit-sign', name: 'Exit Sign', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['exit', 'exit sign', 'combo exit', 'emergency'] },
      { id: 'emergency-light', name: 'Emergency Light', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['emergency', 'bug eye', 'battery backup', 'egress'] },
      { id: 'exterior-fixture', name: 'Exterior Fixture', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.0, keywords: ['wall pack', 'area light', 'flood', 'pole mount', 'bollard'] },
    ]
  },

  // FINISHES
  {
    id: 'drywall',
    name: 'Drywall & Framing',
    csiDivision: '09',
    icon: 'Square',
    color: '#E5E7EB',
    subCategories: [
      { id: 'metal-studs', name: 'Metal Studs', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['metal stud', 'steel stud', 'CFS', 'light gauge'] },
      { id: 'track', name: 'Track', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.01, keywords: ['track', 'runner', 'top track', 'bottom track'] },
      { id: 'gypsum-board', name: 'Gypsum Board', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['drywall', 'gypsum', 'sheetrock', 'gyp board', '5/8"'] },
      { id: 'finishing', name: 'Taping & Finishing', defaultUnit: 'SF', wasteFactorPercent: 0, laborHoursPerUnit: 0.02, keywords: ['tape', 'mud', 'finish', 'level 4', 'level 5'] },
    ]
  },
  {
    id: 'flooring',
    name: 'Flooring',
    csiDivision: '09',
    icon: 'Grid2X2',
    color: '#A3A3A3',
    subCategories: [
      { id: 'carpet', name: 'Carpet', defaultUnit: 'SY', wasteFactorPercent: 10, laborHoursPerUnit: 0.08, keywords: ['carpet', 'carpet tile', 'broadloom'] },
      { id: 'vct', name: 'VCT/Vinyl Tile', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['VCT', 'vinyl tile', 'LVT', 'luxury vinyl'] },
      { id: 'lvp', name: 'LVP/Sheet Vinyl', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['LVP', 'sheet vinyl', 'vinyl plank'] },
      { id: 'ceramic-tile', name: 'Ceramic/Porcelain Tile', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.1, keywords: ['ceramic', 'porcelain', 'tile', 'floor tile'] },
      { id: 'hardwood', name: 'Hardwood', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.08, keywords: ['hardwood', 'wood floor', 'engineered wood'] },
      { id: 'polished-concrete', name: 'Polished Concrete', defaultUnit: 'SF', wasteFactorPercent: 0, laborHoursPerUnit: 0.03, keywords: ['polished', 'sealed concrete', 'stained'] },
      { id: 'base', name: 'Wall Base', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['base', 'cove base', 'rubber base', 'wood base'] },
    ]
  },
  {
    id: 'ceiling',
    name: 'Ceilings',
    csiDivision: '09',
    icon: 'Rows3',
    color: '#F5F5F5',
    subCategories: [
      { id: 'act', name: 'Acoustic Ceiling Tile', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['ACT', 'acoustic', 'ceiling tile', 'suspended ceiling', 'drop ceiling'] },
      { id: 'grid', name: 'Ceiling Grid', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['grid', 'T-bar', 'main runner', 'cross tee'] },
      { id: 'gypsum-ceiling', name: 'Gypsum Board Ceiling', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['gypsum ceiling', 'drywall ceiling', 'hard lid'] },
    ]
  },
  {
    id: 'walls',
    name: 'Wall Finishes',
    csiDivision: '09',
    icon: 'PanelTop',
    color: '#D4D4D8',
    subCategories: [
      { id: 'paint', name: 'Paint', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.01, keywords: ['paint', 'primer', 'coat', 'latex', 'enamel'] },
      { id: 'wall-tile', name: 'Wall Tile', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.12, keywords: ['wall tile', 'backsplash', 'ceramic wall', 'subway tile'] },
      { id: 'wallcovering', name: 'Wallcovering', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['wallpaper', 'wallcovering', 'vinyl wall'] },
      { id: 'frp', name: 'FRP Panels', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['FRP', 'fiberglass panel', 'moisture resistant'] },
    ]
  },

  // SPECIALTIES
  {
    id: 'doors',
    name: 'Doors & Frames',
    csiDivision: '08',
    icon: 'DoorOpen',
    color: '#7C3AED',
    subCategories: [
      { id: 'hollow-metal', name: 'Hollow Metal Doors/Frames', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['HM door', 'hollow metal', 'metal door'] },
      { id: 'wood-doors', name: 'Wood Doors', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['wood door', 'flush door', 'panel door'] },
      { id: 'hardware', name: 'Door Hardware', defaultUnit: 'SET', wasteFactorPercent: 5, laborHoursPerUnit: 1, keywords: ['hardware', 'lockset', 'closer', 'hinges'] },
      { id: 'specialty-doors', name: 'Specialty Doors', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['overhead', 'rolling', 'fire door', 'access door'] },
    ]
  },
  {
    id: 'windows',
    name: 'Windows & Glazing',
    csiDivision: '08',
    icon: 'AppWindow',
    color: '#06B6D4',
    subCategories: [
      { id: 'aluminum-windows', name: 'Aluminum Windows', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['window', 'aluminum window', 'storefront'] },
      { id: 'curtain-wall', name: 'Curtain Wall', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['curtain wall', 'glazing system'] },
      { id: 'glass', name: 'Glass/Glazing', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['glass', 'glazing', 'insulated glass', 'tempered'] },
    ]
  },

  // SITEWORK - DIVISION 31 - EARTHWORK
  {
    id: 'earthwork',
    name: 'Earthwork',
    csiDivision: '31',
    icon: 'Mountain',
    color: '#854D0E',
    subCategories: [
      { id: 'excavation-bulk', name: 'Bulk Excavation', defaultUnit: 'CY', wasteFactorPercent: 0, laborHoursPerUnit: 0.11, keywords: ['excavation', 'dig', 'cut', 'mass excavation', 'bulk excavation'] },
      { id: 'excavation-trench', name: 'Trench Excavation', defaultUnit: 'CY', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['trench', 'utility trench', 'pipe trench'] },
      { id: 'excavation-footing', name: 'Footing Excavation', defaultUnit: 'CY', wasteFactorPercent: 0, laborHoursPerUnit: 0.2, keywords: ['footing excavation', 'foundation excavation'] },
      { id: 'excavation-rock', name: 'Rock Excavation', defaultUnit: 'CY', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['rock', 'rock excavation', 'blasting', 'rippable'] },
      { id: 'backfill-compacted', name: 'Compacted Backfill', defaultUnit: 'CY', wasteFactorPercent: 5, laborHoursPerUnit: 0.11, keywords: ['backfill', 'fill', 'compacted fill', 'compacted backfill'] },
      { id: 'backfill-structural', name: 'Structural Fill', defaultUnit: 'CY', wasteFactorPercent: 8, laborHoursPerUnit: 0.15, keywords: ['structural fill', 'engineered fill', 'tested fill'] },
      { id: 'backfill-pipe', name: 'Pipe Zone Backfill', defaultUnit: 'CY', wasteFactorPercent: 10, laborHoursPerUnit: 0.18, keywords: ['pipe bedding', 'pipe zone', 'haunching', 'pipe backfill'] },
      { id: 'import-fill', name: 'Import Fill', defaultUnit: 'CY', wasteFactorPercent: 10, laborHoursPerUnit: 0.16, keywords: ['import', 'import fill', 'borrow'] },
      { id: 'export-haul', name: 'Export/Haul', defaultUnit: 'CY', wasteFactorPercent: 0, laborHoursPerUnit: 0.16, keywords: ['export', 'haul', 'dispose', 'spoils'] },
      { id: 'grading-rough', name: 'Rough Grading', defaultUnit: 'SF', wasteFactorPercent: 0, laborHoursPerUnit: 0.006, keywords: ['rough grade', 'mass grading', 'site grading'] },
      { id: 'grading-fine', name: 'Fine Grading', defaultUnit: 'SF', wasteFactorPercent: 0, laborHoursPerUnit: 0.011, keywords: ['fine grade', 'finish grade', 'subgrade prep'] },
      { id: 'compaction', name: 'Compaction', defaultUnit: 'SF', wasteFactorPercent: 0, laborHoursPerUnit: 0.005, keywords: ['compaction', 'proctor', 'density test', 'proof roll'] },
      { id: 'aggregate-base', name: 'Aggregate Base', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.012, keywords: ['DGA', 'ABC', 'aggregate base', 'crusher run', 'road base'] },
      { id: 'geotextile', name: 'Geotextile Fabric', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.004, keywords: ['geotextile', 'geofabric', 'filter fabric', 'separation fabric'] },
      { id: 'geogrid', name: 'Geogrid', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.005, keywords: ['geogrid', 'reinforcement grid', 'soil reinforcement'] },
      { id: 'erosion-control', name: 'Erosion Control', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.014, keywords: ['silt fence', 'erosion', 'sediment', 'SWPPP', 'inlet protection'] },
      { id: 'construction-entrance', name: 'Construction Entrance', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 5.5, keywords: ['construction entrance', 'stabilized entrance', 'tracking pad'] },
    ]
  },
  
  // SITEWORK - DIVISION 32 - EXTERIOR IMPROVEMENTS
  {
    id: 'paving',
    name: 'Paving & Flatwork',
    csiDivision: '32',
    icon: 'Road',
    color: '#1C1917',
    subCategories: [
      { id: 'asphalt-2in', name: 'Asphalt Paving 2"', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.022, keywords: ['asphalt', 'AC', 'HMA', 'blacktop', '2 inch', '2"'] },
      { id: 'asphalt-4in', name: 'Asphalt Paving 4"', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.028, keywords: ['4 inch asphalt', '4"', 'heavy duty', 'parking lot'] },
      { id: 'asphalt-milling', name: 'Asphalt Milling', defaultUnit: 'SF', wasteFactorPercent: 0, laborHoursPerUnit: 0.014, keywords: ['milling', 'mill', 'remove asphalt'] },
      { id: 'concrete-sidewalk', name: 'Concrete Sidewalk', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.06, keywords: ['sidewalk', 'walkway', 'pedestrian'] },
      { id: 'concrete-driveway', name: 'Concrete Driveway', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.07, keywords: ['driveway', 'drive approach', 'apron'] },
      { id: 'curb-gutter', name: 'Curb & Gutter', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['curb', 'gutter', 'C&G', 'curb and gutter'] },
      { id: 'curb-only', name: 'Curb Only', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.14, keywords: ['header curb', 'mountable curb', 'landscape edge'] },
      { id: 'ada-ramp', name: 'ADA Ramp', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 4.8, keywords: ['ADA', 'curb ramp', 'accessible ramp', 'truncated dome', 'detectable warning'] },
      { id: 'striping', name: 'Pavement Marking', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.004, keywords: ['stripe', 'marking', 'line', 'paint', 'thermoplastic'] },
      { id: 'handicap-symbol', name: 'Handicap Symbol', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.35, keywords: ['handicap', 'accessible', 'wheelchair', 'ADA symbol'] },
      { id: 'parking-stall', name: 'Parking Stall Striping', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.1, keywords: ['parking stall', 'parking space', 'stall'] },
      { id: 'wheel-stop', name: 'Wheel Stop', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['wheel stop', 'parking bumper', 'car stop'] },
      { id: 'signage', name: 'Site Signage', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.4, keywords: ['sign', 'stop sign', 'speed limit', 'directional'] },
    ]
  },
  {
    id: 'landscape',
    name: 'Landscaping',
    csiDivision: '32',
    icon: 'Trees',
    color: '#166534',
    subCategories: [
      { id: 'topsoil', name: 'Topsoil', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.007, keywords: ['topsoil', 'planting soil', 'soil amendment'] },
      { id: 'seed', name: 'Seed & Fertilize', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.004, keywords: ['seed', 'grass seed', 'lawn', 'turf'] },
      { id: 'hydroseed', name: 'Hydroseed', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.001, keywords: ['hydroseed', 'hydroseeding', 'hydraulic seed'] },
      { id: 'sod', name: 'Sod', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.006, keywords: ['sod', 'turf', 'lawn'] },
      { id: 'mulch', name: 'Mulch', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.005, keywords: ['mulch', 'bark', 'wood chips'] },
      { id: 'tree-small', name: 'Trees 2" Cal', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 2.8, keywords: ['tree', '2 inch', '2"', 'deciduous', 'evergreen'] },
      { id: 'tree-large', name: 'Trees 4" Cal', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 6.3, keywords: ['tree', '4 inch', '4"', 'specimen', 'large tree'] },
      { id: 'shrub-small', name: 'Shrubs 1-3 Gal', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.25, keywords: ['shrub', '1 gallon', '3 gallon', 'plant'] },
      { id: 'shrub-large', name: 'Shrubs 5 Gal+', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.49, keywords: ['shrub', '5 gallon', 'large shrub'] },
      { id: 'irrigation', name: 'Irrigation System', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.009, keywords: ['irrigation', 'sprinkler', 'drip', 'watering'] },
      { id: 'edging', name: 'Landscape Edging', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.028, keywords: ['edging', 'edge', 'steel edge', 'plastic edge'] },
    ]
  },
  {
    id: 'fencing',
    name: 'Fencing & Walls',
    csiDivision: '32',
    icon: 'Fence',
    color: '#44403C',
    subCategories: [
      { id: 'chain-link', name: 'Chain Link Fence', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.14, keywords: ['chain link', 'CL fence', 'security fence'] },
      { id: 'wood-fence', name: 'Wood Fence', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.25, keywords: ['wood fence', 'privacy fence', 'board fence'] },
      { id: 'ornamental', name: 'Ornamental Fence', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.5, keywords: ['ornamental', 'aluminum fence', 'wrought iron', 'decorative'] },
      { id: 'gate', name: 'Gates', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3.5, keywords: ['gate', 'swing gate', 'slide gate'] },
      { id: 'retaining-wall', name: 'Retaining Wall', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.38, keywords: ['retaining wall', 'segmental', 'block wall', 'keystone'] },
      { id: 'bollard', name: 'Bollards', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.8, keywords: ['bollard', 'post', 'protection'] },
    ]
  },
  
  // SITEWORK - DIVISION 33 - UTILITIES
  {
    id: 'storm-drainage',
    name: 'Storm Drainage',
    csiDivision: '33',
    icon: 'Waves',
    color: '#155E75',
    subCategories: [
      { id: 'storm-pipe-12', name: 'Storm Pipe 12"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['storm pipe', '12 inch', '12"', 'RCP', 'HDPE'] },
      { id: 'storm-pipe-18', name: 'Storm Pipe 18"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.42, keywords: ['18 inch', '18"', 'storm'] },
      { id: 'storm-pipe-24', name: 'Storm Pipe 24"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.58, keywords: ['24 inch', '24"', 'storm', 'culvert'] },
      { id: 'storm-pipe-36', name: 'Storm Pipe 36"+', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 1.2, keywords: ['36 inch', '36"', '48"', 'large pipe'] },
      { id: 'catch-basin', name: 'Catch Basin', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 14, keywords: ['catch basin', 'CB', 'inlet', 'drain inlet'] },
      { id: 'curb-inlet', name: 'Curb Inlet', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 16.5, keywords: ['curb inlet', 'curb opening'] },
      { id: 'area-drain', name: 'Area Drain', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.9, keywords: ['area drain', 'yard drain', 'surface drain'] },
      { id: 'trench-drain', name: 'Trench Drain', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.9, keywords: ['trench drain', 'channel drain', 'grate'] },
      { id: 'manhole-storm', name: 'Storm Manhole', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 20, keywords: ['manhole', 'MH', 'junction', 'storm manhole'] },
      { id: 'headwall', name: 'Headwall', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 10.5, keywords: ['headwall', 'end wall', 'outlet structure'] },
      { id: 'detention', name: 'Detention/Retention', defaultUnit: 'CF', wasteFactorPercent: 5, laborHoursPerUnit: 0.35, keywords: ['detention', 'retention', 'stormwater', 'underground storage'] },
      { id: 'bio-swale', name: 'Bio-Swale', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.11, keywords: ['swale', 'bio-swale', 'vegetated swale'] },
    ]
  },
  {
    id: 'sanitary-sewer',
    name: 'Sanitary Sewer',
    csiDivision: '33',
    icon: 'Droplet',
    color: '#7C2D12',
    subCategories: [
      { id: 'sanitary-pipe-4', name: 'Sanitary Pipe 4"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['sanitary', '4 inch', '4"', 'service', 'lateral'] },
      { id: 'sanitary-pipe-6', name: 'Sanitary Pipe 6"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.38, keywords: ['6 inch', '6"', 'sanitary main'] },
      { id: 'sanitary-pipe-8', name: 'Sanitary Pipe 8"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.45, keywords: ['8 inch', '8"', 'sewer main'] },
      { id: 'cleanout', name: 'Cleanout', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3.5, keywords: ['cleanout', 'CO', 'access'] },
      { id: 'manhole-sanitary', name: 'Sanitary Manhole', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 25, keywords: ['sanitary manhole', 'sewer manhole'] },
      { id: 'grease-trap', name: 'Grease Trap', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 28, keywords: ['grease trap', 'grease interceptor', 'FOG'] },
      { id: 'lift-station', name: 'Lift Station', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 210, keywords: ['lift station', 'pump station', 'sewage pump'] },
    ]
  },
  {
    id: 'water-system',
    name: 'Water Distribution',
    csiDivision: '33',
    icon: 'Droplets',
    color: '#0369A1',
    subCategories: [
      { id: 'water-main-4', name: 'Water Main 4"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.38, keywords: ['water main', '4 inch', '4"', 'DIP'] },
      { id: 'water-main-6', name: 'Water Main 6"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.48, keywords: ['6 inch', '6"', 'water line', 'ductile iron'] },
      { id: 'water-main-8', name: 'Water Main 8"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.58, keywords: ['8 inch', '8"', 'transmission main'] },
      { id: 'water-service', name: 'Water Service', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.21, keywords: ['service line', 'water service', 'PE pipe'] },
      { id: 'fire-hydrant', name: 'Fire Hydrant', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 20, keywords: ['hydrant', 'fire hydrant', 'FH'] },
      { id: 'gate-valve', name: 'Gate Valve', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.9, keywords: ['gate valve', 'valve', 'isolation'] },
      { id: 'valve-box', name: 'Valve Box', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.0, keywords: ['valve box', 'valve can'] },
      { id: 'water-meter', name: 'Water Meter', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 7, keywords: ['meter', 'water meter'] },
      { id: 'backflow-preventer', name: 'Backflow Preventer', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.9, keywords: ['backflow', 'RPZ', 'DCVA', 'preventer'] },
      { id: 'thrust-block', name: 'Thrust Block', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.9, keywords: ['thrust block', 'reaction block', 'anchor'] },
    ]
  },
  {
    id: 'site-electrical',
    name: 'Site Electrical',
    csiDivision: '33',
    icon: 'Zap',
    color: '#B45309',
    subCategories: [
      { id: 'conduit-ug', name: 'Underground Conduit', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.09, keywords: ['underground', 'conduit', 'UG', 'direct burial'] },
      { id: 'duct-bank', name: 'Duct Bank', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.38, keywords: ['duct bank', 'electrical duct'] },
      { id: 'handhole', name: 'Handhole', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 6.3, keywords: ['handhole', 'pull box', 'junction box'] },
      { id: 'transformer-pad', name: 'Transformer Pad', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.9, keywords: ['transformer pad', 'xfmr pad'] },
      { id: 'light-pole', name: 'Light Pole', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 19, keywords: ['light pole', 'pole', 'site light', 'parking light'] },
      { id: 'light-fixture', name: 'Site Light Fixture', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.9, keywords: ['LED', 'shoebox', 'area light'] },
      { id: 'bollard-light', name: 'Bollard Light', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4.2, keywords: ['bollard light', 'pathway light'] },
    ]
  },

  // DIVISION 07 - THERMAL & MOISTURE PROTECTION
  {
    id: 'roofing',
    name: 'Roofing',
    csiDivision: '07',
    icon: 'Home',
    color: '#991B1B',
    subCategories: [
      { id: 'membrane-tpo', name: 'TPO Membrane', defaultUnit: 'SQ', wasteFactorPercent: 10, laborHoursPerUnit: 2, keywords: ['TPO', 'thermoplastic', 'white roof'] },
      { id: 'membrane-epdm', name: 'EPDM Membrane', defaultUnit: 'SQ', wasteFactorPercent: 10, laborHoursPerUnit: 2, keywords: ['EPDM', 'rubber roof', 'black membrane'] },
      { id: 'membrane-pvc', name: 'PVC Membrane', defaultUnit: 'SQ', wasteFactorPercent: 10, laborHoursPerUnit: 2.2, keywords: ['PVC', 'membrane', 'single-ply'] },
      { id: 'built-up', name: 'Built-Up Roofing', defaultUnit: 'SQ', wasteFactorPercent: 10, laborHoursPerUnit: 3, keywords: ['BUR', 'built-up', 'tar', 'gravel', 'hot mop'] },
      { id: 'modified-bitumen', name: 'Modified Bitumen', defaultUnit: 'SQ', wasteFactorPercent: 10, laborHoursPerUnit: 2.5, keywords: ['mod bit', 'modified bitumen', 'torch down', 'SBS', 'APP'] },
      { id: 'metal-roofing', name: 'Metal Roofing', defaultUnit: 'SQ', wasteFactorPercent: 10, laborHoursPerUnit: 2.5, keywords: ['metal roof', 'standing seam', 'metal panel', 'R-panel'] },
      { id: 'shingles', name: 'Asphalt Shingles', defaultUnit: 'SQ', wasteFactorPercent: 10, laborHoursPerUnit: 1.5, keywords: ['shingle', 'asphalt shingle', 'architectural shingle', '3-tab'] },
      { id: 'tile-roof', name: 'Roof Tile', defaultUnit: 'SQ', wasteFactorPercent: 12, laborHoursPerUnit: 4, keywords: ['tile roof', 'clay tile', 'concrete tile', 'barrel tile'] },
      { id: 'slate-roof', name: 'Slate Roofing', defaultUnit: 'SQ', wasteFactorPercent: 12, laborHoursPerUnit: 5, keywords: ['slate', 'natural slate', 'synthetic slate'] },
      { id: 'insulation-roof', name: 'Roof Insulation', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['roof insulation', 'polyiso', 'ISO', 'tapered', 'cover board'] },
      { id: 'flashing', name: 'Flashing & Sheet Metal', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.1, keywords: ['flashing', 'drip edge', 'counter flashing', 'cap flashing', 'parapet'] },
      { id: 'roof-drain', name: 'Roof Drains', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['roof drain', 'scupper', 'overflow', 'downspout'] },
      { id: 'skylight', name: 'Skylights', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['skylight', 'dome', 'curb mount'] },
    ]
  },
  {
    id: 'insulation',
    name: 'Thermal Insulation',
    csiDivision: '07',
    icon: 'Layers',
    color: '#FCD34D',
    subCategories: [
      { id: 'batt-r13', name: 'Batt Insulation R-13', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.01, keywords: ['R-13', 'R13', 'batt', '3.5 inch'] },
      { id: 'batt-r19', name: 'Batt Insulation R-19', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.01, keywords: ['R-19', 'R19', '6 inch', 'floor insulation'] },
      { id: 'batt-r30', name: 'Batt Insulation R-30', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.012, keywords: ['R-30', 'R30', '10 inch', 'attic insulation'] },
      { id: 'mineral-wool', name: 'Mineral Wool', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.015, keywords: ['mineral wool', 'rock wool', 'roxul', 'fire rated'] },
      { id: 'spray-foam-closed', name: 'Spray Foam Closed Cell', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.025, keywords: ['closed cell', 'SPF', '2lb foam', 'CC spray foam'] },
      { id: 'spray-foam-open', name: 'Spray Foam Open Cell', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.02, keywords: ['open cell', '0.5lb foam', 'OC spray foam'] },
      { id: 'rigid-xps', name: 'Rigid XPS', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['XPS', 'extruded polystyrene', 'styrofoam', 'blue board', 'pink board'] },
      { id: 'rigid-eps', name: 'Rigid EPS', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['EPS', 'expanded polystyrene', 'beadboard'] },
      { id: 'rigid-polyiso', name: 'Rigid Polyiso', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['polyiso', 'polyisocyanurate', 'foil faced'] },
      { id: 'blown-cellulose', name: 'Blown Cellulose', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.008, keywords: ['cellulose', 'blown-in', 'dense pack'] },
      { id: 'blown-fiberglass', name: 'Blown Fiberglass', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.008, keywords: ['blown fiberglass', 'loose fill glass'] },
    ]
  },
  {
    id: 'waterproofing',
    name: 'Waterproofing',
    csiDivision: '07',
    icon: 'Droplet',
    color: '#0F766E',
    subCategories: [
      { id: 'below-grade-membrane', name: 'Below Grade Membrane', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['below grade', 'foundation waterproofing', 'dampproofing', 'membrane'] },
      { id: 'sheet-waterproofing', name: 'Sheet Waterproofing', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['sheet membrane', 'peel and stick', 'self-adhered'] },
      { id: 'fluid-applied', name: 'Fluid Applied Waterproofing', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.03, keywords: ['fluid applied', 'spray waterproofing', 'liquid membrane'] },
      { id: 'bentonite', name: 'Bentonite Waterproofing', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['bentonite', 'clay panel', 'volclay'] },
      { id: 'cementitious', name: 'Cementitious Waterproofing', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['cementitious', 'crystalline', 'xypex', 'negative side'] },
      { id: 'drainage-board', name: 'Drainage Board', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['drainage board', 'protection board', 'dimple mat'] },
      { id: 'plaza-deck', name: 'Plaza Deck Waterproofing', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.08, keywords: ['plaza deck', 'green roof', 'traffic bearing'] },
      { id: 'traffic-coating', name: 'Traffic Coating', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.05, keywords: ['traffic coating', 'parking deck', 'epoxy urethane'] },
    ]
  },
  {
    id: 'air-vapor-barriers',
    name: 'Air & Vapor Barriers',
    csiDivision: '07',
    icon: 'Wind',
    color: '#A855F7',
    subCategories: [
      { id: 'air-barrier-membrane', name: 'Air Barrier Membrane', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['air barrier', 'weather barrier', 'WRB', 'house wrap'] },
      { id: 'air-barrier-fluid', name: 'Fluid Applied Air Barrier', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.04, keywords: ['fluid applied air barrier', 'spray air barrier', 'FAB'] },
      { id: 'vapor-retarder', name: 'Vapor Retarder', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.01, keywords: ['vapor retarder', 'vapor barrier', 'poly', 'visqueen'] },
      { id: 'flashing-tape', name: 'Flashing Tape', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.01, keywords: ['flashing tape', 'window tape', 'seam tape', 'butyl tape'] },
      { id: 'sealants', name: 'Sealants & Caulking', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['sealant', 'caulk', 'silicone', 'polyurethane', 'joint sealant'] },
      { id: 'expansion-joint', name: 'Expansion Joints', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.08, keywords: ['expansion joint', 'movement joint', 'control joint'] },
    ]
  },
  {
    id: 'fireproofing',
    name: 'Fireproofing',
    csiDivision: '07',
    icon: 'Flame',
    color: '#DC2626',
    subCategories: [
      { id: 'spray-fireproofing', name: 'Spray Applied Fireproofing', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.03, keywords: ['SFRM', 'spray fireproofing', 'cementitious fireproofing'] },
      { id: 'intumescent', name: 'Intumescent Coating', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.06, keywords: ['intumescent', 'intumescent paint', 'thin film'] },
      { id: 'firestop', name: 'Firestopping', defaultUnit: 'EA', wasteFactorPercent: 10, laborHoursPerUnit: 0.25, keywords: ['firestop', 'fire caulk', 'penetration seal', 'pillow', 'putty'] },
      { id: 'fire-safing', name: 'Fire Safing', defaultUnit: 'LF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['safing', 'perimeter fire', 'curtain wall firestop', 'mineral wool safing'] },
    ]
  },

  // DIVISION 08 - OPENINGS (Expanded)
  {
    id: 'doors-hollow-metal',
    name: 'Hollow Metal Doors & Frames',
    csiDivision: '08',
    icon: 'DoorClosed',
    color: '#6B7280',
    subCategories: [
      { id: 'hm-door-standard', name: 'HM Door Standard', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['hollow metal', 'HM door', 'steel door', '18 gauge', '16 gauge'] },
      { id: 'hm-door-fire', name: 'HM Door Fire Rated', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.5, keywords: ['fire door', 'fire rated', '90 minute', '60 minute', '20 minute'] },
      { id: 'hm-frame-standard', name: 'HM Frame Standard', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['hollow metal frame', 'steel frame', 'knock down', 'welded frame'] },
      { id: 'hm-frame-borrowed', name: 'HM Borrowed Lite Frame', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['borrowed lite', 'sidelight', 'transom frame'] },
      { id: 'hm-door-pair', name: 'HM Door Pair', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3, keywords: ['double door', 'pair', 'leaf and half'] },
    ]
  },
  {
    id: 'doors-wood',
    name: 'Wood Doors',
    csiDivision: '08',
    icon: 'DoorOpen',
    color: '#92400E',
    subCategories: [
      { id: 'wood-door-flush', name: 'Flush Wood Door', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['flush door', 'solid core', 'hollow core', 'wood veneer'] },
      { id: 'wood-door-stile-rail', name: 'Stile & Rail Door', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['stile and rail', 'panel door', 'raised panel'] },
      { id: 'wood-door-fire', name: 'Wood Door Fire Rated', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['wood fire door', 'mineral core', '20 minute wood'] },
      { id: 'wood-frame', name: 'Wood Door Frame', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1, keywords: ['wood frame', 'buck', 'jamb', 'casing'] },
      { id: 'french-door', name: 'French Doors', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2.5, keywords: ['french door', 'glass panel', 'interior glass'] },
    ]
  },
  {
    id: 'doors-specialty',
    name: 'Specialty Doors',
    csiDivision: '08',
    icon: 'ArrowUpFromLine',
    color: '#3B82F6',
    subCategories: [
      { id: 'overhead-sectional', name: 'Overhead Sectional Door', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['overhead door', 'sectional', 'garage door', 'insulated overhead'] },
      { id: 'overhead-coiling', name: 'Coiling Door', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 10, keywords: ['coiling', 'roll-up', 'rolling steel', 'service door'] },
      { id: 'fire-shutter', name: 'Fire Shutter', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 12, keywords: ['fire shutter', 'fire curtain', 'rolling fire door'] },
      { id: 'sliding-door', name: 'Sliding Door', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['sliding', 'barn door', 'pocket door'] },
      { id: 'access-door', name: 'Access Door/Panel', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['access door', 'access panel', 'ceiling access', 'wall access'] },
      { id: 'revolving-door', name: 'Revolving Door', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 24, keywords: ['revolving', 'entrance'] },
      { id: 'automatic-door', name: 'Automatic Door Operator', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['automatic', 'auto operator', 'power door', 'ADA operator'] },
    ]
  },
  {
    id: 'door-hardware',
    name: 'Door Hardware',
    csiDivision: '08',
    icon: 'KeyRound',
    color: '#71717A',
    subCategories: [
      { id: 'hardware-set-std', name: 'Hardware Set Standard', defaultUnit: 'SET', wasteFactorPercent: 5, laborHoursPerUnit: 1, keywords: ['hardware set', 'finish hardware'] },
      { id: 'lockset-lever', name: 'Lockset Lever', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['lever', 'lockset', 'passage', 'privacy', 'classroom'] },
      { id: 'lockset-mortise', name: 'Mortise Lock', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1, keywords: ['mortise', 'mortise lock', 'heavy duty'] },
      { id: 'panic-hardware', name: 'Panic Hardware', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1.5, keywords: ['panic', 'exit device', 'crash bar', 'push bar'] },
      { id: 'door-closer', name: 'Door Closer', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.75, keywords: ['closer', 'door closer', 'LCN', 'Norton'] },
      { id: 'hinges', name: 'Hinges', defaultUnit: 'SET', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['hinge', 'butt hinge', 'continuous hinge', 'pivot'] },
      { id: 'kickplate', name: 'Kick/Push/Pull Plates', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['kick plate', 'push plate', 'pull', 'protection plate'] },
      { id: 'threshold', name: 'Thresholds & Seals', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['threshold', 'saddle', 'weatherstrip', 'door bottom', 'astragal'] },
      { id: 'card-reader', name: 'Card Reader/Access Control', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['card reader', 'keypad', 'access control', 'electric strike'] },
    ]
  },
  {
    id: 'windows-aluminum',
    name: 'Aluminum Windows',
    csiDivision: '08',
    icon: 'LayoutGrid',
    color: '#64748B',
    subCategories: [
      { id: 'window-fixed', name: 'Fixed Window', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['fixed', 'picture window', 'non-operable'] },
      { id: 'window-casement', name: 'Casement Window', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.25, keywords: ['casement', 'crank out', 'awning'] },
      { id: 'window-hung', name: 'Single/Double Hung', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.22, keywords: ['single hung', 'double hung', 'vertical slider'] },
      { id: 'window-slider', name: 'Sliding Window', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['slider', 'horizontal slider', 'sliding window'] },
      { id: 'window-project', name: 'Project-Out Window', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.25, keywords: ['hopper', 'awning', 'project out'] },
    ]
  },
  {
    id: 'storefront-curtainwall',
    name: 'Storefront & Curtain Wall',
    csiDivision: '08',
    icon: 'Building2',
    color: '#06B6D4',
    subCategories: [
      { id: 'storefront-std', name: 'Storefront System', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['storefront', 'stick built', 'storefront system'] },
      { id: 'storefront-entry', name: 'Storefront Entry', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 6, keywords: ['storefront door', 'entrance', 'vestibule'] },
      { id: 'curtain-wall', name: 'Curtain Wall System', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.4, keywords: ['curtain wall', 'unitized', 'stick curtain wall'] },
      { id: 'window-wall', name: 'Window Wall System', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.35, keywords: ['window wall', 'ribbon window'] },
      { id: 'glass-entrance', name: 'All-Glass Entrance', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 12, keywords: ['all glass', 'herculite', 'patch fitting'] },
    ]
  },
  {
    id: 'glazing',
    name: 'Glazing',
    csiDivision: '08',
    icon: 'Sparkles',
    color: '#0EA5E9',
    subCategories: [
      { id: 'glass-clear', name: 'Clear Glass', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['clear glass', 'float glass', 'annealed'] },
      { id: 'glass-tempered', name: 'Tempered Glass', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.18, keywords: ['tempered', 'safety glass', 'fully tempered'] },
      { id: 'glass-laminated', name: 'Laminated Glass', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['laminated', 'safety laminated', 'PVB interlayer'] },
      { id: 'glass-insulated', name: 'Insulated Glass Unit', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.22, keywords: ['insulated', 'IGU', 'double pane', 'triple pane', 'low-e'] },
      { id: 'glass-spandrel', name: 'Spandrel Glass', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['spandrel', 'opaque', 'shadow box'] },
      { id: 'glass-fire-rated', name: 'Fire Rated Glass', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['fire rated glass', 'fire lite', 'pyran', 'ceramic'] },
      { id: 'mirror', name: 'Mirrors', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['mirror', 'silvered glass'] },
    ]
  },

  // DIVISION 09 - FINISHES (Expanded)
  {
    id: 'acoustic-ceiling',
    name: 'Acoustic Ceilings',
    csiDivision: '09',
    icon: 'Rows3',
    color: '#E5E7EB',
    subCategories: [
      { id: 'act-standard', name: 'ACT Standard', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['ACT', 'acoustic tile', 'lay-in', 'fissured'] },
      { id: 'act-tegular', name: 'ACT Tegular Edge', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['tegular', 'reveal edge', 'shadow line'] },
      { id: 'act-concealed', name: 'ACT Concealed Grid', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.05, keywords: ['concealed', 'concealed grid', 'kerfed'] },
      { id: 'grid-15/16', name: 'Grid System 15/16"', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.02, keywords: ['grid', 'T-bar', '15/16', 'exposed grid'] },
      { id: 'grid-9/16', name: 'Grid System 9/16"', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.022, keywords: ['9/16', 'narrow grid', 'slimline'] },
      { id: 'linear-metal', name: 'Linear Metal Ceiling', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.06, keywords: ['linear', 'metal ceiling', 'metal panel', 'baffle'] },
      { id: 'wood-ceiling', name: 'Wood Ceiling', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.08, keywords: ['wood ceiling', 'wood panel', 'wood slat'] },
      { id: 'specialty-ceiling', name: 'Specialty Ceiling', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.1, keywords: ['clouds', 'canopy', 'floating', 'acoustic cloud'] },
    ]
  },
  {
    id: 'specialty-flooring',
    name: 'Specialty Flooring',
    csiDivision: '09',
    icon: 'Square',
    color: '#8B5CF6',
    subCategories: [
      { id: 'epoxy-flooring', name: 'Epoxy Flooring', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.05, keywords: ['epoxy', 'resinous', 'seamless', 'broadcast'] },
      { id: 'urethane-flooring', name: 'Urethane Flooring', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.06, keywords: ['urethane', 'polyurethane', 'MMA'] },
      { id: 'rubber-flooring', name: 'Rubber Flooring', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.05, keywords: ['rubber', 'rubber tile', 'rubber sheet', 'gym floor'] },
      { id: 'terrazzo', name: 'Terrazzo', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['terrazzo', 'epoxy terrazzo', 'cementitious terrazzo'] },
      { id: 'access-flooring', name: 'Access Flooring', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.06, keywords: ['access floor', 'raised floor', 'computer floor', 'pedestal'] },
      { id: 'athletic-flooring', name: 'Athletic Flooring', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.08, keywords: ['gym', 'athletic', 'maple', 'sport floor', 'synthetic turf'] },
      { id: 'static-control', name: 'Static Control Flooring', defaultUnit: 'SF', wasteFactorPercent: 8, laborHoursPerUnit: 0.06, keywords: ['ESD', 'static dissipative', 'conductive'] },
    ]
  },
  {
    id: 'wall-protection',
    name: 'Wall Protection',
    csiDivision: '09',
    icon: 'Shield',
    color: '#10B981',
    subCategories: [
      { id: 'corner-guard', name: 'Corner Guards', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.08, keywords: ['corner guard', 'corner protection', 'stainless corner'] },
      { id: 'wall-guard', name: 'Wall Guards', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['wall guard', 'bumper rail', 'crash rail', 'handrail'] },
      { id: 'chair-rail', name: 'Chair Rail', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.06, keywords: ['chair rail', 'dado rail'] },
      { id: 'wainscot', name: 'Wainscot', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.08, keywords: ['wainscot', 'wainscoting', 'wood paneling'] },
      { id: 'impact-resistant', name: 'Impact Resistant Wall', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.04, keywords: ['impact resistant', 'abuse resistant', 'high impact'] },
      { id: 'wall-panel', name: 'Decorative Wall Panel', defaultUnit: 'SF', wasteFactorPercent: 10, laborHoursPerUnit: 0.06, keywords: ['wall panel', 'acoustic panel', 'fabric panel'] },
    ]
  },

  // DIVISION 10 - SPECIALTIES
  {
    id: 'toilet-accessories',
    name: 'Toilet Accessories',
    csiDivision: '10',
    icon: 'Bath',
    color: '#0891B2',
    subCategories: [
      { id: 'grab-bar', name: 'Grab Bars', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['grab bar', 'ADA bar', 'safety bar'] },
      { id: 'toilet-partition', name: 'Toilet Partitions', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['partition', 'toilet partition', 'stall', 'SSSP', 'SSSP-P'] },
      { id: 'urinal-screen', name: 'Urinal Screens', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.75, keywords: ['urinal screen', 'privacy screen'] },
      { id: 'mirror-accessory', name: 'Mirrors', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['mirror', 'restroom mirror', 'framed mirror'] },
      { id: 'paper-towel', name: 'Paper Towel Dispenser', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['paper towel', 'towel dispenser', 'hand dryer'] },
      { id: 'tp-dispenser', name: 'Toilet Paper Dispenser', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['toilet paper', 'TP dispenser', 'tissue dispenser'] },
      { id: 'soap-dispenser', name: 'Soap Dispenser', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['soap', 'soap dispenser', 'sanitizer'] },
      { id: 'waste-receptacle', name: 'Waste Receptacle', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['waste', 'trash', 'receptacle', 'sanitary napkin'] },
      { id: 'coat-hook', name: 'Coat Hooks/Shelf', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.15, keywords: ['hook', 'coat hook', 'shelf'] },
      { id: 'baby-station', name: 'Baby Changing Station', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1, keywords: ['baby', 'changing', 'diaper station'] },
    ]
  },
  {
    id: 'lockers',
    name: 'Lockers & Shelving',
    csiDivision: '10',
    icon: 'Lock',
    color: '#475569',
    subCategories: [
      { id: 'locker-metal', name: 'Metal Lockers', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['locker', 'metal locker', 'single tier', 'double tier'] },
      { id: 'locker-plastic', name: 'Plastic Lockers', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['plastic locker', 'HDPE locker'] },
      { id: 'locker-wood', name: 'Wood Lockers', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.75, keywords: ['wood locker', 'laminate locker'] },
      { id: 'bench', name: 'Locker Room Bench', defaultUnit: 'LF', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['bench', 'locker bench', 'changing bench'] },
      { id: 'wire-shelving', name: 'Wire Shelving', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['wire shelf', 'storage rack'] },
      { id: 'metal-shelving', name: 'Metal Shelving', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.2, keywords: ['metal shelf', 'industrial shelf'] },
    ]
  },
  {
    id: 'signage',
    name: 'Signage',
    csiDivision: '10',
    icon: 'SignpostBig',
    color: '#1D4ED8',
    subCategories: [
      { id: 'room-sign', name: 'Room Identification Signs', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['room sign', 'door sign', 'name plate', 'ADA sign'] },
      { id: 'directional-sign', name: 'Directional Signs', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['directional', 'wayfinding', 'directory'] },
      { id: 'exit-sign', name: 'Exit Signs', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['exit', 'exit sign', 'egress'] },
      { id: 'building-sign', name: 'Building Signage', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['building sign', 'exterior sign', 'monument sign'] },
      { id: 'safety-sign', name: 'Safety Signs', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.15, keywords: ['safety', 'warning', 'caution', 'hazard'] },
    ]
  },
  {
    id: 'fire-protection-equipment',
    name: 'Fire Protection Equipment',
    csiDivision: '10',
    icon: 'FireExtinguisher',
    color: '#EF4444',
    subCategories: [
      { id: 'fire-extinguisher', name: 'Fire Extinguisher', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.25, keywords: ['extinguisher', 'fire extinguisher', 'ABC', 'CO2'] },
      { id: 'fire-cabinet', name: 'Fire Extinguisher Cabinet', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['fire cabinet', 'extinguisher cabinet'] },
      { id: 'fire-blanket', name: 'Fire Blanket', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.15, keywords: ['fire blanket'] },
      { id: 'aed-cabinet', name: 'AED Cabinet', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.5, keywords: ['AED', 'defibrillator', 'emergency'] },
    ]
  },
  {
    id: 'misc-specialties',
    name: 'Miscellaneous Specialties',
    csiDivision: '10',
    icon: 'Package',
    color: '#6366F1',
    subCategories: [
      { id: 'flagpole', name: 'Flagpoles', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['flagpole', 'flag pole'] },
      { id: 'corner-post', name: 'Corner Protection Posts', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1, keywords: ['corner post', 'bollard', 'column guard'] },
      { id: 'mailbox', name: 'Mailboxes', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1, keywords: ['mailbox', 'mail slot', 'parcel locker'] },
      { id: 'canopy', name: 'Canopies & Awnings', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.1, keywords: ['canopy', 'awning', 'entrance canopy'] },
      { id: 'sun-control', name: 'Sun Control Devices', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.08, keywords: ['louver', 'sunshade', 'brise soleil', 'sun screen'] },
      { id: 'demountable', name: 'Demountable Partitions', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['demountable', 'movable partition', 'operable wall'] },
    ]
  },

  // DIVISION 21 - FIRE SUPPRESSION
  {
    id: 'fire-sprinklers',
    name: 'Fire Sprinkler Systems',
    csiDivision: '21',
    icon: 'Droplets',
    color: '#DC2626',
    subCategories: [
      { id: 'sprinkler-wet', name: 'Wet Pipe System', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.015, keywords: ['wet pipe', 'wet system', 'wet sprinkler'] },
      { id: 'sprinkler-dry', name: 'Dry Pipe System', defaultUnit: 'SF', wasteFactorPercent: 5, laborHoursPerUnit: 0.018, keywords: ['dry pipe', 'dry system', 'preaction'] },
      { id: 'sprinkler-head-pend', name: 'Pendant Sprinkler Head', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.5, keywords: ['pendant', 'sprinkler head', 'pendent'] },
      { id: 'sprinkler-head-upright', name: 'Upright Sprinkler Head', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.5, keywords: ['upright', 'upright head'] },
      { id: 'sprinkler-head-sidewall', name: 'Sidewall Sprinkler Head', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.6, keywords: ['sidewall', 'horizontal sidewall'] },
      { id: 'sprinkler-head-concealed', name: 'Concealed Sprinkler Head', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.75, keywords: ['concealed', 'recessed', 'flush'] },
      { id: 'sprinkler-pipe-1', name: 'Sprinkler Pipe 1"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.12, keywords: ['1 inch', '1"', 'branch line'] },
      { id: 'sprinkler-pipe-2', name: 'Sprinkler Pipe 2"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.15, keywords: ['2 inch', '2"', 'cross main'] },
      { id: 'sprinkler-pipe-4', name: 'Sprinkler Pipe 4"', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.22, keywords: ['4 inch', '4"', 'riser', 'main'] },
      { id: 'sprinkler-pipe-6', name: 'Sprinkler Pipe 6"+', defaultUnit: 'LF', wasteFactorPercent: 5, laborHoursPerUnit: 0.3, keywords: ['6 inch', '6"', '8"', 'underground'] },
    ]
  },
  {
    id: 'fire-pumps',
    name: 'Fire Pumps & Equipment',
    csiDivision: '21',
    icon: 'Activity',
    color: '#B91C1C',
    subCategories: [
      { id: 'fire-pump-electric', name: 'Electric Fire Pump', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 80, keywords: ['fire pump', 'electric pump', 'centrifugal'] },
      { id: 'fire-pump-diesel', name: 'Diesel Fire Pump', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 120, keywords: ['diesel pump', 'engine driven'] },
      { id: 'jockey-pump', name: 'Jockey Pump', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 16, keywords: ['jockey', 'pressure maintenance'] },
      { id: 'fire-dept-connection', name: 'Fire Department Connection', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['FDC', 'siamese', 'fire department connection'] },
      { id: 'piv', name: 'Post Indicator Valve', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 6, keywords: ['PIV', 'post indicator', 'OS&Y'] },
      { id: 'fire-hose-cabinet', name: 'Fire Hose Cabinet', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['hose cabinet', 'hose reel', 'fire hose'] },
    ]
  },
  {
    id: 'standpipes',
    name: 'Standpipes',
    csiDivision: '21',
    icon: 'ArrowUp',
    color: '#991B1B',
    subCategories: [
      { id: 'standpipe-class-i', name: 'Class I Standpipe', defaultUnit: 'FLR', wasteFactorPercent: 5, laborHoursPerUnit: 16, keywords: ['class I', 'class 1', '2-1/2 outlet'] },
      { id: 'standpipe-class-ii', name: 'Class II Standpipe', defaultUnit: 'FLR', wasteFactorPercent: 5, laborHoursPerUnit: 12, keywords: ['class II', 'class 2', '1-1/2 hose'] },
      { id: 'standpipe-class-iii', name: 'Class III Standpipe', defaultUnit: 'FLR', wasteFactorPercent: 5, laborHoursPerUnit: 20, keywords: ['class III', 'class 3', 'combination'] },
      { id: 'hose-valve', name: 'Hose Valve', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['hose valve', 'hose connection', '2-1/2'] },
      { id: 'roof-manifold', name: 'Roof Manifold', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['roof manifold', 'test header'] },
    ]
  },

  // DIVISION 28 - ELECTRONIC SAFETY & SECURITY
  {
    id: 'fire-alarm',
    name: 'Fire Alarm Systems',
    csiDivision: '28',
    icon: 'Bell',
    color: '#F97316',
    subCategories: [
      { id: 'facp', name: 'Fire Alarm Control Panel', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 24, keywords: ['FACP', 'fire alarm panel', 'control panel', 'NAC panel'] },
      { id: 'smoke-detector', name: 'Smoke Detector', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.75, keywords: ['smoke detector', 'photoelectric', 'ionization'] },
      { id: 'heat-detector', name: 'Heat Detector', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.75, keywords: ['heat detector', 'rate of rise', 'fixed temp'] },
      { id: 'duct-detector', name: 'Duct Smoke Detector', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['duct detector', 'duct smoke', 'air sampling'] },
      { id: 'pull-station', name: 'Manual Pull Station', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.75, keywords: ['pull station', 'manual station', 'fire pull'] },
      { id: 'horn-strobe', name: 'Horn/Strobe', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.75, keywords: ['horn strobe', 'notification appliance', 'NAC device', 'AV'] },
      { id: 'speaker-strobe', name: 'Speaker/Strobe', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 1, keywords: ['speaker strobe', 'voice', 'EVAC'] },
      { id: 'beam-detector', name: 'Beam Detector', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['beam', 'projected beam', 'linear'] },
      { id: 'monitor-module', name: 'Monitor Module', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.5, keywords: ['monitor module', 'input module', 'zone module'] },
      { id: 'relay-module', name: 'Relay Module', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.5, keywords: ['relay module', 'control module', 'output module'] },
      { id: 'annunciator', name: 'Remote Annunciator', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['annunciator', 'graphic annunciator', 'remote display'] },
    ]
  },
  {
    id: 'security-access',
    name: 'Security & Access Control',
    csiDivision: '28',
    icon: 'Lock',
    color: '#4F46E5',
    subCategories: [
      { id: 'access-panel', name: 'Access Control Panel', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['access panel', 'access controller', 'door controller'] },
      { id: 'card-reader-prox', name: 'Proximity Card Reader', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['card reader', 'proximity', 'prox reader'] },
      { id: 'card-reader-bio', name: 'Biometric Reader', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3, keywords: ['biometric', 'fingerprint', 'facial recognition'] },
      { id: 'door-contact', name: 'Door Contact', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.5, keywords: ['door contact', 'magnetic contact', 'reed switch'] },
      { id: 'motion-sensor', name: 'Motion Sensor', defaultUnit: 'EA', wasteFactorPercent: 5, laborHoursPerUnit: 0.75, keywords: ['motion', 'PIR', 'motion detector', 'occupancy'] },
      { id: 'electric-strike', name: 'Electric Strike', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['electric strike', 'door strike'] },
      { id: 'mag-lock', name: 'Magnetic Lock', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['mag lock', 'magnetic lock', 'EM lock'] },
      { id: 'rex', name: 'Request to Exit', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 0.75, keywords: ['REX', 'request to exit', 'push button'] },
    ]
  },
  {
    id: 'cctv',
    name: 'Video Surveillance',
    csiDivision: '28',
    icon: 'Video',
    color: '#7C3AED',
    subCategories: [
      { id: 'camera-fixed', name: 'Fixed Camera', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 2, keywords: ['fixed camera', 'bullet camera', 'dome camera'] },
      { id: 'camera-ptz', name: 'PTZ Camera', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 4, keywords: ['PTZ', 'pan tilt zoom'] },
      { id: 'nvr', name: 'Network Video Recorder', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 8, keywords: ['NVR', 'DVR', 'video recorder'] },
      { id: 'monitor', name: 'Surveillance Monitor', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 1, keywords: ['monitor', 'display', 'video wall'] },
      { id: 'video-intercom', name: 'Video Intercom', defaultUnit: 'EA', wasteFactorPercent: 0, laborHoursPerUnit: 3, keywords: ['intercom', 'video intercom', 'entry phone'] },
    ]
  },
];

/**
 * Get category by ID
 */
export function getCategoryById(id: string): TakeoffCategory | undefined {
  return TAKEOFF_CATEGORIES.find(c => c.id === id);
}

/**
 * Get all category IDs as a flat list
 */
export function getAllCategoryIds(): string[] {
  return TAKEOFF_CATEGORIES.map(c => c.id);
}

/**
 * Match item name to best category based on keywords
 */
export function matchItemToCategory(itemName: string): { categoryId: string; subCategoryId: string; confidence: number } | null {
  const normalizedName = itemName.toLowerCase();
  let bestMatch: { categoryId: string; subCategoryId: string; confidence: number } | null = null;
  let highestScore = 0;

  for (const category of TAKEOFF_CATEGORIES) {
    for (const subCategory of category.subCategories) {
      let score = 0;
      let matchCount = 0;

      for (const keyword of subCategory.keywords) {
        if (normalizedName.includes(keyword.toLowerCase())) {
          score += keyword.length; // Longer keywords = more specific match
          matchCount++;
        }
      }

      if (matchCount > 0 && score > highestScore) {
        highestScore = score;
        bestMatch = {
          categoryId: category.id,
          subCategoryId: subCategory.id,
          confidence: Math.min(100, 50 + (matchCount * 15)),
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Get waste factor for a category/subcategory
 */
export function getWasteFactor(categoryId: string, subCategoryId?: string): number {
  const category = getCategoryById(categoryId);
  if (!category) return 10; // Default 10% waste

  if (subCategoryId) {
    const subCategory = category.subCategories.find(s => s.id === subCategoryId);
    if (subCategory) return subCategory.wasteFactorPercent;
  }

  // Return average waste factor for category
  const totalWaste = category.subCategories.reduce((sum, s) => sum + s.wasteFactorPercent, 0);
  return Math.round(totalWaste / category.subCategories.length);
}

/**
 * Get labor hours per unit for a category/subcategory
 */
export function getLaborHoursPerUnit(categoryId: string, subCategoryId?: string): number {
  const category = getCategoryById(categoryId);
  if (!category) return 0.1; // Default

  if (subCategoryId) {
    const subCategory = category.subCategories.find(s => s.id === subCategoryId);
    if (subCategory) return subCategory.laborHoursPerUnit;
  }

  // Return average labor hours for category
  const totalHours = category.subCategories.reduce((sum, s) => sum + s.laborHoursPerUnit, 0);
  return totalHours / category.subCategories.length;
}

/**
 * Get the comprehensive extraction prompt for all categories
 */
export function getComprehensiveExtractionPrompt(): string {
  const categoryList = TAKEOFF_CATEGORIES.map(cat => {
    const items = cat.subCategories.map(sub => `    - ${sub.name} (${sub.defaultUnit}): ${sub.keywords.slice(0, 3).join(', ')}`).join('\n');
    return `### ${cat.name} (CSI ${cat.csiDivision})\n${items}`;
  }).join('\n\n');

  return `## COMPREHENSIVE MATERIAL CATEGORIES TO EXTRACT:\n\n${categoryList}`;
}
