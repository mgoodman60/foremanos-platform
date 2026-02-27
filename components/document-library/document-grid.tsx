'use client';

import {
  FileText,
  FileImage,
  File,
  Download,
  Eye,
  Pencil,
  Trash2,
  Lock,
  Globe,
  CheckSquare,
  Square,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getCategoryLabel } from '@/lib/document-categorizer';
import DocumentIntelligenceBadges from '@/components/documents/DocumentIntelligenceBadges';
import {
  Document,
  DocumentCategory,
  DocumentProgress,
} from './types';
import {
  ProcessingStatusMobile,
  ProcessingStatusDesktop,
  isStalled,
} from './processing-status-card';

// ─── Quality badge ────────────────────────────────────────────────────────────

function QualityBadge({ score, deadLetters }: { score: number | null | undefined; deadLetters?: number }) {
  if ((score === null || score === undefined) && !deadLetters) return null;
  const color = score === null || score === undefined
    ? 'bg-gray-400'
    : score >= 60 ? 'bg-green-500'
    : score >= 40 ? 'bg-yellow-500'
    : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      <span className={`w-2 h-2 rounded-full ${color}`} title={`Quality: ${score ?? 'N/A'}/100`} aria-hidden="true" />
      {deadLetters != null && deadLetters > 0 && (
        <span className="text-xs text-red-500" aria-label={`${deadLetters} dead letter pages`}>
          {deadLetters}
        </span>
      )}
    </span>
  );
}

// ─── Pure helper functions ────────────────────────────────────────────────────

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function isRecentlyUpdated(updatedAt: string): boolean {
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffInHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
  return diffInHours < 48;
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getDocumentIcon(fileType: string): React.ReactNode {
  const type = fileType.toLowerCase();
  switch (type) {
    case 'pdf':
      return <FileText className="w-12 h-12 text-red-600" />;
    case 'doc':
    case 'docx':
      return <FileText className="w-12 h-12 text-blue-600" />;
    case 'xlsx':
    case 'xls':
      return <FileText className="w-12 h-12 text-green-600" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <FileImage className="w-12 h-12 text-purple-600" />;
    default:
      return <File className="w-12 h-12 text-gray-600" />;
  }
}

export function getAccessLevelBadge(accessLevel: string): React.ReactNode {
  switch (accessLevel) {
    case 'admin':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900/30 text-purple-400 border border-purple-700 text-xs font-bold rounded-full">
          <Lock className="w-3 h-3" />
          Admin Only
        </span>
      );
    case 'client':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 border border-blue-700 text-xs font-bold rounded-full">
          <Eye className="w-3 h-3" />
          Client Access
        </span>
      );
    case 'guest':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 border border-green-700 text-xs font-bold rounded-full">
          <Globe className="w-3 h-3" />
          Guest Access
        </span>
      );
    default:
      return null;
  }
}

export function getAccessLevelDescription(accessLevel: string): string {
  switch (accessLevel) {
    case 'admin':
      return 'Only administrators can see this document';
    case 'client':
      return 'Clients and administrators can see this document';
    case 'guest':
      return 'Everyone (guests, clients, and admins) can see this document';
    default:
      return '';
  }
}

