/**
 * Discipline Colors
 * Centralized discipline-to-color/icon mapping used across
 * document detail page, library badges, and filter components.
 */

export const DISCIPLINE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'Architectural': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: '#8B5CF6' },
  'Structural': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: '#10B981' },
  'Mechanical': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: '#3B82F6' },
  'Electrical': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: '#F59E0B' },
  'Plumbing': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: '#06B6D4' },
  'Civil': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: '#F97316' },
  'Fire Protection': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: '#EF4444' },
  'General': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', dot: '#6B7280' },
  'Landscape': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: '#059669' },
};

export const DRAWING_TYPE_LABELS: Record<string, string> = {
  'floor_plan': 'Floor Plan',
  'elevation': 'Elevation',
  'section': 'Section',
  'detail': 'Detail',
  'schedule': 'Schedule',
  'specification': 'Specification',
  'cover': 'Cover Sheet',
  'site_plan': 'Site Plan',
  'reflected_ceiling': 'Reflected Ceiling',
  'roof_plan': 'Roof Plan',
  'life_safety': 'Life Safety',
  'unknown': 'Unknown',
};

export const CONFIDENCE_LEVELS = {
  high: { min: 0.8, color: 'text-green-600', bg: 'bg-green-100', dot: '#16A34A', label: 'High' },
  medium: { min: 0.6, color: 'text-yellow-600', bg: 'bg-yellow-100', dot: '#CA8A04', label: 'Medium' },
  low: { min: 0, color: 'text-red-600', bg: 'bg-red-100', dot: '#DC2626', label: 'Low' },
} as const;

export function getConfidenceLevel(confidence: number | null): typeof CONFIDENCE_LEVELS[keyof typeof CONFIDENCE_LEVELS] {
  if (confidence === null || confidence === undefined) return CONFIDENCE_LEVELS.low;
  if (confidence >= CONFIDENCE_LEVELS.high.min) return CONFIDENCE_LEVELS.high;
  if (confidence >= CONFIDENCE_LEVELS.medium.min) return CONFIDENCE_LEVELS.medium;
  return CONFIDENCE_LEVELS.low;
}

export function getDisciplineColor(discipline: string): typeof DISCIPLINE_COLORS[string] {
  return DISCIPLINE_COLORS[discipline] || DISCIPLINE_COLORS['General'];
}

export function getDrawingTypeLabel(type: string): string {
  return DRAWING_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
