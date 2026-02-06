/**
 * Room Bulk Export Service
 * Generates PDF/DOCX exports for multiple rooms in a single document
 * Migrated from jspdf to @react-pdf/renderer for PDF generation
 */

import { prisma } from './db';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
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

// PDF Styles using @react-pdf/renderer
const pdfStyles = StyleSheet.create({
  page: {
    padding: 42,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  titlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  projectName: {
    fontSize: 16,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 5,
    color: '#666666',
  },
  tocTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
  },
  tocItem: {
    fontSize: 10,
    marginBottom: 6,
  },
  roomHeader: {
    backgroundColor: '#003B71',
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    padding: 8,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    width: 60,
  },
  infoValue: {
    fontSize: 9,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 6,
  },
  categoryTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    marginBottom: 3,
  },
  listItem: {
    fontSize: 8,
    marginLeft: 10,
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    right: 42,
    fontSize: 8,
    color: '#666666',
  },
});

// Title Page Component
const TitlePage: React.FC<{ projectName: string; roomCount: number }> = ({
  projectName,
  roomCount,
}) => (
  <Page size="LETTER" style={pdfStyles.page}>
    <View style={pdfStyles.titlePage}>
      <Text style={pdfStyles.mainTitle}>Room Schedule Export</Text>
      <Text style={pdfStyles.projectName}>{projectName}</Text>
      <Text style={pdfStyles.subtitle}>{roomCount} Rooms</Text>
      <Text style={pdfStyles.subtitle}>
        Generated: {new Date().toLocaleDateString()}
      </Text>
    </View>
  </Page>
);

// Table of Contents Page
const TableOfContentsPage: React.FC<{ rooms: RoomExportData[] }> = ({ rooms }) => (
  <Page size="LETTER" style={pdfStyles.page}>
    <Text style={pdfStyles.tocTitle}>Table of Contents</Text>
    {rooms.map((room, idx) => (
      <Text key={room.id} style={pdfStyles.tocItem}>
        {idx + 1}. {room.roomNumber} - {room.name}
      </Text>
    ))}
  </Page>
);

// Room Page Component
const RoomPage: React.FC<{
  room: RoomExportData;
  pageNumber: number;
  totalPages: number;
  options: Partial<BulkExportOptions>;
}> = ({ room, pageNumber, totalPages, options }) => {
  // Group finish items by category
  const groupedFinish: Record<string, any[]> = {};
  if (options.includeFinishSchedule !== false) {
    room.finishItems.forEach((item) => {
      const cat = item.category || 'Other';
      if (!groupedFinish[cat]) groupedFinish[cat] = [];
      groupedFinish[cat].push(item);
    });
  }

  return (
    <Page size="LETTER" style={pdfStyles.page}>
      <Text style={pdfStyles.roomHeader}>
        {room.roomNumber} - {room.name}
      </Text>

      {/* Room Info */}
      <View style={{ marginBottom: 15 }}>
        <View style={pdfStyles.infoRow}>
          <Text style={pdfStyles.infoLabel}>Type:</Text>
          <Text style={pdfStyles.infoValue}>{room.type}</Text>
          <Text style={{ ...pdfStyles.infoLabel, marginLeft: 60 }}>Status:</Text>
          <Text style={pdfStyles.infoValue}>{room.status}</Text>
        </View>
        <View style={pdfStyles.infoRow}>
          <Text style={pdfStyles.infoLabel}>Floor:</Text>
          <Text style={pdfStyles.infoValue}>{room.floorNumber?.toString() || '-'}</Text>
          <Text style={{ ...pdfStyles.infoLabel, marginLeft: 60 }}>Progress:</Text>
          <Text style={pdfStyles.infoValue}>{room.percentComplete}%</Text>
        </View>
        <View style={pdfStyles.infoRow}>
          <Text style={pdfStyles.infoLabel}>Area:</Text>
          <Text style={pdfStyles.infoValue}>
            {room.area ? `${room.area} SF` : '-'}
          </Text>
        </View>
      </View>

      {/* Finish Schedule */}
      {options.includeFinishSchedule !== false && room.finishItems.length > 0 && (
        <View>
          <Text style={pdfStyles.sectionTitle}>Finish Schedule</Text>
          {Object.entries(groupedFinish).map(([category, items]) => (
            <View key={category}>
              <Text style={pdfStyles.categoryTitle}>{category.toUpperCase()}</Text>
              {items.map((item, idx) => {
                const text = `• ${cleanName(item.itemName)}: ${cleanName(
                  item.description || item.productName
                )}`;
                return (
                  <Text key={idx} style={pdfStyles.listItem}>
                    {text}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* MEP Equipment */}
      {options.includeMEP !== false && room.mepEquipment.length > 0 && (
        <View>
          <Text style={pdfStyles.sectionTitle}>MEP Equipment</Text>
          {room.mepEquipment.map((item, idx) => {
            const text = `• ${cleanName(item.equipmentTag || item.type)}: ${cleanName(
              item.description || item.manufacturer
            )}`;
            return (
              <Text key={idx} style={pdfStyles.listItem}>
                {text}
              </Text>
            );
          })}
        </View>
      )}

      {/* Notes */}
      {room.notes && (
        <View>
          <Text style={pdfStyles.sectionTitle}>Notes</Text>
          <Text style={{ fontSize: 8, marginLeft: 5 }}>{room.notes}</Text>
        </View>
      )}

      {/* Page Number */}
      <Text style={pdfStyles.footer}>
        Page {pageNumber} of {totalPages}
      </Text>
    </Page>
  );
};

// Main PDF Document
const BulkExportDocument: React.FC<{
  projectName: string;
  rooms: RoomExportData[];
  options: Partial<BulkExportOptions>;
}> = ({ projectName, rooms, options }) => {
  const totalPages = rooms.length + 2; // Title + TOC + rooms

  return (
    <Document>
      <TitlePage projectName={projectName} roomCount={rooms.length} />
      <TableOfContentsPage rooms={rooms} />
      {rooms.map((room, idx) => (
        <RoomPage
          key={room.id}
          room={room}
          pageNumber={idx + 3}
          totalPages={totalPages}
          options={options}
        />
      ))}
    </Document>
  );
};

/**
 * Generate bulk PDF export using @react-pdf/renderer
 */
export async function generateBulkPDF(
  projectName: string,
  rooms: RoomExportData[],
  options: Partial<BulkExportOptions>
): Promise<Blob> {
  const doc = <BulkExportDocument projectName={projectName} rooms={rooms} options={options} />;
  const blob = await pdf(doc).toBlob();
  return blob;
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
