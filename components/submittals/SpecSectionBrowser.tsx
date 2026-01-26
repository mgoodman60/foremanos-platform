'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  FileCheck,
  Loader2,
  Search,
  Link as LinkIcon,
  ExternalLink,
  Hash,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface SpecSection {
  number: string;
  title: string;
  division: string;
  divisionTitle: string;
  submittalsCount?: number;
}

interface LinkedSubmittal {
  id: string;
  submittalNumber: string;
  title: string;
  status: string;
  lineItemCount: number;
}

interface SpecSectionBrowserProps {
  projectSlug: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-300',
  submitted: 'bg-blue-900 text-blue-300',
  reviewed: 'bg-purple-900 text-purple-300',
  approved: 'bg-emerald-900 text-emerald-300',
  rejected: 'bg-red-900 text-red-300',
  revision_requested: 'bg-amber-900 text-amber-300',
};

export default function SpecSectionBrowser({ projectSlug }: SpecSectionBrowserProps) {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<SpecSection[]>([]);
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [linkedSubmittals, setLinkedSubmittals] = useState<LinkedSubmittal[]>([]);
  const [loadingSubmittals, setLoadingSubmittals] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSections();
  }, [projectSlug]);

  const fetchSections = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/spec-sections`);
      if (res.ok) {
        const data = await res.json();
        setSections(data.sections);
        // Expand first division by default if there are sections
        if (data.sections.length > 0) {
          const firstDivision = data.sections[0].division;
          setExpandedDivisions(new Set([firstDivision]));
        }
      }
    } catch (error) {
      console.error('Failed to fetch spec sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmittalsForSection = async (specSection: string) => {
    setLoadingSubmittals(true);
    setSelectedSection(specSection);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/mep/submittals/spec-sections?specSection=${encodeURIComponent(specSection)}`
      );
      if (res.ok) {
        const data = await res.json();
        setLinkedSubmittals(data.submittals);
      }
    } catch (error) {
      console.error('Failed to fetch linked submittals:', error);
      toast.error('Failed to fetch linked submittals');
    } finally {
      setLoadingSubmittals(false);
    }
  };

  const toggleDivision = (division: string) => {
    const newExpanded = new Set(expandedDivisions);
    if (newExpanded.has(division)) {
      newExpanded.delete(division);
    } else {
      newExpanded.add(division);
    }
    setExpandedDivisions(newExpanded);
  };

  // Group sections by division
  const groupedSections = sections.reduce((acc, section) => {
    if (!acc[section.division]) {
      acc[section.division] = {
        divisionTitle: section.divisionTitle,
        sections: [],
      };
    }
    acc[section.division].sections.push(section);
    return acc;
  }, {} as Record<string, { divisionTitle: string; sections: SpecSection[] }>);

  // Filter sections based on search
  const filteredDivisions = Object.entries(groupedSections).filter(([_, data]) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      data.divisionTitle.toLowerCase().includes(term) ||
      data.sections.some(
        (s) =>
          s.number.toLowerCase().includes(term) ||
          s.title.toLowerCase().includes(term)
      )
    );
  });

  if (loading) {
    return (
      <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-2 text-slate-400">Loading spec sections...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          Specification Sections
        </h3>
        <span className="text-sm text-slate-400">
          {sections.length} sections tracked
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search sections..."
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
            text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-4">
        {/* Spec Sections List */}
        <div className="flex-1 max-h-96 overflow-y-auto space-y-2">
          {filteredDivisions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              {searchTerm ? 'No sections match your search' : 'No spec sections found'}
            </p>
          ) : (
            filteredDivisions.map(([division, data]) => (
              <div key={division} className="border border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleDivision(division)}
                  className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-between
                    text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedDivisions.has(division) ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-slate-300 font-medium">
                      Division {division}: {data.divisionTitle}
                    </span>
                  </div>
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full text-slate-400">
                    {data.sections.length}
                  </span>
                </button>

                {expandedDivisions.has(division) && (
                  <div className="bg-slate-850 border-t border-slate-700">
                    {data.sections
                      .filter(
                        (s) =>
                          !searchTerm ||
                          s.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.title.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((section) => (
                        <button
                          key={section.number}
                          onClick={() => fetchSubmittalsForSection(section.number)}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors
                            flex items-center justify-between ${selectedSection === section.number ? 'bg-slate-700' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-300">{section.number}</span>
                            <span className="text-slate-500">{section.title}</span>
                          </div>
                          {(section.submittalsCount ?? 0) > 0 && (
                            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" />
                              {section.submittalsCount}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Linked Submittals Panel */}
        {selectedSection && (
          <div className="w-80 bg-slate-800 border-2 border-slate-600 rounded-lg p-3">
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-400" />
              Submittals for {selectedSection}
            </h4>

            {loadingSubmittals ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              </div>
            ) : linkedSubmittals.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                No submittals linked to this section
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {linkedSubmittals.map((submittal) => (
                  <Link
                    key={submittal.id}
                    href={`/project/${projectSlug}/mep/submittals/${submittal.id}`}
                    className="block bg-slate-900 border border-slate-700 rounded-lg p-3
                      hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-white text-sm">
                          {submittal.submittalNumber}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {submittal.title}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[submittal.status.toLowerCase()] || STATUS_COLORS.draft}`}>
                        {submittal.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {submittal.lineItemCount} items
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