export function getCategoryBadge(category: string): React.ReactNode {
  const categoryLabel = getCategoryLabel(category as DocumentCategory);
  const colors: Record<string, string> = {
    budget_cost: 'bg-green-900/30 text-green-400 border-green-700',
    schedule: 'bg-blue-900/30 text-blue-400 border-blue-700',
    plans_drawings: 'bg-purple-900/30 text-purple-400 border-purple-700',
    specifications: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
    contracts: 'bg-red-900/30 text-red-400 border-red-700',
    daily_reports: 'bg-indigo-900/30 text-indigo-400 border-indigo-700',
    photos: 'bg-pink-900/30 text-pink-400 border-pink-700',
    other: 'bg-gray-900/30 text-gray-400 border-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 border text-xs font-medium rounded-full ${colors[category] || colors.other}`}
    >
      {categoryLabel}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentGridProps {
  documents: Document[];
  projectSlug: string;
  userRole: string;
  selectedDocs: Set<string>;
  progressMap: Record<string, DocumentProgress>;
  lastPollTimes: Record<string, number>;
  canDeleteDocuments: boolean;
  canChangeVisibility: boolean;
  onToggleSelect: (docId: string) => void;
  onPreview: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onRename: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  onAccessLevelChange: (doc: Document, newAccessLevel: string) => void;
  onForceResume: (documentId: string, documentName: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentGrid({
  documents,
  projectSlug,
  userRole: _userRole,
  selectedDocs,
  progressMap,
  lastPollTimes,
  canDeleteDocuments,
  canChangeVisibility,
  onToggleSelect,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onAccessLevelChange,
  onForceResume,
}: DocumentGridProps) {
  return (
    <div className="space-y-2 lg:space-y-3">
      {documents.map((doc) => {
        const isProcessing =
          doc.queueStatus &&
          doc.queueStatus !== 'none' &&
          doc.queueStatus !== 'completed' &&
          !doc.processed;

        return (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-dark-card border border-gray-700 rounded-lg p-3 lg:p-4 hover:border-orange-500 hover:shadow-lg hover:bg-dark-surface transition-all group"
          >
            {/* ── Mobile view (< 1024px) ── */}
            <div className="lg:hidden">
              <div className="flex items-center gap-3">
                {canDeleteDocuments && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(doc.id);
                    }}
                    className="flex-shrink-0 p-1 hover:bg-dark-surface rounded transition-colors"
                    aria-label={`Select ${doc.name}`}
                  >
                    {selectedDocs.has(doc.id) ? (
                      <CheckSquare className="w-5 h-5 text-orange-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                )}

                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-gray-600 bg-dark-surface">
                    {doc.fileType.toLowerCase() === 'pdf' ? (
                      <FileText className="w-5 h-5 text-red-500" />
                    ) : doc.fileType.toLowerCase() === 'docx' ||
                      doc.fileType.toLowerCase() === 'doc' ? (
                      <FileText className="w-5 h-5 text-blue-500" />
                    ) : (
                      <File className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-slate-50 truncate">
                    {projectSlug ? (
                      <Link
                        href={`/project/${projectSlug}/documents/${doc.id}`}
                        className="hover:text-orange-400 transition-colors"
                      >
                        {doc.name}
                      </Link>
                    ) : (
                      doc.name
                    )}
                    <QualityBadge score={(doc as any).avgQualityScore} deadLetters={(doc as any).deadLetterPageCount} />
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="font-medium uppercase">
                      {doc.fileType}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                  </div>
                  <div className="mt-1.5">{getCategoryBadge(doc.category)}</div>
                  <DocumentIntelligenceBadges
                    intelligence={doc.intelligence ?? null}
                    compact
                  />
                  {isProcessing && (
                    <ProcessingStatusMobile
                      doc={doc}
                      progress={progressMap[doc.id]}
                      lastPollTime={lastPollTimes[doc.id]}
                      onForceResume={onForceResume}
                    />
                  )}
                </div>

                <button
                  type="button"
                  className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-dark-card hover:bg-dark-surface border border-gray-600 text-gray-300 hover:text-orange-500 rounded-lg transition-all active:scale-95"
                  aria-label={`Preview ${doc.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPreview(doc);
                  }}
                >
                  <Eye className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all active:scale-95"
                  aria-label={`Download ${doc.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDownload(doc);
                  }}
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Desktop view (>= 1024px) ── */}
            <div className="hidden lg:block">
              <div className="space-y-0">
                {/* Row 1: Document info + actions */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {canDeleteDocuments && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelect(doc.id);
                        }}
                        className="flex-shrink-0 p-2 hover:bg-dark-surface rounded transition-colors mt-1"
                        aria-label={`Select ${doc.name}`}
                      >
                        {selectedDocs.has(doc.id) ? (
                          <CheckSquare className="w-6 h-6 text-orange-500" />
                        ) : (
                          <Square className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    )}

                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 rounded-xl flex items-center justify-center border-2 border-gray-600 bg-dark-surface transition-transform hover:scale-105">
                        {getDocumentIcon(doc.fileType)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 py-1">
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="font-bold text-slate-50 truncate text-lg flex-1">
                          {projectSlug ? (
                            <Link
                              href={`/project/${projectSlug}/documents/${doc.id}`}
                              className="hover:text-orange-400 transition-colors"
                            >
                              {doc.name}
                            </Link>
                          ) : (
                            doc.name
                          )}
                          <QualityBadge score={(doc as any).avgQualityScore} deadLetters={(doc as any).deadLetterPageCount} />
                        </h3>
                        {isRecentlyUpdated(doc.updatedAt) && (
                          <span className="px-2 py-1 bg-green-900/30 text-green-400 border border-green-700 text-xs font-bold rounded-full whitespace-nowrap flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Recently Updated
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                        <span className="px-3 py-1 bg-dark-surface border border-gray-600 rounded-full text-xs font-bold uppercase">
                          {doc.fileType}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="font-medium">
                          {formatFileSize(doc.fileSize)}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span
                          className="text-xs font-medium"
                          title={`Last modified: ${new Date(doc.updatedAt).toLocaleString()}`}
                        >
                          Modified {formatRelativeTime(doc.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-2">
                        {getCategoryBadge(doc.category)}
                      </div>
                      <DocumentIntelligenceBadges
                        intelligence={doc.intelligence ?? null}
                      />

                      {/* Visibility controls */}
                      {canChangeVisibility && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400">
                              Visibility:
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  onAccessLevelChange(doc, 'admin')
                                }
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  doc.accessLevel === 'admin'
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'bg-purple-900/30 text-purple-400 border border-purple-700 hover:bg-purple-900/50'
                                }`}
                                title={getAccessLevelDescription('admin')}
                              >
                                <Lock className="w-3 h-3" />
                                Admin Only
                              </button>
                              <button
                                onClick={() =>
                                  onAccessLevelChange(doc, 'client')
                                }
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  doc.accessLevel === 'client'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-blue-900/30 text-blue-400 border border-blue-700 hover:bg-blue-900/50'
                                }`}
                                title={getAccessLevelDescription('client')}
                              >
                                <Eye className="w-3 h-3" />
                                Client Access
                              </button>
                              <button
                                onClick={() =>
                                  onAccessLevelChange(doc, 'guest')
                                }
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  doc.accessLevel === 'guest'
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'bg-green-900/30 text-green-400 border border-green-700 hover:bg-green-900/50'
                                }`}
                                title={getAccessLevelDescription('guest')}
                              >
                                <Globe className="w-3 h-3" />
                                Guest Access
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {getAccessLevelDescription(doc.accessLevel)}
                          </p>
                        </div>
                      )}

                      {!canChangeVisibility && (
                        <div className="mt-2">
                          {getAccessLevelBadge(doc.accessLevel)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 bg-dark-card hover:bg-dark-surface border border-gray-600 text-gray-300 hover:text-orange-500 rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-dark-surface focus:outline-none"
                      aria-label={`Preview ${doc.name}`}
                      title="Preview document"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onPreview(doc);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview</span>
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-dark-surface focus:outline-none"
                      aria-label={`Download ${doc.name}`}
                      title="Download document"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDownload(doc);
                      }}
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>

                    {canDeleteDocuments && (
                      <>
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 focus:ring-offset-dark-surface focus:outline-none"
                          aria-label={`Rename ${doc.name}`}
                          title="Rename document"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRename(doc);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-dark-surface focus:outline-none"
                          aria-label={`Delete ${doc.name}`}
                          title="Delete document"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(doc);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 2: Processing status (desktop full panel, shown only when processing) */}
                {isProcessing && (
                  <ProcessingStatusDesktop
                    doc={doc}
                    progress={progressMap[doc.id]}
                    lastPollTime={lastPollTimes[doc.id]}
                    onForceResume={onForceResume}
                    categoryBadge={getCategoryBadge(doc.category)}
                  />
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
