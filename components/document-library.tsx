"use client";

import { useState, useEffect, useRef } from 'react';
import { FileText, X, Download, Loader2, Trash2, FileImage, File, Pencil, Eye, EyeOff, Lock, Globe, Upload, Shield, CheckSquare, Square, Filter, Box, ExternalLink, CheckCircle2 } from 'lucide-react';
import { WithTooltip } from '@/components/ui/icon-button';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
type DocumentCategory = string;
import { getAllCategories, getCategoryLabel } from '@/lib/document-categorizer';
import DocumentPreviewModal from './document-preview-modal';
import { DocumentCategoryModal } from './document-category-modal';
import { useOptimisticDocuments } from '@/hooks/useOptimisticDocuments';
import { ConfirmDialog } from './confirm-dialog';

// CAD file extensions supported by Autodesk
const CAD_EXTENSIONS = ['.dwg', '.dxf', '.dwf', '.dwfx', '.rvt', '.rfa', '.ifc', '.nwd', '.nwc', '.3ds', '.fbx', '.obj', '.stl', '.stp', '.step', '.iges', '.igs', '.f3d', '.skp'];

function isCADFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return CAD_EXTENSIONS.includes(ext);
}

interface DocumentLibraryProps {
  userRole: string;
  projectId: string;
  onDocumentsChange?: () => void;
}

interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  accessLevel: string;
  category: string;
  filePath: string | null;
  fileSize: number | null;
  lastModified: string | null;
  updatedAt: string;
}

