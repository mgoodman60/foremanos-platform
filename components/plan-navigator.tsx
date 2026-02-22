'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Map,
  FileText,
  ArrowRight,
  Search,
  X,
  ExternalLink,
  Link2,
  ChevronDown,
  ChevronRight,
  Layers,
  Target,
  MapPin,
  Download,
  RefreshCw,
  FolderOpen,
  Building,
  Zap,
  Droplet,
  Wind,
  Flame,
  Layout,
  FileStack,
  Hash,
  Eye,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WithTooltip } from '@/components/ui/icon-button';
import { toast } from 'sonner';

interface DocumentNode {
  id: string;
  name: string;
  type: string;
  category?: string;
  sheetNumber?: string;
  outgoingRefs: number;
  incomingRefs: number;
}

interface DocumentReference {
  sourceDocumentId: string;
  targetDocumentId: string;
  referenceType: string;
  location: string;
  context: string;
  sourceDoc?: DocumentNode;
  targetDoc?: DocumentNode;
  summary?: string;
}

interface SheetDocument {
  id: string;
  name: string;
  category: string;
  sheetNumber?: string;
  discipline?: string;
  url?: string;
  summary?: string;
}



interface PlanNavigatorProps {
  projectSlug: string;
  onClose?: () => void;
}

// Discipline classification for organizing sheets
const DISCIPLINE_CONFIG: Record<string, { icon: any; color: string; patterns: string[] }> = {
  'Architectural': { icon: Building, color: 'text-blue-400', patterns: ['A-', 'A0', 'A1', 'A2', 'ARCH', 'architectural'] },
  'Structural': { icon: Layers, color: 'text-orange-400', patterns: ['S-', 'S0', 'S1', 'STRUCT', 'structural'] },
  'Electrical': { icon: Zap, color: 'text-yellow-400', patterns: ['E-', 'E0', 'E1', 'ELEC', 'electrical'] },
  'Plumbing': { icon: Droplet, color: 'text-cyan-400', patterns: ['P-', 'P0', 'P1', 'PLUMB', 'plumbing'] },
  'Mechanical': { icon: Wind, color: 'text-green-400', patterns: ['M-', 'M0', 'M1', 'MECH', 'mechanical', 'HVAC'] },
  'Fire Protection': { icon: Flame, color: 'text-red-400', patterns: ['FP-', 'FP0', 'FP1', 'FIRE'] },
  'Civil': { icon: MapPin, color: 'text-amber-400', patterns: ['C-', 'C0', 'C1', 'CIVIL', 'SITE', 'GRADING'] },
  'General': { icon: Layout, color: 'text-gray-400', patterns: ['G-', 'G0', 'COVER', 'INDEX', 'TITLE'] },
};

