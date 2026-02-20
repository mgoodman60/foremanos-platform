'use client';

import { useState, useCallback } from 'react';
import PunchList from '@/components/field-ops/PunchList';
import PunchListDetailModal from '@/components/field-ops/PunchListDetailModal';
import ProjectHealthWidget from '@/components/field-ops/ProjectHealthWidget';

type PunchListStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'REJECTED' | 'VOID';
type PunchListPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
type PunchListCategory = 'GENERAL' | 'SAFETY' | 'QUALITY' | 'INCOMPLETE_WORK' | 'DAMAGED' | 'DEFECTIVE' | 'CODE_VIOLATION' | 'DESIGN_CHANGE';
type TradeType = 'general_contractor' | 'concrete_masonry' | 'carpentry_framing' | 'electrical' | 'plumbing' | 'hvac_mechanical' | 'drywall_finishes' | 'site_utilities' | 'structural_steel' | 'roofing' | 'glazing_windows' | 'painting_coating' | 'flooring';

interface PunchListItem {
  id: string;
  itemNumber: number;
  title: string;
  description: string | null;
  status: PunchListStatus;
  priority: PunchListPriority;
  location: string | null;
  floor: string | null;
  room: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  trade: TradeType | null;
  category: PunchListCategory;
  photoIds: string[];
  completionPhotoIds: string[];
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  notes: string | null;
  completionNotes: string | null;
  createdAt: string;
  createdByUser: { id: string; username: string };
}

export default function PunchListPage({ params }: { params: { slug: string } }) {
  const [_showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PunchListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectItem = useCallback((item: PunchListItem) => {
    setSelectedItem(item);
    setModalOpen(true);
  }, []);

  const handleUpdate = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Punch List</h1>
          <p className="text-gray-400 mt-1">Track deficiencies and completion items</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PunchList
            key={refreshKey}
            projectSlug={params.slug}
            onCreateNew={() => setShowForm(true)}
            onSelect={handleSelectItem}
          />
        </div>
        <div>
          <ProjectHealthWidget projectSlug={params.slug} />
        </div>
      </div>

      <PunchListDetailModal
        item={selectedItem}
        projectSlug={params.slug}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
