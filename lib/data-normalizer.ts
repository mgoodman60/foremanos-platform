/**
 * Data Normalizer — 8-pass normalization for extracted construction data
 *
 * Order: N5->N7->N8->N1->N4->N2->N3->N6
 * N5: Schema compliance (canonical field names)
 * N7: Date normalization (ISO 8601)
 * N8: Deduplication (remove duplicate entries)
 * N1: Unit standardization (consistent measurement format)
 * N4: Field backfill (infer missing fields from context)
 * N2: Counter reconciliation (array lengths match counts)
 * N3: Cross-ref linking (resolve internal references)
 * N6: Computed totals (recalculate derived values)
 */
import type { ExtractedData } from './vision-api-quality';

export interface NormalizationResult {
  normalizedData: ExtractedData;
  changesApplied: string[];
  fieldsFixed: number;
}

export function normalizeExtractedData(
  data: ExtractedData,
  discipline: string,
): NormalizationResult {
  const changes: string[] = [];
  let fieldsFixed = 0;
  // Deep clone to avoid mutating input
  let d = JSON.parse(JSON.stringify(data)) as ExtractedData;

  // N5: Schema compliance
  const n5 = normalizeSchemaCompliance(d);
  d = n5.data; changes.push(...n5.changes); fieldsFixed += n5.fixes;

  // N7: Date normalization
  const n7 = normalizeDates(d);
  d = n7.data; changes.push(...n7.changes); fieldsFixed += n7.fixes;

  // N8: Deduplication
  const n8 = deduplicateArrays(d);
  d = n8.data; changes.push(...n8.changes); fieldsFixed += n8.fixes;

  // N1: Unit standardization
  const n1 = normalizeUnits(d);
  d = n1.data; changes.push(...n1.changes); fieldsFixed += n1.fixes;

  // N4: Field backfill
  const n4 = backfillFields(d, discipline);
  d = n4.data; changes.push(...n4.changes); fieldsFixed += n4.fixes;

  // N2: Counter reconciliation
  const n2 = reconcileCounters(d);
  d = n2.data; changes.push(...n2.changes); fieldsFixed += n2.fixes;

  // N3: Cross-ref linking
  const n3 = linkCrossReferences(d);
  d = n3.data; changes.push(...n3.changes); fieldsFixed += n3.fixes;

  // N6: Computed totals
  const n6 = recomputeTotals(d);
  d = n6.data; changes.push(...n6.changes); fieldsFixed += n6.fixes;

  return { normalizedData: d, changesApplied: changes, fieldsFixed };
}

interface PassResult { data: ExtractedData; changes: string[]; fixes: number; }

// N5: Schema compliance — ensure canonical field names
function normalizeSchemaCompliance(d: ExtractedData): PassResult {
  const changes: string[] = [];
  let fixes = 0;

  // Common field name aliases -> canonical
  const aliases: Record<string, string> = {
    'grid_lines': 'gridLines',
    'gridlines': 'gridLines',
    'sheet_number': 'sheetNumber',
    'sheet_title': 'sheetTitle',
    'drawing_type': 'drawingType',
    'room_count': 'roomsCount',
    'door_schedule': 'doors',
    'window_schedule': 'windows',
    'plumbing_fixtures': 'plumbingFixtures',
    'electrical_devices': 'electricalDevices',
    'hvac_data': 'hvacData',
    'fire_protection': 'fireProtection',
    'symbol_data': 'symbolData',
    'spatial_data': 'spatialData',
    'visual_materials': 'visualMaterials',
    'construction_intel': 'constructionIntel',
  };

  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias in d && !(canonical in d)) {
      (d as Record<string, unknown>)[canonical] = (d as Record<string, unknown>)[alias];
      delete (d as Record<string, unknown>)[alias];
      changes.push(`N5: Renamed ${alias} -> ${canonical}`);
      fixes++;
    }
  }

  return { data: d, changes, fixes };
}

