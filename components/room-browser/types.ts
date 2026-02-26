export interface FinishItem {
  id: string;
  category: string;
  finishType?: string;
  material?: string;
  manufacturer?: string;
  modelNumber?: string;
  color?: string;
  dimensions?: string;
  notes?: string;
  csiCode?: string;
}

export interface MEPEquipmentItem {
  id: string;
  tag: string;
  name: string;
  trade: 'electrical' | 'hvac' | 'plumbing' | 'fire_alarm';
  quantity?: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
}

export interface Room {
  id: string;
  name: string;
  roomNumber?: string;
  type: string;
  floorNumber?: number;
  area?: number;
  gridLocation?: string;
  sheetId?: string;
  status: string;
  percentComplete: number;
  notes?: string;
  tradeType?: string;
  assignedTo?: string;
  floorPlanId?: string;
  hotspotX?: number;
  hotspotY?: number;
  hotspotWidth?: number;
  hotspotHeight?: number;
  FinishScheduleItem?: FinishItem[];
  mepEquipment?: MEPEquipmentItem[];
  doorType?: string | null;
}

export interface RoomSummary {
  totalRooms: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  averageProgress: number;
  byType: Record<string, number>;
}

export interface RoomBrowserProps {
  projectSlug: string;
  onClose?: () => void;
  onRoomSelect?: (room: Room) => void;
}
