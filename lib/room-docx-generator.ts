// Room Sheet DOCX Generator
// Client-side DOCX generation for editable room data sheets
// Matches the PDF formatting but in an editable Word format

import PizZip from 'pizzip';

// Helper function to clean item names (remove underscores and clean up formatting)
function cleanItemName(name: string | undefined | null): string {
  if (!name) return '-';
  return name
    .replace(/_/g, ' ')           // Replace underscores with spaces
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .trim();
}

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
  };
  revision?: {
    number: number;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
  };
  exportedAt: string;
}

// Generate DOCX template as base64
function _generateDocxTemplate(): string {
  // This creates a minimal valid DOCX file structure
  // The template uses docxtemplater tags like {variable}
  const templateXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>{projectName}</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr><w:r><w:t>{roomTitle}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Exported: {exportDate}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{content}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
  
  return templateXml;
}

export async function generateRoomSheetDOCX(data: RoomSheetData): Promise<Blob> {
  // Build document content as structured data for manual XML generation
  const roomTitle = `${data.room.roomNumber ? data.room.roomNumber + ' - ' : ''}${data.room.name}`;
  const exportDate = new Date(data.exportedAt).toLocaleDateString();
  
  // Build content sections
  const sections: string[] = [];
  
  // Room Details Section
  sections.push('\n\n=== ROOM DETAILS ===\n');
  const details = [
    ['Type', data.room.type],
    ['Floor', data.room.floorNumber !== undefined ? `Floor ${data.room.floorNumber}` : null],
    ['Area', data.room.area ? `${data.room.area.toLocaleString()} SF` : null],
    ['Grid Location', data.room.gridLocation],
    ['Status', data.room.status],
    ['Progress', `${data.room.percentComplete}%`],
    ['Trade', data.room.tradeType],
    ['Assigned To', data.room.assignedTo],
  ].filter(([_, v]) => v !== null && v !== undefined);
  
  details.forEach(([key, value]) => {
    sections.push(`${key}: ${value}`);
  });
  
  if (data.room.notes) {
    sections.push(`\nNotes: ${data.room.notes}`);
  }
  
  // Finish Schedule Section
  if (data.finishSchedule.totalItems > 0) {
    sections.push(`\n\n=== FINISH SCHEDULE (${data.finishSchedule.totalItems} items) ===`);
    
    for (const category of data.finishSchedule.categories) {
      const items = data.finishSchedule.items[category] || [];
      if (items.length === 0) continue;
      
      sections.push(`\n${category} (${items.length}):`);
      sections.push('Finish Type | Material | Manufacturer | Model/Color');
      sections.push('-'.repeat(70));
      
      items.forEach((item: any) => {
        const modelColor = `${cleanItemName(item.modelNumber)} ${cleanItemName(item.color)}`.trim() || '-';
        sections.push(
          `${cleanItemName(item.finishType)} | ${cleanItemName(item.material)} | ${cleanItemName(item.manufacturer)} | ${modelColor}`
        );
      });
    }
  }
  
  // MEP Equipment Section
  if (data.mepEquipment.totalItems > 0) {
    sections.push(`\n\n=== MEP EQUIPMENT (${data.mepEquipment.totalItems} items) ===`);
    
    for (const system of data.mepEquipment.systems) {
      const items = data.mepEquipment.items[system] || [];
      if (items.length === 0) continue;
      
      sections.push(`\n${system.toUpperCase()} (${items.length}):`);
      sections.push('Equipment | Model | Specs | Notes');
      sections.push('-'.repeat(70));
      
      items.forEach((item: any) => {
        sections.push(
          `${cleanItemName(item.name || item.equipmentTag)} | ${cleanItemName(item.modelNumber)} | ${cleanItemName(item.specifications)} | ${cleanItemName(item.notes)}`
        );
      });
    }
  }
  
  // Material Takeoff Section
  if (data.takeoffItems.totalItems > 0) {
    sections.push(`\n\n=== MATERIAL TAKEOFF (${data.takeoffItems.totalItems} items) ===`);
    
    for (const category of data.takeoffItems.categories) {
      const items = data.takeoffItems.items[category] || [];
      if (items.length === 0) continue;
      
      sections.push(`\n${cleanItemName(category)} (${items.length}):`);
      sections.push('Item | Qty | Unit | Description');
      sections.push('-'.repeat(70));
      
      items.forEach((item: any) => {
        sections.push(
          `${cleanItemName(item.itemName || item.description)} | ${item.quantity || 0} | ${item.unit || '-'} | ${cleanItemName(item.notes || item.specification) || '-'}`
        );
      });
    }
  }
  
  const _fullContent = sections.join('\n');
  
  // Create minimal DOCX structure using PizZip
  const zip = new PizZip();
  
  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
  
  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  
  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  
  // word/styles.xml - Define styles for headers
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="F97316"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="F97316"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1F2328"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`);
  
  // Generate document content XML with proper tables
  const documentXml = generateDocumentXml(data, roomTitle, exportDate);
  zip.file('word/document.xml', documentXml);
  
  // Generate the blob
  const blob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  
  return blob;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateDocumentXml(data: RoomSheetData, roomTitle: string, exportDate: string): string {
  const paragraphs: string[] = [];
  
  // Helper to create a paragraph
  const p = (text: string, style?: string, bold?: boolean) => {
    const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
    const boldXml = bold ? '<w:b/>' : '';
    return `<w:p>${styleXml}<w:r><w:rPr>${boldXml}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
  };
  
  // Helper to create a table
  const createTable = (headers: string[], rows: string[][]) => {
    const colCount = headers.length;
    const colWidth = Math.floor(9000 / colCount); // Total width ~9000 twips for letter size
    
    let tableXml = '<w:tbl>';
    tableXml += '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>';
    
    // Grid columns
    tableXml += '<w:tblGrid>';
    for (let i = 0; i < colCount; i++) {
      tableXml += `<w:gridCol w:w="${colWidth}"/>`;
    }
    tableXml += '</w:tblGrid>';
    
    // Header row
    tableXml += '<w:tr>';
    headers.forEach(h => {
      tableXml += `<w:tc><w:tcPr><w:shd w:val="clear" w:fill="F0F0F0"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r></w:p></w:tc>`;
    });
    tableXml += '</w:tr>';
    
    // Data rows
    rows.forEach(row => {
      tableXml += '<w:tr>';
      row.forEach(cell => {
        tableXml += `<w:tc><w:p><w:r><w:t>${escapeXml(cell || '-')}</w:t></w:r></w:p></w:tc>`;
      });
      tableXml += '</w:tr>';
    });
    
    tableXml += '</w:tbl>';
    return tableXml;
  };
  
  // Title and Header
  paragraphs.push(p(data.project.name, 'Title'));
  paragraphs.push(p(roomTitle, 'Heading1'));
  paragraphs.push(p(`Exported: ${exportDate}`, 'Normal'));
  paragraphs.push(p('', 'Normal')); // Spacer
  
  // Room Details Section
  paragraphs.push(p('ROOM DETAILS', 'Heading1'));
  
  const detailRows: string[][] = [];
  if (data.room.type) detailRows.push(['Type', data.room.type]);
  if (data.room.floorNumber !== undefined) detailRows.push(['Floor', `Floor ${data.room.floorNumber}`]);
  if (data.room.area) detailRows.push(['Area', `${data.room.area.toLocaleString()} SF`]);
  if (data.room.gridLocation) detailRows.push(['Grid Location', data.room.gridLocation]);
  if (data.room.status) detailRows.push(['Status', data.room.status]);
  detailRows.push(['Progress', `${data.room.percentComplete}%`]);
  if (data.room.tradeType) detailRows.push(['Trade', data.room.tradeType]);
  if (data.room.assignedTo) detailRows.push(['Assigned To', data.room.assignedTo]);
  
  if (detailRows.length > 0) {
    paragraphs.push(createTable(['Property', 'Value'], detailRows));
  }
  
  if (data.room.notes) {
    paragraphs.push(p('', 'Normal'));
    paragraphs.push(p(`Notes: ${data.room.notes}`, 'Normal'));
  }
  
  paragraphs.push(p('', 'Normal')); // Spacer
  
  // Finish Schedule Section
  if (data.finishSchedule.totalItems > 0) {
    paragraphs.push(p(`FINISH SCHEDULE (${data.finishSchedule.totalItems} items)`, 'Heading1'));
    
    for (const category of data.finishSchedule.categories) {
      const items = data.finishSchedule.items[category] || [];
      if (items.length === 0) continue;
      
      paragraphs.push(p(`${category} (${items.length})`, 'Heading2'));
      
      const rows = items.map((item: any) => [
        cleanItemName(item.finishType),
        cleanItemName(item.material),
        cleanItemName(item.manufacturer),
        `${cleanItemName(item.modelNumber)} ${cleanItemName(item.color)}`.trim() || '-'
      ]);
      
      paragraphs.push(createTable(['Finish Type', 'Material', 'Manufacturer', 'Model/Color'], rows));
      paragraphs.push(p('', 'Normal'));
    }
  }
  
  // MEP Equipment Section
  if (data.mepEquipment.totalItems > 0) {
    paragraphs.push(p(`MEP EQUIPMENT (${data.mepEquipment.totalItems} items)`, 'Heading1'));
    
    for (const system of data.mepEquipment.systems) {
      const items = data.mepEquipment.items[system] || [];
      if (items.length === 0) continue;
      
      paragraphs.push(p(`${system.toUpperCase()} (${items.length})`, 'Heading2'));
      
      const rows = items.map((item: any) => [
        cleanItemName(item.name || item.equipmentTag),
        cleanItemName(item.modelNumber),
        cleanItemName(item.specifications),
        cleanItemName(item.notes)
      ]);
      
      paragraphs.push(createTable(['Equipment', 'Model', 'Specs', 'Notes'], rows));
      paragraphs.push(p('', 'Normal'));
    }
  }
  
  // Material Takeoff Section
  if (data.takeoffItems.totalItems > 0) {
    paragraphs.push(p(`MATERIAL TAKEOFF (${data.takeoffItems.totalItems} items)`, 'Heading1'));
    
    for (const category of data.takeoffItems.categories) {
      const items = data.takeoffItems.items[category] || [];
      if (items.length === 0) continue;
      
      paragraphs.push(p(`${cleanItemName(category)} (${items.length})`, 'Heading2'));
      
      const rows = items.map((item: any) => [
        cleanItemName(item.itemName || item.description),
        String(item.quantity || 0),
        item.unit || '-',
        cleanItemName(item.notes || item.specification) || '-'
      ]);
      
      paragraphs.push(createTable(['Item', 'Qty', 'Unit', 'Description'], rows));
      paragraphs.push(p('', 'Normal'));
    }
  }
  
  // Footer
  paragraphs.push(p('', 'Normal'));
  paragraphs.push(p('Generated by ForemanOS', 'Normal'));
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}
