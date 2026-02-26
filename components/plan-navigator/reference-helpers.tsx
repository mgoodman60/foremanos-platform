'use client';

import { FileText, Target, Layers, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function getReferenceTypeIcon(type: string) {
  switch (type) {
    case 'sheet_reference':
      return <FileText className="h-4 w-4 text-blue-400" />;
    case 'detail_callout':
      return <Target className="h-4 w-4 text-orange-400" />;
    case 'spec_reference':
      return <Layers className="h-4 w-4 text-purple-400" />;
    default:
      return <Link2 className="h-4 w-4 text-gray-400" />;
  }
}

export function getReferenceTypeBadge(type: string) {
  const variants: Record<string, { color: string; label: string }> = {
    sheet_reference: { color: 'bg-blue-500/20 text-blue-400 border-blue-700', label: 'Sheet Ref' },
    detail_callout: { color: 'bg-orange-500/20 text-orange-400 border-orange-700', label: 'Detail' },
    spec_reference: { color: 'bg-purple-500/20 text-purple-400 border-purple-700', label: 'Spec' },
  };

  const variant = variants[type] || { color: 'bg-gray-500/20 text-gray-400 border-gray-700', label: 'Reference' };
  return (
    <Badge variant="outline" className={`text-xs ${variant.color}`}>
      {variant.label}
    </Badge>
  );
}
