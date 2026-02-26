// Room Sheet PDF Generator
// Client-side PDF generation for room data sheets using @react-pdf/renderer
// Enhanced with branding, QR codes, and revision tracking

import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

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

// Define styles using @react-pdf/renderer StyleSheet
const styles = StyleSheet.create({
  page: {
    padding: 42, // ~15mm
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    backgroundColor: '#F97316', // orange
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 85, // ~30mm
    padding: 15,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  headerSubtext: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
  },
  headerBrand: {
    position: 'absolute',
    top: 15,
    right: 15,
    textAlign: 'right',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  brandSubtitle: {
    color: '#FFFFFF',
    fontSize: 6,
    marginTop: 2,
  },
  headerMeta: {
    position: 'absolute',
    top: 50,
    right: 15,
    fontSize: 7,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  content: {
    marginTop: 110, // Space for header
  },
  sectionTitle: {
    backgroundColor: '#1F2328', // darkGray
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    padding: 5,
    paddingLeft: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  detailColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 8,
    color: '#646464', // mediumGray
    width: 70,
  },
  detailValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1F2328', // darkGray
    marginLeft: 5,
  },
  notesLabel: {
    fontSize: 8,
    color: '#646464',
    marginTop: 8,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: '#1F2328',
    lineHeight: 1.4,
  },
  categoryHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#F97316', // orange
    marginBottom: 5,
  },
  table: {
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    padding: 4,
    borderBottom: '1px solid #C8C8C8',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottom: '1px solid #E8E8E8',
  },
  tableCell: {
    fontSize: 7,
    flex: 1,
    paddingRight: 4,
  },
  tableCellHeader: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#1F2328',
    flex: 1,
    paddingRight: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 42,
    right: 42,
    borderTop: '1px solid #C8C8C8',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#646464',
  },
  footerCenter: {
    color: '#C8C8C8',
    fontSize: 8,
  },
  qrPlaceholder: {
    position: 'absolute',
    bottom: 100,
    right: 42,
    width: 70,
    height: 70,
    border: '1px solid #C8C8C8',
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrText: {
    fontSize: 5,
    color: '#646464',
    textAlign: 'center',
  },
});

// Header Component
const RoomSheetHeader: React.FC<{ data: RoomSheetData }> = ({ data }) => {
  const date = new Date(data.exportedAt).toLocaleDateString();
  const time = new Date(data.exportedAt).toLocaleTimeString();
  const roomTitle = `${data.room.roomNumber ? data.room.roomNumber + ' - ' : ''}${data.room.name}`;
  const subtext = [data.project.clientName, data.project.address].filter(Boolean).join(' | ');

  return (
    <View style={styles.header} fixed>
      <View style={styles.headerBrand}>
        <Text style={styles.brandTitle}>FOREMANOS</Text>
        <Text style={styles.brandSubtitle}>Field Operations Intelligence</Text>
      </View>
      <Text style={styles.headerText}>{data.project.name}</Text>
      <Text style={styles.headerSubtext}>{roomTitle}</Text>
      {subtext && <Text style={{ color: '#FFFFFF', fontSize: 8, marginTop: 2 }}>{subtext}</Text>}
      <View style={styles.headerMeta}>
        <Text>Exported: {date} {time}</Text>
        {data.revision && <Text>Rev {data.revision.number}</Text>}
      </View>
    </View>
  );
};

// Footer Component
const RoomSheetFooter: React.FC<{ data: RoomSheetData }> = ({ data }) => {
  let revInfo = '';
  if (data.revision?.lastModifiedBy || data.revision?.lastModifiedAt) {
    const parts: string[] = [];
    if (data.revision.lastModifiedBy) parts.push(`Modified by: ${data.revision.lastModifiedBy}`);
    if (data.revision.lastModifiedAt) {
      parts.push(new Date(data.revision.lastModifiedAt).toLocaleDateString());
    }
    revInfo = parts.join(' | ');
  }

  return (
    <View style={styles.footer} fixed>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      <Text style={styles.footerCenter}>ForemanOS Room Sheet</Text>
      <Text>{revInfo}</Text>
    </View>
  );
};

// Room Details Section
const RoomDetails: React.FC<{ data: RoomSheetData }> = ({ data }) => {
  const details = [
    ['Type', data.room.type],
    ['Floor', data.room.floorNumber !== undefined ? `Floor ${data.room.floorNumber}` : undefined],
    ['Area', data.room.area ? `${data.room.area.toLocaleString()} SF` : undefined],
    ['Grid Location', data.room.gridLocation],
    ['Status', data.room.status],
    ['Progress', `${data.room.percentComplete}%`],
    ['Trade', data.room.tradeType],
    ['Assigned To', data.room.assignedTo],
  ].filter(([_, v]) => v !== undefined) as [string, string][];

  // Group into rows of 2
  const rows: [string, string][][] = [];
  for (let i = 0; i < details.length; i += 2) {
    rows.push([details[i], details[i + 1]]);
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>ROOM DETAILS</Text>
      {rows.map(([left, right], idx) => (
        <View key={idx} style={styles.detailRow}>
          <View style={styles.detailColumn}>
            <Text>
              <Text style={styles.detailLabel}>{left[0]}:</Text>
              <Text style={styles.detailValue}>{left[1]}</Text>
            </Text>
          </View>
          {right && (
            <View style={styles.detailColumn}>
              <Text>
                <Text style={styles.detailLabel}>{right[0]}:</Text>
                <Text style={styles.detailValue}>{right[1]}</Text>
              </Text>
            </View>
          )}
        </View>
      ))}
      {data.room.notes && (
        <View>
          <Text style={styles.notesLabel}>Notes:</Text>
          <Text style={styles.notesText}>{data.room.notes}</Text>
        </View>
      )}
    </View>
  );
};

