'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getAllCategories, getCategoryLabel } from '@/lib/document-categorizer';
import DocumentPreviewModal from '@/components/document-preview-modal';
import { DocumentCategoryModal } from '@/components/document-category-modal';
import { useOptimisticDocuments } from '@/hooks/useOptimisticDocuments';
import { ConfirmDialog } from '@/components/confirm-dialog';
import ExtractionFeedbackBanner from '@/components/documents/ExtractionFeedbackBanner';

import {
  Document,
  DocumentCategory,
  DocumentIntelligence,
  DocumentProgress,
  DocumentLibraryProps,
} from './types';
import { DocumentGrid, formatFileSize as _formatFileSize } from './document-grid';
import { DragOverlay, EmptyState } from './upload-zone';
import { BulkActionsToolbar, NormalHeader } from './bulk-actions-toolbar';
import { DeleteConfirmDialog } from './delete-confirm-dialog';

// ─── CAD helpers ──────────────────────────────────────────────────────────────

const CAD_EXTENSIONS = [
  '.dwg', '.dxf', '.dwf', '.dwfx', '.rvt', '.rfa', '.ifc',
  '.nwd', '.nwc', '.3ds', '.fbx', '.obj', '.stl', '.stp',
  '.step', '.iges', '.igs', '.f3d', '.skp',
];

function isCADFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return CAD_EXTENSIONS.includes(ext);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentLibrary({
  userRole,
  projectId,
  onDocumentsChange,
}: DocumentLibraryProps) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  // Rename modal
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameDocument, setRenameDocument] = useState<Document | null>(null);
  const [newDocumentName, setNewDocumentName] = useState('');

  // Preview
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Bulk selection
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkAccessMenu, setShowBulkAccessMenu] = useState(false);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // Upload
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preSelectedCategory, setPreSelectedCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const _cadFileInputRef = useRef<HTMLInputElement>(null);

  // Project slug (for links / rescan)
  const [projectSlug, setProjectSlug] = useState<string>('');

  // Modals / confirm dialogs
  const [showViewModelConfirm, setShowViewModelConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<Document | null>(null);
  const [deletionImpact, setDeletionImpact] = useState<{
    impact: {
      rooms: number;
      doors: number;
      windows: number;
      finishes: number;
      floorPlans: number;
      hardware: number;
      takeoffs: number;
      chunks: number;
    };
    hasExtractedData: boolean;
  } | null>(null);
  const [deletionImpactLoading, setDeletionImpactLoading] = useState(false);
  const [cleanupExtracted, setCleanupExtracted] = useState(false);

  // Processing progress polling
  const [progressMap, setProgressMap] = useState<Record<string, DocumentProgress>>({});
  const [lastPollTimes, setLastPollTimes] = useState<Record<string, number>>({});
  const [completedBanners, setCompletedBanners] = useState<
    Array<{ docId: string; docName: string; intelligence: DocumentIntelligence }>
  >([]);
  const prevProcessingIdsRef = useRef<Set<string>>(new Set());

  // Rescan
  const [rescanningAll, setRescanningAll] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);

  // Rename modal focus trap
  const renameModalRef = useFocusTrap({
    isActive: renameModalOpen,
    onEscape: () => {
      setRenameModalOpen(false);
      setRenameDocument(null);
      setNewDocumentName('');
    },
  });

  const categories = getAllCategories();

  // ── Derived ────────────────────────────────────────────────────────────────
  const canDeleteDocuments = userRole === 'admin' || userRole === 'client';
  const canChangeVisibility = userRole === 'admin' || userRole === 'client';
  const filteredDocuments = useMemo(
    () => selectedCategory === 'all'
      ? documents
      : documents.filter((doc) => doc.category === selectedCategory),
    [documents, selectedCategory]
  );

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchProjectSlug = async () => {
    try {
      const response = await fetch(`/api/projects/by-id/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProjectSlug(data.project?.slug || '');
      }
    } catch (error) {
      console.error('Error fetching project slug:', error);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/documents?projectId=${projectId}&include=intelligence`,
      );
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      const accessible =
        userRole === 'admin' || userRole === 'client'
          ? data.documents
          : data.documents.filter(
              (doc: Document) => doc.accessLevel === 'guest',
            );
      setDocuments(accessible);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // Optimistic updates hook (must be after fetchDocuments is defined)
  const { optimisticDelete, optimisticChangeAccess } = useOptimisticDocuments({
    documents,
    setDocuments,
    fetchDocuments,
    onDocumentsChange,
  });

  useEffect(() => {
    fetchDocuments();
    fetchProjectSlug();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track processing IDs and detect newly completed documents for feedback banners
  useEffect(() => {
    const currentProcessingIds = new Set(
      documents
        .filter(
          (d) =>
            d.queueStatus &&
            d.queueStatus !== 'none' &&
            d.queueStatus !== 'completed' &&
            !d.processed,
        )
        .map((d) => d.id),
    );
    const prevIds = prevProcessingIdsRef.current;

    for (const id of prevIds) {
      if (!currentProcessingIds.has(id)) {
        const doc = documents.find((d) => d.id === id);
        if (doc && doc.intelligence) {
          setCompletedBanners((prev) => {
            if (prev.some((b) => b.docId === id)) return prev;
            return [
              ...prev,
              {
                docId: id,
                docName: doc.name,
                intelligence: doc.intelligence as DocumentIntelligence,
              },
            ];
          });
        }
      }
    }

    prevProcessingIdsRef.current = currentProcessingIds;
  }, [documents]);

  // Poll progress for processing documents
  useEffect(() => {
    const processingDocs = documents.filter(
      (d) =>
        d.queueStatus &&
        d.queueStatus !== 'none' &&
        d.queueStatus !== 'completed' &&
        !d.processed,
    );
    if (processingDocs.length === 0) return;

    const fetchProgress = async () => {
      for (const doc of processingDocs) {
        try {
          const res = await fetch(`/api/documents/${doc.id}/progress`);
          if (res.ok) {
            const data: DocumentProgress = await res.json();
            setProgressMap((prev) => ({ ...prev, [doc.id]: data }));
            setLastPollTimes((prev) => ({ ...prev, [doc.id]: Date.now() }));
            if (data.currentPhase === 'completed') {
              fetchDocuments();
            }
          }
        } catch { /* ignore polling errors */ }
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
  }, [documents.map((d) => `${d.id}:${d.queueStatus}`).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload handlers ────────────────────────────────────────────────────────

  const handleCADUpload = async (file: File) => {
    if (!projectSlug) {
      toast.error('Project not found');
      return;
    }
    setUploading(true);
    const toastId = toast.loading(`Uploading ${file.name} to CAD viewer...`);
    try {
      const presignRes = await fetch('/api/autodesk/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'application/octet-stream',
          projectSlug,
        }),
      });
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to prepare upload');
      }
      const { uploadUrl, cloudStoragePath } = await presignRes.json();
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) {
        throw new Error(
          putRes.status === 403
            ? 'Upload URL expired. Please try again.'
            : `Upload to storage failed (${putRes.status})`,
        );
      }
      const response = await fetch('/api/autodesk/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudStoragePath,
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'application/octet-stream',
          projectSlug,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      toast.success(
        'CAD file uploaded! Processing will take a few minutes. View in Models page.',
        { id: toastId },
      );
      setShowViewModelConfirm(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (isCADFile(file.name)) {
      handleCADUpload(file);
      e.target.value = '';
      return;
    }
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png'];
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast.error(
        'Supported files: PDF, DOCX, XLSX, images, or CAD files (.dwg, .rvt, .ifc, etc.)',
      );
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error('File size must be less than 200MB');
      return;
    }
    if (preSelectedCategory) {
      handleUpload(preSelectedCategory, file);
      setPreSelectedCategory(null);
    } else {
      setPendingFile(file);
      setShowCategoryModal(true);
    }
  };

  const handleUpload = async (category: DocumentCategory, file?: File) => {
    const fileToUpload = file || pendingFile;
    if (!fileToUpload) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const presignRes = await fetch('/api/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileToUpload.name,
          fileSize: fileToUpload.size,
          contentType: fileToUpload.type || 'application/octet-stream',
          projectId,
          category,
        }),
      });
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to prepare upload');
      }
      const { uploadUrl, cloudStoragePath } = await presignRes.json();
      setUploadProgress(10);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = 10 + Math.round((e.loaded / e.total) * 80);
            setUploadProgress(percent);
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else if (xhr.status === 403) {
            reject(new Error('Upload URL expired. Please try again.'));
          } else {
            reject(new Error(`Upload to storage failed (${xhr.status})`));
          }
        });
        xhr.addEventListener('error', () => {
          reject(
            new Error(
              'Upload blocked — likely a CORS issue on the storage bucket. Run `npx tsx scripts/setup-r2-cors.ts` to fix.',
            ),
          );
        });
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader(
          'Content-Type',
          fileToUpload.type || 'application/octet-stream',
        );
        xhr.send(fileToUpload);
      });

      setUploadProgress(90);

      const confirmRes = await fetch('/api/documents/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudStoragePath,
          fileName: fileToUpload.name,
          fileSize: fileToUpload.size,
          projectId,
          category,
        }),
      });
      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => ({}));
        const errorMessage = data.error || 'Failed to confirm upload';
        const errorCode = data.errorCode;
        const retryAdvice = data.retryAdvice;
        const parts = [errorMessage];
        if (errorCode) parts[0] = `[${errorCode}] ${parts[0]}`;
        if (retryAdvice) parts.push(retryAdvice);
        throw new Error(parts.join(' — '));
      }

      setUploadProgress(100);
      toast.success('Document uploaded successfully');
      setShowCategoryModal(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload document',
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Drag and drop ──────────────────────────────────────────────────────────

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (userRole === 'guest') return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (userRole === 'guest') {
      toast.error('Guests cannot upload documents');
      return;
    }
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (isCADFile(file.name)) {
      handleCADUpload(file);
      return;
    }
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png'];
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast.error(
        'Supported files: PDF, DOCX, XLSX, images, or CAD files (.dwg, .rvt, .ifc, etc.)',
      );
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error('File size must be less than 200MB');
      return;
    }
    if (preSelectedCategory) {
      handleUpload(preSelectedCategory, file);
      setPreSelectedCategory(null);
    } else {
      setPendingFile(file);
      setShowCategoryModal(true);
    }
  };

  const handleCategoryFirstUpload = () => {
    setPendingFile(null);
    setShowCategoryModal(true);
  };

  const handleCategorySelected = async (category: DocumentCategory) => {
    if (!pendingFile) {
      setPreSelectedCategory(category);
      setShowCategoryModal(false);
      toast.success(
        <div className="flex flex-col gap-1">
          <div className="font-semibold">Category Selected!</div>
          <div className="text-sm">
            {getCategoryLabel(category)} - Now choose your file to upload
          </div>
        </div>,
        { duration: 4000, icon: '📁' },
      );
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else {
      await handleUpload(category);
    }
  };

  // ── Rescan all ─────────────────────────────────────────────────────────────

  const handleRescanAll = async () => {
    if (!projectSlug) return;
    setRescanningAll(true);
    setRescanMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rescan`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setRescanMessage(data.message);
        setTimeout(() => fetchDocuments(), 2000);
      } else {
        setRescanMessage(data.error || 'Failed to start rescan');
      }
    } catch {
      setRescanMessage('Failed to start rescan');
    } finally {
      setRescanningAll(false);
      setTimeout(() => setRescanMessage(null), 8000);
    }
  };

  // ── Document actions ───────────────────────────────────────────────────────

  const handleDownload = useCallback(async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}?download=true`);
      if (!response.ok) throw new Error('Failed to generate download URL');
      const data = await response.json();
      if (data.url) {
        const link = document.createElement('a');
        link.href = data.url;
        link.download = doc.fileName;
        link.target = '_blank';
        link.click();
        toast.success(`Downloading ${doc.name}...`);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  }, []);

  const handleForceResume = useCallback(async (documentId: string, documentName: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/resume-processing`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success(`Resuming processing for ${documentName}`);
        setTimeout(() => fetchDocuments(), 2000);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to resume processing');
      }
    } catch {
      toast.error('Failed to resume processing');
    }
  }, [fetchDocuments]);

  const handleRename = async () => {
    if (!renameDocument || !newDocumentName.trim()) {
      toast.error('Document name cannot be empty');
      return;
    }
    const trimmedName = newDocumentName.trim();
    if (trimmedName.length < 3) {
      toast.error('Document name must be at least 3 characters long');
      return;
    }
    if (trimmedName.length > 200) {
      toast.error('Document name is too long (max 200 characters)');
      return;
    }
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(trimmedName)) {
      toast.error('Document name contains invalid characters');
      return;
    }
    if (trimmedName === renameDocument.name) {
      toast.error('New name must be different from the current name');
      return;
    }
    try {
      const response = await fetch(`/api/documents/${renameDocument.id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename document');
      }
      toast.success('Document renamed successfully');
      setRenameModalOpen(false);
      setRenameDocument(null);
      setNewDocumentName('');
      fetchDocuments();
    } catch (error) {
      console.error('Error renaming document:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to rename document',
      );
    }
  };

  const openRenameModal = useCallback((doc: Document) => {
    setRenameDocument(doc);
    setNewDocumentName(doc.name);
    setRenameModalOpen(true);
  }, []);

  const openPreviewModal = useCallback((doc: Document) => {
    setPreviewDocument(doc);
    setPreviewModalOpen(true);
  }, []);

  const handleAccessLevelChange = async (
    doc: Document,
    newAccessLevel: string,
  ) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessLevel: newAccessLevel }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update visibility');
      }
      const data = await response.json();
      toast.success(data.message || 'Document visibility updated');
      fetchDocuments();
    } catch (error) {
      console.error('Error updating access level:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to update visibility',
      );
    }
  };

  const handleDelete = useCallback(async (doc: Document) => {
    setPendingDeleteDoc(doc);
    setShowDeleteConfirm(true);
    setDeletionImpact(null);
    setCleanupExtracted(false);
    setDeletionImpactLoading(true);
    try {
      const response = await fetch(`/api/documents/${doc.id}/deletion-impact`);
      if (response.ok) {
        const data = await response.json();
        setDeletionImpact(data);
      }
    } catch {
      // Non-critical
    } finally {
      setDeletionImpactLoading(false);
    }
  }, []);

  const doDelete = async () => {
    setShowDeleteConfirm(false);
    const doc = pendingDeleteDoc;
    const shouldCleanup = cleanupExtracted;
    setPendingDeleteDoc(null);
    setDeletionImpact(null);
    setCleanupExtracted(false);
    if (!doc) return;
    try {
      const url = shouldCleanup
        ? `/api/documents/${doc.id}?cleanup=true`
        : `/api/documents/${doc.id}`;
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete document');
      }
      toast.success('Document deleted successfully');
      fetchDocuments();
      onDocumentsChange?.();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete document',
      );
    }
  };

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setPendingDeleteDoc(null);
    setDeletionImpact(null);
    setCleanupExtracted(false);
  }, []);

  // ── Bulk action handlers ───────────────────────────────────────────────────

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) newSet.delete(docId);
      else newSet.add(docId);
      return newSet;
    });
  }, []);

  const selectAllDocs = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map((doc) => doc.id)));
    }
  };

  const bulkDownload = async () => {
    if (selectedDocs.size === 0) return;
    setBulkActionLoading(true);
    let successCount = 0;
    for (const docId of selectedDocs) {
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        try {
          await handleDownload(doc);
          successCount++;
        } catch (error) {
          console.error(`Failed to download ${doc.name}:`, error);
        }
      }
    }
    setBulkActionLoading(false);
    setSelectedDocs(new Set());
    toast.success(
      `Downloaded ${successCount} of ${selectedDocs.size} documents`,
    );
  };

  const bulkDelete = () => {
    if (selectedDocs.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const doBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    setBulkActionLoading(true);
    const docCount = selectedDocs.size;
    const success = await optimisticDelete(Array.from(selectedDocs));
    setBulkActionLoading(false);
    setSelectedDocs(new Set());
    if (success) toast.success(`Deleted ${docCount} document(s)`);
  };

  const bulkChangeAccess = async (newAccessLevel: 'admin' | 'client' | 'guest') => {
    if (selectedDocs.size === 0) return;
    setBulkActionLoading(true);
    const docCount = selectedDocs.size;
    const success = await optimisticChangeAccess(
      Array.from(selectedDocs),
      newAccessLevel,
    );
    setBulkActionLoading(false);
    setSelectedDocs(new Set());
    if (success) toast.success(`Updated access for ${docCount} document(s)`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col h-full bg-dark-surface ${isDragging ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.dwg,.dxf,.dwf,.dwfx,.rvt,.rfa,.ifc,.nwd,.nwc,.3ds,.fbx,.obj,.stl,.stp,.step,.iges,.igs,.f3d,.skp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Drag overlay */}
      <DragOverlay
        isDragging={isDragging}
        userRole={userRole}
        preSelectedCategory={preSelectedCategory}
      />

      {/* Header */}
      <div className="bg-dark-card border-b border-gray-700 p-3 lg:p-6">
        {selectedDocs.size > 0 ? (
          <BulkActionsToolbar
            selectedCount={selectedDocs.size}
            totalCount={documents.length}
            bulkActionLoading={bulkActionLoading}
            canDeleteDocuments={canDeleteDocuments}
            showBulkAccessMenu={showBulkAccessMenu}
            onClearSelection={() => setSelectedDocs(new Set())}
            onBulkDownload={bulkDownload}
            onBulkChangeAccess={(level) => {
              bulkChangeAccess(level);
              setShowBulkAccessMenu(false);
            }}
            onBulkDelete={bulkDelete}
            onToggleBulkAccessMenu={() =>
              setShowBulkAccessMenu(!showBulkAccessMenu)
            }
          />
        ) : (
          <NormalHeader
            filteredCount={filteredDocuments.length}
            totalCount={documents.length}
            selectedCategory={selectedCategory}
            projectSlug={projectSlug}
            userRole={userRole}
            uploading={uploading}
            uploadProgress={uploadProgress}
            rescanningAll={rescanningAll}
            preSelectedCategory={preSelectedCategory}
            showCategoryFilter={showCategoryFilter}
            canDeleteDocuments={canDeleteDocuments}
            categories={categories}
            onUploadClick={handleCategoryFirstUpload}
            onRescanAll={handleRescanAll}
            onViewModels={() => router.push(`/project/${projectSlug}/models`)}
            onSelectAll={selectAllDocs}
            onClearPreSelectedCategory={() => setPreSelectedCategory(null)}
            onSetSelectedCategory={(cat) => {
              setSelectedCategory(cat);
              setShowCategoryFilter(false);
            }}
            onToggleCategoryFilter={() =>
              setShowCategoryFilter(!showCategoryFilter)
            }
          />
        )}
      </div>

      {/* Rescan message */}
      {rescanMessage && (
        <div className="px-3 lg:px-6 pt-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 border border-blue-700/50 rounded-lg text-sm text-blue-300">
            <RefreshCw className="w-4 h-4 flex-shrink-0" />
            {rescanMessage}
          </div>
        </div>
      )}

      {/* Extraction feedback banners */}
      {completedBanners.length > 0 && projectSlug && (
        <div className="px-3 lg:px-6 pt-3">
          {completedBanners.map((banner) => (
            <ExtractionFeedbackBanner
              key={banner.docId}
              documentName={banner.docName}
              documentId={banner.docId}
              projectSlug={projectSlug}
              intelligence={banner.intelligence}
              onDismiss={() =>
                setCompletedBanners((prev) =>
                  prev.filter((b) => b.docId !== banner.docId),
                )
              }
            />
          ))}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-3 lg:p-6 bg-dark-surface">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-dark-card border border-gray-700 rounded-lg p-4 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-700 rounded w-1/2" />
                  </div>
                  <div className="h-8 w-20 bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            userRole={userRole}
            onUploadClick={() => fileInputRef.current?.click()}
          />
        ) : (
          <DocumentGrid
            documents={filteredDocuments}
            projectSlug={projectSlug}
            userRole={userRole}
            selectedDocs={selectedDocs}
            progressMap={progressMap}
            lastPollTimes={lastPollTimes}
            canDeleteDocuments={canDeleteDocuments}
            canChangeVisibility={canChangeVisibility}
            onToggleSelect={toggleDocSelection}
            onPreview={openPreviewModal}
            onDownload={handleDownload}
            onRename={openRenameModal}
            onDelete={handleDelete}
            onAccessLevelChange={handleAccessLevelChange}
            onForceResume={handleForceResume}
          />
        )}
      </div>

      {/* Footer */}
      {!loading && documents.length > 0 && (
        <div className="border-t border-gray-700 p-4 bg-dark-surface">
          <p className="text-sm text-gray-400 text-center">
            Showing {documents.length} document
            {documents.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Rename modal */}
      {renameModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div
            ref={renameModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-library-rename-dialog-title"
            className="bg-dark-card border border-gray-700 rounded-lg shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200"
          >
            <h3
              id="document-library-rename-dialog-title"
              className="text-xl font-bold text-slate-50 mb-4"
            >
              Rename Document
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Enter a new name for &quot;{renameDocument?.name}&quot;
            </p>
            <div>
              <input
                type="text"
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setRenameModalOpen(false);
                    setRenameDocument(null);
                    setNewDocumentName('');
                  }
                }}
                className="w-full px-4 py-2 bg-dark-surface border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="Enter document name"
                aria-label="New document name"
                aria-describedby="name-requirements"
                maxLength={200}
                autoFocus
              />
              <div
                id="name-requirements"
                className="flex justify-between items-center mt-2 text-xs"
                role="status"
                aria-live="polite"
              >
                <span
                  className={`${newDocumentName.length < 3 ? 'text-orange-500' : 'text-gray-400'}`}
                >
                  {newDocumentName.length < 3 &&
                    newDocumentName.length > 0 &&
                    'Minimum 3 characters'}
                </span>
                <span
                  className={`${newDocumentName.length > 180 ? 'text-orange-500' : 'text-gray-400'}`}
                >
                  {newDocumentName.length}/200
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setRenameModalOpen(false);
                  setRenameDocument(null);
                  setNewDocumentName('');
                }}
                className="flex-1 px-4 py-2 bg-dark-surface hover:bg-dark-base text-gray-300 border border-gray-600 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={
                  !newDocumentName.trim() || newDocumentName.length < 3
                }
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDocument}
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          setPreviewDocument(null);
        }}
      />

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <DocumentCategoryModal
          isOpen={showCategoryModal}
          fileName={pendingFile?.name || ''}
          fileType={pendingFile?.type || ''}
          onConfirm={handleCategorySelected}
          onCancel={() => {
            setShowCategoryModal(false);
            setPendingFile(null);
            setPreSelectedCategory(null);
          }}
        />
      )}

      {/* View 3D model confirm */}
      <ConfirmDialog
        open={showViewModelConfirm}
        onConfirm={() => {
          setShowViewModelConfirm(false);
          router.push(`/project/${projectSlug}/models`);
        }}
        onCancel={() => setShowViewModelConfirm(false)}
        title="View 3D Model"
        description="Would you like to view the model in the 3D viewer?"
        confirmLabel="View Model"
        cancelLabel="Not Now"
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        onConfirm={doBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        title="Delete Documents"
        description={`Delete ${selectedDocs.size} selected document${selectedDocs.size > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />

      {/* Single-doc delete confirm */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        pendingDeleteDoc={pendingDeleteDoc}
        deletionImpact={deletionImpact}
        deletionImpactLoading={deletionImpactLoading}
        cleanupExtracted={cleanupExtracted}
        onCleanupChange={setCleanupExtracted}
        onConfirm={doDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
