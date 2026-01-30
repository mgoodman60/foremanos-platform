'use client';

import { useState } from 'react';
import { Building2, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { RoomBrowser } from './room-browser';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface RoomBrowserRibbonProps {
  projectSlug: string;
  projectId: string;
}

export function RoomBrowserRibbon({ projectSlug, projectId }: RoomBrowserRibbonProps) {
  const { data: session } = useSession() || {};
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="p-2 border-b border-gray-700">
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setIsOpen(true)}
            variant="outline"
            className="flex-1 flex items-center justify-center gap-2 border-gray-600 text-gray-300 hover:bg-dark-card hover:text-white py-2"
          >
            <Building2 className="h-4 w-4" />
            <span>Room Browser</span>
          </Button>
          <Link href={`/project/${projectSlug}/rooms`}>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-gray-600 text-gray-400 hover:bg-dark-card hover:text-white"
              title="Open full page"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Room Browser Modal - Full screen for better usability */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-dark-surface border-gray-700">
          <RoomBrowser
            projectSlug={projectSlug}
            onClose={() => setIsOpen(false)}
            onRoomSelect={(room) => {
              console.log('Selected room:', room);
              // Future: Navigate to room details or highlight on plan
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
