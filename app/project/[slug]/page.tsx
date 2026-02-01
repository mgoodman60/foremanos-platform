'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Home, Upload, FileText, X, Cloud, Settings, History, CloudRain, Users, Image as ImageIcon, Ruler, Calendar, Wrench, DoorOpen, DollarSign, BookOpen, Layers, Pin, Menu, ChevronDown, MoreVertical, User, Box, ClipboardList, Cpu, TrendingUp, BarChart2, Plug, Camera } from 'lucide-react';
import { toast } from 'sonner';
type DocumentCategory = string;
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { ChatInterface } from '@/components/chat-interface';
import { DocumentLibrary } from '@/components/document-library';
import OneDriveSettings from '@/components/onedrive-settings';
import { FinalizationSettingsModal } from '@/components/finalization-settings-modal';
import { DailyReportHistory } from '@/components/daily-report-history';
import { DocumentCategoryModal } from '@/components/document-category-modal';
import WeatherWidget from '@/components/weather-widget';
import WeatherPreferencesModal from '@/components/weather-preferences-modal';
import { PhotoLibrary } from '@/components/photo-library';
import ScheduleProgressRibbon from '@/components/schedule-progress-ribbon';
import ThreeWeekLookahead from '@/components/three-week-lookahead';
import DocumentProcessingMonitor from '@/components/document-processing-monitor';
import OnboardingChecklist from '@/components/onboarding-checklist';
import { MobileBottomNav } from '@/components/mobile';
import SubmittalMetricsWidget from '@/components/submittals/SubmittalMetricsWidget';
import { SkeletonProjectWorkspace } from '@/components/ui/skeleton-card';

interface Project {
  id: string;
  name: string;
  slug: string;
  documentCount: number;
  ownerId: string;
}

