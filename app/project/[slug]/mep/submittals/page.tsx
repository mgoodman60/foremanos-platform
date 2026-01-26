'use client';

import { useState } from 'react';
import SubmittalList from '@/components/mep/SubmittalList';
import BulkVerificationDashboard from '@/components/submittals/BulkVerificationDashboard';
import ToleranceSettings from '@/components/submittals/ToleranceSettings';
import SpecSectionBrowser from '@/components/submittals/SpecSectionBrowser';
import ScheduleExtractionButton from '@/components/submittals/ScheduleExtractionButton';
import { ListChecks, BarChart3, Settings, BookOpen, FileSpreadsheet } from 'lucide-react';

export default function SubmittalsPage({ params }: { params: { slug: string } }) {
  const [activeTab, setActiveTab] = useState<'list' | 'dashboard' | 'settings' | 'specs'>('list');

  return (
    <div className="space-y-4">
      {/* Header with Schedule Extraction */}
      <div className="flex items-center justify-between px-6 pt-4">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-blue-400" />
          Submittals & Verification
        </h1>
        <ScheduleExtractionButton projectSlug={params.slug} />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 px-6 flex-wrap">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'list'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          Submittal List
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Verification Dashboard
        </button>
        <button
          onClick={() => setActiveTab('specs')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'specs'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Spec Sections
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          Tolerance Settings
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' ? (
        <SubmittalList projectSlug={params.slug} />
      ) : activeTab === 'dashboard' ? (
        <div className="px-6 pb-6">
          <BulkVerificationDashboard projectSlug={params.slug} />
        </div>
      ) : activeTab === 'specs' ? (
        <div className="px-6 pb-6">
          <SpecSectionBrowser projectSlug={params.slug} />
        </div>
      ) : (
        <div className="px-6 pb-6">
          <ToleranceSettings projectSlug={params.slug} />
        </div>
      )}
    </div>
  );
}
