'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { useProject } from '@/components/layout/project-context';

type DocumentCategory = string;

export function useDocumentUpload() {
  const { project, refreshProject } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('other');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF and DOCX files are supported');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      toast.error('File size must be less than 200MB');
      return;
    }

    setPendingFile(file);
    setShowCategoryModal(true);
  }, []);

  const uploadDirect = useCallback(async (file: File, category: DocumentCategory) => {
    if (!project) return;

    const toastId = toast.loading('Preparing upload...');

    const presignRes = await fetchWithRetry('/api/documents/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || 'application/octet-stream',
        projectId: project.id,
        category,
      }),
      retryOptions: {
        maxRetries: 2,
        initialDelay: 1000,
        onRetry: (attempt: number) => {
          toast.loading(`Preparing upload, retrying... (${attempt}/2)`, { id: toastId });
        },
      },
    });

    if (!presignRes.ok) {
      toast.dismiss(toastId);
      let errorMessage = 'Failed to prepare upload';
      try {
        const data = await presignRes.json();
        errorMessage = data.error || errorMessage;
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }

    const { uploadUrl, cloudStoragePath } = await presignRes.json();
    setUploadProgress(20);
    toast.loading('Uploading to storage...', { id: toastId });

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    if (!uploadRes.ok) {
      toast.dismiss(toastId);
      if (uploadRes.status === 403) {
        throw new Error('Upload URL expired. Please try again.');
      }
      throw new Error(`Upload to storage failed (${uploadRes.status})`);
    }

    setUploadProgress(70);
    toast.loading('Confirming upload...', { id: toastId });

    const confirmRes = await fetchWithRetry('/api/documents/confirm-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cloudStoragePath,
        fileName: file.name,
        fileSize: file.size,
        projectId: project.id,
        category,
      }),
      retryOptions: {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (attempt: number) => {
          toast.loading(`Confirming upload, retrying... (${attempt}/3)`, { id: toastId });
        },
      },
    });

    toast.dismiss(toastId);

    if (!confirmRes.ok) {
      let errorMessage = 'Failed to confirm upload';
      try {
        const data = await confirmRes.json();
        errorMessage = data.error || errorMessage;
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }
  }, [project]);

  const handleCategoryConfirm = useCallback(async (category: DocumentCategory) => {
    setShowCategoryModal(false);
    setSelectedCategory(category);

    if (!pendingFile) return;

    setUploading(true);
    setUploadProgress(5);

    try {
      await uploadDirect(pendingFile, category);

      setUploadProgress(100);
      toast.success(`Document "${pendingFile.name}" uploaded successfully!`);

      await refreshProject();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPendingFile(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload document';
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [pendingFile, uploadDirect, refreshProject]);

  const handleCategoryCancel = useCallback(() => {
    setShowCategoryModal(false);
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    uploading,
    uploadProgress,
    pendingFile,
    selectedCategory,
    showCategoryModal,
    handleFileUpload,
    handleCategoryConfirm,
    handleCategoryCancel,
    triggerUpload,
  };
}
