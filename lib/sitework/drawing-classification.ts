/**
 * Drawing type classification for sitework plans
 */

export type DrawingType =
  | 'grading' | 'utility' | 'landscape' | 'paving'
  | 'erosion_control' | 'stormwater' | 'civil_general' | 'unknown';

export function classifyDrawingType(sheetNumber: string, content: string): DrawingType {
  const sheet = sheetNumber?.toUpperCase() || '';
  const text = content?.toLowerCase() || '';

  if (/^(GR|GRAD)/.test(sheet) || text.includes('grading plan')) return 'grading';
  if (/^(UT|UTIL)/.test(sheet) || text.includes('utility plan') || text.includes('storm plan') || text.includes('sewer plan')) return 'utility';
  if (/^(L|LA|LP)[-\d]/.test(sheet) || text.includes('landscape plan') || text.includes('planting plan')) return 'landscape';
  if (/^(PV|PAV)/.test(sheet) || text.includes('paving plan') || text.includes('parking plan')) return 'paving';
  if (text.includes('detention') || text.includes('retention') || text.includes('stormwater')) return 'stormwater';
  if (/^(EC|ESCP)/.test(sheet) || text.includes('erosion') || text.includes('sediment')) return 'erosion_control';
  if (/^SW/.test(sheet)) return 'stormwater';
  if (/^C[-\d]/.test(sheet)) return 'civil_general';
  return 'unknown';
}
