'use client';

import { useState } from 'react';
import RFIList from '@/components/field-ops/RFIList';
import ProjectHealthWidget from '@/components/field-ops/ProjectHealthWidget';

export default function RFIsPage({ params }: { params: { slug: string } }) {
  const [showForm, setShowForm] = useState(false);

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
            projectSlug={params.slug}
            onCreateNew={() => setShowForm(true)}
            onSelect={(rfi) => {
              // TODO: Open RFI detail/edit modal
              console.log('Selected RFI:', rfi);
            }}
          />
        </div>
        <div>
          <ProjectHealthWidget projectSlug={params.slug} />
        </div>
      </div>
    </div>
  );
}
