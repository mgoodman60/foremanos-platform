// Shape types (string union, not enum -- extensible without migration)
export type MarkupShapeType =
  | 'line'
  | 'arrow'
  | 'polyline'
  | 'polygon'
  | 'cloud'
  | 'rectangle'
  | 'ellipse'
  | 'arc'
  | 'freehand'
  | 'highlighter'
  | 'text_box'
  | 'callout'
  | 'typewriter'
  | 'sticky_note'
  | 'stamp'
  | 'count_marker'
  | 'distance_measurement'
  | 'area_measurement'
  | 'perimeter_measurement'
  | 'angle_measurement'
  | 'diameter_measurement'
  | 'volume_measurement'
  | 'highlight'
  | 'strikethrough'
  | 'underline';

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash_dot';

export type ArrowheadStyle = 'none' | 'open' | 'closed' | 'diamond' | 'circle';

export type AnnotationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type AnnotationPriority = 'low' | 'medium' | 'high' | 'critical';

// Geometry -- stored in PDF user space (72 units/inch, bottom-left origin)
export interface MarkupGeometry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  points?: number[];
  leaderPoints?: number[];
  symbolId?: string;
  tension?: number;
  arrowStart?: ArrowheadStyle;
  arrowEnd?: ArrowheadStyle;
}

export interface MarkupStyle {
  color: string;
  strokeWidth: number;
  fillColor?: string;
  fillOpacity?: number;
  opacity: number;
  lineStyle: LineStyle;
  dashPattern?: number[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  hatchPattern?: string;
}

export interface MarkupRecord {
  id: string;
  documentId: string;
  projectId: string;
  pageNumber: number;
  sheetNumber?: string;
  shapeType: MarkupShapeType;
  geometry: MarkupGeometry;
  style: MarkupStyle;
  content?: string;
  label?: string;
  status: AnnotationStatus;
  priority: AnnotationPriority;
  tags: string[];
  layerId?: string;
  measurementValue?: number;
  measurementUnit?: string;
  calibrationId?: string;
  symbolId?: string;
  createdBy: string;
  lockedBy?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MarkupLayerRecord {
  id: string;
  documentId: string;
  projectId: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  sortOrder: number;
  scope: 'document' | 'project' | 'user';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarkupCalibrationRecord {
  id: string;
  documentId: string;
  projectId: string;
  pageNumber: number;
  point1X: number;
  point1Y: number;
  point2X: number;
  point2Y: number;
  realDistance: number;
  realUnit: string;
  pdfUnitsPerRealUnit: number;
  confidence: number;
  createdBy: string;
  createdAt: string;
}

export interface MarkupReplyRecord {
  id: string;
  markupId: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarkupRequest {
  pageNumber: number;
  shapeType: MarkupShapeType;
  geometry: MarkupGeometry;
  style: MarkupStyle;
  content?: string;
  label?: string;
  layerId?: string;
  measurementValue?: number;
  measurementUnit?: string;
  calibrationId?: string;
  symbolId?: string;
}

export interface UpdateMarkupRequest {
  geometry?: MarkupGeometry;
  style?: MarkupStyle;
  content?: string;
  label?: string;
  status?: AnnotationStatus;
  priority?: AnnotationPriority;
  tags?: string[];
  layerId?: string;
  measurementValue?: number;
  measurementUnit?: string;
  lockedBy?: string | null;
  expectedUpdatedAt?: string;
}

export interface BulkCreateMarkupRequest {
  markups: CreateMarkupRequest[];
}
