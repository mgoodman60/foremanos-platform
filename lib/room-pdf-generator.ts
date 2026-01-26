// Room Sheet PDF Generator
// Client-side PDF generation for room data sheets
// Enhanced with branding, QR codes, and revision tracking

// Helper function to clean item names (remove underscores and clean up formatting)
function cleanItemName(name: string | undefined | null): string {
  if (!name) return '-';
  return name
    .replace(/_/g, ' ')           // Replace underscores with spaces
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .trim();
}

import jsPDF from 'jspdf';

export interface RoomSheetData {
  project: {
    name: string;
    slug: string;
    address?: string;
    clientName?: string;
  };
  room: {
    id: string;
    name: string;
    roomNumber?: string;
    type: string;
    floorNumber?: number;
    area?: number;
    gridLocation?: string;
    status: string;
    percentComplete: number;
    notes?: string;
    tradeType?: string;
    assignedTo?: string;
    // Enhancement: Photo support
    photos?: Array<{
      url: string;
      caption?: string;
      takenAt?: string;
    }>;
    // Enhancement: Punch list items
    punchItems?: Array<{
      id: string;
      description: string;
      status: 'open' | 'in_progress' | 'resolved';
      priority: 'low' | 'medium' | 'high';
      assignedTo?: string;
    }>;
  };
  finishSchedule: {
    categories: string[];
    items: Record<string, any[]>;
    totalItems: number;
  };
  mepEquipment: {
    systems: string[];
    items: Record<string, any[]>;
    totalItems: number;
  };
  takeoffItems: {
    categories: string[];
    items: Record<string, any[]>;
    totalItems: number;
    totalCost: number;
    // Enhancement: Cost breakdown
    laborCost?: number;
    materialCost?: number;
  };
  // Enhancement: Revision tracking
  revision?: {
    number: number;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
  };
  exportedAt: string;
  // Enhancement: App URL for QR code
  appUrl?: string;
}

