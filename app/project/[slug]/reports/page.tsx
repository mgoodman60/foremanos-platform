'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  BarChart2, FileText, Settings, ArrowLeft, 
  PieChart, TrendingUp, Layout
} from 'lucide-react';
import Link from 'next/link';
import ExecutiveDashboard from '@/components/executive-dashboard';
import { ReportBuilder, QuickReports } from '@/components/reports';

type TabType = 'dashboard' | 'quick-reports' | 'builder';

export default function ReportsPage() {
  const params = useParams();
  const { data: session } = useSession() || {};
  const slug = params?.slug as string;
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setProject(data);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchProject();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard' as TabType, name: 'Executive Dashboard', icon: <Layout className="w-4 h-4" /> },
    { id: 'quick-reports' as TabType, name: 'Quick Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'builder' as TabType, name: 'Report Builder', icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                href={`/project/${slug}`}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Project</span>
              </Link>
              <div className="h-6 w-px bg-gray-700" />
              <div>
                <h1 className="text-lg font-semibold text-white">Reports & Analytics</h1>
                <p className="text-sm text-gray-400">{project?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-orange-400 border-orange-400'
                    : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
                }`}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <ExecutiveDashboard projectSlug={slug} />
        )}
        {activeTab === 'quick-reports' && project && (
          <QuickReports projectId={project.id} projectSlug={slug} />
        )}
        {activeTab === 'builder' && project && (
          <ReportBuilder projectId={project.id} projectSlug={slug} />
        )}
      </div>
    </div>
  );
}
