'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';
import { PlanViewerSelector } from './plan-viewer-selector';

interface PlanViewerRibbonProps {
  projectSlug: string;
  projectId: string;
}

export function PlanViewerRibbon({ projectSlug, projectId }: PlanViewerRibbonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="p-2 border-b border-gray-700">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white py-2"
        >
          <Layers className="h-4 w-4" />
          <span>Document Viewer</span>
        </Button>
      </div>

      {/* Document Viewer Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 bg-dark-surface border-gray-700">
          <PlanViewerSelector
            projectSlug={projectSlug}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
