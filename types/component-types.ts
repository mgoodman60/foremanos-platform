/**
 * Shared type definitions for React components.
 * Used to improve type safety across UI components.
 */

// ============================================
// Weather & Schedule Types
// ============================================

export interface WeatherAlert {
  type: string;
  severity: 'advisory' | 'watch' | 'warning';
  message: string;
  expires?: string;
}

export interface WeatherData {
  temperature: number;
  conditions: string;
  description?: string;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  alerts?: WeatherAlert[];
}

export interface ScheduleTask {
  id: string;
  taskId?: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  percentComplete: number;
  isCritical?: boolean;
  location?: string;
}

export interface ScheduleContext {
  todayTasks?: string[];
  upcomingMilestones?: string[];
  criticalPathTasks?: ScheduleTask[];
}

// ============================================
// Takeoff & Budget Types
// ============================================

export interface TakeoffItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  materialCost: number;
  laborCost: number;
  totalCost?: number;
  confidence?: number;
  sourceDocument?: string;
  sourcePageNumber?: number;
}

export interface CategoryVarianceData {
  takeoffEstimate: number;
  budgetedAmount: number;
  variance: number;
  variancePercent: number;
  itemCount: number;
}

export interface VarianceReport {
  totalTakeoffEstimate: number;
  totalBudgetedAmount: number;
  variance: number;
  variancePercent: number;
  categoryVariance: Record<string, CategoryVarianceData>;
  generatedAt: string;
}

export interface BudgetItem {
  id: string;
  name: string;
  phaseName?: string;
  tradeType?: string;
  budgetedAmount: number;
  actualCost: number;
  committedCost?: number;
  variance?: number;
}

// ============================================
// Room & Space Types
// ============================================

export interface Room {
  id: string;
  name: string;
  number?: string;
  floor?: string;
  building?: string;
  type?: string;
  area?: number;
  areaUnit?: string;
  finishes?: RoomFinish[];
}

export interface RoomFinish {
  id: string;
  finishType: string;
  material?: string;
  manufacturer?: string;
  model?: string;
  color?: string;
  notes?: string;
}

// ============================================
// Sheet & Drawing Types
// ============================================

export interface SheetStats {
  totalSheets: number;
  byDiscipline: Record<string, number>;
  byStatus: Record<string, number>;
  lastUpdated?: string;
}

export interface SheetIndexEntry {
  id: string;
  sheetNumber: string;
  sheetName: string;
  discipline: string;
  revision?: string;
  revisionDate?: string;
  scale?: string;
  status?: string;
}

// ============================================
// Workflow Types
// ============================================

export type WorkflowStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'completed';

export interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStatus;
  assignee?: string;
  completedAt?: string;
  notes?: string;
}

export interface WorkflowData {
  id: string;
  name: string;
  type: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Document Types
// ============================================

export interface DocumentMetadata {
  id: string;
  name: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  processed: boolean;
  pagesProcessed?: number;
  category?: string;
  discipline?: string;
  uploadedAt: string;
}

// ============================================
// Submittal Types
// ============================================

export interface SubmittalLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  manufacturer?: string;
  model?: string;
  status: string;
}

export interface Submittal {
  id: string;
  number: string;
  title: string;
  status: string;
  specSection?: string;
  submittedDate?: string;
  requiredDate?: string;
  lineItems: SubmittalLineItem[];
}

// ============================================
// Daily Report Types
// ============================================

export interface LaborEntry {
  id: string;
  tradeName: string;
  workerCount: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
}

export interface EquipmentEntry {
  id: string;
  equipmentName: string;
  equipmentType?: string;
  hours: number;
  totalCost: number;
}

export interface DailyReportSummary {
  id: string;
  reportDate: string;
  status: string;
  weatherCondition?: string;
  temperatureHigh?: number;
  temperatureLow?: number;
  laborEntries: LaborEntry[];
  equipmentEntries: EquipmentEntry[];
  totalLaborCost: number;
  totalEquipmentCost: number;
}
