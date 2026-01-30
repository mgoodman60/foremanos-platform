'use client';

import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';
import { MEPEquipmentBrowser } from './mep-equipment-browser';

interface MEPEquipmentRibbonProps {
  projectSlug: string;
  projectId: string;
}

export function MEPEquipmentRibbon({ projectSlug, projectId }: MEPEquipmentRibbonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="p-2 border-b border-gray-700">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white py-2"
        >
          <Wrench className="h-4 w-4" />
          <span>MEP Equipment</span>
        </Button>
      </div>

      {/* MEP Equipment Browser Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl h-[85vh] p-0 bg-dark-surface border-gray-700">
          <MEPEquipmentBrowser
            projectSlug={projectSlug}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
