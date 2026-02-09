/**
 * Sitework pattern definitions for CSI Divisions 31 (Earthwork), 32 (Exterior), 33 (Utilities)
 */

export interface SiteworkPattern {
  pattern: RegExp;
  category: 'earthwork' | 'paving' | 'utilities' | 'landscape' | 'stormwater';
  division: 31 | 32 | 33;
  itemKey: string;
  unitExtractor?: (match: RegExpMatchArray) => { quantity: number; unit: string };
  description?: string;
}

export const EARTHWORK_PATTERNS: SiteworkPattern[] = [
  {
    pattern: /(?:cut|excavat(?:e|ion))\s*[:\-]?\s*([\d,]+\.?\d*)\s*(CY|cy|cubic\s*(?:yards?|yds?))/i,
    category: 'earthwork', division: 31, itemKey: 'excavation-bulk',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'CY' }),
    description: 'Bulk excavation/cut volume'
  },
  {
    pattern: /(?:fill|import)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(CY|cy|cubic\s*(?:yards?|yds?))/i,
    category: 'earthwork', division: 31, itemKey: 'import-fill',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'CY' }),
    description: 'Fill/import volume'
  },
  {
    pattern: /(\d{2,3})%\s*(?:proctor|compaction|std\.?\s*proctor|mod(?:ified)?\s*proctor)/i,
    category: 'earthwork', division: 31, itemKey: 'compaction', description: 'Compaction requirement'
  },
  {
    pattern: /compacted?\s*to\s*(\d{2,3})%/i,
    category: 'earthwork', division: 31, itemKey: 'compaction', description: 'Compaction specification'
  },
  {
    pattern: /(?:soil\s*)?type\s*([ABC])(?:\s*soil)?/i,
    category: 'earthwork', division: 31, itemKey: 'excavation-bulk', description: 'OSHA soil classification'
  },
  {
    pattern: /(?:cohesive|granular|rock|clay|sandy?|silt)\s*(?:soil|material)/i,
    category: 'earthwork', division: 31, itemKey: 'excavation-bulk', description: 'Soil type identification'
  },
  {
    pattern: /excavat(?:e|ion)\s*(?:to\s*)?(?:depth\s*(?:of\s*)?)?(\d+\.?\d*)['"]?(?:\s*(?:ft|feet|deep))?/i,
    category: 'earthwork', division: 31, itemKey: 'excavation-bulk',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1]), unit: 'FT' }),
    description: 'Excavation depth'
  },
  {
    pattern: /subgrade\s*(?:prep(?:aration)?)?\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY|sf|sy)/i,
    category: 'earthwork', division: 31, itemKey: 'grading-fine',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: m[2].toUpperCase() })
  },
  {
    pattern: /(\d+)["']?\s*(?:DGA|ABC|aggregate\s*base|crushed?\s*stone|crusher\s*run)/i,
    category: 'earthwork', division: 31, itemKey: 'aggregate-base-6in', description: 'Aggregate base course'
  },
  {
    pattern: /(?:geo(?:textile|fabric|grid))\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY|sf|sy)/i,
    category: 'earthwork', division: 31, itemKey: 'geotextile',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'SF' })
  },
  {
    pattern: /silt\s*fence\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf|linear\s*(?:feet|ft))/i,
    category: 'earthwork', division: 31, itemKey: 'silt-fence',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
];