export function PlanNavigator({ projectSlug, onClose }: PlanNavigatorProps) {
  const { data: _session } = useSession() || {};
  const [references, setReferences] = useState<DocumentReference[]>([]);
  const [referencesByDoc, setReferencesByDoc] = useState<Record<string, DocumentReference[]>>({});
  const [nodes, setNodes] = useState<DocumentNode[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'network'>('list');
  
  // New state for enhanced features
  const [activeTab, setActiveTab] = useState<'references' | 'sheets'>('sheets');
  const [allDocuments, setAllDocuments] = useState<SheetDocument[]>([]);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set(['Architectural']));
  const [sheetSearch, setSheetSearch] = useState('');
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());
  const [sheetPreviews, setSheetPreviews] = useState<Record<string, string>>({});
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectSlug) {
      fetchCrossReferences();
      fetchAllDocuments();
    }
  }, [projectSlug]);

  const fetchCrossReferences = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/cross-references`);
      if (!response.ok) throw new Error('Failed to fetch cross-references');

      const data = await response.json();
      setReferences(data.references || []);
      setReferencesByDoc(data.referencesByDoc || {});
      // Support both graph.nodes format and flat nodes array
      const nodesData = data.graph?.nodes || data.nodes || [];
      // Normalize node format
      const normalizedNodes = nodesData.map((n: any) => ({
        id: n.id,
        name: n.name || n.label || 'Unknown',
        type: n.type || 'document',
        outgoingRefs: n.outgoingRefs ?? 0,
        incomingRefs: n.incomingRefs ?? 0
      }));
      setNodes(normalizedNodes);
      setStats(data.stats || null);

      // Auto-expand first document with references
      const firstDocWithRefs = Object.keys(data.referencesByDoc || {})[0];
      if (firstDocWithRefs) {
        setExpandedDocs(new Set([firstDocWithRefs]));
      }
    } catch (error: unknown) {
      console.error('Error fetching cross-references:', error);
      toast.error('Failed to load cross-references');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all documents for Sheet Index
  const fetchAllDocuments = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/documents`);
      if (response.ok) {
        const data = await response.json();
        const docs = (data.documents || []).map((doc: any) => {
          const category = doc.category || 'Other';
          const discipline = classifyDiscipline(doc.name, category);
          return {
            id: doc.id,
            name: doc.name,
            category,
            sheetNumber: extractSheetNumber(doc.name),
            discipline,
            url: doc.url,
            summary: generateDocumentSummary(doc.name, category, discipline),
          };
        });
        setAllDocuments(docs);
        console.log('[PlanNav] Loaded', docs.length, 'documents');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Generate summary for a cross-reference explaining why it matters
  const generateReferenceSummary = (ref: DocumentReference): string => {
    const refType = ref.referenceType?.toLowerCase() || '';
    const location = ref.location || '';
    const context = ref.context || '';
    const sourceName = ref.sourceDoc?.name || '';
    const targetName = ref.targetDoc?.name || '';
    const contextLower = context.toLowerCase();
    const _locationLower = location.toLowerCase();
    
    // Extract specific identifiers from context/location
    const detailMatch = context.match(/(?:detail|dtl|det)\s*[-#]?\s*(\d+[A-Za-z]?)/i);
    const sectionMatch = context.match(/(?:section|sect|sec)\s*[-#]?\s*([A-Za-z]?\d*)/i);
    const sheetMatch = context.match(/(?:sheet|sht|dwg)\s*[-#]?\s*([A-Za-z]*\d+\.?\d*)/i);
    const elevMatch = context.match(/(?:elevation|elev)\s*[-#]?\s*([A-Za-z]?\d*)/i);
    const noteMatch = context.match(/(?:note|n)\s*[-#]?\s*(\d+)/i);
    const specMatch = context.match(/(?:spec(?:ification)?|section)\s*[-#]?\s*(\d{2,6})/i);
    
    // Extract discipline from target document
    const getDiscipline = (name: string): string => {
      const n = name.toLowerCase();
      if (n.match(/^a[-\d]|arch|floor plan|elevation|reflected/i)) return 'Architectural';
      if (n.match(/^s[-\d]|struct|foundation|framing/i)) return 'Structural';
      if (n.match(/^m[-\d]|mech|hvac|duct/i)) return 'Mechanical';
      if (n.match(/^e[-\d]|elec|power|light/i)) return 'Electrical';
      if (n.match(/^p[-\d]|plumb|sanitary|water/i)) return 'Plumbing';
      if (n.match(/^c[-\d]|civil|site|grading/i)) return 'Civil/Site';
      if (n.match(/^l[-\d]|land|landscape/i)) return 'Landscape';
      if (n.match(/^fp|fire|sprink/i)) return 'Fire Protection';
      return '';
    };
    
    const targetDiscipline = getDiscipline(targetName);
    const sourceDiscipline = getDiscipline(sourceName);
    
    // Build specific summary based on what we can extract
    let summary = '';
    
    // Handle detail references
    if (refType.includes('detail') || detailMatch) {
      const detailNum = detailMatch?.[1] || '';
      if (detailNum) {
        summary = `References Detail ${detailNum} on "${targetName}" for enlarged construction assembly`;
        if (contextLower.includes('wall')) summary += ' at wall condition';
        else if (contextLower.includes('floor')) summary += ' at floor connection';
        else if (contextLower.includes('roof')) summary += ' at roof assembly';
        else if (contextLower.includes('window') || contextLower.includes('door')) summary += ' at opening';
        else if (contextLower.includes('foundation')) summary += ' at foundation';
      } else {
        summary = `Links to enlarged detail on "${targetName}" showing specific construction assembly`;
      }
      return summary;
    }
    
    // Handle section references
    if (refType.includes('section') || sectionMatch) {
      const sectionId = sectionMatch?.[1] || '';
      if (sectionId) {
        summary = `References Section ${sectionId} on "${targetName}" showing cut-through view`;
      } else {
        summary = `Links to building section on "${targetName}" for internal construction view`;
      }
      if (contextLower.includes('building')) summary += ' of building envelope';
      else if (contextLower.includes('wall')) summary += ' through wall assembly';
      return summary;
    }
    
    // Handle elevation references
    if (refType.includes('elevation') || elevMatch) {
      const elevId = elevMatch?.[1] || '';
      if (elevId) {
        summary = `References Elevation ${elevId} on "${targetName}" for vertical coordination`;
      } else {
        summary = `Links to elevation view on "${targetName}" showing facade/height relationships`;
      }
      if (contextLower.includes('exterior')) summary += ' (exterior)';
      else if (contextLower.includes('interior')) summary += ' (interior)';
      return summary;
    }
    
    // Handle schedule references
    if (refType.includes('schedule') || contextLower.includes('schedule')) {
      if (contextLower.includes('door')) summary = `References door schedule on "${targetName}" for hardware and sizing specifications`;
      else if (contextLower.includes('window')) summary = `References window schedule on "${targetName}" for glazing and frame specifications`;
      else if (contextLower.includes('finish')) summary = `References finish schedule on "${targetName}" for material and color selections`;
      else if (contextLower.includes('equipment')) summary = `References equipment schedule on "${targetName}" for mechanical specifications`;
      else summary = `Links to specification schedule on "${targetName}" for component data`;
      return summary;
    }
    
    // Handle specification references
    if (specMatch) {
      const specNum = specMatch[1];
      summary = `References Specification Section ${specNum} for technical requirements and material standards`;
      return summary;
    }
    
    // Handle note references
    if (refType.includes('note') || noteMatch) {
      const noteNum = noteMatch?.[1] || '';
      if (noteNum) {
        summary = `References Note ${noteNum} for specific construction requirements or clarifications`;
      } else {
        summary = `Links to general notes for construction standards and requirements`;
      }
      return summary;
    }
    
    // Handle sheet references
    if (sheetMatch) {
      const sheetNum = sheetMatch[1];
      summary = `Directs to Sheet ${sheetNum} ("${targetName}")`;
      if (targetDiscipline) summary += ` for ${targetDiscipline} coordination`;
      return summary;
    }
    
    // Cross-discipline coordination
    if (targetDiscipline && sourceDiscipline && targetDiscipline !== sourceDiscipline) {
      summary = `${sourceDiscipline} to ${targetDiscipline} coordination reference - `;
      if (targetDiscipline === 'Structural') summary += 'verify structural elements, connections, and load paths';
      else if (targetDiscipline === 'Mechanical') summary += 'coordinate HVAC systems, ductwork, and equipment clearances';
      else if (targetDiscipline === 'Electrical') summary += 'verify electrical routing, panel locations, and connections';
      else if (targetDiscipline === 'Plumbing') summary += 'coordinate pipe routing, fixture locations, and drain points';
      else if (targetDiscipline === 'Civil/Site') summary += 'verify site conditions, utilities, and grading';
      else summary += `verify ${targetDiscipline.toLowerCase()} coordination`;
      return summary;
    }
    
    // Context-based specific summaries
    if (contextLower.includes('see') && targetName) {
      summary = `Directs viewer to "${targetName}" for additional information`;
      if (contextLower.includes('typ')) summary += ' (typical condition at multiple locations)';
      return summary;
    }
    
    if (contextLower.includes('verify') || contextLower.includes('confirm')) {
      summary = `Field verification required - refer to "${targetName}" before proceeding`;
      return summary;
    }
    
    if (contextLower.includes('match') || contextLower.includes('align')) {
      summary = `Alignment/matching requirement - see "${targetName}" for coordination`;
      return summary;
    }
    
    if (contextLower.includes('coordinate') || contextLower.includes('coord')) {
      summary = `Trade coordination required with "${targetName}"`;
      if (targetDiscipline) summary += ` (${targetDiscipline})`;
      return summary;
    }
    
    // Fallback with document names
    if (targetName && sourceName) {
      summary = `Cross-reference from "${sourceName}" to "${targetName}"`;
      if (targetDiscipline) summary += ` for ${targetDiscipline.toLowerCase()} coordination`;
      else summary += ' for construction coordination';
      return summary;
    }
    
    // Generic fallback
    return 'Cross-reference for construction coordination - click to view related documents';
  };

  // Toggle reference expansion and load preview
  const toggleRefExpansion = async (refKey: string, sourceDocId: string, targetDocId: string) => {
    const newExpanded = new Set(expandedRefs);
    if (newExpanded.has(refKey)) {
      newExpanded.delete(refKey);
    } else {
      newExpanded.add(refKey);
      // Load previews for both documents if not already loaded
      await loadSheetPreview(sourceDocId);
      await loadSheetPreview(targetDocId);
    }
    setExpandedRefs(newExpanded);
  };

  // Load sheet preview image
  const loadSheetPreview = async (docId: string) => {
    if (sheetPreviews[docId] || loadingPreviews.has(docId)) return;
    
    setLoadingPreviews(prev => new Set(prev).add(docId));
    
    try {
      // Try to get document thumbnail or first page preview
      const response = await fetch(`/api/documents/${docId}/metadata`);
      if (response.ok) {
        const data = await response.json();
        if (data.thumbnailUrl || data.previewUrl) {
          setSheetPreviews(prev => ({
            ...prev,
            [docId]: data.thumbnailUrl || data.previewUrl
          }));
        }
      }
    } catch (error) {
      console.error('Error loading sheet preview:', error);
    } finally {
      setLoadingPreviews(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  // Extract sheet number from document name (e.g., "A101 - Floor Plan" -> "A101")
  const extractSheetNumber = (name: string): string | undefined => {
    const match = name.match(/^([A-Z]{1,3}[-]?\d{2,4})/i);
    return match ? match[1].toUpperCase() : undefined;
  };

  // Classify document into discipline based on name/category
  const classifyDiscipline = (name: string, category: string): string => {
    const searchText = `${name} ${category}`.toUpperCase();
    for (const [discipline, config] of Object.entries(DISCIPLINE_CONFIG)) {
      if (config.patterns.some(p => searchText.includes(p.toUpperCase()))) {
        return discipline;
      }
    }
    return 'Other';
  };

  // Generate intelligent summary for a document based on its type, name, and category
  const generateDocumentSummary = (name: string, category: string, discipline: string): string => {
    const lowerName = name.toLowerCase();
    const lowerCategory = category.toLowerCase();
    
    // Category-specific summaries
    const categoryDescriptions: Record<string, string> = {
      'plans_drawings': 'Construction drawing showing design intent and specifications',
      'budget_cost': 'Financial document for cost tracking and budget management',
      'schedule': 'Project timeline with task sequencing and milestones',
      'specifications': 'Technical requirements and material standards',
      'contracts': 'Legal agreements, project contracts, RFIs, and submittals',
      'daily_reports': 'Project status reports and daily documentation',
      'photos': 'Field photos and visual documentation',
      'other': 'Miscellaneous project documents',
    };
    
    // Discipline-specific content descriptions
    const disciplineContent: Record<string, string> = {
      'Architectural': 'building layout, dimensions, and finishes',
      'Structural': 'load-bearing elements, foundations, and framing',
      'Electrical': 'power distribution, lighting, and systems',
      'Plumbing': 'water supply, drainage, and fixtures',
      'Mechanical': 'HVAC systems, ventilation, and equipment',
      'Fire Protection': 'fire suppression systems and egress',
      'Civil': 'site grading, utilities, and drainage',
      'General': 'cover sheets, legends, and general notes',
    };
    
    // Name-based keywords for more specific summaries
    const nameKeywords: Record<string, string> = {
      'floor plan': 'Room layout and spatial organization',
      'elevation': 'Vertical views showing exterior/interior heights',
      'section': 'Cut-through view revealing internal construction',
      'detail': 'Enlarged view of specific construction assembly',
      'schedule': 'Tabular listing of components and specifications',
      'diagram': 'Schematic showing system connections',
      'site': 'Property boundaries, grading, and site features',
      'foundation': 'Below-grade structural support systems',
      'roof': 'Roofing materials and drainage',
      'reflected ceiling': 'Ceiling layout with lighting and MEP',
      'partition': 'Wall types and locations',
      'door': 'Door sizes, types, and hardware',
      'window': 'Window sizes, types, and glazing',
      'finish': 'Interior finishes and materials',
      'demolition': 'Elements to be removed or modified',
      'grading': 'Site elevations and earthwork',
      'utility': 'Underground services and connections',
      'landscape': 'Planting and hardscape design',
      'conformance': 'Compliance verification documents',
      'budget': 'Cost breakdown and financial tracking',
      'lookahead': 'Short-term schedule planning',
      'critical path': 'Key milestone sequencing',
    };
    
    // Check for specific name keywords first
    for (const [keyword, description] of Object.entries(nameKeywords)) {
      if (lowerName.includes(keyword)) {
        return description;
      }
    }
    
    // Check category for description
    for (const [cat, description] of Object.entries(categoryDescriptions)) {
      if (lowerCategory.includes(cat.replace('_', ' ')) || lowerCategory.includes(cat)) {
        // Add discipline context if available
        if (discipline !== 'Other' && disciplineContent[discipline]) {
          return `${description} - ${disciplineContent[discipline]}`;
        }
        return description;
      }
    }
    
    // Fallback to discipline-based description
    if (discipline !== 'Other' && disciplineContent[discipline]) {
      return `Drawing showing ${disciplineContent[discipline]}`;
    }
    
    // Generic fallback
    return 'Project documentation for reference';
  };

  // Group documents by discipline
  const getDocumentsByDiscipline = (): Record<string, SheetDocument[]> => {
    const groups: Record<string, SheetDocument[]> = {};
    
    allDocuments
      .filter(doc => {
        if (!sheetSearch) return true;
        const query = sheetSearch.toLowerCase();
        return doc.name.toLowerCase().includes(query) ||
               doc.sheetNumber?.toLowerCase().includes(query) ||
               doc.discipline?.toLowerCase().includes(query);
      })
      .forEach(doc => {
        const discipline = doc.discipline || 'Other';
        if (!groups[discipline]) groups[discipline] = [];
        groups[discipline].push(doc);
      });
    
    // Sort documents within each group by sheet number
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (a.sheetNumber && b.sheetNumber) {
          return a.sheetNumber.localeCompare(b.sheetNumber);
        }
        return a.name.localeCompare(b.name);
      });
    });
    
    return groups;
  };

  const toggleDiscipline = (discipline: string) => {
    const newExpanded = new Set(expandedDisciplines);
    if (newExpanded.has(discipline)) {
      newExpanded.delete(discipline);
    } else {
      newExpanded.add(discipline);
    }
    setExpandedDisciplines(newExpanded);
  };

  const handleExtractCrossReferences = async () => {
    try {
      setExtracting(true);
      toast.loading('Extracting cross-references from documents...', { id: 'extract-refs' });
      
      const response = await fetch(`/api/projects/${projectSlug}/cross-references/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Extraction failed');
      const data = await response.json();

      toast.dismiss('extract-refs');
      
      if (data.success) {
        toast.success(
          `Extracted ${data.summary?.totalCallouts || 0} cross-references from ${data.summary?.documentsWithRefs || 0} documents`,
          { duration: 5000 }
        );
        
        // Refresh the cross-references display
        await fetchCrossReferences();
      } else {
        toast.error(data.message || 'Extraction failed');
      }
    } catch (error) {
      console.error('Error extracting cross-references:', error);
      toast.dismiss('extract-refs');
      toast.error('Failed to extract cross-references');
    } finally {
      setExtracting(false);
    }
  };

  const toggleDoc = (docId: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      newExpanded.add(docId);
    }
    setExpandedDocs(newExpanded);
  };

  const getFilteredReferences = (): DocumentReference[] => {
    return references.filter((ref) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          ref.context.toLowerCase().includes(query) ||
          ref.sourceDoc?.name.toLowerCase().includes(query) ||
          ref.targetDoc?.name.toLowerCase().includes(query) ||
          ref.location.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Document filter
      if (selectedDoc !== 'all') {
        if (ref.sourceDocumentId !== selectedDoc && ref.targetDocumentId !== selectedDoc) {
          return false;
        }
      }

      // Type filter
      if (filterType !== 'all' && ref.referenceType !== filterType) {
        return false;
      }

      return true;
    });
  };

  const getReferenceTypeIcon = (type: string) => {
    switch (type) {
      case 'sheet_reference':
        return <FileText className="h-4 w-4 text-blue-400" />;
      case 'detail_callout':
        return <Target className="h-4 w-4 text-orange-400" />;
      case 'spec_reference':
        return <Layers className="h-4 w-4 text-purple-400" />;
      default:
        return <Link2 className="h-4 w-4 text-gray-400" />;
    }
  };

  const getReferenceTypeBadge = (type: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      sheet_reference: { color: 'bg-blue-500/20 text-blue-400 border-blue-700', label: 'Sheet Ref' },
      detail_callout: { color: 'bg-orange-500/20 text-orange-400 border-orange-700', label: 'Detail' },
      spec_reference: { color: 'bg-purple-500/20 text-purple-400 border-purple-700', label: 'Spec' }
    };

    const variant = variants[type] || { color: 'bg-gray-500/20 text-gray-400 border-gray-700', label: 'Reference' };
    return (
      <Badge variant="outline" className={`text-xs ${variant.color}`}>
        {variant.label}
      </Badge>
    );
  };

  const handleJumpToDocument = async (docId: string, docName: string) => {
    // Try to open the document in a new tab or trigger download
    try {
      const response = await fetch(`/api/documents/${docId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.open(data.url, '_blank');
          toast.success(`Opened ${docName}`);
        } else {
          toast.info(`${docName}`, { description: 'Document preview not available' });
        }
      } else {
        toast.error(`Could not open ${docName}`);
      }
    } catch (error) {
      console.error('Error opening document:', error);
      toast.error(`Failed to open ${docName}`);
    }
  };

  const exportToCSV = () => {
    const filtered = getFilteredReferences();
    
    // CSV Header
    const header = [
      'Source Document',
      'Target Document',
      'Reference Type',
      'Location',
      'Context'
    ].join(',');

    // CSV Rows
    const rows = filtered.map(ref => [
      `"${ref.sourceDoc?.name || 'Unknown'}"`,
      `"${ref.targetDoc?.name || 'Unknown'}"`,
      ref.referenceType,
      `"${ref.location}"`,
      `"${ref.context}"`
    ].join(','));

    const csv = [header, ...rows].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CrossReferences_${projectSlug}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('Exported to CSV');
  };

  const filteredRefs = getFilteredReferences();

  const documentsByDiscipline = getDocumentsByDiscipline();
  const disciplineOrder = ['General', 'Architectural', 'Structural', 'Civil', 'Electrical', 'Plumbing', 'Mechanical', 'Fire Protection', 'Other'];

  return (
    <div className="flex flex-col bg-dark-surface text-slate-50" style={{ height: '80vh', maxHeight: '800px' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-blue-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Plan Navigator</h2>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'references' && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleExtractCrossReferences}
                disabled={extracting || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${extracting ? 'animate-spin' : ''}`} />
                {extracting ? 'Extracting...' : 'Extract References'}
              </Button>
              <WithTooltip tooltip="Export references to CSV file">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  disabled={filteredRefs.length === 0}
                  className="border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </WithTooltip>
            </>
          )}
          {onClose && (
            <WithTooltip tooltip="Close panel">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </WithTooltip>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-gray-700">
        <div className="flex">
          <WithTooltip tooltip="Browse all plan sheets by discipline">
            <button
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sheets'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-card'
              }`}
            >
              <FileStack className="h-4 w-4" />
              Sheet Index
              <Badge variant="secondary" className="text-xs">{allDocuments.length}</Badge>
            </button>
          </WithTooltip>
          <WithTooltip tooltip="View document cross-references and links">
            <button
              onClick={() => setActiveTab('references')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'references'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-card'
              }`}
            >
              <Link2 className="h-4 w-4" />
              Cross-References
              <Badge variant="secondary" className="text-xs">{stats?.totalReferences || 0}</Badge>
            </button>
          </WithTooltip>
        </div>
      </div>

      {/* Tab-specific Search/Filters */}
      {activeTab === 'sheets' && (
        <div className="flex-shrink-0 p-4 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by sheet number (A101), name, or discipline..."
              value={sheetSearch}
              onChange={(e) => setSheetSearch(e.target.value)}
              className="bg-dark-card border-gray-600 pl-10 text-slate-50 placeholder:text-gray-400"
            />
          </div>
          {/* Quick Stats */}
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
            {Object.entries(documentsByDiscipline).map(([discipline, docs]) => (
              <span key={discipline} className="flex items-center gap-1">
                {DISCIPLINE_CONFIG[discipline] && (
                  <span className={DISCIPLINE_CONFIG[discipline].color}>
                    {docs.length}
                  </span>
                )}
                <span>{discipline}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'references' && (
        <div className="flex-shrink-0 space-y-3 border-b border-gray-700 p-4">
          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 pb-3 border-b border-gray-700">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-500">{stats.totalReferences}</div>
                <div className="text-xs text-gray-400">Cross-References</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-500">{stats.totalDocuments}</div>
                <div className="text-xs text-gray-400">Documents</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-500">
                  {stats.avgRefsPerDoc?.toFixed(1) || '0'}
                </div>
                <div className="text-xs text-gray-400">Avg Refs/Doc</div>
              </div>
            </div>
          )}

          {/* View Mode */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-blue-500 hover:bg-blue-600' : 'border-gray-600 text-gray-300 hover:bg-dark-card'}
            >
              List View
            </Button>
            <Button
              variant={viewMode === 'network' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('network')}
              className={viewMode === 'network' ? 'bg-blue-500 hover:bg-blue-600' : 'border-gray-600 text-gray-300 hover:bg-dark-card'}
            >
              Network View
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search references, documents, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-dark-card border-gray-600 pl-10 text-slate-50 placeholder:text-gray-400"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={selectedDoc} onValueChange={setSelectedDoc}>
              <SelectTrigger className="flex-1 bg-dark-card border-gray-600 text-slate-50">
                <SelectValue placeholder="All Documents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                {nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name} ({node.outgoingRefs + node.incomingRefs} refs)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="flex-1 bg-dark-card border-gray-600 text-slate-50">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sheet_reference">Sheet References</SelectItem>
                <SelectItem value="detail_callout">Detail Callouts</SelectItem>
                <SelectItem value="spec_reference">Spec References</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(searchQuery || selectedDoc !== 'all' || filterType !== 'all') && (
            <WithTooltip tooltip="Reset all filters">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDoc('all');
                  setFilterType('all');
                }}
                className="w-full text-blue-500 hover:text-blue-400 hover:bg-dark-card"
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </WithTooltip>
          )}
        </div>
      )}

      {/* Content - Scrollable Area */}
      <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
        {loading && activeTab === 'references' ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="animate-spin text-orange-500 h-8 w-8 mb-2 inline-block" />
              <p className="text-sm text-gray-400">Loading cross-references...</p>
            </div>
          </div>
        ) : activeTab === 'sheets' ? (
          /* ========== SHEET INDEX TAB ========== */
          <div className="p-4 space-y-2">
            {Object.keys(documentsByDiscipline).length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <FileStack className="mx-auto mb-3 h-12 w-12 text-gray-600" />
                  <p className="text-sm text-gray-400">
                    {sheetSearch ? 'No sheets match your search' : 'No documents found'}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">Upload documents to see them organized here</p>
                </div>
              </div>
            ) : (
              disciplineOrder
                .filter(d => documentsByDiscipline[d]?.length > 0)
                .map((discipline) => {
                  const docs = documentsByDiscipline[discipline];
                  const config = DISCIPLINE_CONFIG[discipline] || { icon: FileText, color: 'text-gray-400', patterns: [] };
                  const Icon = config.icon;
                  
                  return (
                    <div key={discipline}>
                      {/* Discipline Header */}
                      <button
                        onClick={() => toggleDiscipline(discipline)}
                        className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-dark-hover transition-colors"
                      >
                        {expandedDisciplines.has(discipline) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="flex-1 font-medium text-slate-50">{discipline}</span>
                        <Badge variant="secondary" className="text-xs">
                          {docs.length} sheets
                        </Badge>
                      </button>

                      {/* Sheets in Discipline */}
                      {expandedDisciplines.has(discipline) && (
                        <div className="ml-6 mt-1 space-y-1">
                          {docs.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => handleJumpToDocument(doc.id, doc.name)}
                              className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-dark-surface p-3 text-left hover:border-blue-500 hover:bg-dark-card transition-all group"
                            >
                              {/* Sheet Number */}
                              {doc.sheetNumber ? (
                                <div className="flex-shrink-0 w-16 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-center">
                                  <span className="text-sm font-mono font-medium text-blue-400">{doc.sheetNumber}</span>
                                </div>
                              ) : (
                                <div className="flex-shrink-0 w-16 px-2 py-1 bg-gray-500/20 border border-gray-500/30 rounded text-center">
                                  <Hash className="h-4 w-4 text-gray-400 mx-auto" />
                                </div>
                              )}
                              
                              {/* Sheet Name & Summary */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-50 truncate">{doc.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{doc.summary}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{doc.category}</p>
                              </div>
                              
                              {/* View Icon */}
                              <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
            {/* Show "Other" discipline last if it has documents */}
            {documentsByDiscipline['Other']?.length > 0 && !disciplineOrder.includes('Other') && (
              <div>
                <button
                  onClick={() => toggleDiscipline('Other')}
                  className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-dark-hover transition-colors"
                >
                  {expandedDisciplines.has('Other') ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <FolderOpen className="h-4 w-4 text-gray-400" />
                  <span className="flex-1 font-medium text-slate-50">Other Documents</span>
                  <Badge variant="secondary" className="text-xs">
                    {documentsByDiscipline['Other'].length}
                  </Badge>
                </button>
                {expandedDisciplines.has('Other') && (
                  <div className="ml-6 mt-1 space-y-1">
                    {documentsByDiscipline['Other'].map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleJumpToDocument(doc.id, doc.name)}
                        className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-dark-surface p-3 text-left hover:border-blue-500 hover:bg-dark-card transition-all group"
                      >
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-50 truncate">{doc.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{doc.summary}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{doc.category}</p>
                        </div>
                        <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : filteredRefs.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Map className="mx-auto mb-3 h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">
                {searchQuery || selectedDoc !== 'all' || filterType !== 'all'
                  ? 'No references match your filters'
                  : 'No cross-references found'}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {Object.keys(referencesByDoc).length === 0
                  ? 'Process documents to extract cross-references'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          </div>
        ) : viewMode === 'network' ? (
          // Network View (Document-centric)
          <div className="p-4 space-y-2">
            {nodes
              .filter(node => {
                const hasRefs = (node.outgoingRefs + node.incomingRefs) > 0;
                if (!hasRefs) return false;
                if (selectedDoc !== 'all' && node.id !== selectedDoc) return false;
                return true;
              })
              .sort((a, b) => (b.outgoingRefs + b.incomingRefs) - (a.outgoingRefs + a.incomingRefs))
              .map((node) => {
                const docRefs = referencesByDoc[node.id] || [];
                const filteredDocRefs = docRefs.filter((ref: any) => {
                  if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    return ref.context.toLowerCase().includes(query) ||
                           ref.location.toLowerCase().includes(query);
                  }
                  if (filterType !== 'all' && ref.referenceType !== filterType) {
                    return false;
                  }
                  return true;
                });

                if (filteredDocRefs.length === 0 && (searchQuery || filterType !== 'all')) {
                  return null;
                }

                return (
                  <div key={node.id}>
                    {/* Document Header */}
                    <button
                      onClick={() => toggleDoc(node.id)}
                      className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-dark-hover transition-colors"
                    >
                      {expandedDocs.has(node.id) ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="flex-1 font-medium text-slate-50">{node.name}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary" className="text-green-400">
                          {node.outgoingRefs} out
                        </Badge>
                        <Badge variant="secondary" className="text-orange-400">
                          {node.incomingRefs} in
                        </Badge>
                      </div>
                    </button>

                    {/* Document References */}
                    {expandedDocs.has(node.id) && filteredDocRefs.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1">
                        {filteredDocRefs.map((ref: any, idx: number) => {
                          const summary = generateReferenceSummary(ref);
                          return (
                            <div
                              key={`${ref.sourceDocumentId}-${ref.targetDocumentId}-${idx}`}
                              className="flex items-start gap-3 rounded-lg border border-gray-700 bg-dark-surface p-3 text-sm hover:border-blue-500 transition-all"
                            >
                              {/* Reference Icon */}
                              <div className="mt-1">
                                {getReferenceTypeIcon(ref.referenceType)}
                              </div>

                              {/* Reference Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-gray-400">{ref.location}</span>
                                  {getReferenceTypeBadge(ref.referenceType)}
                                </div>
                                
                                {/* Summary */}
                                <p className="text-xs text-gray-400 mb-1">{summary}</p>

                                <p className="text-xs text-gray-400 mb-2 italic">"{ref.context}"</p>

                                {/* Target Document */}
                                <button
                                  onClick={() => handleJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown')}
                                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  <ArrowRight className="h-3 w-3" />
                                  <span>{ref.targetDoc?.name || 'Unknown Document'}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          // List View (Flat list of all references with summaries and expandable previews)
          <div className="p-4 space-y-3">
            {filteredRefs.map((ref, idx) => {
              const refKey = `${ref.sourceDocumentId}-${ref.targetDocumentId}-${idx}`;
              const isExpanded = expandedRefs.has(refKey);
              const summary = generateReferenceSummary(ref);
              
              return (
                <div
                  key={refKey}
                  className="rounded-lg border border-gray-700 bg-dark-card overflow-hidden hover:border-blue-500 transition-all"
                >
                  {/* Reference Header - Clickable to expand */}
                  <button
                    onClick={() => toggleRefExpansion(refKey, ref.sourceDocumentId, ref.targetDocumentId)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-dark-surface border-b border-gray-700 hover:bg-dark-hover transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      <Link2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getReferenceTypeBadge(ref.referenceType)}
                          <span className="text-sm font-medium text-gray-200">{ref.location}</span>
                        </div>
                        {/* Summary - Always visible */}
                        <p className="text-xs text-gray-400 mt-1">{summary}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">#{idx + 1}</span>
                  </button>
                  
                  {/* Reference Body - Always show basic info */}
                  <div className="p-4">
                    {/* Context/Description */}
                    <p className="text-sm text-gray-300 mb-4 leading-relaxed italic">"{ref.context}"</p>

                    {/* Document Flow - Source to Target */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
                      {/* Source Document */}
                      <WithTooltip tooltip="View source document">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleJumpToDocument(ref.sourceDocumentId, ref.sourceDoc?.name || 'Unknown'); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors w-full sm:w-auto"
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm font-medium">{ref.sourceDoc?.name || 'Source'}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                        </button>
                      </WithTooltip>

                      <ArrowRight className="hidden sm:block h-5 w-5 text-gray-400 flex-shrink-0" />
                      <span className="sm:hidden text-xs text-gray-400 ml-2">↓ references</span>

                      {/* Target Document */}
                      <WithTooltip tooltip="View target document">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown'); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300 transition-colors w-full sm:w-auto"
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm font-medium">{ref.targetDoc?.name || 'Target'}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                        </button>
                      </WithTooltip>
                    </div>
                    
                    {/* Expanded Section - Sheet Previews */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="text-xs text-gray-400 mb-3 flex items-center gap-2">
                          <Eye className="h-3 w-3" />
                          Sheet Previews
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Source Sheet Preview */}
                          <div className="border border-gray-600 rounded-lg overflow-hidden bg-dark-surface">
                            <div className="px-3 py-2 bg-blue-500/10 border-b border-gray-600">
                              <span className="text-xs font-medium text-blue-400">Source: {ref.sourceDoc?.name || 'Unknown'}</span>
                            </div>
                            <div className="p-3">
                              {loadingPreviews.has(ref.sourceDocumentId) ? (
                                <div className="h-32 flex items-center justify-center">
                                  <Loader2 className="animate-spin text-orange-500 h-6 w-6" />
                                </div>
                              ) : sheetPreviews[ref.sourceDocumentId] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={sheetPreviews[ref.sourceDocumentId]}
                                  alt={`Preview of ${ref.sourceDoc?.name}`}
                                  className="w-full h-32 object-contain bg-white/5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handleJumpToDocument(ref.sourceDocumentId, ref.sourceDoc?.name || 'Unknown')}
                                />
                              ) : (
                                <div 
                                  className="h-32 flex flex-col items-center justify-center text-gray-400 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                                  onClick={() => handleJumpToDocument(ref.sourceDocumentId, ref.sourceDoc?.name || 'Unknown')}
                                >
                                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                                  <span className="text-xs">Click to view document</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Target Sheet Preview */}
                          <div className="border border-gray-600 rounded-lg overflow-hidden bg-dark-surface">
                            <div className="px-3 py-2 bg-green-500/10 border-b border-gray-600">
                              <span className="text-xs font-medium text-green-400">Target: {ref.targetDoc?.name || 'Unknown'}</span>
                            </div>
                            <div className="p-3">
                              {loadingPreviews.has(ref.targetDocumentId) ? (
                                <div className="h-32 flex items-center justify-center">
                                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-r-transparent" />
                                </div>
                              ) : sheetPreviews[ref.targetDocumentId] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={sheetPreviews[ref.targetDocumentId]}
                                  alt={`Preview of ${ref.targetDoc?.name}`}
                                  className="w-full h-32 object-contain bg-white/5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handleJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown')}
                                />
                              ) : (
                                <div 
                                  className="h-32 flex flex-col items-center justify-center text-gray-400 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                                  onClick={() => handleJumpToDocument(ref.targetDocumentId, ref.targetDoc?.name || 'Unknown')}
                                >
                                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                                  <span className="text-xs">Click to view document</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
