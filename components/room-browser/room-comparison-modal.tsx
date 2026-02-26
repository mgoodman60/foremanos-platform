'use client';

import RoomComparison from '@/components/room-comparison';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface RoomComparisonModalProps {
  projectSlug: string;
  onClose: () => void;
}

export function RoomComparisonModal({ projectSlug, onClose }: RoomComparisonModalProps) {
  const containerRef = useFocusTrap({ isActive: true, onEscape: onClose });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-comparison-title"
        className="w-full max-w-4xl max-h-[90vh] overflow-auto"
      >
        <RoomComparison projectSlug={projectSlug} onClose={onClose} />
      </div>
    </div>
  );
}
