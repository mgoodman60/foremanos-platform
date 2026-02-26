import { chartColors, semanticColors, primaryColors } from '@/lib/design-tokens';

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'border-green-500 bg-green-500/30';
    case 'in_progress':
      return 'border-blue-500 bg-blue-500/30';
    default:
      return 'border-gray-400 bg-gray-400/20';
  }
}

export function getStatusHoverColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'border-green-400 bg-green-500/50';
    case 'in_progress':
      return 'border-blue-400 bg-blue-500/50';
    default:
      return 'border-orange-400 bg-orange-500/40';
  }
}

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    office: 'bg-blue-500/40 border-blue-500',
    conference: 'bg-purple-500/40 border-purple-500',
    restroom: 'bg-cyan-500/40 border-cyan-500',
    corridor: 'bg-gray-500/40 border-gray-500',
    lobby: 'bg-amber-500/40 border-amber-500',
    storage: 'bg-orange-500/40 border-orange-500',
    mechanical: 'bg-red-500/40 border-red-500',
    electrical: 'bg-yellow-500/40 border-yellow-500',
    multipurpose: 'bg-green-500/40 border-green-500',
    exam_room: 'bg-teal-500/40 border-teal-500',
    waiting: 'bg-indigo-500/40 border-indigo-500',
    reception: 'bg-pink-500/40 border-pink-500',
  };
  return colors[type.toLowerCase()] || 'bg-gray-500/30 border-gray-500';
}

export function getLayerColor(layerName: string, index: number): string {
  const lowerName = layerName.toLowerCase();

  if (lowerName.includes('sv') || lowerName.includes('survey') || lowerName.includes('pnt')) {
    return chartColors.positive;
  }
  if (lowerName.includes('grading') || lowerName.includes('grade') || lowerName.includes('elev')) {
    return chartColors.warning;
  }
  if (
    lowerName.includes('util') ||
    lowerName.includes('storm') ||
    lowerName.includes('water') ||
    lowerName.includes('sewer')
  ) {
    return chartColors.neutral;
  }
  if (
    lowerName.includes('pav') ||
    lowerName.includes('curb') ||
    lowerName.includes('road') ||
    lowerName.includes('drive')
  ) {
    return chartColors.palette[4];
  }
  if (lowerName.includes('land') || lowerName.includes('tree') || lowerName.includes('plant')) {
    return semanticColors.success[500];
  }
  if (lowerName.includes('bldg') || lowerName.includes('build') || lowerName.includes('struct')) {
    return chartColors.palette[5];
  }
  if (lowerName.includes('elec') || lowerName.includes('light')) {
    return semanticColors.warning[400];
  }

  const fallbackColors = [
    chartColors.palette[6],
    chartColors.palette[7],
    primaryColors.orange[500],
    chartColors.negative,
    chartColors.palette[4],
    chartColors.trades.plumbing,
  ];
  return fallbackColors[index % fallbackColors.length];
}