export const PAVING_PATTERNS: SiteworkPattern[] = [
  {
    pattern: /(\d+\.?\d*)["']?\s*(?:thick)?\s*(?:asphalt|AC|HMA|bit(?:uminous)?)/i,
    category: 'paving', division: 32, itemKey: 'asphalt-paving-4in', description: 'Asphalt pavement thickness'
  },
  {
    pattern: /asphalt\s*(?:paving)?\s*[:\-]?\s*([\d,]+\.?\d*)\s*(SF|SY|sf|sy)/i,
    category: 'paving', division: 32, itemKey: 'asphalt-paving-4in',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: m[2].toUpperCase() })
  },
  {
    pattern: /(\d+)["']?\s*(?:thick)?\s*(?:concrete|conc\.?|PCC)\s*(?:paving|sidewalk|driveway)?/i,
    category: 'paving', division: 32, itemKey: 'concrete-sidewalk-4in', description: 'Concrete pavement thickness'
  },
  {
    pattern: /(\d+)["']?\s*(?:white|yellow)\s*(?:stripe?|line|marking)/i,
    category: 'paving', division: 32, itemKey: 'pavement-marking-4in', description: 'Pavement marking width'
  },
  {
    pattern: /(?:striping|marking)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf)/i,
    category: 'paving', division: 32, itemKey: 'pavement-marking',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
  {
    pattern: /(?:handicap|ADA|accessible)\s*(?:symbol|sign|space|parking)/i,
    category: 'paving', division: 32, itemKey: 'handicap-symbol', description: 'ADA marking'
  },
  {
    pattern: /(?:truncated\s*dome|detectable\s*warning)/i,
    category: 'paving', division: 32, itemKey: 'detectable-warning-surface', description: 'ADA detectable warning'
  },
  {
    pattern: /(?:ADA|curb)\s*ramp\s*[:\-]?\s*(\d+)\s*(?:EA|ea)?/i,
    category: 'paving', division: 32, itemKey: 'ada-ramp',
    unitExtractor: (m) => ({ quantity: parseInt(m[1]), unit: 'EA' })
  },
  {
    pattern: /(?:curb\s*(?:and|&)?\s*gutter|C&G)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf)/i,
    category: 'paving', division: 32, itemKey: 'concrete-curb-gutter',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
];

export const UTILITY_PATTERNS: SiteworkPattern[] = [
  {
    pattern: /(\d+)["']?\s*(?:DIA\.?|Ø|diameter)?\s*(PVC|RCP|HDPE|DIP|CIP|VCP|ABS|CPVC)\s*(?:@|at)?\s*([\d.]+)%?/i,
    category: 'utilities', division: 33, itemKey: 'sanitary-pipe-8', description: 'Pipe with slope specification'
  },
  {
    pattern: /(\d+)["']?\s*(PVC|RCP|HDPE|DIP|CIP|VCP)\s*(?:pipe|storm|sanitary|sewer)?/i,
    category: 'utilities', division: 33, itemKey: 'storm-pipe-12', description: 'Pipe diameter and material'
  },
  {
    pattern: /(?:storm|sanitary|sewer)\s*(?:pipe|line)\s*[:\-]?\s*([\d,]+\.?\d*)\s*(LF|lf)/i,
    category: 'utilities', division: 33, itemKey: 'storm-pipe-12',
    unitExtractor: (m) => ({ quantity: parseFloat(m[1].replace(/,/g, '')), unit: 'LF' })
  },
  {
    pattern: /(?:MH|manhole)\s*(?:#|no\.?)?\s*(\d+)\s*(?:rim|ie|inv(?:ert)?)?\s*(?:elev(?:ation)?)?\s*[=:]?\s*([\d.]+)/i,
    category: 'utilities', division: 33, itemKey: 'manhole-sanitary', description: 'Manhole with invert elevation'
  },
  {
    pattern: /(?:rim|top)\s*(?:elev(?:ation)?)?\s*[=:]?\s*([\d.]+)\s*(?:ie|inv(?:ert)?)?\s*[=:]?\s*([\d.]+)/i,
    category: 'utilities', division: 33, itemKey: 'manhole-sanitary', description: 'Rim and invert elevations'
  },
  {
    pattern: /(?:CB|catch\s*basin)\s*(?:type\s*)?([A-Z0-9]+)/i,
    category: 'utilities', division: 33, itemKey: 'catch-basin', description: 'Catch basin type'
  },
  {
    pattern: /(?:curb\s*inlet|CB|catch\s*basin)\s*[:\-]?\s*(\d+)\s*(?:EA|ea)?/i,
    category: 'utilities', division: 33, itemKey: 'catch-basin',
    unitExtractor: (m) => ({ quantity: parseInt(m[1]), unit: 'EA' })
  },
  {
    pattern: /(?:fire\s*)?hydrant\s*[:\-]?\s*(\d+)\s*(?:EA|ea)?/i,
    category: 'utilities', division: 33, itemKey: 'fire-hydrant',
    unitExtractor: (m) => ({ quantity: parseInt(m[1]), unit: 'EA' })
  },
  {
    pattern: /(\d+)["']?\s*(?:water\s*(?:main|line)|WM|DIP)/i,
    category: 'utilities', division: 33, itemKey: 'water-main-6', description: 'Water main diameter'
  },
];

export const ALL_SITEWORK_PATTERNS: SiteworkPattern[] = [
  ...EARTHWORK_PATTERNS,
  ...PAVING_PATTERNS,
  ...UTILITY_PATTERNS,
];
