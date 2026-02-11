/**
 * Requirement Auto-Import Component
 * Allows users to auto-import requirements from project schedules into a submittal
 */

'use client';

import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Check,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Package,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

interface CategoryInfo {
  category: string;
  label: string;
  itemCount: number;
  specSections: string[];
}

interface RequirementAutoImportProps {
  projectSlug: string;
  submittalId: string;
  onImportComplete?: (result: { imported: number; skipped: number }) => void;
  onClose?: () => void;
  onImported?: () => void;
}

export function RequirementAutoImport({
  projectSlug,
  submittalId,
  onImportComplete,
  onClose,
  onImported,
}: RequirementAutoImportProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  // Fetch available categories
  useEffect(() => {
    fetchCategories();
  }, [projectSlug]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/mep/submittals/requirements?mode=categories`
      );
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const selectAllCategories = () => {
    setSelectedCategories(categories.map(c => c.category));
  };

  const clearSelection = () => {
    setSelectedCategories([]);
  };

  const handleImport = async () => {
    if (selectedCategories.length === 0 && categories.length > 0) {
      toast.error('Please select at least one category to import');
      return;
    }

    setLoading(true);
    setImportResult(null);

    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/mep/submittals/requirements`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submittalId,
            categoryFilter:
              selectedCategories.length > 0 ? selectedCategories : undefined,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await res.json();
      setImportResult(result);

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} requirements`);
      } else if (result.skipped > 0) {
        toast.info(`All ${result.skipped} requirements already exist`);
      } else {
        toast.info('No requirements found to import');
      }

      onImportComplete?.(result);
      onImported?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import requirements');
    } finally {
      setLoading(false);
    }
  };

  const totalItems = categories.reduce((sum, c) => sum + c.itemCount, 0);
  const selectedItemCount = categories
    .filter(c => selectedCategories.includes(c.category))
    .reduce((sum, c) => sum + c.itemCount, 0);

  return (
    <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-700/50 rounded-lg p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-white font-medium">Auto-Import Requirements</h4>
            <p className="text-gray-400 text-sm">
              Import from door, window, plumbing, electrical & finish schedules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalItems > 0 && (
            <span className="text-blue-400 text-sm">
              {totalItems} items available
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" aria-hidden="true" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Category Selection */}
          {loadingCategories ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" aria-hidden="true" />
              <span className="ml-2 text-gray-400">Loading categories...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-4">
              <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
              <p className="text-gray-400">No schedule data found</p>
              <p className="text-gray-400 text-sm">
                Upload door, window, or equipment schedules first
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  <span className="text-gray-300 text-sm">Select categories:</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      selectAllCategories();
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Select All
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      clearSelection();
                    }}
                    className="text-gray-400 hover:text-gray-300 text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.category}
                    onClick={e => {
                      e.stopPropagation();
                      toggleCategory(cat.category);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedCategories.includes(cat.category)
                        ? 'bg-blue-600/30 border-blue-500 text-white'
                        : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {cat.label}
                      </span>
                      {selectedCategories.includes(cat.category) && (
                        <Check className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {cat.itemCount} items
                    </div>
                  </button>
                ))}
              </div>

              {/* Import Button */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                  {selectedCategories.length > 0 ? (
                    <>
                      <span className="text-blue-400 font-medium">
                        {selectedItemCount}
                      </span>{' '}
                      items selected from{' '}
                      <span className="text-blue-400">
                        {selectedCategories.length}
                      </span>{' '}
                      categories
                    </>
                  ) : (
                    'Select categories to import'
                  )}
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleImport();
                  }}
                  disabled={loading || selectedCategories.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="w-4 h-4" aria-hidden="true" />
                  )}
                  Import Requirements
                </button>
              </div>
            </>
          )}

          {/* Import Result */}
          {importResult && (
            <div
              className={`p-3 rounded-lg ${
                importResult.errors.length > 0
                  ? 'bg-yellow-900/30 border border-yellow-700/50'
                  : 'bg-green-900/30 border border-green-700/50'
              }`}
            >
              <div className="flex items-start gap-3">
                {importResult.errors.length > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" aria-hidden="true" />
                )}
                <div className="flex-1">
                  <p className="text-white text-sm">
                    Imported{' '}
                    <span className="font-bold text-green-400">
                      {importResult.imported}
                    </span>{' '}
                    requirements
                    {importResult.skipped > 0 && (
                      <>
                        {' '}
                        (skipped{' '}
                        <span className="text-yellow-400">
                          {importResult.skipped}
                        </span>{' '}
                        duplicates)
                      </>
                    )}
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 text-yellow-400 text-xs space-y-1">
                      {importResult.errors.slice(0, 3).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {importResult.errors.length > 3 && (
                        <li>...and {importResult.errors.length - 3} more</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
