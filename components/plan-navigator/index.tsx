'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Map,
  Search,
  X,
  Download,
  RefreshCw,
  FileStack,
  Link2,
  Loader2,
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

import { DocumentNode, DocumentReference, SheetDocument } from './types';
import { DISCIPLINE_CONFIG, classifyDiscipline, extractSheetNumber, generateDocumentSummary, generateReferenceSummary } from './discipline-utils';
import { SheetIndexTab } from './sheet-index-tab';
import { ReferenceListTab } from './reference-list-tab';
import { ReferenceNetworkTab } from './reference-network-tab';

interface PlanNavigatorProps {
  projectSlug: string;
  onClose?: () => void;
}

const DISCIPLINE_ORDER = ['General', 'Architectural', 'Structural', 'Civil', 'Electrical', 'Plumbing', 'Mechanical', 'Fire Protection', 'Other'];

export function PlanNavigator({ projectSlug, onClose }: PlanNavigatorProps) {
  const { data: _session } = useSession() || {};

  // ── State ──────────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<'references' | 'sheets'>('sheets');
  const [allDocuments, setAllDocuments] = useState<SheetDocument[]>([]);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set(['Architectural']));
  const [sheetSearch, setSheetSearch] = useState('');
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());
  const [sheetPreviews, setSheetPreviews] = useState<Record<string, string>>({});
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (projectSlug) {
      fetchCrossReferences();
      fetchAllDocuments();
    }
  }, [projectSlug]);

  // ── Fetch handlers ─────────────────────────────────────────────────────────
  const fetchCrossReferences = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/cross-references`);
      if (!response.ok) throw new Error('Failed to fetch cross-references');

      const data = await response.json();
      setReferences(data.references || []);
      setReferencesByDoc(data.referencesByDoc || {});
      const nodesData = data.graph?.nodes || data.nodes || [];
      const normalizedNodes = nodesData.map((n: any) => ({
        id: n.id,
        name: n.name || n.label || 'Unknown',
        type: n.type || 'document',
        outgoingRefs: n.outgoingRefs ?? 0,
        incomingRefs: n.incomingRefs ?? 0,
      }));
      setNodes(normalizedNodes);
      setStats(data.stats || null);

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

  // ── Interaction handlers ───────────────────────────────────────────────────
  const toggleRefExpansion = useCallback(async (refKey: string, sourceDocId: string, targetDocId: string) => {
    const wasExpanded = expandedRefs.has(refKey);
    setExpandedRefs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(refKey)) {
        newSet.delete(refKey);
      } else {
        newSet.add(refKey);
      }
      return newSet;
    });
    if (!wasExpanded) {
      await loadSheetPreview(sourceDocId);
      await loadSheetPreview(targetDocId);
    }
  }, [expandedRefs]);

  const loadSheetPreview = async (docId: string) => {
    if (sheetPreviews[docId] || loadingPreviews.has(docId)) return;

    setLoadingPreviews(prev => new Set(prev).add(docId));

    try {
      const response = await fetch(`/api/documents/${docId}/metadata`);
      if (response.ok) {
        const data = await response.json();
        if (data.thumbnailUrl || data.previewUrl) {
          setSheetPreviews(prev => ({
            ...prev,
            [docId]: data.thumbnailUrl || data.previewUrl,
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

  const toggleDiscipline = useCallback((discipline: string) => {
    setExpandedDisciplines((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(discipline)) newSet.delete(discipline);
      else newSet.add(discipline);
      return newSet;
    });
  }, []);

  const handleExtractCrossReferences = useCallback(async () => {
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
          { duration: 5000 },
        );
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
  }, [projectSlug]);

  const toggleDoc = useCallback((docId: string) => {
    setExpandedDocs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) newSet.delete(docId);
      else newSet.add(docId);
      return newSet;
    });
  }, []);

  const handleJumpToDocument = useCallback(async (docId: string, docName: string) => {
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
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const filteredRefs = useMemo(() => {
    return references.filter((ref) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ref.context.toLowerCase().includes(query) ||
          ref.sourceDoc?.name.toLowerCase().includes(query) ||
          ref.targetDoc?.name.toLowerCase().includes(query) ||
          ref.location.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (selectedDoc !== 'all') {
        if (ref.sourceDocumentId !== selectedDoc && ref.targetDocumentId !== selectedDoc) return false;
      }
      if (filterType !== 'all' && ref.referenceType !== filterType) return false;
      return true;
    });
  }, [references, searchQuery, selectedDoc, filterType]);

  const documentsByDiscipline = useMemo(() => {
    const groups: Record<string, SheetDocument[]> = {};

    allDocuments
      .filter(doc => {
        if (!sheetSearch) return true;
        const query = sheetSearch.toLowerCase();
        return (
          doc.name.toLowerCase().includes(query) ||
          doc.sheetNumber?.toLowerCase().includes(query) ||
          doc.discipline?.toLowerCase().includes(query)
        );
      })
      .forEach(doc => {
        const discipline = doc.discipline || 'Other';
        if (!groups[discipline]) groups[discipline] = [];
        groups[discipline].push(doc);
      });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (a.sheetNumber && b.sheetNumber) return a.sheetNumber.localeCompare(b.sheetNumber);
        return a.name.localeCompare(b.name);
      });
    });

    return groups;
  }, [allDocuments, sheetSearch]);

  const exportToCSV = useCallback(() => {
    const header = ['Source Document', 'Target Document', 'Reference Type', 'Location', 'Context'].join(',');
    const rows = filteredRefs.map(ref => [
      `"${ref.sourceDoc?.name || 'Unknown'}"`,
      `"${ref.targetDoc?.name || 'Unknown'}"`,
      ref.referenceType,
      `"${ref.location}"`,
      `"${ref.context}"`,
    ].join(','));

    const csv = [header, ...rows].join('\n');
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
  }, [filteredRefs, projectSlug]);

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <SheetIndexTab
            documentsByDiscipline={documentsByDiscipline}
            disciplineOrder={DISCIPLINE_ORDER}
            expandedDisciplines={expandedDisciplines}
            sheetSearch={sheetSearch}
            onToggleDiscipline={toggleDiscipline}
            onJumpToDocument={handleJumpToDocument}
          />
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
          <ReferenceNetworkTab
            nodes={nodes}
            referencesByDoc={referencesByDoc}
            expandedDocs={expandedDocs}
            searchQuery={searchQuery}
            filterType={filterType}
            selectedDoc={selectedDoc}
            onToggleDoc={toggleDoc}
            onJumpToDocument={handleJumpToDocument}
            generateReferenceSummary={generateReferenceSummary}
          />
        ) : (
          // List View — delegated to ReferenceListTab
          <ReferenceListTab
            filteredRefs={filteredRefs}
            expandedRefs={expandedRefs}
            sheetPreviews={sheetPreviews}
            loadingPreviews={loadingPreviews}
            onToggleRefExpansion={toggleRefExpansion}
            onJumpToDocument={handleJumpToDocument}
            generateReferenceSummary={generateReferenceSummary}
          />
        )}
      </ScrollArea>
    </div>
  );
}
