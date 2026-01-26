/**
 * Room Bulk Export Service
 * Generates PDF/DOCX exports for multiple rooms in a single document
 */

import { prisma } from './db';
import jsPDF from 'jspdf';
import PizZip from 'pizzip';

export interface BulkExportOptions {
  projectId: string;
  roomIds?: string[];  // If empty, export all rooms
  format: 'pdf' | 'docx';
  includePhotos?: boolean;
  includeFinishSchedule?: boolean;
  includeMEP?: boolean;
  includeTakeoff?: boolean;
}

interface RoomExportData {
  id: string;
  name: string;
  roomNumber: string;
  type: string;
  floorNumber: number | null;
  area: number | null;
  status: string;
  percentComplete: number;
  notes: string | null;
  finishItems: any[];
  mepEquipment: any[];
  photos: any[];
}

/**
 * Fetch all room data for export
 */
export async function fetchRoomsForExport(
  projectId: string,
  roomIds?: string[]
): Promise<RoomExportData[]> {
  const whereClause: any = { projectId };
  if (roomIds && roomIds.length > 0) {
    whereClause.id = { in: roomIds };
  }

  const rooms = await prisma.room.findMany({
    where: whereClause,
    include: {
      FinishScheduleItem: true,
      RoomPhoto: {
        orderBy: { capturedAt: 'desc' },
        take: 4,
      },
    },
    orderBy: [{ floorNumber: 'asc' }, { roomNumber: 'asc' }],
  });

  // Fetch MEP equipment for the project (linked by room name/number)
  const mepEquipment = await prisma.mEPEquipment.findMany({
    where: { projectId },
    select: { room: true, equipmentTag: true, name: true, equipmentType: true, manufacturer: true },
  });

  return rooms.map((room: any) => {
    // Match MEP equipment by room name/number
    const roomMep = mepEquipment.filter(
      (e) => e.room === room.roomNumber || e.room === room.name
    );

    return {
      id: room.id,
      name: room.name,
      roomNumber: room.roomNumber || '',
      type: room.type || 'General',
      floorNumber: room.floorNumber,
      area: room.area,
      status: room.status,
      percentComplete: room.percentComplete || 0,
      notes: room.notes,
      finishItems: room.FinishScheduleItem || [],
      mepEquipment: roomMep,
      photos: room.RoomPhoto || [],
    };
  });
}

/**
 * Clean item names (remove underscores)
 */
function cleanName(name: string | null | undefined): string {
  if (!name) return '-';
  return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Generate bulk PDF export
 */
export async function generateBulkPDF(
  projectName: string,
  rooms: RoomExportData[],
  options: Partial<BulkExportOptions>
): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'letter');
  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  // Title page
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Room Schedule Export', pageWidth / 2, 60, { align: 'center' });
  
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.text(projectName, pageWidth / 2, 80, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.text(`${rooms.length} Rooms`, pageWidth / 2, 95, { align: 'center' });
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 105, { align: 'center' });

  // Table of contents
  pdf.addPage();
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Table of Contents', margin, 25);
  
  let tocY = 40;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  rooms.forEach((room, idx) => {
    if (tocY > pageHeight - 20) {
      pdf.addPage();
      tocY = 25;
    }
    pdf.text(`${idx + 1}. ${room.roomNumber} - ${room.name}`, margin, tocY);
    tocY += 6;
  });

  // Each room
  rooms.forEach((room, roomIndex) => {
    pdf.addPage();
    let y = 20;

    // Room header
    pdf.setFillColor(0, 59, 113);  // Brand blue
    pdf.rect(margin, y, contentWidth, 12, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${room.roomNumber} - ${room.name}`, margin + 5, y + 8);
    pdf.setTextColor(0, 0, 0);
    y += 20;

    // Room info grid
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const infoLeft = [
      ['Type:', room.type],
      ['Floor:', room.floorNumber?.toString() || '-'],
      ['Area:', room.area ? `${room.area} SF` : '-'],
    ];
    const infoRight = [
      ['Status:', room.status],
      ['Progress:', `${room.percentComplete}%`],
    ];

    infoLeft.forEach(([label, value], i) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin, y + i * 5);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, margin + 20, y + i * 5);
    });

    infoRight.forEach(([label, value], i) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin + 80, y + i * 5);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, margin + 100, y + i * 5);
    });
    y += 20;

    // Finish Schedule
    if (options.includeFinishSchedule !== false && room.finishItems.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Finish Schedule', margin, y);
      y += 6;

      // Group by category
      const grouped: Record<string, any[]> = {};
      room.finishItems.forEach((item) => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      });

      pdf.setFontSize(8);
      Object.entries(grouped).forEach(([category, items]) => {
        if (y > pageHeight - 30) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.text(category.toUpperCase(), margin, y);
        y += 4;
        pdf.setFont('helvetica', 'normal');
        items.forEach((item) => {
          if (y > pageHeight - 15) {
            pdf.addPage();
            y = 20;
          }
          const text = `• ${cleanName(item.itemName)}: ${cleanName(item.description || item.productName)}`;
          const lines = pdf.splitTextToSize(text, contentWidth - 5);
          pdf.text(lines, margin + 3, y);
          y += lines.length * 3.5;
        });
        y += 2;
      });
      y += 5;
    }

    // MEP Equipment
    if (options.includeMEP !== false && room.mepEquipment.length > 0) {
      if (y > pageHeight - 40) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MEP Equipment', margin, y);
      y += 6;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      room.mepEquipment.forEach((item) => {
        if (y > pageHeight - 15) {
          pdf.addPage();
          y = 20;
        }
        const text = `• ${cleanName(item.equipmentTag || item.type)}: ${cleanName(item.description || item.manufacturer)}`;
        const lines = pdf.splitTextToSize(text, contentWidth - 5);
        pdf.text(lines, margin + 3, y);
        y += lines.length * 3.5;
      });
      y += 5;
    }

    // Notes
    if (room.notes) {
      if (y > pageHeight - 30) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Notes', margin, y);
      y += 5;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const noteLines = pdf.splitTextToSize(room.notes, contentWidth);
      pdf.text(noteLines, margin, y);
    }

    // Page number
    pdf.setFontSize(8);
    pdf.text(
      `Page ${roomIndex + 3} of ${rooms.length + 2}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  });

  return pdf.output('blob');
}

