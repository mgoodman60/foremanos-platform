'use client';

import { FileText, Upload, Shield, CheckCircle2, X } from 'lucide-react';
import { getCategoryLabel } from '@/lib/document-categorizer';
import { DocumentCategory } from './types';

// ─── Drag overlay ─────────────────────────────────────────────────────────────

interface DragOverlayProps {
  isDragging: boolean;
  userRole: string;
  preSelectedCategory: string | null;
}

export function DragOverlay({
  isDragging,
  userRole,
  preSelectedCategory,
}: DragOverlayProps) {
  if (!isDragging || userRole === 'guest') return null;

  return (
    <div className="absolute inset-0 z-50 bg-orange-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="bg-dark-card border-2 border-dashed border-orange-500 rounded-lg p-8 text-center max-w-md">
        <Upload className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-bounce" />
        <p className="text-xl font-semibold text-slate-50 mb-2">
          Drop file here to upload
        </p>
        {preSelectedCategory && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold mb-3">
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {getCategoryLabel(preSelectedCategory as DocumentCategory)}
            </span>
          </div>
        )}
        {!preSelectedCategory && (
          <p className="text-sm text-gray-300 mb-2">
            File will be categorized after drop
          </p>
        )}
        <p className="text-sm text-gray-400">
          PDF, DOCX, XLSX, images, or CAD files (.dwg, .rvt, .ifc)
        </p>
        <p className="text-xs text-gray-400 mt-1">Maximum file size: 200MB</p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  userRole: string;
  onUploadClick: () => void;
}

export function EmptyState({ userRole, onUploadClick }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md px-4">
        <div className="w-24 h-24 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-orange-500/30">
          <FileText className="w-12 h-12 text-orange-400" aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-bold text-slate-50 mb-3">
          {userRole === 'guest' ? 'No Documents Available' : 'No Documents Yet'}
        </h3>
        <p className="text-gray-300 mb-6 leading-relaxed text-base">
          {userRole === 'guest'
            ? 'You currently have no document access. Contact your project administrator to request access to project documents.'
            : 'Get started by uploading your first document. Plans, specifications, contracts, and more can be stored here.'}
        </p>
        {userRole !== 'guest' && (
          <>
            <button
              onClick={onUploadClick}
              className="mb-6 px-6 py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-dark-base"
            >
              <Upload className="w-5 h-5 inline mr-2" aria-hidden="true" />
              Upload Your First Document
            </button>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-orange-500" />
                </div>
                <span>PDF & DOCX</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-orange-500" />
                </div>
                <span>Up to 200MB</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-orange-500" />
                </div>
                <span>Secure Storage</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Category pre-selection badge ─────────────────────────────────────────────

interface CategoryPreSelectionBadgeProps {
  preSelectedCategory: string | null;
  onClear: () => void;
}

export function CategoryPreSelectionBadge({
  preSelectedCategory,
  onClear,
}: CategoryPreSelectionBadgeProps) {
  if (!preSelectedCategory) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white border-2 border-orange-500 rounded-lg text-sm font-semibold shadow-lg animate-in fade-in zoom-in-95 duration-200">
      <CheckCircle2 className="w-5 h-5" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <span className="text-xs sm:text-sm">Selected:</span>
        <span className="font-bold">
          {getCategoryLabel(preSelectedCategory as DocumentCategory)}
        </span>
      </div>
      <button
        onClick={onClear}
        className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
        aria-label="Clear category selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
