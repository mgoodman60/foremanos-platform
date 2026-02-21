'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Trash2, RefreshCw, Box, FileType, Clock, CheckCircle, XCircle, AlertCircle, X, Database, Zap, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, Info, Layers, Ruler, Scissors, Pencil, Palette, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ForgeViewerEnhanced, ViewerToolbar, ModelElementTree, ElementPropertiesPanel, MeasurementTools, SectionTools, MarkupTools, BIMDataPanel, RenderingTools, LayerControlPanel, AIRenderPanel } from './viewer';
import type { ViewerHandle } from './viewer';

// Supported formats for Autodesk Model Derivative API
const SUPPORTED_FORMATS = [
  '.dwg', '.dxf', '.dwf', '.dwfx', '.rvt', '.rfa', '.ifc',
  '.nwd', '.nwc', '.3ds', '.fbx', '.obj', '.stl', '.stp',
  '.step', '.iges', '.igs', '.f3d', '.skp', '.zip',
];

interface AutodeskModel {
  id: string;
  fileName: string;
  urn: string;
  status: 'processing' | 'ready' | 'failed' | 'complete';
  fileSize: number | null;
  createdAt: string;
  thumbnailUrl: string | null;
  extracted?: boolean;
  takeoffId?: string;
  takeoffItems?: number;
  // DWG-specific metadata
  fileType?: string;
  totalLayers?: number;
  totalBlocks?: number;
  totalAnnotations?: number;
  layerCategories?: Record<string, number>;
}

interface ModelViewerPanelProps {
  projectSlug: string;
}

