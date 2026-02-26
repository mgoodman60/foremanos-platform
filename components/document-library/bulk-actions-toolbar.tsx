'use client';

import React from 'react';
import {
  X,
  Download,
  Loader2,
  Trash2,
  Lock,
  Upload,
  Box,
  CheckSquare,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { WithTooltip } from '@/components/ui/icon-button';
import { getCategoryLabel } from '@/lib/document-categorizer';
import { DocumentCategory } from './types';

// ─── Bulk actions toolbar (shown when selectedDocs.size > 0) ─────────────────

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  bulkActionLoading: boolean;
  canDeleteDocuments: boolean;
  showBulkAccessMenu: boolean;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  onBulkChangeAccess: (level: 'admin' | 'client' | 'guest') => void;
  onBulkDelete: () => void;
  onToggleBulkAccessMenu: () => void;
}

export const BulkActionsToolbar = React.memo(function BulkActionsToolbar({
  selectedCount,
  totalCount,
  bulkActionLoading,
  canDeleteDocuments,
  showBulkAccessMenu,
  onClearSelection,
  onBulkDownload,
  onBulkChangeAccess,
  onBulkDelete,
  onToggleBulkAccessMenu,
}: BulkActionsToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <WithTooltip tooltip="Clear selection">
          <button
            onClick={onClearSelection}
            className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </WithTooltip>
        <div>
          <h3 className="text-lg font-semibold text-slate-50">
            {selectedCount} Selected
          </h3>
          <p className="text-sm text-gray-400">
            {selectedCount} of {totalCount} document
            {totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onBulkDownload}
          disabled={bulkActionLoading}
          className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {bulkActionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Download</span>
        </button>

        {canDeleteDocuments && (
          <>
            <div className="relative">
              <button
                onClick={onToggleBulkAccessMenu}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-3 py-2 bg-dark-card hover:bg-dark-surface border border-gray-600 text-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Access</span>
              </button>

              {showBulkAccessMenu && (
                <div className="absolute right-0 top-full mt-2 bg-dark-card border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px] animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => onBulkChangeAccess('admin')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors"
                  >
                    Admin Only
                  </button>
                  <button
                    onClick={() => onBulkChangeAccess('client')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors"
                  >
                    Client Access
                  </button>
                  <button
                    onClick={() => onBulkChangeAccess('guest')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors"
                  >
                    Guest Access
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onBulkDelete}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {bulkActionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Delete</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
});

// ─── Normal header (shown when no docs selected) ──────────────────────────────

interface NormalHeaderProps {
  filteredCount: number;
  totalCount: number;
  selectedCategory: string;
  projectSlug: string;
  userRole: string;
  uploading: boolean;
  uploadProgress: number;
  rescanningAll: boolean;
  preSelectedCategory: string | null;
  showCategoryFilter: boolean;
  canDeleteDocuments: boolean;
  categories: { value: string; label: string }[];
  onUploadClick: () => void;
  onRescanAll: () => void;
  onViewModels: () => void;
  onSelectAll: () => void;
  onClearPreSelectedCategory: () => void;
  onSetSelectedCategory: (cat: string) => void;
  onToggleCategoryFilter: () => void;
}

export function NormalHeader({
  filteredCount,
  totalCount,
  selectedCategory,
  projectSlug,
  userRole,
  uploading,
  uploadProgress,
  rescanningAll,
  preSelectedCategory,
  showCategoryFilter,
  canDeleteDocuments,
  categories,
  onUploadClick,
  onRescanAll,
  onViewModels,
  onSelectAll,
  onClearPreSelectedCategory,
  onSetSelectedCategory,
  onToggleCategoryFilter,
}: NormalHeaderProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="document-library-title"
            className="text-lg lg:text-2xl font-bold text-slate-50"
          >
            Documents
          </h2>
          <p className="text-gray-400 text-xs lg:text-sm mt-1">
            {filteredCount} document{filteredCount !== 1 ? 's' : ''}
            {selectedCategory !== 'all' &&
              ` in ${getCategoryLabel(selectedCategory as DocumentCategory)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Category pre-selection badge */}
          {preSelectedCategory && (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white border-2 border-orange-500 rounded-lg text-sm font-semibold shadow-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-xs sm:text-sm">Selected:</span>
                <span className="font-bold">
                  {getCategoryLabel(preSelectedCategory as DocumentCategory)}
                </span>
              </div>
              <button
                onClick={onClearPreSelectedCategory}
                className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
                aria-label="Clear category selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Rescan All */}
          {projectSlug && userRole !== 'guest' && totalCount > 0 && (
            <button
              onClick={onRescanAll}
              disabled={rescanningAll}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
              title="Re-process all documents in this project"
            >
              <RefreshCw
                className={`w-4 h-4 ${rescanningAll ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {rescanningAll ? 'Rescanning...' : 'Rescan All'}
              </span>
            </button>
          )}

          {/* CAD Models */}
          {projectSlug && (
            <button
              onClick={onViewModels}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium"
            >
              <Box className="w-4 h-4" />
              <span className="hidden sm:inline">CAD Models</span>
            </button>
          )}

          {/* Upload */}
          {userRole !== 'guest' && (
            <div className="relative">
              <button
                onClick={onUploadClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onUploadClick();
                  }
                }}
                disabled={uploading}
                aria-label="Upload document"
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-dark-base"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">
                      Uploading {uploadProgress}%
                    </span>
                    <span className="sm:hidden">{uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </>
                )}
              </button>
              {uploading && uploadProgress > 0 && (
                <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                    role="progressbar"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                  />
                </div>
              )}
            </div>
          )}

          {totalCount > 0 && canDeleteDocuments && (
            <button
              onClick={onSelectAll}
              className="text-sm text-gray-300 hover:text-orange-500 transition-colors flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Select All</span>
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      {totalCount > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="relative">
            <button
              onClick={onToggleCategoryFilter}
              className="flex items-center gap-2 px-3 py-2 bg-dark-surface hover:bg-dark-card border border-gray-600 text-gray-300 rounded-lg transition-all text-sm"
            >
              <Filter className="w-4 h-4" />
              <span>Filter by Category</span>
            </button>

            {showCategoryFilter && (
              <div className="absolute left-0 top-full mt-2 bg-dark-card border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => onSetSelectedCategory('all')}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-300 hover:bg-dark-surface'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => onSetSelectedCategory(cat.value)}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      selectedCategory === cat.value
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-300 hover:bg-dark-surface'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCategory !== 'all' && (
            <button
              onClick={() => onSetSelectedCategory('all')}
              className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