export function DocumentLibrary({ userRole, projectId, onDocumentsChange }: DocumentLibraryProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameDocument, setRenameDocument] = useState<Document | null>(null);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkAccessMenu, setShowBulkAccessMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [projectSlug, setProjectSlug] = useState<string>('');
  const [preSelectedCategory, setPreSelectedCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cadFileInputRef = useRef<HTMLInputElement>(null);
  const [showViewModelConfirm, setShowViewModelConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<Document | null>(null);

  const categories = getAllCategories();

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
      const response = await fetch(`/api/documents?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();

      // Admins and clients can see all documents (they need to manage visibility)
      // Guests only see documents with accessLevel 'guest'
      const accessible = (userRole === 'admin' || userRole === 'client')
        ? data.documents
        : data.documents.filter((doc: Document) =>
            doc.accessLevel === 'guest'
          );

      setDocuments(accessible);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // Initialize optimistic update hook (after fetchDocuments is defined)
  const { optimisticDelete, optimisticChangeAccess } = useOptimisticDocuments({
    documents,
    setDocuments,
    fetchDocuments,
    onDocumentsChange,
  });

  useEffect(() => {
    fetchDocuments();
    fetchProjectSlug();
  }, [projectId]);

  // Handle CAD file upload to Autodesk
  const handleCADUpload = async (file: File) => {
    if (!projectSlug) {
      toast.error('Project not found');
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Uploading ${file.name} to CAD viewer...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectSlug', projectSlug);

      const response = await fetch('/api/autodesk/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      toast.success('CAD file uploaded! Processing will take a few minutes. View in Models page.', { id: toastId });

      // Optionally navigate to models page
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

    // Check if it's a CAD file
    if (isCADFile(file.name)) {
      handleCADUpload(file);
      e.target.value = ''; // Reset input
      return;
    }

    // Validate file type for documents (PDF, DOCX, XLSX, images)
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast.error('Supported files: PDF, DOCX, XLSX, images, or CAD files (.dwg, .rvt, .ifc, etc.)');
      return;
    }

    // Validate file size (200MB limit)
    if (file.size > 200 * 1024 * 1024) {
      toast.error('File size must be less than 200MB');
      return;
    }

    // If category is already selected, upload immediately
    if (preSelectedCategory) {
      handleUpload(preSelectedCategory, file);
      setPreSelectedCategory(null);
    } else {
      // Otherwise, open category modal for selection
      setPendingFile(file);
      setShowCategoryModal(true);
    }
  };

  const handleUpload = async (category: DocumentCategory, file?: File) => {
    const fileToUpload = file || pendingFile;
    if (!fileToUpload) return;

    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('projectId', projectId);
    formData.append('category', category);

    try {
      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || 'Failed to upload document'));
            } catch {
              reject(new Error('Failed to upload document'));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.open('POST', '/api/documents/upload');
        xhr.send(formData);
      });

      toast.success('Document uploaded successfully');
      setShowCategoryModal(false);
      setPendingFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchDocuments(); // Refresh the list
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (userRole === 'guest') return; // Guests can't upload
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

    // Check if it's a CAD file
    if (isCADFile(file.name)) {
      handleCADUpload(file);
      return;
    }

    // Validate file type for documents
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast.error('Supported files: PDF, DOCX, XLSX, images, or CAD files (.dwg, .rvt, .ifc, etc.)');
      return;
    }

    // Validate file size (200MB limit)
    if (file.size > 200 * 1024 * 1024) {
      toast.error('File size must be less than 200MB');
      return;
    }

    // If category is already selected, upload immediately
    if (preSelectedCategory) {
      handleUpload(preSelectedCategory, file);
      setPreSelectedCategory(null);
    } else {
      // Otherwise, open category modal for selection
      setPendingFile(file);
      setShowCategoryModal(true);
    }
  };

  const handleCategoryFirstUpload = () => {
    // Open category selection modal without a file
    setPendingFile(null);
    setShowCategoryModal(true);
  };

  const handleCategorySelected = async (category: DocumentCategory) => {
    if (!pendingFile) {
      // User selected category first, now prompt for file
      setPreSelectedCategory(category);
      setShowCategoryModal(false);
      toast.success(
        <div className="flex flex-col gap-1">
          <div className="font-semibold">Category Selected!</div>
          <div className="text-sm">{getCategoryLabel(category)} - Now choose your file to upload</div>
        </div>,
        {
          duration: 4000,
          icon: '📁',
        }
      );
      // Trigger file input
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else {
      // User dropped file first, category selected second (old flow)
      await handleUpload(category);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      const kb = bytes / 1024;
      return `${kb.toFixed(0)} KB`;
    }
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const handleDownload = async (doc: Document) => {
    try {
      // Fetch the signed URL from the API
      const response = await fetch(`/api/documents/${doc.id}?download=true`);
      
      if (!response.ok) {
        throw new Error('Failed to generate download URL');
      }

      const data = await response.json();
      
      // If the response contains a URL, use it for download
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
  };

  const handleRename = async () => {
    if (!renameDocument || !newDocumentName.trim()) {
      toast.error('Document name cannot be empty');
      return;
    }

    // Validate file name
    const trimmedName = newDocumentName.trim();
    if (trimmedName.length < 3) {
      toast.error('Document name must be at least 3 characters long');
      return;
    }
    
    if (trimmedName.length > 200) {
      toast.error('Document name is too long (max 200 characters)');
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(trimmedName)) {
      toast.error('Document name contains invalid characters');
      return;
    }

    // Check if name is the same
    if (trimmedName === renameDocument.name) {
      toast.error('New name must be different from the current name');
      return;
    }

    try {
      const response = await fetch(`/api/documents/${renameDocument.id}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename document');
      }

      toast.success('✓ Document renamed successfully');
      setRenameModalOpen(false);
      setRenameDocument(null);
      setNewDocumentName('');
      // Refresh the document list
      fetchDocuments();
    } catch (error) {
      console.error('Error renaming document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rename document');
    }
  };

  const openRenameModal = (doc: Document) => {
    setRenameDocument(doc);
    setNewDocumentName(doc.name);
    setRenameModalOpen(true);
  };

  const openPreviewModal = (doc: Document) => {
    setPreviewDocument(doc);
    setPreviewModalOpen(true);
  };

  // Bulk selection handlers
  const toggleDocSelection = (docId: string) => {
    setSelectedDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const selectAllDocs = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(doc => doc.id)));
    }
  };

  // Bulk action handlers
  const bulkDownload = async () => {
    if (selectedDocs.size === 0) return;
    
    setBulkActionLoading(true);
    let successCount = 0;
    
    for (const docId of selectedDocs) {
      const doc = documents.find(d => d.id === docId);
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
    toast.success(`✓ Downloaded ${successCount} of ${selectedDocs.size} documents`);
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

    if (success) {
      toast.success(`Deleted ${docCount} document(s)`);
    }
  };

  const bulkChangeAccess = async (newAccessLevel: 'admin' | 'client' | 'guest') => {
    if (selectedDocs.size === 0) return;

    setBulkActionLoading(true);
    const docCount = selectedDocs.size;
    const success = await optimisticChangeAccess(
      Array.from(selectedDocs),
      newAccessLevel
    );
    setBulkActionLoading(false);
    setSelectedDocs(new Set());

    if (success) {
      toast.success(`Updated access for ${docCount} document(s)`);
    }
  };

  const handleDelete = (doc: Document) => {
    setPendingDeleteDoc(doc);
    setShowDeleteConfirm(true);
  };

  const doDelete = async () => {
    setShowDeleteConfirm(false);
    const doc = pendingDeleteDoc;
    setPendingDeleteDoc(null);
    if (!doc) return;

    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete document');
      }

      toast.success('Document deleted successfully');
      // Refresh the document list
      fetchDocuments();
      // Notify parent of changes
      onDocumentsChange?.();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete document');
    }
  };

  const handleAccessLevelChange = async (doc: Document, newAccessLevel: string) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/access`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessLevel: newAccessLevel }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update visibility');
      }

      const data = await response.json();
      toast.success(data.message || 'Document visibility updated');
      // Refresh the document list
      fetchDocuments();
    } catch (error) {
      console.error('Error updating access level:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update visibility');
    }
  };

  // Check if user can delete documents (admins and clients/project owners)
  const canDeleteDocuments = userRole === 'admin' || userRole === 'client';
  
  // Check if user can change document visibility
  const canChangeVisibility = userRole === 'admin' || userRole === 'client';

  const getAccessLevelBadge = (accessLevel: string) => {
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
  };

  const getAccessLevelDescription = (accessLevel: string) => {
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
  };

  const getCategoryBadge = (category: string) => {
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
      <span className={`inline-flex items-center px-2 py-1 border text-xs font-medium rounded-full ${colors[category] || colors.other}`}>
        {categoryLabel}
      </span>
    );
  };

  // Filter documents by category
  const filteredDocuments = selectedCategory === 'all' 
    ? documents 
    : documents.filter(doc => doc.category === selectedCategory);

  const getDocumentIcon = (fileType: string) => {
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
  };

  const getDocumentColor = (fileType: string) => {
    const type = fileType.toLowerCase();
    switch (type) {
      case 'pdf':
        return 'bg-red-900/30 border-red-700';
      case 'doc':
      case 'docx':
        return 'bg-blue-900/30 border-blue-700';
      case 'xlsx':
      case 'xls':
        return 'bg-green-900/30 border-green-700';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'bg-purple-900/30 border-purple-700';
      default:
        return 'bg-gray-800 border-gray-600';
    }
  };

  const isRecentlyUpdated = (updatedAt: string) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffInHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
    return diffInHours < 48; // Within last 48 hours
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div 
      className={`flex flex-col h-full bg-dark-surface ${isDragging ? 'ring-2 ring-[#F97316] ring-inset' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input - accepts documents and CAD files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.dwg,.dxf,.dwf,.dwfx,.rvt,.rfa,.ifc,.nwd,.nwc,.3ds,.fbx,.obj,.stl,.stp,.step,.iges,.igs,.f3d,.skp"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Drag overlay */}
      {isDragging && userRole !== 'guest' && (
        <div className="absolute inset-0 z-50 bg-[#F97316]/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-dark-card border-2 border-dashed border-[#F97316] rounded-lg p-8 text-center max-w-md">
            <Upload className="w-16 h-16 text-[#F97316] mx-auto mb-4 animate-bounce" />
            <p className="text-xl font-semibold text-[#F8FAFC] mb-2">Drop file here to upload</p>
            {preSelectedCategory && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-lg font-semibold mb-3">
                <CheckCircle2 className="w-5 h-5" />
                <span>{getCategoryLabel(preSelectedCategory as DocumentCategory)}</span>
              </div>
            )}
            {!preSelectedCategory && (
              <p className="text-sm text-gray-300 mb-2">File will be categorized after drop</p>
            )}
            <p className="text-sm text-gray-400">PDF, DOCX, XLSX, images, or CAD files (.dwg, .rvt, .ifc)</p>
            <p className="text-xs text-gray-500 mt-1">Maximum file size: 200MB</p>
          </div>
        </div>
      )}
      
      {/* Header - Dark Theme with Bulk Actions */}
      <div className="bg-dark-card border-b border-gray-700 p-3 lg:p-6">
        {selectedDocs.size > 0 ? (
          /* Bulk Actions Toolbar */
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <WithTooltip tooltip="Clear selection">
                <button
                  onClick={() => setSelectedDocs(new Set())}
                  className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
                  aria-label="Clear selection"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </WithTooltip>
              <div>
                <h3 className="text-lg font-semibold text-[#F8FAFC]">
                  {selectedDocs.size} Selected
                </h3>
                <p className="text-sm text-gray-400">
                  {selectedDocs.size} of {documents.length} document{documents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Download */}
              <button
                onClick={bulkDownload}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-3 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {bulkActionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Download</span>
              </button>
              
              {/* Bulk Access Change - Admin Only */}
              {canDeleteDocuments && (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setShowBulkAccessMenu(!showBulkAccessMenu)}
                      disabled={bulkActionLoading}
                      className="flex items-center gap-2 px-3 py-2 bg-dark-card hover:bg-dark-surface border border-gray-600 text-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Lock className="w-4 h-4" />
                      <span className="hidden sm:inline">Access</span>
                    </button>
                    
                    {showBulkAccessMenu && (
                      <div className="absolute right-0 top-full mt-2 bg-dark-card border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px] animate-in fade-in zoom-in-95 duration-200">
                        <button
                          onClick={() => {
                            bulkChangeAccess('admin');
                            setShowBulkAccessMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors"
                        >
                          Admin Only
                        </button>
                        <button
                          onClick={() => {
                            bulkChangeAccess('client');
                            setShowBulkAccessMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors"
                        >
                          Client Access
                        </button>
                        <button
                          onClick={() => {
                            bulkChangeAccess('guest');
                            setShowBulkAccessMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors"
                        >
                          Guest Access
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Bulk Delete */}
                  <button
                    onClick={bulkDelete}
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
        ) : (
          /* Normal Header */
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 id="document-library-title" className="text-lg lg:text-2xl font-bold text-[#F8FAFC]">Documents</h2>
                <p className="text-gray-400 text-xs lg:text-sm mt-1">
                  {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} 
                  {selectedCategory !== 'all' && ` in ${getCategoryLabel(selectedCategory as DocumentCategory)}`}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Category Pre-Selection Badge */}
                {preSelectedCategory && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white border-2 border-[#F97316] rounded-lg text-sm font-semibold shadow-lg animate-in fade-in zoom-in-95 duration-200">
                    <CheckCircle2 className="w-5 h-5" />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="text-xs sm:text-sm">Selected:</span>
                      <span className="font-bold">{getCategoryLabel(preSelectedCategory as DocumentCategory)}</span>
                    </div>
                    <button
                      onClick={() => setPreSelectedCategory(null)}
                      className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
                      aria-label="Clear category selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* View CAD Models Button */}
                {projectSlug && (
                  <button
                    onClick={() => router.push(`/project/${projectSlug}/models`)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium"
                  >
                    <Box className="w-4 h-4" />
                    <span className="hidden sm:inline">CAD Models</span>
                  </button>
                )}

                {/* Upload Button - Non-guests only */}
                {userRole !== 'guest' && (
                  <div className="relative">
                    <button
                      onClick={handleCategoryFirstUpload}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCategoryFirstUpload();
                        }
                      }}
                      disabled={uploading}
                      aria-label="Upload document"
                      className="flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:ring-offset-[#1c2128]"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden sm:inline">Uploading {uploadProgress}%</span>
                          <span className="sm:hidden">{uploadProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span className="hidden sm:inline">Upload</span>
                        </>
                      )}
                    </button>
                    {/* Upload Progress Bar */}
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
                
                {documents.length > 0 && canDeleteDocuments && (
                  <button
                    onClick={selectAllDocs}
                    className="text-sm text-gray-300 hover:text-[#F97316] transition-colors flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Select All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            {documents.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                    className="flex items-center gap-2 px-3 py-2 bg-dark-surface hover:bg-dark-card border border-gray-600 text-gray-300 rounded-lg transition-all text-sm"
                  >
                    <Filter className="w-4 h-4" />
                    <span>Filter by Category</span>
                  </button>
                  
                  {showCategoryFilter && (
                    <div className="absolute left-0 top-full mt-2 bg-dark-card border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
                      <button
                        onClick={() => {
                          setSelectedCategory('all');
                          setShowCategoryFilter(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          selectedCategory === 'all' 
                            ? 'bg-[#F97316] text-white' 
                            : 'text-gray-300 hover:bg-dark-surface'
                        }`}
                      >
                        All Categories
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => {
                            setSelectedCategory(cat.value);
                            setShowCategoryFilter(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                            selectedCategory === cat.value 
                              ? 'bg-[#F97316] text-white' 
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
                    onClick={() => setSelectedCategory('all')}
                    className="text-xs text-gray-400 hover:text-[#F97316] transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document List - Mobile & Tablet Optimized */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-6 bg-dark-surface">
          {loading ? (
            <div className="space-y-3">
              {/* Skeleton Loading States */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-dark-card border border-gray-700 rounded-lg p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                    <div className="h-8 w-20 bg-gray-700 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center max-w-md px-4">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-orange-500/30">
                  <FileText className="w-12 h-12 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-[#F8FAFC] mb-3">
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
                      onClick={() => fileInputRef.current?.click()}
                      className="mb-6 px-6 py-3 bg-[#F97316] hover:bg-[#EA580C] active:bg-[#C2410C] text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-dark-base"
                    >
                      <Upload className="w-5 h-5 inline mr-2" />
                      Upload Your First Document
                    </button>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#F97316]/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-[#F97316]" />
                        </div>
                        <span>PDF & DOCX</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#F97316]/10 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-[#F97316]" />
                        </div>
                        <span>Up to 200MB</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#F97316]/10 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-[#F97316]" />
                        </div>
                        <span>Secure Storage</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 lg:space-y-3">
              {filteredDocuments.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-dark-card border border-gray-700 rounded-lg p-3 lg:p-4 hover:border-[#F97316] hover:shadow-lg hover:bg-dark-surface transition-all group"
                >
                  {/* Mobile & Tablet Simple View (< 1024px) */}
                  <div className="lg:hidden">
                    <div className="flex items-center gap-3">
                      {/* Checkbox - Admin/Owner Only */}
                      {canDeleteDocuments && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDocSelection(doc.id);
                          }}
                          className="flex-shrink-0 p-1 hover:bg-dark-surface rounded transition-colors"
                          aria-label={`Select ${doc.name}`}
                        >
                          {selectedDocs.has(doc.id) ? (
                            <CheckSquare className="w-5 h-5 text-[#F97316]" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-500" />
                          )}
                        </button>
                      )}
                      
                      {/* Small Icon */}
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-gray-600 bg-dark-surface`}>
                          {doc.fileType.toLowerCase() === 'pdf' ? (
                            <FileText className="w-5 h-5 text-red-500" />
                          ) : doc.fileType.toLowerCase() === 'docx' || doc.fileType.toLowerCase() === 'doc' ? (
                            <FileText className="w-5 h-5 text-blue-500" />
                          ) : (
                            <File className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      </div>
                      
                      {/* Document Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-[#F8FAFC] truncate">
                          {doc.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span className="font-medium uppercase">{doc.fileType}</span>
                          <span>•</span>
                          <span>{formatFileSize(doc.fileSize)}</span>
                        </div>
                        <div className="mt-1.5">
                          {getCategoryBadge(doc.category)}
                        </div>
                      </div>
                      
                      {/* Preview Button */}
                      <button
                        type="button"
                        className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-dark-card hover:bg-dark-surface border border-gray-600 text-gray-300 hover:text-[#F97316] rounded-lg transition-all active:scale-95"
                        aria-label={`Preview ${doc.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openPreviewModal(doc);
                        }}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      
                      {/* Download Button */}
                      <button
                        type="button"
                        className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-all active:scale-95"
                        aria-label={`Download ${doc.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownload(doc);
                        }}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Full View (>= 1024px) */}
                  <div className="hidden lg:block">
                    <div className="flex items-center justify-between gap-4">
                      {/* Document Thumbnail & Info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Checkbox - Admin/Owner Only */}
                        {canDeleteDocuments && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDocSelection(doc.id);
                            }}
                            className="flex-shrink-0 p-2 hover:bg-dark-surface rounded transition-colors mt-1"
                            aria-label={`Select ${doc.name}`}
                          >
                            {selectedDocs.has(doc.id) ? (
                              <CheckSquare className="w-6 h-6 text-[#F97316]" />
                            ) : (
                              <Square className="w-6 h-6 text-gray-500" />
                            )}
                          </button>
                        )}
                        
                        {/* Large Thumbnail */}
                        <div className="flex-shrink-0">
                          <div className="w-20 h-20 rounded-xl flex items-center justify-center border-2 border-gray-600 bg-dark-surface transition-transform hover:scale-105">
                            {getDocumentIcon(doc.fileType)}
                          </div>
                        </div>
                        {/* Document Details */}
                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex items-start gap-2 mb-2">
                            <h3 className="font-bold text-[#F8FAFC] truncate text-lg flex-1">
                              {doc.name}
                            </h3>
                            {isRecentlyUpdated(doc.updatedAt) && (
                              <span className="px-2 py-1 bg-green-900/30 text-green-400 border border-green-700 text-xs font-bold rounded-full whitespace-nowrap flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                Recently Updated
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                            <span className="px-3 py-1 bg-dark-surface border border-gray-600 rounded-full text-xs font-bold uppercase">
                              {doc.fileType}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="font-medium">{formatFileSize(doc.fileSize)}</span>
                            <span className="text-gray-600">•</span>
                            <span className="text-xs font-medium" title={`Last modified: ${new Date(doc.updatedAt).toLocaleString()}`}>
                              Modified {formatRelativeTime(doc.updatedAt)}
                            </span>
                          </div>
                          
                          {/* Category Badge */}
                          <div className="mt-2">
                            {getCategoryBadge(doc.category)}
                          </div>
                          
                          {/* Visibility Controls - Desktop Only */}
                          {canChangeVisibility && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-gray-400">Visibility:</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAccessLevelChange(doc, 'admin')}
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
                                    onClick={() => handleAccessLevelChange(doc, 'client')}
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
                                    onClick={() => handleAccessLevelChange(doc, 'guest')}
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
                              <p className="text-xs text-gray-500 mt-1.5">
                                {getAccessLevelDescription(doc.accessLevel)}
                              </p>
                            </div>
                          )}
                          
                          {/* Show badge only for non-admin/non-client users */}
                          {!canChangeVisibility && (
                            <div className="mt-2">
                              {getAccessLevelBadge(doc.accessLevel)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons - Desktop Only */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 bg-dark-card hover:bg-dark-surface border border-gray-600 text-gray-300 hover:text-[#F97316] rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:ring-offset-[#1F2328] focus:outline-none"
                          aria-label={`Preview ${doc.name}`}
                          title="Preview document"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openPreviewModal(doc);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          <span>Preview</span>
                        </button>
                        
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:ring-offset-[#1F2328] focus:outline-none"
                          aria-label={`Download ${doc.name}`}
                          title="Download document"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDownload(doc);
                          }}
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                        
                        {canDeleteDocuments && (
                          <>
                            <button
                              type="button"
                              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 focus:ring-offset-[#1F2328] focus:outline-none"
                              aria-label={`Rename ${doc.name}`}
                              title="Rename document"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openRenameModal(doc);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                              <span>Rename</span>
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-[#1F2328] focus:outline-none"
                              aria-label={`Delete ${doc.name}`}
                              title="Delete document"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(doc);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      {/* Footer */}
      {!loading && documents.length > 0 && (
        <div className="border-t border-gray-700 p-4 bg-dark-surface">
          <p className="text-sm text-gray-400 text-center">
            Showing {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Rename Modal */}
      {renameModalOpen && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-library-rename-dialog-title"
        >
          <div className="bg-dark-card border border-gray-700 rounded-lg shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 id="document-library-rename-dialog-title" className="text-xl font-bold text-[#F8FAFC] mb-4">Rename Document</h3>
            <p className="text-sm text-gray-400 mb-4">
              Enter a new name for "{renameDocument?.name}"
            </p>
            <div>
              <input
                type="text"
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                  if (e.key === 'Escape') {
                    setRenameModalOpen(false);
                    setRenameDocument(null);
                    setNewDocumentName('');
                  }
                }}
                className="w-full px-4 py-2 bg-dark-surface border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent outline-none"
                placeholder="Enter document name"
                aria-label="New document name"
                aria-describedby="name-requirements"
                maxLength={200}
                autoFocus
              />
              <div id="name-requirements" className="flex justify-between items-center mt-2 text-xs" role="status" aria-live="polite">
                <span className={`${newDocumentName.length < 3 ? 'text-orange-500' : 'text-gray-500'}`}>
                  {newDocumentName.length < 3 && newDocumentName.length > 0 && 'Minimum 3 characters'}
                </span>
                <span className={`${newDocumentName.length > 180 ? 'text-orange-500' : 'text-gray-500'}`}>
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
                disabled={!newDocumentName.trim() || newDocumentName.length < 3}
                className="flex-1 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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

      <ConfirmDialog
        open={showViewModelConfirm}
        onConfirm={() => { setShowViewModelConfirm(false); router.push(`/project/${projectSlug}/models`); }}
        onCancel={() => setShowViewModelConfirm(false)}
        title="View 3D Model"
        description="Would you like to view the model in the 3D viewer?"
        confirmLabel="View Model"
        cancelLabel="Not Now"
      />

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

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={doDelete}
        onCancel={() => { setShowDeleteConfirm(false); setPendingDeleteDoc(null); }}
        title="Delete Document"
        description={`Are you sure you want to delete "${pendingDeleteDoc?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}
