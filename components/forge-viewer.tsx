'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Maximize2, Minimize2, RotateCcw, Box, Layers, Eye } from 'lucide-react';

// Use global Autodesk types - avoiding duplicate declaration
type _AutodeskViewer = any;
type _AutodeskDocument = any;
type _AutodeskBubbleNode = any;

interface ForgeViewerProps {
  urn: string;
  onViewerReady?: (viewer: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function ForgeViewer({ urn, onViewerReady, onError, className = '' }: ForgeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [_accessToken, setAccessToken] = useState<string | null>(null);

  // Fetch access token
  const fetchToken = useCallback(async () => {
    try {
      const response = await fetch('/api/autodesk/token');
      if (!response.ok) throw new Error('Failed to get viewer token');
      const data = await response.json();
      setAccessToken(data.access_token);
      return data.access_token;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token fetch failed';
      setError(message);
      onError?.(message);
      return null;
    }
  }, [onError]);

  // Load Autodesk Viewer scripts
  useEffect(() => {
    const loadViewerScripts = async () => {
      // Check if already loaded
      if (window.Autodesk?.Viewing) return true;

      // Load CSS
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      // Pinned version - do not use wildcard (7.*) for security. Update manually after testing.
      css.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.99.1/style.min.css';
      document.head.appendChild(css);

      // Load JS
      return new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        // Pinned version - do not use wildcard (7.*) for security. Update manually after testing.
        script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.99.1/viewer3D.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    };

    loadViewerScripts();
  }, []);

  // Initialize viewer
  useEffect(() => {
    if (!urn || !containerRef.current) return;

    let viewer: any = null;
    let mounted = true;

    const initViewer = async () => {
      // Get token first
      const token = await fetchToken();
      if (!token || !mounted) return;

      // Wait for Autodesk SDK to load
      let attempts = 0;
      while (!window.Autodesk?.Viewing && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.Autodesk?.Viewing) {
        setError('Failed to load Autodesk Viewer SDK');
        setLoading(false);
        return;
      }

      // Initialize the viewer
      const options = {
        env: 'AutodeskProduction2',
        api: 'streamingV2',
        getAccessToken: (callback: (token: string, expires: number) => void) => {
          callback(token, 3600);
        },
      };

      window.Autodesk.Viewing.Initializer(options, () => {
        if (!mounted || !containerRef.current) return;

        viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current);
        viewerRef.current = viewer;

        const startedCode = viewer.start();
        if (startedCode > 0) {
          setError('Failed to initialize viewer');
          setLoading(false);
          return;
        }

        // Set dark theme
        viewer.setTheme('dark-theme');

        // Load the document
        const documentId = `urn:${urn}`;
        window.Autodesk.Viewing.Document.load(
          documentId,
          (doc) => {
            if (!viewer || !mounted) return;

            const viewables = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewables).then(() => {
              if (!mounted) return;
              setLoading(false);
              onViewerReady?.(viewer!);
            });
          },
          (errorCode) => {
            console.error('[ForgeViewer] Document load error:', errorCode);
            setError(`Failed to load model (Error: ${errorCode})`);
            setLoading(false);
          },
          () => token
        );
      });
    };

    initViewer();

    return () => {
      mounted = false;
      if (viewer) {
        viewer.finish();
        viewerRef.current = null;
      }
    };
  }, [urn, fetchToken, onViewerReady]);

  // Viewer controls
  const handleFitToView = () => viewerRef.current?.fitToView();
  const handleShowAll = () => viewerRef.current?.showAll();
  const handleIsolate = () => viewerRef.current?.isolate();

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.parentElement?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-white rounded-lg p-8 ${className}`}>
        <div className="text-center">
          <Box aria-hidden="true" className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-400 font-medium">{error}</p>
          <p className="text-gray-400 text-sm mt-2">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Viewer container */}
      <div ref={containerRef} className="w-full h-full min-h-[400px]" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 aria-hidden="true" className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
            <p className="text-white mt-4">Loading 3D Model...</p>
            <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!loading && !error && (
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button
            onClick={handleFitToView}
            className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg text-white transition-colors"
            title="Fit to View"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={handleShowAll}
            className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg text-white transition-colors"
            title="Show All"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button
            onClick={handleIsolate}
            className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg text-white transition-colors"
            title="Clear Isolation"
          >
            <Layers className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      )}
    </div>
  );
}
