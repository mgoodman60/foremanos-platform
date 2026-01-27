/**
 * Utility functions for formatting takeoff data
 */

/**
 * Formats a currency amount to a string
 * 
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  })}`;
}

/**
 * Formats a quantity with its unit
 * 
 * @param quantity - The quantity value
 * @param unit - The unit of measurement
 * @returns Formatted quantity string
 */
export function formatQuantity(quantity: number, unit: string): string {
  return `${quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
}

/**
 * Formats a CSI division number and name
 * 
 * @param divisionNumber - The CSI division number
 * @param divisionName - The CSI division name
 * @returns Formatted division string
 */
export function formatCSIDivision(divisionNumber: number, divisionName: string): string {
  return `${String(divisionNumber).padStart(2, '0')} - ${divisionName}`;
}

/**
 * Formats data for CSV export
 * 
 * @param items - Array of takeoff line items
 * @returns Array of export rows
 */
export interface ExportRow {
  category: string;
  itemName: string;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  totalCost: string;
  location: string;
  verified: string;
}

export function formatForExport(items: Array<{ 
  category: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  verified: boolean;
}>): ExportRow[] {
  return items.map((item) => ({
    category: item.category || '',
    itemName: item.itemName || '',
    description: item.description || '',
    quantity: item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    unit: item.unit || '',
    unitCost: item.unitCost ? formatCurrency(item.unitCost) : '',
    totalCost: item.totalCost ? formatCurrency(item.totalCost) : '',
    location: item.location || '',
    verified: item.verified ? 'Yes' : 'No',
  }));
}

/**
 * Gets confidence color class based on confidence value
 * Confidence can be 0-1 or 0-100 scale
 * 
 * @param confidence - Confidence value (0-1 or 0-100)
 * @returns Tailwind CSS color class
 */
export function getConfidenceColor(confidence: number | undefined): string {
  if (confidence === undefined) return 'text-gray-500';
  
  // Normalize: if > 1, it's already 0-100 scale
  const normalized = confidence > 1 ? confidence : confidence * 100;
  
  if (normalized >= 80) return 'text-green-500';
  if (normalized >= 60) return 'text-yellow-500';
  if (normalized >= 40) return 'text-orange-500';
  return 'text-red-500';
}