export default function ModelViewerPanel({ projectSlug }: ModelViewerPanelProps) {
  const [models, setModels] = useState<AutodeskModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<AutodeskModel | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [showSidePanels, setShowSidePanels] = useState(true);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [activeToolsTab, setActiveToolsTab] = useState<'measure' | 'section' | 'markup' | 'bim' | 'render' | 'layers' | 'ai'>('bim');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const viewerRef = useRef<ViewerHandle>(null);
  const [deleteModel, setDeleteModel] = useState<AutodeskModel | null>(null);

  // Fetch models for the project
  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch(`/api/autodesk/models?projectSlug=${projectSlug}`);
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error('[ModelViewer] Fetch error:', error);
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Poll for processing models
  useEffect(() => {
    const processingModels = models.filter(m => m.status === 'processing');
    if (processingModels.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const model of processingModels) {
        try {
          const response = await fetch(`/api/autodesk/models/${model.id}/status`);
          if (response.ok) {
            const data = await response.json();
            if (data.status !== 'processing') {
              // Refresh the models list
              fetchModels();
              if (data.status === 'ready') {
                toast.success(`${model.fileName} is ready to view!`);
              } else if (data.status === 'failed') {
                toast.error(`${model.fileName} failed to process`);
              }
            }
          }
        } catch (e) {
          console.error('[ModelViewer] Status poll error:', e);
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [models, fetchModels]);

  // Auto-switch to appropriate tab based on file type
  useEffect(() => {
    if (selectedModel) {
      if (selectedModel.fileType === 'dwg') {
        // For DWG files, default to Layers tab
        setActiveToolsTab('layers');
        setShowToolsPanel(true);
      } else {
        // For BIM files, default to BIM tab
        setActiveToolsTab('bim');
      }
    }
  }, [selectedModel?.id]);

  // Handle file upload
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!SUPPORTED_FORMATS.includes(ext)) {
      toast.error(`Unsupported file format. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);

    try {
      // Step 1: Get presigned URL
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

      // Step 2: Upload file directly to R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      if (!putRes.ok) {
        throw new Error(putRes.status === 403
          ? 'Upload URL expired. Please try again.'
          : `Upload to storage failed (${putRes.status})`);
      }

      // Step 3: Tell the server to process the uploaded file
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

      toast.success('File uploaded! Processing will take a few minutes.', { id: toastId });
      fetchModels();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Handle delete
  const handleDelete = (model: AutodeskModel) => {
    setDeleteModel(model);
  };

  const doDelete = async () => {
    const model = deleteModel;
    setDeleteModel(null);
    if (!model) return;

    try {
      const response = await fetch(`/api/autodesk/models/${model.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      toast.success('Model deleted');
      if (selectedModel?.id === model.id) setSelectedModel(null);
      fetchModels();
    } catch (error) {
      toast.error('Failed to delete model');
    }
  };

  // Handle BIM data extraction
  const handleExtract = async (model: AutodeskModel) => {
    const toastId = toast.loading(`Extracting BIM data from ${model.fileName}...`);

    try {
      const response = await fetch(`/api/autodesk/models/${model.id}/extract`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Extraction failed');
      }

      const data = await response.json();
      toast.success(
        `Extracted ${data.takeoff.importedItems} items for takeoff, ${data.rag.indexedChunks} chunks indexed for chat`,
        { id: toastId }
      );
      fetchModels();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Extraction failed';
      toast.error(message, { id: toastId });
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  // Format file size
  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get status icon
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'ready':
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="model-viewer-container bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Box className="w-5 h-5 text-blue-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">3D Model Viewer</h2>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            Autodesk Forge
          </span>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept={SUPPORTED_FORMATS.join(',')}
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading}
          />
          <span className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Upload className="w-4 h-4" aria-hidden="true" />
            Upload Model
          </span>
        </label>
      </div>

      <div className="flex h-[600px]">
        {/* Sidebar - Model List */}
        <div className="w-72 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <p className="text-xs text-gray-400">
              Supports: DWG, RVT, IFC, SKP, 3DS, FBX, and more
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`m-4 p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <FileType className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">Drop CAD/BIM files here</p>
          </div>

          {/* Models list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" aria-hidden="true" />
              </div>
            ) : models.length === 0 ? (
              <div className="text-center py-8">
                <Box className="w-12 h-12 text-gray-600 mx-auto mb-3" aria-hidden="true" />
                <p className="text-gray-400 text-sm">No models uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                      selectedModel?.id === model.id
                        ? 'bg-blue-600/20 border border-blue-500/50'
                        : 'hover:bg-gray-800 border border-transparent'
                    }`}
                    onClick={() => (model.status === 'ready' || model.status === 'complete') && setSelectedModel(model)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={model.status} />
                          <span className="text-sm text-white font-medium truncate">
                            {model.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{formatSize(model.fileSize)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {new Date(model.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(model);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {model.status === 'processing' && (
                      <div className="mt-2">
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                        </div>
                        <p className="text-xs text-yellow-400 mt-1">Processing...</p>
                      </div>
                    )}
                    {(model.status === 'ready' || model.status === 'complete') && model.extracted && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {model.fileType === 'dwg' ? (
                          // DWG-specific display
                          <>
                            {(model.totalLayers ?? 0) > 0 && (
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <Layers className="w-3 h-3" aria-hidden="true" />
                                {model.totalLayers} layers
                              </span>
                            )}
                            {(model.totalBlocks ?? 0) > 0 && (
                              <span className="text-xs text-blue-400 flex items-center gap-1">
                                <Box className="w-3 h-3" aria-hidden="true" />
                                {model.totalBlocks} blocks
                              </span>
                            )}
                            {(model.totalAnnotations ?? 0) > 0 && (
                              <span className="text-xs text-purple-400 flex items-center gap-1">
                                <Info className="w-3 h-3" aria-hidden="true" />
                                {model.totalAnnotations} notes
                              </span>
                            )}
                          </>
                        ) : (
                          // BIM-specific display
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Database className="w-3 h-3" aria-hidden="true" />
                            {model.takeoffItems || 0} items extracted
                          </span>
                        )}
                      </div>
                    )}
                    {(model.status === 'ready' || model.status === 'complete') && !model.extracted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtract(model);
                        }}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" aria-hidden="true" />
                        Extract Data
                      </button>
                    )}
                    {model.status === 'failed' && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" aria-hidden="true" /> Conversion failed
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Viewer area */}
        <div className="flex-1 bg-gray-900 relative">
          {selectedModel ? (
            <>
              {/* Top bar with controls */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => setSelectedModel(null)}
                  className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg text-white transition-colors"
                  title="Close Model"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="px-3 py-1.5 bg-gray-800/90 rounded-lg">
                  <p className="text-sm text-white font-medium">{selectedModel.fileName}</p>
                </div>

                <button
                  onClick={() => setShowSidePanels(!showSidePanels)}
                  className={`p-2 rounded-lg transition-colors ${showSidePanels ? 'bg-blue-600 text-white' : 'bg-gray-800/90 hover:bg-gray-700 text-white'}`}
                  title={showSidePanels ? 'Hide Left Panel' : 'Show Left Panel'}
                >
                  {showSidePanels ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
                </button>

                <button
                  onClick={() => setShowToolsPanel(!showToolsPanel)}
                  className={`p-2 rounded-lg transition-colors ${showToolsPanel ? 'bg-cyan-600 text-white' : 'bg-gray-800/90 hover:bg-gray-700 text-white'}`}
                  title={showToolsPanel ? 'Hide Tools Panel' : 'Show Tools Panel'}
                >
                  {showToolsPanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRight className="w-5 h-5" />}
                </button>

                {activeTool && (
                  <div className="px-3 py-1.5 bg-blue-600/90 rounded-lg">
                    <p className="text-xs text-white font-medium capitalize">{activeTool} Tool Active</p>
                  </div>
                )}
              </div>

              {/* Enhanced Viewer */}
              <ForgeViewerEnhanced
                ref={viewerRef}
                urn={selectedModel.urn}
                className="w-full h-full"
                onError={(error) => toast.error(error)}
                onSelectionChanged={setSelectedIds}
              />

              {/* Viewer Toolbar */}
              <ViewerToolbar
                viewerRef={viewerRef}
                onToolChange={setActiveTool}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => {
                  const container = document.querySelector('.model-viewer-container');
                  if (!isFullscreen) {
                    container?.requestFullscreen?.();
                  } else {
                    document.exitFullscreen?.();
                  }
                  setIsFullscreen(!isFullscreen);
                }}
              />

              {/* Side panels (Element Tree & Properties) */}
              {showSidePanels && (
                <div className="absolute top-20 left-4 bottom-4 w-72 flex flex-col gap-4 z-10">
                  <ModelElementTree
                    viewerRef={viewerRef}
                    selectedIds={selectedIds}
                    onSelect={setSelectedIds}
                    className="flex-1 max-h-[50%]"
                  />
                  <ElementPropertiesPanel
                    viewerRef={viewerRef}
                    selectedIds={selectedIds}
                    className="flex-1 max-h-[50%]"
                  />
                </div>
              )}

              {/* Right Tools Panel */}
              {showToolsPanel && (
                <div className="absolute top-20 right-4 bottom-4 w-80 z-10 flex flex-col">
                  {/* Tab buttons */}
                  <div className="flex gap-1 mb-2 bg-gray-800/90 p-1 rounded-lg flex-wrap">
                    <button
                      onClick={() => setActiveToolsTab('bim')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        activeToolsTab === 'bim' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Database className="w-3 h-3" /> BIM
                    </button>
                    <button
                      onClick={() => setActiveToolsTab('render')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        activeToolsTab === 'render' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Palette className="w-3 h-3" /> Render
                    </button>
                    <button
                      onClick={() => setActiveToolsTab('measure')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        activeToolsTab === 'measure' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Ruler className="w-3 h-3" /> Measure
                    </button>
                    <button
                      onClick={() => setActiveToolsTab('section')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        activeToolsTab === 'section' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Scissors className="w-3 h-3" /> Section
                    </button>
                    <button
                      onClick={() => setActiveToolsTab('markup')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        activeToolsTab === 'markup' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Pencil className="w-3 h-3" /> Markup
                    </button>
                    {selectedModel?.fileType === 'dwg' && (
                      <button
                        onClick={() => setActiveToolsTab('layers')}
                        className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                          activeToolsTab === 'layers' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Layers className="w-3 h-3" /> Layers
                      </button>
                    )}
                    <button
                      onClick={() => setActiveToolsTab('ai')}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        activeToolsTab === 'ai' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" /> AI Render
                    </button>
                  </div>

                  {/* Tool content */}
                  <div className="flex-1 overflow-y-auto">
                    {activeToolsTab === 'bim' && (
                      <BIMDataPanel
                        projectSlug={projectSlug}
                        modelId={selectedModel.id}
                        modelUrn={selectedModel.urn}
                        onRefresh={fetchModels}
                      />
                    )}
                    {activeToolsTab === 'render' && (
                      <RenderingTools viewerRef={viewerRef} />
                    )}
                    {activeToolsTab === 'measure' && (
                      <MeasurementTools
                        viewerRef={viewerRef}
                        projectSlug={projectSlug}
                      />
                    )}
                    {activeToolsTab === 'section' && (
                      <SectionTools viewerRef={viewerRef} />
                    )}
                    {activeToolsTab === 'markup' && (
                      <MarkupTools
                        viewerRef={viewerRef}
                        projectSlug={projectSlug}
                        modelId={selectedModel.id}
                      />
                    )}
                    {activeToolsTab === 'layers' && selectedModel?.fileType === 'dwg' && (
                      <LayerControlPanel
                        viewerRef={viewerRef}
                        modelId={selectedModel.id}
                        projectSlug={projectSlug}
                        layerCategories={selectedModel.layerCategories}
                        totalLayers={selectedModel.totalLayers}
                        className="h-full"
                      />
                    )}
                    {activeToolsTab === 'ai' && (
                      <AIRenderPanel
                        modelId={selectedModel.id}
                        projectSlug={projectSlug}
                        modelName={selectedModel.fileName}
                        className="h-full"
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Box className="w-16 h-16 text-gray-600 mx-auto mb-4" aria-hidden="true" />
                <p className="text-gray-400 text-lg">Select a model to view</p>
                <p className="text-gray-400 text-sm mt-1">
                  Or upload a CAD/BIM file to get started
                </p>
                <div className="mt-6 grid grid-cols-3 gap-4 max-w-md mx-auto text-xs text-gray-400">
                  <div className="flex flex-col items-center p-3 bg-gray-800/50 rounded-lg">
                    <Layers className="w-5 h-5 text-blue-400 mb-2" aria-hidden="true" />
                    <span>Section Planes</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-gray-800/50 rounded-lg">
                    <Box className="w-5 h-5 text-green-400 mb-2" aria-hidden="true" />
                    <span>Measurements</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-gray-800/50 rounded-lg">
                    <Info className="w-5 h-5 text-purple-400 mb-2" aria-hidden="true" />
                    <span>Properties</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteModel !== null}
        onConfirm={doDelete}
        onCancel={() => setDeleteModel(null)}
        title="Delete Model"
        description={deleteModel ? `Delete ${deleteModel.fileName}? This cannot be undone.` : ''}
        variant="destructive"
      />
    </div>
  );
}