// N7: Date normalization — ISO 8601
function normalizeDates(d: ExtractedData): PassResult {
  const changes: string[] = [];
  let fixes = 0;

  const dateFields = ['date', 'revisionDate', 'drawingDate', 'issueDate'];
  for (const field of dateFields) {
    const val = (d as Record<string, unknown>)[field];
    if (typeof val === 'string' && val.trim() !== '' && val !== 'N/A') {
      const normalized = normalizeDate(val);
      if (normalized && normalized !== val) {
        (d as Record<string, unknown>)[field] = normalized;
        changes.push(`N7: Normalized ${field}: ${val} -> ${normalized}`);
        fixes++;
      }
    }
  }

  // Also check titleBlock dates
  if (d.titleBlock && typeof d.titleBlock === 'object') {
    const tb = d.titleBlock as Record<string, unknown>;
    for (const field of ['date', 'revisionDate']) {
      if (typeof tb[field] === 'string' && tb[field] !== 'N/A') {
        const normalized = normalizeDate(tb[field] as string);
        if (normalized && normalized !== tb[field]) {
          tb[field] = normalized;
          changes.push(`N7: Normalized titleBlock.${field}`);
          fixes++;
        }
      }
    }
  }

  return { data: d, changes, fixes };
}

function normalizeDate(input: string): string | null {
  // Try common date formats
  const patterns = [
    // M/D/YY or M/D/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
    // M-D-YY or M-D-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,
    // Already ISO
    /^\d{4}-\d{2}-\d{2}$/,
  ];

  if (patterns[2].test(input)) return input; // Already ISO

  for (const pattern of [patterns[0], patterns[1]]) {
    const match = input.match(pattern);
    if (match) {
      const month = match[1].padStart(2, '0');
      const day = match[2].padStart(2, '0');
      let year = match[3];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

// N8: Deduplication
function deduplicateArrays(d: ExtractedData): PassResult {
  const changes: string[] = [];
  let fixes = 0;

  const arrayFields = ['rooms', 'doors', 'windows', 'dimensions', 'equipment',
    'plumbingFixtures', 'electricalDevices', 'gridLines', 'symbolData'];

  for (const field of arrayFields) {
    const arr = (d as Record<string, unknown>)[field];
    if (Array.isArray(arr) && arr.length > 1) {
      const seen = new Set<string>();
      const deduped = arr.filter(item => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (deduped.length < arr.length) {
        (d as Record<string, unknown>)[field] = deduped;
        const removed = arr.length - deduped.length;
        changes.push(`N8: Removed ${removed} duplicate(s) from ${field}`);
        fixes += removed;
      }
    }
  }

  return { data: d, changes, fixes };
}

// N1: Unit standardization
function normalizeUnits(d: ExtractedData): PassResult {
  const changes: string[] = [];
  let fixes = 0;

  // Standardize dimension values
  const dims = (d as Record<string, unknown>).dimensions;
  if (Array.isArray(dims)) {
    for (const dim of dims) {
      if (dim && typeof dim === 'object' && 'value' in dim && typeof dim.value === 'string') {
        const original = dim.value;
        const normalized = normalizeMeasurement(dim.value);
        if (normalized !== original) {
          dim.value = normalized;
          changes.push(`N1: Normalized dimension: ${original} -> ${normalized}`);
          fixes++;
        }
      }
    }
  }

  // Standardize scale
  if (typeof d.scale === 'string') {
    const normalizedScale = normalizeMeasurement(d.scale);
    if (normalizedScale !== d.scale) {
      changes.push(`N1: Normalized scale: ${d.scale} -> ${normalizedScale}`);
      d.scale = normalizedScale;
      fixes++;
    }
  }

  return { data: d, changes, fixes };
}

function normalizeMeasurement(value: string): string {
  // Convert "12ft 6in" -> "12'-6\""
  let result = value
    .replace(/(\d+)\s*ft\s*/gi, "$1'-")
    .replace(/(\d+)\s*in\b/gi, '$1"')
    .replace(/(\d+)\s*feet\s*/gi, "$1'-")
    .replace(/(\d+)\s*inch(?:es)?\b/gi, '$1"');

  // Clean up "12'-6"" -> "12'-6\""
  result = result.replace(/'-(\d+)"/, "'-$1\"");

  return result;
}

// N4: Field backfill — infer missing fields from context
function backfillFields(d: ExtractedData, discipline: string): PassResult {
  const changes: string[] = [];
  let fixes = 0;

  // Infer discipline from sheet number
  if (!d.discipline || d.discipline === 'Unknown' || d.discipline === 'N/A') {
    if (d.sheetNumber) {
      const prefix = d.sheetNumber.charAt(0).toUpperCase();
      const disciplineMap: Record<string, string> = {
        'A': 'Architectural', 'S': 'Structural', 'M': 'Mechanical',
        'E': 'Electrical', 'P': 'Plumbing', 'FP': 'Fire Protection',
        'C': 'Civil', 'L': 'Landscape', 'T': 'Telecommunications',
      };
      // Check two-char prefix first
      const twoChar = d.sheetNumber.substring(0, 2).toUpperCase();
      const inferred = disciplineMap[twoChar] || disciplineMap[prefix];
      if (inferred) {
        d.discipline = inferred;
        changes.push(`N4: Inferred discipline from sheet ${d.sheetNumber}: ${inferred}`);
        fixes++;
      }
    }
    // Fall back to passed discipline
    if ((!d.discipline || d.discipline === 'Unknown') && discipline !== 'Unknown') {
      d.discipline = discipline;
      changes.push(`N4: Set discipline from classification: ${discipline}`);
      fixes++;
    }
  }

  return { data: d, changes, fixes };
}

// N2: Counter reconciliation
function reconcileCounters(d: ExtractedData): PassResult {
  const changes: string[] = [];
  let fixes = 0;

  const counterMap: Record<string, string> = {
    'roomsCount': 'rooms',
    'doorsCount': 'doors',
    'windowsCount': 'windows',
    'fixturesCount': 'plumbingFixtures',
    'dimensionCount': 'dimensions',
  };

  for (const [countField, arrayField] of Object.entries(counterMap)) {
    const arr = (d as Record<string, unknown>)[arrayField];
    const count = (d as Record<string, unknown>)[countField];
    if (Array.isArray(arr) && typeof count === 'number' && count !== arr.length) {
      (d as Record<string, unknown>)[countField] = arr.length;
      changes.push(`N2: Fixed ${countField}: ${count} -> ${arr.length}`);
      fixes++;
    }
  }

  return { data: d, changes, fixes };
}

// N3: Cross-ref linking
function linkCrossReferences(d: ExtractedData): PassResult {
  // Lightweight: just ensure room references in fixtures match rooms array
  const changes: string[] = [];
  const fixes = 0;

  // Placeholder — cross-reference linking is more relevant after Phase C
  return { data: d, changes, fixes };
}

// N6: Computed totals
function recomputeTotals(d: ExtractedData): PassResult {
  const changes: string[] = [];
  let fixes = 0;

  // Recompute total area from room areas
  const rooms = (d as Record<string, unknown>).rooms;
  if (Array.isArray(rooms) && rooms.length > 0) {
    let totalArea = 0;
    let hasAreas = false;
    for (const room of rooms) {
      if (room && typeof room === 'object' && 'area' in room) {
        const area = parseFloat(String(room.area));
        if (!isNaN(area)) {
          totalArea += area;
          hasAreas = true;
        }
      }
    }
    if (hasAreas) {
      const existing = (d as Record<string, unknown>).totalArea;
      if (typeof existing === 'number' && Math.abs(existing - totalArea) > 1) {
        (d as Record<string, unknown>).totalArea = totalArea;
        changes.push(`N6: Recomputed totalArea: ${existing} -> ${totalArea}`);
        fixes++;
      } else if (existing === undefined || existing === null) {
        (d as Record<string, unknown>).totalArea = totalArea;
        changes.push(`N6: Computed totalArea: ${totalArea}`);
        fixes++;
      }
    }
  }

  return { data: d, changes, fixes };
}
