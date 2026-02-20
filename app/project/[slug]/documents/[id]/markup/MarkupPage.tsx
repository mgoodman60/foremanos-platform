'use client';

import { useState, lazy } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LayerPanel } from '@/components/markup/panels/LayerPanel';
import { PropertiesPanel } from '@/components/markup/panels/PropertiesPanel';
import { CommentThread } from '@/components/markup/panels/CommentThread';
import { ExportDialog } from '@/components/markup/panels/ExportDialog';
import { MarkupSummaryBar } from '@/components/markup/panels/MarkupSummaryBar';
import type { MarkupRecord } from '@/lib/markup/markup-types';

const MarkupViewer = lazy(() => import('@/components/markup/MarkupViewer').then((mod) => ({ default: mod.MarkupViewer })));

interface MarkupPageProps {
  slug: string;
  documentId: string;
  documentName: string;
  projectName: string;
  userId: string;
}

export function MarkupPage({ slug, documentId, documentName, projectName, userId }: MarkupPageProps) {
  const [selectedMarkups, setSelectedMarkups] = useState<MarkupRecord[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMarkupsChange = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const singleSelectedMarkup = selectedMarkups.length === 1 ? selectedMarkups[0] : null;

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b bg-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/project/${slug}/documents/${documentId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{documentName}</h1>
            <p className="text-xs text-gray-500">{projectName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Markup viewer */}
        <div className="flex-1 relative">
          <MarkupViewer
            documentId={documentId}
            slug={slug}
            onSelectionChange={setSelectedMarkups}
            refreshKey={refreshKey}
          />
        </div>

        {/* Right sidebar */}
        <div className="w-[260px] flex flex-col">
          <LayerPanel slug={slug} documentId={documentId} onLayerChange={handleMarkupsChange} />
          {singleSelectedMarkup && (
            <div className="border-t flex-shrink-0 max-h-[300px] overflow-y-auto">
              <CommentThread
                slug={slug}
                documentId={documentId}
                markupId={singleSelectedMarkup.id}
                currentUserId={userId}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom panels */}
      <PropertiesPanel
        slug={slug}
        documentId={documentId}
        selectedMarkups={selectedMarkups}
        onUpdate={handleMarkupsChange}
      />

      <MarkupSummaryBar
        slug={slug}
        documentId={documentId}
        onExportClick={() => setExportDialogOpen(true)}
      />

      {/* Export dialog */}
      <ExportDialog
        slug={slug}
        documentId={documentId}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </div>
  );
}