// Table Component
const TableSection: React.FC<{
  title: string;
  headers: string[];
  rows: string[][];
}> = ({ title, headers, rows }) => {
  return (
    <View style={styles.table} wrap={false}>
      <Text style={styles.categoryHeader}>{title}</Text>
      <View style={styles.tableHeaderRow}>
        {headers.map((header, idx) => (
          <Text key={idx} style={styles.tableCellHeader}>
            {header}
          </Text>
        ))}
      </View>
      {rows.map((row, idx) => (
        <View key={idx} style={styles.tableRow}>
          {row.map((cell, cellIdx) => (
            <Text key={cellIdx} style={styles.tableCell}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

// Finish Schedule Section
const FinishSchedule: React.FC<{ data: RoomSheetData }> = ({ data }) => {
  if (data.finishSchedule.totalItems === 0) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>
        FINISH SCHEDULE ({data.finishSchedule.totalItems} items)
      </Text>
      {data.finishSchedule.categories.map((category) => {
        const items = data.finishSchedule.items[category] || [];
        if (items.length === 0) return null;

        const rows = items.map((item: any) => [
          cleanItemName(item.finishType),
          cleanItemName(item.material),
          cleanItemName(item.manufacturer),
          `${cleanItemName(item.modelNumber)} ${cleanItemName(item.color)}`.trim() || '-',
        ]);

        return (
          <TableSection
            key={category}
            title={`${category} (${items.length})`}
            headers={['Finish Type', 'Material', 'Manufacturer', 'Model/Color']}
            rows={rows}
          />
        );
      })}
    </View>
  );
};

// MEP Equipment Section
const MEPEquipment: React.FC<{ data: RoomSheetData }> = ({ data }) => {
  if (data.mepEquipment.totalItems === 0) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>
        MEP EQUIPMENT ({data.mepEquipment.totalItems} items)
      </Text>
      {data.mepEquipment.systems.map((system) => {
        const items = data.mepEquipment.items[system] || [];
        if (items.length === 0) return null;

        const rows = items.map((item: any) => [
          cleanItemName(item.name || item.equipmentTag),
          cleanItemName(item.modelNumber),
          cleanItemName(item.specifications),
          cleanItemName(item.notes),
        ]);

        return (
          <TableSection
            key={system}
            title={`${system.toUpperCase()} (${items.length})`}
            headers={['Equipment', 'Model', 'Specs', 'Notes']}
            rows={rows}
          />
        );
      })}
    </View>
  );
};

// Material Takeoff Section
const MaterialTakeoff: React.FC<{ data: RoomSheetData }> = ({ data }) => {
  if (data.takeoffItems.totalItems === 0) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>
        MATERIAL TAKEOFF ({data.takeoffItems.totalItems} items)
      </Text>
      {data.takeoffItems.categories.map((category) => {
        const items = data.takeoffItems.items[category] || [];
        if (items.length === 0) return null;

        const rows = items.map((item: any) => [
          cleanItemName(item.itemName || item.description),
          String(item.quantity || 0),
          item.unit || '-',
          cleanItemName(item.notes || item.specification) || '-',
        ]);

        return (
          <TableSection
            key={category}
            title={`${category} (${items.length})`}
            headers={['Item', 'Qty', 'Unit', 'Description']}
            rows={rows}
          />
        );
      })}
    </View>
  );
};

// Punch List Section
const PunchList: React.FC<{ data: RoomSheetData }> = ({ data }) => {
  if (!data.room.punchItems || data.room.punchItems.length === 0) return null;

  const openItems = data.room.punchItems.filter((p) => p.status !== 'resolved');
  if (openItems.length === 0) return null;

  const rows = openItems.map((item) => [
    item.description.substring(0, 40),
    item.priority.toUpperCase(),
    item.status.replace('_', ' ').toUpperCase(),
    item.assignedTo || '-',
  ]);

  return (
    <View>
      <Text style={styles.sectionTitle}>OPEN PUNCH ITEMS ({openItems.length})</Text>
      <TableSection title="" headers={['Description', 'Priority', 'Status', 'Assigned']} rows={rows} />
    </View>
  );
};

// QR Code Placeholder
const QRPlaceholder: React.FC<{ url?: string }> = ({ url }) => {
  if (!url) return null;

  return (
    <View style={styles.qrPlaceholder}>
      <Text style={styles.qrText}>Scan for</Text>
      <Text style={styles.qrText}>digital record</Text>
      <Text style={{ ...styles.qrText, fontSize: 4, marginTop: 4 }}>[QR CODE]</Text>
    </View>
  );
};

// Main Document Component
const RoomSheetDocument: React.FC<{ data: RoomSheetData }> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      <RoomSheetHeader data={data} />
      <View style={styles.content}>
        <RoomDetails data={data} />
        <FinishSchedule data={data} />
        <MEPEquipment data={data} />
        <MaterialTakeoff data={data} />
        <PunchList data={data} />
      </View>
      <QRPlaceholder url={data.appUrl} />
      <RoomSheetFooter data={data} />
    </Page>
  </Document>
);

// Main export function
export async function generateRoomSheetPDF(data: RoomSheetData): Promise<Blob> {
  const doc = <RoomSheetDocument data={data} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}

// Batch export helper for multiple rooms
export interface BatchExportOptions {
  rooms: RoomSheetData[];
  combineIntoOne?: boolean;
}

export async function generateBatchRoomSheetsPDF(options: BatchExportOptions): Promise<Blob[]> {
  const pdfs: Blob[] = [];

  for (const roomData of options.rooms) {
    const pdfBlob = await generateRoomSheetPDF(roomData);
    pdfs.push(pdfBlob);
  }

  return pdfs;
}
