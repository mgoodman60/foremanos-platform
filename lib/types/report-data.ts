/**
 * Shared TypeScript types for daily report data structures
 *
 * These types represent the JSON fields stored in the Conversation model
 * and are used across multiple files for type safety.
 */

/** Work entry by trade in daily report */
export interface WorkByTradeEntry {
  trade: string;
  company?: string;
  description?: string;
  location?: string;
  crewSize?: number;
}

/** Crew entry in daily report */
export interface CrewEntry {
  trade?: string;
  company?: string;
  count: number;
}

/** Report data stored in conversation.reportData JSON field */
export interface ReportData {
  workByTrade?: WorkByTradeEntry[];
  crew?: CrewEntry[];
  notes?: string;
  visitors?: string[];
  delays?: string[];
  safetyIncidents?: string[] | number;  // Array of descriptions or count
  crewSize?: number;
  foreman?: string;
  crewForeman?: string;
  hoursWorked?: number;
  percentComplete?: number;
  daysAheadBehind?: number;
  scheduleStatus?: string;
  equipmentIssues?: string;
  qualityIssues?: number;
  inspections?: string;
  additionalNotes?: string;
  nextDayPlan?: string;
  tomorrowsPlan?: string;
  [key: string]: unknown;
}

/** Photo data stored in conversation.photos JSON field */
export interface PhotoEntry {
  id: string;
  cloud_storage_path: string;
  isPublic?: boolean;
  caption?: string;
  location?: string;
  aiDescription?: string;
  aiConfidence?: number;
  timestamp?: string;
}

/** Weather snapshot data stored in conversation.weatherSnapshots JSON field */
export interface WeatherSnapshot {
  time: string;
  temperature?: number;
  condition?: string;   // Used in template-processor.ts
  conditions?: string;  // Used in report-finalization.ts
  humidity?: number;
  windSpeed?: number;
  precipitation?: string | number;
}

/** Material delivery entry */
export interface MaterialDelivery {
  sub?: string;
  material: string;
  quantity?: number;
  unit?: string;
}

/** Equipment data entry */
export interface EquipmentEntry {
  name: string;
  type?: string;
  hours?: number;
  status?: 'active' | 'idle' | 'broken';
}

/** Schedule update entry */
export interface ScheduleUpdateEntry {
  activity: string;
  plannedStatus?: string;
  actualStatus?: string;
  percentComplete?: number;
}

/** Quantity calculation entry */
export interface QuantityCalculation {
  type: string;
  description?: string;
  location?: string;
  actualQuantity?: number;
  unit?: string;
}

/**
 * OneDrive file item from Microsoft Graph API
 */
export interface OneDriveItem {
  id: string;
  name: string;
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  parentReference?: {
    id: string;
    path: string;
  };
}

/**
 * OneDrive API response for list operations
 */
export interface OneDriveListResponse {
  value: OneDriveItem[];
  '@odata.nextLink'?: string;
}
