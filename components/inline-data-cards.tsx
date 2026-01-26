'use client';

import { useState } from 'react';
import { 
  Home, 
  Package, 
  Zap, 
  ExternalLink,
  MapPin,
  DollarSign,
  Ruler,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RoomCardProps {
  roomId: string;
  onView?: (roomId: string) => void;
}

export function RoomCard({ roomId, onView }: RoomCardProps) {
  const [roomData, setRoomData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // In a real implementation, fetch room data
  // For now, we'll show a placeholder

  return (
    <Card className="inline-flex items-center gap-2 p-2 bg-green-500/10 border-green-500/30 my-1 mx-1">
      <div className="p-1.5 rounded bg-green-500/20">
        <Home className="h-4 w-4 text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-green-300">Room {roomId.substring(0, 8)}</div>
      </div>
      {onView && (
        <Button
          onClick={() => onView(roomId)}
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-green-400 hover:bg-green-500/20"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      )}
    </Card>
  );
}

interface MaterialCardProps {
  materialId: string;
  onView?: (materialId: string) => void;
}

export function MaterialCard({ materialId, onView }: MaterialCardProps) {
  return (
    <Card className="inline-flex items-center gap-2 p-2 bg-purple-500/10 border-purple-500/30 my-1 mx-1">
      <div className="p-1.5 rounded bg-purple-500/20">
        <Package className="h-4 w-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-purple-300">Material {materialId.substring(0, 8)}</div>
      </div>
      {onView && (
        <Button
          onClick={() => onView(materialId)}
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-purple-400 hover:bg-purple-500/20"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      )}
    </Card>
  );
}

interface MEPCardProps {
  callout: string;
  onView?: (callout: string) => void;
}

export function MEPCard({ callout, onView }: MEPCardProps) {
  // Determine trade color
  const upper = callout.toUpperCase();
  let color = 'orange';
  if (upper.includes('AHU') || upper.includes('RTU') || upper.includes('VAV')) {
    color = 'blue';
  } else if (upper.includes('PANEL') || upper.includes('MDP')) {
    color = 'yellow';
  } else if (upper.includes('LAV') || upper.includes('WC')) {
    color = 'cyan';
  } else if (upper.includes('FACP') || upper.includes('SD')) {
    color = 'red';
  }

  const colorClasses = {
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    red: 'bg-red-500/10 border-red-500/30 text-red-300'
  };

  const iconColorClasses = {
    orange: 'bg-orange-500/20 text-orange-400',
    blue: 'bg-blue-500/20 text-blue-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    red: 'bg-red-500/20 text-red-400'
  };

  const buttonColorClasses = {
    orange: 'text-orange-400 hover:bg-orange-500/20',
    blue: 'text-blue-400 hover:bg-blue-500/20',
    yellow: 'text-yellow-400 hover:bg-yellow-500/20',
    cyan: 'text-cyan-400 hover:bg-cyan-500/20',
    red: 'text-red-400 hover:bg-red-500/20'
  };

  return (
    <Card className={`inline-flex items-center gap-2 p-2 my-1 mx-1 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className={`p-1.5 rounded ${iconColorClasses[color as keyof typeof iconColorClasses]}`}>
        <Zap className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium">{callout}</div>
      </div>
      {onView && (
        <Button
          onClick={() => onView(callout)}
          size="sm"
          variant="ghost"
          className={`h-6 px-2 ${buttonColorClasses[color as keyof typeof buttonColorClasses]}`}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      )}
    </Card>
  );
}

interface ShowOnPlanButtonProps {
  documentId: string;
  pageNumber: number;
  onView?: (documentId: string, pageNumber: number) => void;
}

export function ShowOnPlanButton({ documentId, pageNumber, onView }: ShowOnPlanButtonProps) {
  return (
    <Button
      onClick={() => onView?.(documentId, pageNumber)}
      size="sm"
      className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white my-1 mx-1"
    >
      <MapPin className="h-3.5 w-3.5" />
      <span className="text-xs">Show on Plan (Page {pageNumber})</span>
    </Button>
  );
}

interface NavigationSuggestionProps {
  type: 'room' | 'material' | 'mep' | 'plan' | 'navigator';
  label: string;
  onNavigate?: (type: string) => void;
}

export function NavigationSuggestion({ type, label, onNavigate }: NavigationSuggestionProps) {
  const icons = {
    room: <Home className="h-4 w-4" />,
    material: <Package className="h-4 w-4" />,
    mep: <Zap className="h-4 w-4" />,
    plan: <MapPin className="h-4 w-4" />,
    navigator: <ExternalLink className="h-4 w-4" />
  };

  const colors = {
    room: 'bg-green-500 hover:bg-green-600',
    material: 'bg-purple-500 hover:bg-purple-600',
    mep: 'bg-orange-500 hover:bg-orange-600',
    plan: 'bg-blue-500 hover:bg-blue-600',
    navigator: 'bg-cyan-500 hover:bg-cyan-600'
  };

  return (
    <Button
      onClick={() => onNavigate?.(type)}
      size="sm"
      className={`inline-flex items-center gap-2 ${colors[type]} text-white my-1 mr-2`}
    >
      {icons[type]}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
