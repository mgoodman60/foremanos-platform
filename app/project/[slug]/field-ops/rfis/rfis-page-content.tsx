'use client';

import { useState, useCallback } from 'react';
import RFIList from '@/components/field-ops/RFIList';
import RFIDetailModal from '@/components/field-ops/RFIDetailModal';
import ProjectHealthWidget from '@/components/field-ops/ProjectHealthWidget';

interface RFI {
  id: string;
  rfiNumber: number;
  title: string;
  question: string;
  status: 'OPEN' | 'PENDING_RESPONSE' | 'RESPONDED' | 'CLOSED' | 'VOID';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedToName: string | null;
  assignedToEmail?: string | null;
  ballInCourt: string | null;
  dueDate: string | null;
  response: string | null;
  respondedAt?: string | null;
  specSection?: string | null;
  drawingRef?: string | null;
  createdAt: string;
  createdByUser: { id: string; username: string };
  comments: Array<{
    id: string;
    content: string;
    createdAt?: string;
    user?: { id: string; username: string };
  }>;
  costImpact: number | null;
  scheduleImpact: number | null;
  impactNotes: string | null;
}

export function RFIsPageContent({ projectSlug }: { projectSlug: string }) {
  const [_showForm, setShowForm] = useState(false);
  const [selectedRFI, setSelectedRFI] = useState<RFI | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectRFI = useCallback((rfi: RFI) => {
    setSelectedRFI(rfi);
    setModalOpen(true);
  }, []);

  const handleUpdate = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Requests for Information</h1>
          <p className="text-gray-400 mt-1">Track and manage project RFIs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RFIList
            key={refreshKey}
            projectSlug={projectSlug}
            onCreateNew={() => setShowForm(true)}
            onSelect={handleSelectRFI}
          />
        </div>
        <div>
          <ProjectHealthWidget projectSlug={projectSlug} />
        </div>
      </div>

      <RFIDetailModal
        rfi={selectedRFI}
        projectSlug={projectSlug}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