export default function ProjectPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDocumentLibrary, setShowDocumentLibrary] = useState(false);
  const [showProcessingMonitor, setShowProcessingMonitor] = useState(false);
  const [showOneDriveSettings, setShowOneDriveSettings] = useState(false);
  const [showFinalizationSettings, setShowFinalizationSettings] = useState(false);
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [showWeatherWidget, setShowWeatherWidget] = useState(false);
  const [showWeatherPreferences, setShowWeatherPreferences] = useState(false);
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false);
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('other');
  const [showLookahead, setShowLookahead] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [pendingUpdatesCount, setPendingUpdatesCount] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    common: true,
    analysis: true,
    browsing: true,
    admin: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Last synced timestamp
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Mobile-specific state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSection = (section: 'common' | 'analysis' | 'browsing' | 'admin') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && slug) {
      fetchProject();
      fetchPendingUpdatesCount();
    }
  }, [status, slug, router]);

  // Real-time polling for pending schedule updates (every 30 seconds)
  const prevCountRef = useRef(0);
  
  useEffect(() => {
    if (status !== 'authenticated' || !slug) return;

    // Set up polling interval
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${slug}/schedule-updates/pending-count`);
        if (res.ok) {
          const data = await res.json();
          const newCount = data.count || 0;
          
          // Show toast if count increased
          if (newCount > prevCountRef.current && prevCountRef.current > 0) {
            const diff = newCount - prevCountRef.current;
            toast.info(
              `${diff} new schedule update${diff !== 1 ? 's' : ''} available`,
              {
                duration: 5000,
                action: {
                  label: 'Review',
                  onClick: () => router.push(`/project/${slug}/schedule-updates`),
                },
              }
            );
          }
          
          prevCountRef.current = newCount;
          setPendingUpdatesCount(newCount);
        }
      } catch (error) {
        console.error('Error polling pending updates:', error);
        // Silently fail - polling will retry on next interval
      }
    }, 30000); // Poll every 30 seconds

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, [status, slug, router]);

  const fetchProject = async (retryCount = 0) => {
    setLoading(true);
    const maxRetries = 3;
    
    try {
      const res = await fetch(`/api/projects/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setLastSynced(new Date());
      } else if (res.status === 403) {
        toast.error('You do not have access to this project');
        router.push('/dashboard');
      } else if (res.status === 503 && retryCount < maxRetries) {
        // Database connection error - retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`[Project] Connection error, retrying in ${delay}ms...`);
        toast.loading(`Connecting to project... (attempt ${retryCount + 2}/${maxRetries + 1})`, {
          id: 'project-retry',
        });
        setTimeout(() => fetchProject(retryCount + 1), delay);
        return;
      } else {
        toast.error('Project not found');
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Error fetching project:', error);
      
      // Retry on connection errors
      if (retryCount < maxRetries && (
        error?.message?.includes('fetch') ||
        error?.message?.includes('network') ||
        error?.message?.includes('connection')
      )) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`[Project] Network error, retrying in ${delay}ms...`);
        toast.loading(`Reconnecting... (attempt ${retryCount + 2}/${maxRetries + 1})`, {
          id: 'project-retry',
        });
        setTimeout(() => fetchProject(retryCount + 1), delay);
        return;
      }
      
      toast.error('Failed to load project. Please refresh the page.');
    } finally {
      setLoading(false);
      toast.dismiss('project-retry');
    }
  };

  const fetchPendingUpdatesCount = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/schedule-updates/pending-count`);
      if (res.ok) {
        const data = await res.json();
        const count = data.count || 0;
        setPendingUpdatesCount(count);
        prevCountRef.current = count; // Initialize ref for polling comparison
      }
    } catch (error) {
      console.error('Error fetching pending updates count:', error);
      // Silently fail - this is not critical
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type (PDF and DOCX)
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF and DOCX files are supported');
      return;
    }

    // Validate file size (200MB max)
    if (file.size > 200 * 1024 * 1024) {
      toast.error('File size must be less than 200MB');
      return;
    }

    // Show category selection modal
    setPendingFile(file);
    setShowCategoryModal(true);
  };

  const handleCategoryConfirm = async (category: DocumentCategory) => {
    setShowCategoryModal(false);
    setSelectedCategory(category);

    if (!pendingFile) return;

    setUploading(true);
    setUploadProgress(5);

    try {
      // Use chunked upload for files larger than 5MB
      if (pendingFile.size > 5 * 1024 * 1024) {
        await uploadInChunks(pendingFile, category);
      } else {
        await uploadDirect(pendingFile, category);
      }

      setUploadProgress(100);
      toast.success(`Document "${pendingFile.name}" uploaded successfully!`);
      
      // Refresh project data
      await fetchProject();
      
      // Reset file input and pending file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPendingFile(null);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCategoryCancel = () => {
    setShowCategoryModal(false);
    setPendingFile(null);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only PNG, JPG, and SVG are allowed.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !project) return;

    setUploadingLogo(true);

    try {
      // Step 1: Get presigned URL
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

      // Step 2: Upload file to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': logoFile.type },
        body: logoFile,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Step 3: Confirm upload completion
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
      console.error('Logo upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadDirect = async (file: File, category: DocumentCategory) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', project!.id);
    formData.append('category', category);

    setUploadProgress(30);

    const toastId = toast.loading('Uploading document...');
    
    const res = await fetchWithRetry('/api/documents/upload', {
      method: 'POST',
      body: formData,
      retryOptions: {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (attempt: number) => {
          toast.loading(`Upload interrupted, retrying... (${attempt}/3)`, { id: toastId });
        },
      },
    });

    toast.dismiss(toastId);
    setUploadProgress(70);

    if (!res.ok) {
      // Try to parse as JSON, but handle plain text errors
      let errorMessage = 'Failed to upload document';
      try {
        const data = await res.json();
        errorMessage = data.error || errorMessage;
      } catch (jsonError) {
        // Response is not JSON, try to get text
        try {
          const text = await res.text();
          errorMessage = text || errorMessage;
        } catch (textError) {
          // Can't read response, use status text
          errorMessage = `Upload failed: ${res.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }
  };

  const uploadInChunks = async (file: File, category: DocumentCategory) => {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log(`[CHUNKED UPLOAD] Starting: ${file.name} (${totalChunks} chunks)`);
    const toastId = toast.loading(`Uploading ${file.name}...`);

    // Upload each chunk with retry
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('metadata', JSON.stringify({
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        chunkIndex,
        totalChunks,
        projectId: project!.id,
      }));

      const res = await fetchWithRetry('/api/documents/upload-chunk', {
        method: 'POST',
        body: formData,
        retryOptions: {
          maxRetries: 3,
          initialDelay: 2000,
          onRetry: (attempt: number) => {
            toast.loading(`Chunk ${chunkIndex + 1} upload interrupted, retrying... (${attempt}/3)`, { id: toastId });
          },
        },
      });

      if (!res.ok) {
        toast.dismiss(toastId);
        // Try to parse as JSON, but handle plain text errors
        let errorMessage = `Failed to upload chunk ${chunkIndex + 1}`;
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch (jsonError) {
          // Response is not JSON, try to get text
          try {
            const text = await res.text();
            errorMessage = `${errorMessage}: ${text}`;
          } catch (textError) {
            // Can't read response, use status text
            errorMessage = `${errorMessage}: ${res.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Update progress (reserve last 10% for assembly)
      const progress = 10 + Math.floor((chunkIndex + 1) / totalChunks * 80);
      setUploadProgress(progress);
      toast.loading(`Uploading... ${Math.round(progress)}%`, { id: toastId });
      
      console.log(`[CHUNKED UPLOAD] Chunk ${chunkIndex + 1}/${totalChunks} uploaded`);
    }

    // Complete the upload (server will assemble chunks)
    console.log('[CHUNKED UPLOAD] Completing upload...');
    setUploadProgress(90);
    toast.loading('Finalizing upload...', { id: toastId });

    const completeRes = await fetchWithRetry('/api/documents/upload-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        projectId: project!.id,
        category,
      }),
      retryOptions: {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (attempt: number) => {
          toast.loading(`Finalizing interrupted, retrying... (${attempt}/3)`, { id: toastId });
        },
      },
    });

    toast.dismiss(toastId);

    if (!completeRes.ok) {
      // Try to parse as JSON, but handle plain text errors
      let errorMessage = 'Failed to complete upload';
      try {
        const data = await completeRes.json();
        errorMessage = data.error || errorMessage;
      } catch (jsonError) {
        // Response is not JSON, try to get text
        try {
          const text = await completeRes.text();
          errorMessage = text || errorMessage;
        } catch (textError) {
          // Can't read response, use status text
          errorMessage = `Upload completion failed: ${completeRes.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    console.log('[CHUNKED UPLOAD] Upload complete!');
  };

  // Helper to format "Last synced" timestamp
  const formatLastSynced = (): string => {
    if (!lastSynced) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastSynced.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    return lastSynced.toLocaleTimeString();
  };

  if (loading || status === 'loading') {
    return <SkeletonProjectWorkspace />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface flex flex-col">
      {/* Header with Breadcrumbs - Compact */}
      <header className="bg-dark-card border-b border-gray-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-1.5 sm:py-2">
          {/* Single Row Layout - Logo, Breadcrumbs, Actions */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo */}
            <img 
              src="/foremanos-new-logo.png" 
              alt="ForemanOS" 
              className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
            />

            {/* Breadcrumbs */}
            <nav className="flex items-center text-xs sm:text-sm text-gray-400 flex-1 min-w-0">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center hover:text-[#F97316] transition-colors flex-shrink-0"
              >
                <Home className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 mx-1 flex-shrink-0" />
              <span className="text-[#F8FAFC] font-medium truncate">{project.name}</span>
              {/* Last synced indicator */}
              {lastSynced && (
                <span className="hidden lg:flex items-center gap-1.5 ml-4 text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {formatLastSynced()}
                </span>
              )}
            </nav>

            {/* Actions - Dropdown Menu */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 relative">
              {/* Tools Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowToolsMenu(!showToolsMenu)}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors font-medium"
                  title="Project Tools"
                >
                  <MoreVertical className="w-4 h-4" />
                  <span className="hidden sm:inline">Tools</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showToolsMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowToolsMenu(false)}
                    />
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-2 w-64 bg-dark-card border border-gray-700 rounded-lg shadow-2xl z-50 max-h-[80vh] overflow-y-auto">
                      {/* Common Tools */}
                      <div className="border-b border-gray-700">
                        <button
                          onClick={() => toggleSection('common')}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-dark-surface transition-colors"
                        >
                          <p className="text-xs font-semibold text-gray-400 tracking-wider">COMMON</p>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedSections.common ? '' : '-rotate-90'}`} />
                        </button>
                        <div className={`overflow-hidden transition-all duration-200 ${expandedSections.common ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="p-2">
                            <button
                              onClick={() => { setShowDocumentLibrary(true); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span>Documents</span>
                            </button>
                            <button
                              onClick={() => { setShowProcessingMonitor(true); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Settings className="w-4 h-4 text-blue-400" />
                              <span>Processing Status</span>
                            </button>
                            <button
                              onClick={() => { setShowReportHistory(true); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <History className="w-4 h-4 text-gray-400" />
                              <span>Daily Report History</span>
                            </button>
                            <button
                              onClick={() => { setShowWeatherWidget(true); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <CloudRain className="w-4 h-4 text-cyan-400" />
                              <span>Weather Intelligence</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Analysis Tools */}
                      <div className="border-b border-gray-700">
                        <button
                          onClick={() => toggleSection('analysis')}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-dark-surface transition-colors"
                        >
                          <p className="text-xs font-semibold text-gray-400 tracking-wider">ANALYSIS</p>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedSections.analysis ? '' : '-rotate-90'}`} />
                        </button>
                        <div className={`overflow-hidden transition-all duration-200 ${expandedSections.analysis ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="p-2">
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/takeoffs`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Ruler className="w-4 h-4 text-yellow-400" />
                              <span>Material Takeoffs</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/schedules`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Calendar className="w-4 h-4 text-cyan-400" />
                              <span>Project Schedule</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/intelligence`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              <span>Intelligence Dashboard</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/spatial`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Layers className="w-4 h-4 text-cyan-400" />
                              <span>Spatial Correlation</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/isometric`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              <span>Isometric Views</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Browsing Tools */}
                      <div className="border-b border-gray-700">
                        <button
                          onClick={() => toggleSection('browsing')}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-dark-surface transition-colors"
                        >
                          <p className="text-xs font-semibold text-gray-400 tracking-wider">BROWSING</p>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedSections.browsing ? '' : '-rotate-90'}`} />
                        </button>
                        <div className={`overflow-hidden transition-all duration-200 ${expandedSections.browsing ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="p-2">
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/mep`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Wrench className="w-4 h-4 text-blue-400" />
                              <span>MEP Equipment</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/rooms`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <DoorOpen className="w-4 h-4 text-green-400" />
                              <span>Room Browser</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/legends`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <BookOpen className="w-4 h-4 text-purple-400" />
                              <span>Legend & Symbols</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/scales`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Ruler className="w-4 h-4 text-cyan-400" />
                              <span>Scale Validation</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/annotations`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Pin className="w-4 h-4 text-pink-400" />
                              <span>Visual Annotations</span>
                            </button>
                            <button
                              onClick={() => { router.push(`/project/${project.slug}/drawing-types`); setShowToolsMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                            >
                              <Layers className="w-4 h-4 text-blue-400" />
                              <span>Drawing Classification</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Admin Tools - Owner Only */}
                      {session?.user.id === project.ownerId && (
                        <div>
                          <button
                            onClick={() => toggleSection('admin')}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-dark-surface transition-colors"
                          >
                            <p className="text-xs font-semibold text-gray-400 tracking-wider">ADMIN</p>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedSections.admin ? '' : '-rotate-90'}`} />
                          </button>
                          <div className={`overflow-hidden transition-all duration-200 ${expandedSections.admin ? 'max-h-[40rem] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-2">
                              <button
                                onClick={() => { setShowPhotoLibrary(true); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <ImageIcon className="w-4 h-4 text-green-400" />
                                <span>Photo Library</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/subcontractors`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Users className="w-4 h-4 text-purple-400" />
                                <span>Subcontractors</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/crews`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Users className="w-4 h-4 text-indigo-400" />
                                <span>Crew Management</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/budget`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <DollarSign className="w-4 h-4 text-amber-400" />
                                <span>Budget Management</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/models`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Box className="w-4 h-4 text-blue-400" />
                                <span>3D Model Viewer</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/field-ops`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <ClipboardList className="w-4 h-4 text-orange-400" />
                                <span>Field Operations</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/mep`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Cpu className="w-4 h-4 text-purple-400" />
                                <span>MEP Tracking</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/schedule-budget`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <TrendingUp className="w-4 h-4 text-cyan-400" />
                                <span>Schedule & Budget Hub</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/reports`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <BarChart2 className="w-4 h-4 text-orange-400" />
                                <span>Reports & Analytics</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/integrations`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Plug className="w-4 h-4 text-purple-400" />
                                <span>Integrations</span>
                              </button>
                              <button
                                onClick={() => { setShowLogoUpload(true); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <ImageIcon className="w-4 h-4 text-emerald-400" />
                                <span>Company Logo</span>
                              </button>
                              <button
                                onClick={() => { setShowOneDriveSettings(true); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Cloud className="w-4 h-4 text-[#F97316]" />
                                <span>OneDrive Settings</span>
                              </button>
                              <button
                                onClick={() => { setShowFinalizationSettings(true); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Settings className="w-4 h-4 text-blue-400" />
                                <span>Report Settings</span>
                              </button>
                              <div className="border-t border-gray-700 my-2" />
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/settings`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <Settings className="w-4 h-4 text-orange-400" />
                                <span>Project Settings</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/templates`); setShowToolsMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <FileText className="w-4 h-4 text-cyan-400" />
                                <span>Document Templates</span>
                              </button>
                              <button
                                onClick={() => { router.push(`/project/${project.slug}/schedule-updates`); setShowToolsMenu(false); }}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-dark-surface rounded transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar className="w-4 h-4 text-orange-400" />
                                  <span>Schedule Updates</span>
                                </div>
                                {pendingUpdatesCount > 0 && (
                                  <span className="px-2 py-0.5 text-xs font-semibold bg-orange-600 text-white rounded-full">
                                    {pendingUpdatesCount}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* User Settings Button */}
              <button
                onClick={() => router.push('/profile')}
                className="p-1.5 sm:p-2 bg-dark-surface hover:bg-dark-base text-gray-300 border border-gray-600 rounded-lg transition-colors"
                title="User Settings"
              >
                <User className="w-4 h-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-1.5 sm:p-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={uploading ? `Uploading... ${uploadProgress}%` : 'Upload Document (PDF/DOCX)'}
              >
                <Upload className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
                className="p-1.5 sm:p-2 text-gray-300 hover:text-white hover:bg-dark-surface rounded-lg transition-colors ml-1"
                title="Sign Out"
                data-testid="logout-button"
              >
                <span className="text-xs sm:text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Onboarding Checklist */}
      <div className="bg-dark-surface px-3 sm:px-6 py-2">
        <OnboardingChecklist 
          projectSlug={slug}
          onRefresh={() => fetchProject()}
          onOpenDocumentLibrary={() => setShowDocumentLibrary(true)}
        />
      </div>

      {/* Schedule Progress Ribbon (with integrated Health Score) */}
      <div className="bg-dark-surface px-3 sm:px-6 py-2 overflow-hidden">
        <ScheduleProgressRibbon 
          projectSlug={slug} 
          compact={false}
          pendingUpdatesCount={pendingUpdatesCount}
        />
      </div>

      {/* Submittal Metrics Widget (compact) */}
      <div className="bg-dark-surface px-3 sm:px-6 pb-2 overflow-hidden">
        <SubmittalMetricsWidget projectSlug={slug} compact={true} />
      </div>

      {/* Chat Interface */}
      <main className="flex-1 pb-16 md:pb-0">
        <ChatInterface 
          userRole={session?.user.role || 'guest'} 
          projectSlug={slug}
          projectId={project.id}
          mobileOpen={showMobileSidebar}
          onMobileClose={() => setShowMobileSidebar(false)}
        />
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          activeTab="chat"
          projectSlug={slug}
          onShowDocuments={() => setShowDocumentLibrary(true)}
          onShowCamera={() => setShowQuickCapture(true)}
          onUpload={() => fileInputRef.current?.click()}
          onToggleSidebar={() => setShowMobileSidebar(true)}
          pendingUpdatesCount={pendingUpdatesCount}
        />
      )}

      {/* Photo Library Modal (Mobile Quick Capture) */}
      {showQuickCapture && project && (
        <PhotoLibrary
          projectSlug={slug}
          onClose={() => setShowQuickCapture(false)}
          startInUploadMode={true}
        />
      )}

      {/* Document Library Modal */}
      {showDocumentLibrary && project && session?.user && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-[#F8FAFC]">Project Documents</h2>
              <button
                onClick={() => setShowDocumentLibrary(false)}
                className="p-2 hover:bg-dark-surface text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <DocumentLibrary 
                userRole={session.user.role || 'guest'} 
                projectId={project.id} 
                onDocumentsChange={() => fetchProject()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Company Logo Upload Modal */}
      {showLogoUpload && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-[#F8FAFC]">Upload Company Logo</h2>
              <button
                onClick={() => {
                  setShowLogoUpload(false);
                  setLogoFile(null);
                  setLogoPreview(null);
                }}
                className="p-2 hover:bg-dark-surface text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-400">
                Upload your company logo to appear on daily report PDFs. Accepted formats: PNG, JPG, SVG (max 5MB).
              </div>

              {!logoPreview ? (
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('logo-file-input')?.click()}
                >
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-500 mb-2" />
                  <div className="text-sm text-gray-400">
                    Click to select logo file
                  </div>
                  <input
                    id="logo-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    onChange={handleLogoFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="max-h-32 max-w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="flex-1 px-4 py-2 bg-dark-surface hover:bg-dark-base text-gray-300 rounded-lg transition-colors"
                    >
                      Change File
                    </button>
                    <button
                      onClick={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OneDrive Settings Modal */}
      {showOneDriveSettings && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-[#F8FAFC]">OneDrive Sync Settings</h2>
              <button
                onClick={() => setShowOneDriveSettings(false)}
                className="p-2 hover:bg-dark-surface text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <OneDriveSettings 
                projectSlug={slug} 
                isOwner={session?.user.id === project.ownerId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Finalization Settings Modal */}
      <FinalizationSettingsModal
        projectSlug={slug}
        isOpen={showFinalizationSettings}
        onClose={() => setShowFinalizationSettings(false)}
      />

      {/* Daily Report History Modal */}
      <DailyReportHistory
        projectSlug={slug}
        isOpen={showReportHistory}
        onClose={() => setShowReportHistory(false)}
      />

      {/* Document Category Selection Modal */}
      {pendingFile && (
        <DocumentCategoryModal
          isOpen={showCategoryModal}
          fileName={pendingFile.name}
          fileType={pendingFile.name.split('.').pop() || 'pdf'}
          onConfirm={handleCategoryConfirm}
          onCancel={handleCategoryCancel}
        />
      )}

      {/* Weather Widget Modal */}
      {showWeatherWidget && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-surface rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-[#F8FAFC]">Weather Intelligence</h2>
              <button
                onClick={() => setShowWeatherWidget(false)}
                className="p-2 hover:bg-dark-card text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <WeatherWidget
                projectId={project.id}
                onOpenPreferences={() => {
                  setShowWeatherWidget(false);
                  setShowWeatherPreferences(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Weather Preferences Modal */}
      <WeatherPreferencesModal
        projectId={project.id}
        isOpen={showWeatherPreferences}
        onClose={() => setShowWeatherPreferences(false)}
      />

      {/* Photo Library Modal */}
      {showPhotoLibrary && project && (
        <PhotoLibrary
          projectSlug={project.slug}
          onClose={() => setShowPhotoLibrary(false)}
        />
      )}

      {/* 3-Week Look-Ahead Modal */}
      {showLookahead && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">3-Week Look-Ahead Schedule</h2>
              <button
                onClick={() => setShowLookahead(false)}
                className="p-2 hover:bg-dark-surface text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ThreeWeekLookahead
                projectSlug={slug}
                onTaskClick={(taskId) => {
                  console.log('Task clicked:', taskId);
                  // Navigate to task or show details
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Document Processing Monitor Modal */}
      {showProcessingMonitor && project && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-[#F8FAFC]">Document Processing Status</h2>
              <button
                onClick={() => setShowProcessingMonitor(false)}
                className="p-2 hover:bg-dark-surface text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <DocumentProcessingMonitor 
                projectId={project.id}
                projectSlug={slug}
                autoRefresh={true}
                refreshInterval={10}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
