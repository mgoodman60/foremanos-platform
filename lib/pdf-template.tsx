/**
 * Daily Report PDF Template
 * 
 * Generates professional PDF reports with:
 * - Header/Letterhead with company logo
 * - Weather summary (3 snapshots)
 * - Crew information and work performed
 * - Photos with captions and locations
 * - Material deliveries
 * - Equipment on site
 * - Schedule updates
 * - Quantity calculations
 * - Notes
 * - Footer with prepared by and date
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register fonts
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ],
});

// Define styles
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    paddingTop: 30,
    paddingBottom: 60,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #1F2328',
    paddingBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
  },
  headerText: {
    textAlign: 'right',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1F2328',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 3,
  },
  projectInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 120,
    fontWeight: 500,
    color: '#374151',
  },
  infoValue: {
    flex: 1,
    color: '#1F2937',
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1F2328',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1 solid #E5E7EB',
  },
  subsection: {
    marginTop: 8,
    marginBottom: 6,
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 500,
    color: '#374151',
    marginBottom: 4,
  },
  text: {
    fontSize: 10,
    color: '#1F2937',
    lineHeight: 1.5,
  },
  weatherGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  weatherCard: {
    width: '30%',
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    border: '1 solid #D1D5DB',
  },
  weatherTime: {
    fontSize: 9,
    fontWeight: 500,
    color: '#6B7280',
    marginBottom: 4,
  },
  weatherData: {
    fontSize: 10,
    color: '#1F2937',
    marginBottom: 2,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  photoContainer: {
    width: '48%',
    marginBottom: 10,
    marginRight: '2%',
  },
  photo: {
    width: '100%',
    height: 150,
    objectFit: 'cover',
    borderRadius: 4,
    border: '1 solid #E5E7EB',
  },
  photoCaption: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 1.3,
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #E5E7EB',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#F3F4F6',
    borderBottom: '1 solid #D1D5DB',
    fontWeight: 500,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: '#1F2937',
    paddingHorizontal: 4,
  },
  list: {
    marginTop: 5,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    width: 15,
    fontSize: 10,
  },
  listContent: {
    flex: 1,
    fontSize: 10,
    color: '#1F2937',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 15,
    borderTop: '1 solid #E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#6B7280',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 15,
    right: 40,
    fontSize: 8,
    color: '#9CA3AF',
  },
});

// Type definitions
interface WeatherSnapshot {
  time: string;
  temperature: number;
  conditions: string;
  humidity?: number;
  windSpeed?: number;
}

interface Photo {
  id: string;
  url: string;
  caption?: string;
  location?: string;
  aiDescription?: string;
  aiConfidence?: number;
  timestamp?: string;
}

interface WorkEntry {
  trade: string;
  company?: string;
  description: string;
  location?: string;
  crewSize?: number;
}

interface MaterialDelivery {
  sub: string;
  material: string;
  quantity: string;
}

interface Equipment {
  name: string;
  type?: string;
}

interface ScheduleUpdate {
  activity: string;
  plannedStatus: string;
  actualStatus: string;
}

interface QuantityCalculation {
  type: string;
  description: string;
  location: string;
  actualQuantity: number;
  unit: string;
}

interface DailyReportData {
  // Header info
  projectName: string;
  projectAddress?: string;
  reportDate: string;
  projectManager?: string;
  superintendent?: string;
  client?: string;
  architectEngineer?: string;
  companyName?: string;
  companyLogo?: string; // URL to logo
  
  // Weather
  weatherSnapshots?: WeatherSnapshot[];
  
  // Crew and work
  workPerformed?: WorkEntry[];
  totalCrewSize?: number;
  
  // Photos
  photos?: Photo[];
  
  // Materials
  materialDeliveries?: MaterialDelivery[];
  
  // Equipment
  equipment?: Equipment[];
  
  // Schedule
  scheduleUpdates?: ScheduleUpdate[];
  
  // Quantities
  quantityCalculations?: QuantityCalculation[];
  
  // Notes
  notes?: string;
  
  // Footer
  preparedBy: string;
  finalizationDate: string;
}

// Header Component
const Header: React.FC<{ data: DailyReportData }> = ({ data }) => (
  <View style={styles.header}>
    <View style={styles.headerRow}>
      <View>
        {data.companyLogo ? (
          <Image src={data.companyLogo} style={styles.logo} />
        ) : (
          <Image src="/foremanos-new-logo.png" style={styles.logo} />
        )}
      </View>
      <View style={styles.headerText}>
        <Text style={styles.title}>Daily Report</Text>
        <Text style={styles.subtitle}>{data.reportDate}</Text>
      </View>
    </View>
    
    <View style={styles.projectInfo}>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Project:</Text>
        <Text style={styles.infoValue}>{data.projectName}</Text>
      </View>
      {data.projectAddress && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Address:</Text>
          <Text style={styles.infoValue}>{data.projectAddress}</Text>
        </View>
      )}
      {data.projectManager && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Project Manager:</Text>
          <Text style={styles.infoValue}>{data.projectManager}</Text>
        </View>
      )}
      {data.superintendent && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Superintendent:</Text>
          <Text style={styles.infoValue}>{data.superintendent}</Text>
        </View>
      )}
      {data.client && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Client:</Text>
          <Text style={styles.infoValue}>{data.client}</Text>
        </View>
      )}
      {data.architectEngineer && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Architect/Engineer:</Text>
          <Text style={styles.infoValue}>{data.architectEngineer}</Text>
        </View>
      )}
      {data.companyName && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Company:</Text>
          <Text style={styles.infoValue}>{data.companyName}</Text>
        </View>
      )}
    </View>
  </View>
);

// Weather Section
const WeatherSection: React.FC<{ snapshots?: WeatherSnapshot[] }> = ({ snapshots }) => {
  if (!snapshots || snapshots.length === 0) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Weather Summary</Text>
      <View style={styles.weatherGrid}>
        {snapshots.map((snapshot, index) => (
          <View key={index} style={styles.weatherCard}>
            <Text style={styles.weatherTime}>{snapshot.time}</Text>
            <Text style={styles.weatherData}>{snapshot.temperature}°F</Text>
            <Text style={styles.weatherData}>{snapshot.conditions}</Text>
            {snapshot.humidity && (
              <Text style={styles.weatherData}>Humidity: {snapshot.humidity}%</Text>
            )}
            {snapshot.windSpeed && (
              <Text style={styles.weatherData}>Wind: {snapshot.windSpeed} mph</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

// Work Performed Section
const WorkSection: React.FC<{ work?: WorkEntry[]; totalCrew?: number }> = ({ work, totalCrew }) => {
  if (!work || work.length === 0) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Crew & Work Performed</Text>
      {totalCrew && (
        <Text style={styles.text}>Total Crew Size: {totalCrew} workers</Text>
      )}
      <View style={styles.list}>
        {work.map((entry, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <View style={styles.listContent}>
              <Text style={{ fontWeight: 500 }}>
                {entry.trade}
                {entry.company && ` (${entry.company})`}
                {entry.crewSize && ` - ${entry.crewSize} workers`}
              </Text>
              <Text>{entry.description}</Text>
              {entry.location && (
                <Text style={{ fontSize: 9, color: '#6B7280' }}>
                  Location: {entry.location}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Photos Section
const PhotosSection: React.FC<{ photos?: Photo[] }> = ({ photos }) => {
  if (!photos || photos.length === 0) return null;
  
  // Split photos into pages of 4
  const photosPerPage = 4;
  const photoPages = [];
  for (let i = 0; i < photos.length; i += photosPerPage) {
    photoPages.push(photos.slice(i, i + photosPerPage));
  }
  
  return (
    <>
      {photoPages.map((pagePhotos, pageIndex) => (
        <View key={`photo-page-${pageIndex}`} style={styles.section} wrap={false} break={pageIndex > 0}>
          <Text style={styles.sectionTitle}>
            Progress Photos {photoPages.length > 1 ? `(Page ${pageIndex + 1} of ${photoPages.length})` : ''}
          </Text>
          <View style={styles.photoGrid}>
            {pagePhotos.map((photo, index) => (
              <View key={photo.id} style={styles.photoContainer}>
                <Image src={photo.url} style={styles.photo} />
                <View style={styles.photoCaption}>
                  {photo.location && (
                    <Text style={{ fontWeight: 500 }}>📍 {photo.location}</Text>
                  )}
                  {photo.aiDescription && photo.aiConfidence && photo.aiConfidence > 0.8 && (
                    <Text>{photo.aiDescription}</Text>
                  )}
                  {photo.caption && (
                    <Text>{photo.caption}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
};

// Material Deliveries Section
const MaterialsSection: React.FC<{ materials?: MaterialDelivery[] }> = ({ materials }) => {
  if (!materials || materials.length === 0) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Material Deliveries</Text>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 1.2 }]}>Subcontractor</Text>
          <Text style={[styles.tableCell, { flex: 2 }]}>Material</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>Quantity</Text>
        </View>
        {materials.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.sub}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{item.material}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{item.quantity}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Equipment Section
const EquipmentSection: React.FC<{ equipment?: Equipment[] }> = ({ equipment }) => {
  if (!equipment || equipment.length === 0) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Equipment on Site</Text>
      <View style={styles.list}>
        {equipment.map((item, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listContent}>
              {item.name}
              {item.type && ` (${item.type})`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Schedule Updates Section
const ScheduleSection: React.FC<{ updates?: ScheduleUpdate[] }> = ({ updates }) => {
  if (!updates || updates.length === 0) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Schedule Updates</Text>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, { flex: 2 }]}>Activity</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>Planned</Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>Actual</Text>
        </View>
        {updates.map((update, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{update.activity}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{update.plannedStatus}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{update.actualStatus}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Quantity Calculations Section
const QuantitiesSection: React.FC<{ quantities?: QuantityCalculation[] }> = ({ quantities }) => {
  if (!quantities || quantities.length === 0) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quantity Calculations</Text>
      <View style={styles.list}>
        {quantities.map((calc, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <View style={styles.listContent}>
              <Text style={{ fontWeight: 500 }}>{calc.description}</Text>
              <Text>
                Location: {calc.location} | Quantity: {calc.actualQuantity} {calc.unit}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Notes Section
const NotesSection: React.FC<{ notes?: string }> = ({ notes }) => {
  if (!notes) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Additional Notes</Text>
      <Text style={styles.text}>{notes}</Text>
    </View>
  );
};

// Footer Component
const Footer: React.FC<{ preparedBy: string; date: string }> = ({ preparedBy, date }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Prepared by: {preparedBy}</Text>
    <Text style={styles.footerText}>Finalized: {date}</Text>
  </View>
);

// Main PDF Document Component
export const DailyReportPDF: React.FC<{ data: DailyReportData }> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      <Header data={data} />
      <WeatherSection snapshots={data.weatherSnapshots} />
      <WorkSection work={data.workPerformed} totalCrew={data.totalCrewSize} />
      <PhotosSection photos={data.photos} />
      <MaterialsSection materials={data.materialDeliveries} />
      <EquipmentSection equipment={data.equipment} />
      <ScheduleSection updates={data.scheduleUpdates} />
      <QuantitiesSection quantities={data.quantityCalculations} />
      <NotesSection notes={data.notes} />
      <Footer preparedBy={data.preparedBy} date={data.finalizationDate} />
      <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
    </Page>
  </Document>
);

export type { DailyReportData };
