'use client';

import { useState } from 'react';
import { Map } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';
import { PlanNavigator } from './plan-navigator';

interface PlanNavigatorRibbonProps {
  projectSlug: string;
  projectId: string;
}

export function PlanNavigatorRibbon({ projectSlug, projectId: _projectId }: PlanNavigatorRibbonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="p-2 border-b border-gray-700">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white py-2"
        >
          <Map className="h-4 w-4" />
          <span>Plan Navigator</span>
        </Button>
      </div>

      {/* Plan Navigator Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl h-[85vh] p-0 bg-dark-surface border-gray-700">
          <PlanNavigator
            projectSlug={projectSlug}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
