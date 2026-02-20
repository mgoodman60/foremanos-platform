'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';
import { MaterialTakeoffManager } from './material-takeoff-manager';

interface MaterialTakeoffRibbonProps {
  projectSlug: string;
  projectId: string;
}

export function MaterialTakeoffRibbon({ projectSlug, projectId: _projectId }: MaterialTakeoffRibbonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="p-2 border-b border-gray-700">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white py-2"
        >
          <Calculator className="h-4 w-4" aria-hidden="true" />
          <span>Material Takeoff</span>
        </Button>
      </div>

      {/* Material Takeoff Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-7xl h-[92vh] p-0 bg-dark-surface border-gray-700 flex flex-col overflow-hidden">
          <MaterialTakeoffManager
            projectSlug={projectSlug}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
