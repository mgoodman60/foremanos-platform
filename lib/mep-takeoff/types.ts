/**
 * MEP Takeoff Generator - Type Definitions
 */

export interface MEPExtractionResult {
  success: boolean;
  electrical: MEPItem[];
  plumbing: MEPItem[];
  hvac: MEPItem[];
  fire_protection: MEPItem[];
  totalCost: number;
  itemsCreated: number;
  errors: string[];
}

export interface MEPItem {
  itemKey: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  source: string;
  confidence: number;
}