/**
 * Generate bulk DOCX export
 */
export async function generateBulkDOCX(
  projectName: string,
  rooms: RoomExportData[],
  options: Partial<BulkExportOptions>
): Promise<Blob> {
  const today = new Date().toLocaleDateString();

  // Build document XML
  let roomsXml = '';
  rooms.forEach((room, idx) => {
    // Room header
    roomsXml += `
      <w:p>
        <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
        <w:r><w:t>${room.roomNumber} - ${escapeXml(room.name)}</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Type: </w:t></w:r>
        <w:r><w:t>${escapeXml(room.type)}</w:t></w:r>
        <w:r><w:t xml:space="preserve">   </w:t></w:r>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Floor: </w:t></w:r>
        <w:r><w:t>${room.floorNumber || '-'}</w:t></w:r>
        <w:r><w:t xml:space="preserve">   </w:t></w:r>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Area: </w:t></w:r>
        <w:r><w:t>${room.area ? `${room.area} SF` : '-'}</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Status: </w:t></w:r>
        <w:r><w:t>${escapeXml(room.status)}</w:t></w:r>
        <w:r><w:t xml:space="preserve">   </w:t></w:r>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Progress: </w:t></w:r>
        <w:r><w:t>${room.percentComplete}%</w:t></w:r>
      </w:p>`;

    // Finish Schedule
    if (options.includeFinishSchedule !== false && room.finishItems.length > 0) {
      roomsXml += `
        <w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>
          <w:r><w:t>Finish Schedule</w:t></w:r>
        </w:p>`;

      const grouped: Record<string, any[]> = {};
      room.finishItems.forEach((item) => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      });

      Object.entries(grouped).forEach(([category, items]) => {
        roomsXml += `
          <w:p>
            <w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>${escapeXml(category.toUpperCase())}</w:t></w:r>
          </w:p>`;
        items.forEach((item) => {
          roomsXml += `
            <w:p>
              <w:r><w:t>• ${escapeXml(cleanName(item.itemName))}: ${escapeXml(cleanName(item.description || item.productName))}</w:t></w:r>
            </w:p>`;
        });
      });
    }

    // MEP Equipment
    if (options.includeMEP !== false && room.mepEquipment.length > 0) {
      roomsXml += `
        <w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>
          <w:r><w:t>MEP Equipment</w:t></w:r>
        </w:p>`;
      room.mepEquipment.forEach((item) => {
        roomsXml += `
          <w:p>
            <w:r><w:t>• ${escapeXml(cleanName(item.equipmentTag || item.type))}: ${escapeXml(cleanName(item.description || item.manufacturer))}</w:t></w:r>
          </w:p>`;
      });
    }

    // Notes
    if (room.notes) {
      roomsXml += `
        <w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>
          <w:r><w:t>Notes</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:t>${escapeXml(room.notes)}</w:t></w:r>
        </w:p>`;
    }

    // Page break between rooms
    if (idx < rooms.length - 1) {
      roomsXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    }
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>Room Schedule Export</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(projectName)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>${rooms.length} Rooms • Generated ${today}</w:t></w:r>
    </w:p>
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Table of Contents</w:t></w:r>
    </w:p>
    ${rooms.map((r, i) => `<w:p><w:r><w:t>${i + 1}. ${r.roomNumber} - ${escapeXml(r.name)}</w:t></w:r></w:p>`).join('')}
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    ${roomsXml}
  </w:body>
</w:document>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', getContentTypes());
  zip.file('_rels/.rels', getRels());
  zip.file('word/_rels/document.xml.rels', getDocumentRels());
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', getStyles());

  const blob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return blob;
}

// XML helpers
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function getRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function getDocumentRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function getStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:sz w:val="48"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="003B71"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
</w:styles>`;
}
