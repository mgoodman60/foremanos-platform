'use client';

import { useState } from 'react';
import PunchList from '@/components/field-ops/PunchList';
import ProjectHealthWidget from '@/components/field-ops/ProjectHealthWidget';

export default function PunchListPage({ params }: { params: { slug: string } }) {
  const [showForm, setShowForm] = useState(false);

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
            projectSlug={params.slug}
            onCreateNew={() => setShowForm(true)}
            onSelect={(item) => {
              // TODO: Open item detail/edit modal
              console.log('Selected item:', item);
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
