'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Box, Info } from 'lucide-react';
import ModelViewerPanel from '@/components/model-viewer-panel';

export function ModelsPageContent({
  projectSlug,
  projectName,
}: {
  projectSlug: string;
  projectName: string;
}) {
  const router = useRouter();
  const [forgeConfigured, setForgeConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const checkForge = async () => {
      try {
        const res = await fetch('/api/autodesk/token');
        setForgeConfigured(res.status !== 503);
      } catch {
        setForgeConfigured(false);
      }
    };

    checkForge();
  }, []);

  if (forgeConfigured === null) {
    return (
      <div className="min-h-screen bg-dark-base flex items-center justify-center">
        <div className="text-center">
          <Box className="w-12 h-12 text-blue-500 mx-auto animate-pulse" />
          <p className="text-gray-400 mt-4">Loading 3D Viewer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-base">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-subtle border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/project/${projectSlug}`)}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Project</span>
              </button>
              <div className="h-6 w-px bg-gray-700" />
              <div className="flex items-center gap-3">
                <Box className="w-6 h-6 text-blue-400" />
                <div>
                  <h1 className="text-lg font-semibold text-white">3D Model Viewer</h1>
                  <p className="text-xs text-gray-400">{projectName}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-400">Powered by Autodesk Forge</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {forgeConfigured === false ? (
          <div className="flex items-center justify-center py-20">
            <div className="max-w-md text-center p-8 bg-dark-subtle border border-gray-700 rounded-xl">
              <Box className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">3D Model Viewer Not Configured</h2>
              <p className="text-gray-400 text-sm mb-4">
                The Autodesk Forge integration is not set up for this environment.
                Contact your administrator to configure the AUTODESK_CLIENT_ID and
                AUTODESK_CLIENT_SECRET environment variables.
              </p>
              <a
                href="https://aps.autodesk.com/developer/documentation"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Info className="w-4 h-4" />
                Autodesk Platform Services Docs
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Box className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">View CAD & BIM Models in 3D</h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Upload Revit (.rvt), AutoCAD (.dwg), IFC, SketchUp (.skp), and other CAD/BIM files
                    to view them in an interactive 3D viewer. Pan, zoom, rotate, and isolate elements.
                  </p>
                </div>
              </div>
            </div>

            {/* Model Viewer Panel */}
            <ModelViewerPanel projectSlug={projectSlug} />

            {/* Help Section */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-dark-subtle border border-gray-700 rounded-xl">
                <h4 className="text-white font-medium mb-2">Supported Formats</h4>
                <p className="text-gray-400 text-sm">
                  DWG, DXF, RVT, RFA, IFC, NWD, 3DS, FBX, OBJ, STL, STEP, SKP, and more.
                </p>
              </div>
              <div className="p-4 bg-dark-subtle border border-gray-700 rounded-xl">
                <h4 className="text-white font-medium mb-2">Processing Time</h4>
                <p className="text-gray-400 text-sm">
                  Files are processed in the cloud. Small files take 1-2 minutes, larger BIM models may take 5-10 minutes.
                </p>
              </div>
              <div className="p-4 bg-dark-subtle border border-gray-700 rounded-xl">
                <h4 className="text-white font-medium mb-2">Viewer Controls</h4>
                <p className="text-gray-400 text-sm">
                  Left-click to orbit, right-click to pan, scroll to zoom. Use toolbar for fit-to-view and isolation.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
