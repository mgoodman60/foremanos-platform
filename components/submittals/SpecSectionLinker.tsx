/**
 * Spec Section Linker Component
 * Displays and manages specification section references for submittals
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Book,
  FileText,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  X,
  ExternalLink,
  Loader2,
  Library,
} from 'lucide-react';
import { toast } from 'sonner';
import { CSI_DIVISIONS, parseSpecSection } from '@/lib/spec-section-service';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface SpecReference {
  id: string;
  specSection: string;
  sectionTitle: string;
  divisionNumber: string;
  divisionTitle: string;
  documentId?: string;
  documentName?: string;
}

interface SpecSectionLinkerProps {
  projectSlug: string;
  submittalId: string;
  currentSpecSection?: string | null;
  tradeCategory?: string;
  onSpecSectionChange?: (section: string | null) => void;
  compact?: boolean;
}

export default function SpecSectionLinker({
  projectSlug,
  submittalId,
  currentSpecSection,
  tradeCategory,
  onSpecSectionChange,
  compact = false,
}: SpecSectionLinkerProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [relatedSpecs, setRelatedSpecs] = useState<SpecReference[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<{ id: string; name: string; pages: number[] }[]>([]);

  // Parse current spec section
  const currentParsed = useMemo(() => {
    if (!currentSpecSection) return null;
    return parseSpecSection(currentSpecSection);
  }, [currentSpecSection]);

  // Fetch related spec sections and documents
  useEffect(() => {
    if (expanded && submittalId) {
      fetchSpecData();
    }
  }, [expanded, submittalId]);

  const fetchSpecData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/mep/submittals/${submittalId}/spec-sections`
      );
      if (res.ok) {
        const data = await res.json();
        setRelatedSpecs(data.specSections || []);
        setLinkedDocuments(data.linkedDocuments || []);
      }
    } catch (e) {
      console.error('Failed to fetch spec data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSpecSection = async (section: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/mep/submittals/${submittalId}/spec-sections`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ specSection: section }),
        }
      );

      if (res.ok) {
        onSpecSectionChange?.(section);
        setShowPicker(false);
        toast.success('Spec section updated');
        fetchSpecData();
      } else {
        toast.error('Failed to update spec section');
      }
    } catch (e) {
      toast.error('Failed to update spec section');
    }
  };

  const handleClearSpecSection = async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/mep/submittals/${submittalId}/spec-sections`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ specSection: null }),
        }
      );

      if (res.ok) {
        onSpecSectionChange?.(null);
        toast.success('Spec section cleared');
        fetchSpecData();
      }
    } catch (e) {
      toast.error('Failed to clear spec section');
    }
  };

  // Filter divisions and sections based on search
  const filteredDivisions = useMemo(() => {
    if (!searchTerm) return Object.entries(CSI_DIVISIONS);
    
    const term = searchTerm.toLowerCase();
    return Object.entries(CSI_DIVISIONS).filter(([num, div]) => {
      if (div.title.toLowerCase().includes(term)) return true;
      return Object.entries(div.sections).some(
        ([sec, title]) =>
          sec.toLowerCase().includes(term) || title.toLowerCase().includes(term)
      );
    });
  }, [searchTerm]);

  const filteredSections = useMemo(() => {
    if (!selectedDivision) return [];
    const division = CSI_DIVISIONS[selectedDivision];
    if (!division) return [];
    
    if (!searchTerm) return Object.entries(division.sections);
    
    const term = searchTerm.toLowerCase();
    return Object.entries(division.sections).filter(
      ([sec, title]) =>
        sec.toLowerCase().includes(term) || title.toLowerCase().includes(term)
    );
  }, [selectedDivision, searchTerm]);

  // Compact view - just shows the badge
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {currentSpecSection ? (
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-900/30 border border-purple-600/50
              rounded-md text-purple-300 text-sm hover:bg-purple-800/40 transition-colors"
          >
            <Book className="w-3.5 h-3.5" />
            {currentSpecSection}
          </button>
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 border border-slate-600
              rounded-md text-slate-400 text-sm hover:bg-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Spec Section
          </button>
        )}

        {/* Picker Modal */}
        {showPicker && (
          <SpecSectionPickerModal
            onSelect={handleSelectSpecSection}
            onClose={() => setShowPicker(false)}
            currentSection={currentSpecSection}
            filteredDivisions={filteredDivisions}
            filteredSections={filteredSections}
            selectedDivision={selectedDivision}
            setSelectedDivision={setSelectedDivision}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-slate-900 border-2 border-purple-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg">
            <Library className="w-5 h-5 text-purple-400" aria-hidden="true" />
          </div>
          <div className="text-left">
            <h4 className="text-white font-medium">Specification References</h4>
            {currentParsed ? (
              <p className="text-purple-400 text-sm">
                {currentSpecSection} - {currentParsed.sectionTitle}
              </p>
            ) : (
              <p className="text-slate-500 text-sm">No spec section linked</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {relatedSpecs.length > 0 && (
            <span className="text-purple-400 text-sm">
              {relatedSpecs.length} related sections
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-purple-400" aria-hidden="true" />
              <span className="ml-2 text-slate-400">Loading spec data...</span>
            </div>
          ) : (
            <>
              {/* Primary Spec Section */}
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-slate-300">Primary Spec Section</h5>
                  <button
                    onClick={() => setShowPicker(true)}
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    {currentSpecSection ? 'Change' : 'Add'}
                  </button>
                </div>

                {currentParsed ? (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-600/30 border border-purple-500/50 rounded text-purple-300 font-mono">
                          {currentSpecSection}
                        </span>
                        <span className="text-white">{currentParsed.sectionTitle}</span>
                      </div>
                      <p className="text-slate-500 text-sm mt-1">
                        Division {currentParsed.divisionNumber}: {currentParsed.divisionTitle}
                      </p>
                    </div>
                    <button
                      onClick={handleClearSpecSection}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="Remove spec section"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-500">No spec section assigned to this submittal</p>
                )}
              </div>

              {/* Related Spec Sections from Line Items */}
              {relatedSpecs.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-slate-300 mb-2">
                    Related Spec Sections (from line items)
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {relatedSpecs.map((spec) => (
                      <span
                        key={spec.id}
                        className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-300 text-sm"
                        title={spec.sectionTitle}
                      >
                        {spec.specSection}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Documents */}
              {linkedDocuments.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-slate-300 mb-2">
                    Documents Referencing Spec Sections
                  </h5>
                  <div className="space-y-2">
                    {linkedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          <span className="text-slate-300 text-sm">{doc.name}</span>
                          {doc.pages.length > 0 && (
                            <span className="text-slate-500 text-xs">
                              (Pages: {doc.pages.slice(0, 3).join(', ')}
                              {doc.pages.length > 3 && `... +${doc.pages.length - 3}`})
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => window.open(`/project/${projectSlug}?doc=${doc.id}`, '_blank')}
                          className="text-purple-400 hover:text-purple-300 p-1"
                          title="View document"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Picker Modal */}
      {showPicker && (
        <SpecSectionPickerModal
          onSelect={handleSelectSpecSection}
          onClose={() => setShowPicker(false)}
          currentSection={currentSpecSection}
          filteredDivisions={filteredDivisions}
          filteredSections={filteredSections}
          selectedDivision={selectedDivision}
          setSelectedDivision={setSelectedDivision}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      )}
    </div>
  );
}

// Spec Section Picker Modal Component
function SpecSectionPickerModal({
  onSelect,
  onClose,
  currentSection,
  filteredDivisions,
  filteredSections,
  selectedDivision,
  setSelectedDivision,
  searchTerm,
  setSearchTerm,
}: {
  onSelect: (section: string) => void;
  onClose: () => void;
  currentSection?: string | null;
  filteredDivisions: [string, { title: string; sections: Record<string, string> }][];
  filteredSections: [string, string][];
  selectedDivision: string | null;
  setSelectedDivision: (div: string | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}) {
  const trapRef = useFocusTrap({ isActive: true, onEscape: onClose });
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="spec-picker-title" className="bg-slate-900 border-2 border-purple-600 rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 id="spec-picker-title" className="text-lg font-semibold text-white">Select Specification Section</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by section number or title..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Divisions List */}
          <div className="w-1/3 border-r border-slate-700 overflow-y-auto">
            <div className="p-2">
              {filteredDivisions.map(([num, div]) => (
                <button
                  key={num}
                  onClick={() => setSelectedDivision(num)}
                  className={`w-full text-left p-2 rounded-lg mb-1 transition-colors ${
                    selectedDivision === num
                      ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm">Div {num}</div>
                  <div className="text-xs text-slate-500 truncate">{div.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sections List */}
          <div className="w-2/3 overflow-y-auto">
            {selectedDivision ? (
              <div className="p-2">
                <div className="text-xs text-slate-500 px-2 py-1 mb-2">
                  Division {selectedDivision}: {CSI_DIVISIONS[selectedDivision]?.title}
                </div>
                {filteredSections.map(([section, title]) => (
                  <button
                    key={section}
                    onClick={() => onSelect(section)}
                    className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                      currentSection === section
                        ? 'bg-purple-600/30 border border-purple-500/50'
                        : 'hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-400 text-sm">{section}</span>
                      {currentSection === section && (
                        <span className="text-xs bg-purple-600/50 px-1.5 py-0.5 rounded text-purple-200">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-white text-sm mt-0.5">{title}</div>
                  </button>
                ))}
                {filteredSections.length === 0 && (
                  <p className="text-slate-500 text-sm p-4 text-center">No sections match your search</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <p>Select a division to view sections</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
