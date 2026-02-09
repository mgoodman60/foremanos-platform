'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/components/layout/project-context';

export function useProjectModals() {
  const { project } = useProject();

  const [showDocumentLibrary, setShowDocumentLibrary] = useState(false);
  const [showProcessingMonitor, setShowProcessingMonitor] = useState(false);
  const [showWeatherWidget, setShowWeatherWidget] = useState(false);
  const [showWeatherPreferences, setShowWeatherPreferences] = useState(false);
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false);
  const [showLookahead, setShowLookahead] = useState(false);
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [showOneDriveSettings, setShowOneDriveSettings] = useState(false);
  const [showFinalizationSettings, setShowFinalizationSettings] = useState(false);

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only PNG, JPG, and SVG are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleLogoUpload = useCallback(async () => {
    if (!logoFile || !project) return;

    setUploadingLogo(true);
    try {
      const presignedRes = await fetch(`/api/projects/${project.slug}/logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: logoFile.name,
          contentType: logoFile.type,
        }),
      });

      if (!presignedRes.ok) {
        const error = await presignedRes.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploadUrl, cloud_storage_path } = await presignedRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': logoFile.type },
        body: logoFile,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to S3');
      }

      const confirmRes = await fetch(`/api/projects/${project.slug}/logo/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_storage_path }),
      });

      if (!confirmRes.ok) {
        const error = await confirmRes.json();
        throw new Error(error.error || 'Failed to save logo');
      }

      toast.success('Company logo updated successfully!');
      setShowLogoUpload(false);
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }, [logoFile, project]);

  const closeLogoUpload = useCallback(() => {
    setShowLogoUpload(false);
    setLogoFile(null);
    setLogoPreview(null);
  }, []);

  return {
    showDocumentLibrary, setShowDocumentLibrary,
    showProcessingMonitor, setShowProcessingMonitor,
    showWeatherWidget, setShowWeatherWidget,
    showWeatherPreferences, setShowWeatherPreferences,
    showPhotoLibrary, setShowPhotoLibrary,
    showLookahead, setShowLookahead,
    showReportHistory, setShowReportHistory,
    showLogoUpload, setShowLogoUpload,
    showOneDriveSettings, setShowOneDriveSettings,
    showFinalizationSettings, setShowFinalizationSettings,
    logoFile, logoPreview, uploadingLogo,
    handleLogoFileSelect, handleLogoUpload, closeLogoUpload,
  };
}
