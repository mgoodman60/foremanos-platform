'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';
import { Phase3Dashboard } from './phase3-dashboard';

interface Phase3DashboardRibbonProps {
  projectSlug: string;
  projectId: string;
  onOpenRoom?: () => void;
  onOpenMaterials?: () => void;
  onOpenMEP?: () => void;
  onOpenPlans?: () => void;
}

export function Phase3DashboardRibbon({
  projectSlug,
  projectId,
  onOpenRoom,
  onOpenMaterials,
  onOpenMEP,
  onOpenPlans,
}: Phase3DashboardRibbonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="p-2 border-b border-gray-700">
        <Button
          onClick={() => setIsOpen(true)}
          variant="default"
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-2.5 shadow-lg"
        >
          <BarChart3 className="h-5 w-5" />
          <span className="font-semibold">Project Dashboard</span>
        </Button>
      </div>

      {/* Dashboard Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 bg-dark-surface border-gray-700 overflow-hidden">
          <div className="h-full overflow-auto">
            <Phase3Dashboard
              projectSlug={projectSlug}
              onOpenRoom={() => {
                setIsOpen(false);
                onOpenRoom?.();
              }}
              onOpenMaterials={() => {
                setIsOpen(false);
                onOpenMaterials?.();
              }}
              onOpenMEP={() => {
                setIsOpen(false);
                onOpenMEP?.();
              }}
              onOpenPlans={() => {
                setIsOpen(false);
                onOpenPlans?.();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