export async function generateRoomSheetPDF(data: RoomSheetData): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'letter');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Colors
  const orange = [249, 115, 22];
  const darkGray = [31, 35, 40];
  const mediumGray = [100, 100, 100];
  const lightGray = [200, 200, 200];

  // Helper functions
  const addHeader = () => {
    // Header background
    pdf.setFillColor(...orange as [number, number, number]);
    pdf.rect(0, 0, pageWidth, 30, 'F');

    // ForemanOS branding
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('FOREMANOS', pageWidth - margin - 25, 8);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Field Operations Intelligence', pageWidth - margin - 25, 12);

    // Project name
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(data.project.name, margin, 12);

    // Room info
    pdf.setFontSize(12);
    const roomTitle = `${data.room.roomNumber ? data.room.roomNumber + ' - ' : ''}${data.room.name}`;
    pdf.text(roomTitle, margin, 20);

    // Project details (if available)
    if (data.project.address || data.project.clientName) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const subtext = [data.project.clientName, data.project.address].filter(Boolean).join(' | ');
      pdf.text(subtext, margin, 26);
    }

    // Export date & revision
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    const date = new Date(data.exportedAt).toLocaleDateString();
    const time = new Date(data.exportedAt).toLocaleTimeString();
    pdf.text(`Exported: ${date} ${time}`, pageWidth - margin - 35, 20);
    
    if (data.revision) {
      pdf.text(`Rev ${data.revision.number}`, pageWidth - margin - 35, 25);
    }

    y = 38;
  };

  const addSectionTitle = (title: string, icon?: string) => {
    if (y > pageHeight - 40) {
      pdf.addPage();
      y = margin;
    }

    pdf.setFillColor(...darkGray as [number, number, number]);
    pdf.rect(margin, y, contentWidth, 8, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin + 3, y + 5.5);
    y += 12;
  };

  const addKeyValue = (key: string, value: string | number | undefined, width: number = contentWidth / 2) => {
    if (value === undefined || value === null || value === '') return;
    
    pdf.setTextColor(...mediumGray as [number, number, number]);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${key}:`, margin, y);
    
    pdf.setTextColor(...darkGray as [number, number, number]);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(value), margin + 25, y);
    return true;
  };

  const addTableRow = (cells: string[], isHeader: boolean = false) => {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = margin;
    }

    const cellWidth = contentWidth / cells.length;
    const rowHeight = 6;

    if (isHeader) {
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y - 1, contentWidth, rowHeight + 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...darkGray as [number, number, number]);
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...mediumGray as [number, number, number]);
    }

    pdf.setFontSize(7);
    cells.forEach((cell, i) => {
      const x = margin + (i * cellWidth);
      const text = String(cell || '-').substring(0, 30);
      pdf.text(text, x + 2, y + 3);
    });

    y += rowHeight;
  };

  // Generate PDF
  addHeader();

  // Room Details Section
  addSectionTitle('ROOM DETAILS');
  
  const details = [
    ['Type', data.room.type],
    ['Floor', data.room.floorNumber !== undefined ? `Floor ${data.room.floorNumber}` : undefined],
    ['Area', data.room.area ? `${data.room.area.toLocaleString()} SF` : undefined],
    ['Grid Location', data.room.gridLocation],
    ['Status', data.room.status],
    ['Progress', `${data.room.percentComplete}%`],
    ['Trade', data.room.tradeType],
    ['Assigned To', data.room.assignedTo],
  ].filter(([_, v]) => v !== undefined);

  // Two-column layout for details
  const halfWidth = contentWidth / 2;
  for (let i = 0; i < details.length; i += 2) {
    const left = details[i];
    const right = details[i + 1];
    
    pdf.setTextColor(...mediumGray as [number, number, number]);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${left[0]}:`, margin, y);
    pdf.setTextColor(...darkGray as [number, number, number]);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(left[1]), margin + 25, y);

    if (right) {
      pdf.setTextColor(...mediumGray as [number, number, number]);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${right[0]}:`, margin + halfWidth, y);
      pdf.setTextColor(...darkGray as [number, number, number]);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(right[1]), margin + halfWidth + 25, y);
    }
    y += 5;
  }

  if (data.room.notes) {
    y += 3;
    pdf.setTextColor(...mediumGray as [number, number, number]);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Notes:', margin, y);
    y += 4;
    pdf.setTextColor(...darkGray as [number, number, number]);
    const noteLines = pdf.splitTextToSize(data.room.notes, contentWidth);
    pdf.text(noteLines, margin, y);
    y += noteLines.length * 4;
  }

  y += 5;

  // Finish Schedule Section
  if (data.finishSchedule.totalItems > 0) {
    addSectionTitle(`FINISH SCHEDULE (${data.finishSchedule.totalItems} items)`);

    for (const category of data.finishSchedule.categories) {
      const items = data.finishSchedule.items[category] || [];
      if (items.length === 0) continue;

      // Category header
      pdf.setTextColor(...orange as [number, number, number]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${category} (${items.length})`, margin, y);
      y += 5;

      // Table header
      addTableRow(['Finish Type', 'Material', 'Manufacturer', 'Model/Color'], true);

      // Items
      items.forEach((item: any) => {
        addTableRow([
          cleanItemName(item.finishType),
          cleanItemName(item.material),
          cleanItemName(item.manufacturer),
          `${cleanItemName(item.modelNumber)} ${cleanItemName(item.color)}`.trim() || '-'
        ]);
      });

      y += 3;
    }
  }

  // MEP Equipment Section
  if (data.mepEquipment.totalItems > 0) {
    addSectionTitle(`MEP EQUIPMENT (${data.mepEquipment.totalItems} items)`);

    for (const system of data.mepEquipment.systems) {
      const items = data.mepEquipment.items[system] || [];
      if (items.length === 0) continue;

      // System header
      pdf.setTextColor(...orange as [number, number, number]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${system.toUpperCase()} (${items.length})`, margin, y);
      y += 5;

      // Table header
      addTableRow(['Equipment', 'Model', 'Specs', 'Notes'], true);

      // Items
      items.forEach((item: any) => {
        addTableRow([
          cleanItemName(item.name || item.equipmentTag),
          cleanItemName(item.modelNumber),
          cleanItemName(item.specifications),
          cleanItemName(item.notes)
        ]);
      });

      y += 3;
    }
  }

  // Material Takeoff Section
  if (data.takeoffItems.totalItems > 0) {
    addSectionTitle(`MATERIAL TAKEOFF (${data.takeoffItems.totalItems} items)`);

    for (const category of data.takeoffItems.categories) {
      const items = data.takeoffItems.items[category] || [];
      if (items.length === 0) continue;

      // Category header
      pdf.setTextColor(...orange as [number, number, number]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${category} (${items.length})`, margin, y);
      y += 5;

      // Table header (without cost columns)
      addTableRow(['Item', 'Qty', 'Unit', 'Description'], true);

      // Items (without cost data)
      items.forEach((item: any) => {
        addTableRow([
          cleanItemName(item.itemName || item.description),
          String(item.quantity || 0),
          item.unit || '-',
          cleanItemName(item.notes || item.specification) || '-'
        ]);
      });

      y += 3;
    }
  }

  // Cost Summary Section removed per user request - costs should not be shown on room sheets

  // Punch List Section (Enhancement)
  if (data.room.punchItems && data.room.punchItems.length > 0) {
    const openItems = data.room.punchItems.filter(p => p.status !== 'resolved');
    
    if (openItems.length > 0) {
      addSectionTitle(`OPEN PUNCH ITEMS (${openItems.length})`);

      addTableRow(['Description', 'Priority', 'Status', 'Assigned'], true);

      openItems.forEach((item) => {
        addTableRow([
          item.description.substring(0, 40),
          item.priority.toUpperCase(),
          item.status.replace('_', ' ').toUpperCase(),
          item.assignedTo || '-'
        ]);
      });

      y += 5;
    }
  }

  // QR Code placeholder (text-based for now)
  if (data.appUrl) {
    if (y > pageHeight - 30) {
      pdf.addPage();
      y = margin;
    }

    pdf.setFillColor(250, 250, 250);
    pdf.rect(pageWidth - margin - 25, y, 25, 25, 'F');
    pdf.setDrawColor(...lightGray as [number, number, number]);
    pdf.rect(pageWidth - margin - 25, y, 25, 25, 'S');
    
    pdf.setTextColor(...mediumGray as [number, number, number]);
    pdf.setFontSize(5);
    pdf.text('Scan for', pageWidth - margin - 20, y + 8);
    pdf.text('digital record', pageWidth - margin - 22, y + 12);
    pdf.setFontSize(4);
    pdf.text('[QR CODE]', pageWidth - margin - 18, y + 18);
  }

  // Enhanced Footer with revision tracking
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    // Footer line
    pdf.setDrawColor(...lightGray as [number, number, number]);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Left: Page number
    pdf.setTextColor(...mediumGray as [number, number, number]);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Page ${i} of ${totalPages}`, margin, pageHeight - 8);

    // Center: Branding
    pdf.setTextColor(...lightGray as [number, number, number]);
    pdf.setFontSize(8);
    pdf.text('ForemanOS Room Sheet', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Right: Revision info
    if (data.revision?.lastModifiedAt || data.revision?.lastModifiedBy) {
      pdf.setTextColor(...mediumGray as [number, number, number]);
      pdf.setFontSize(6);
      const revInfo = [];
      if (data.revision.lastModifiedBy) revInfo.push(`Modified by: ${data.revision.lastModifiedBy}`);
      if (data.revision.lastModifiedAt) {
        const modDate = new Date(data.revision.lastModifiedAt).toLocaleDateString();
        revInfo.push(modDate);
      }
      pdf.text(revInfo.join(' | '), pageWidth - margin, pageHeight - 8, { align: 'right' });
    }
  }

  return pdf.output('blob');
}

// Batch export helper for multiple rooms
export interface BatchExportOptions {
  rooms: RoomSheetData[];
  combineIntoOne?: boolean;
}

export async function generateBatchRoomSheetsPDF(options: BatchExportOptions): Promise<Blob[]> {
  const pdfs: Blob[] = [];
  
  for (const roomData of options.rooms) {
    const pdf = await generateRoomSheetPDF(roomData);
    pdfs.push(pdf);
  }
  
  return pdfs;
}
