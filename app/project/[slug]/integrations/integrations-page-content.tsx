'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plug, Cloud, Download, Calendar, Webhook } from 'lucide-react';
import { WeatherWidget, ExportPanel, CalendarSubscription, WebhookManager } from '@/components/integrations';

export function IntegrationsPageContent({
  projectSlug,
  projectName,
}: {
  projectSlug: string;
  projectName: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('weather');

  const tabs = [
    { id: 'weather', label: 'Weather', icon: Cloud, color: 'text-cyan-400' },
    { id: 'export', label: 'Export Data', icon: Download, color: 'text-blue-400' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, color: 'text-purple-400' },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook, color: 'text-green-400' },
  ];

  return (
    <div className="min-h-screen bg-dark-base">
      {/* Header */}
      <header className="bg-dark-subtle border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/project/${projectSlug}`)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Plug className="h-5 w-5 text-purple-400" />
                Integrations
              </h1>
              <p className="text-sm text-gray-400">{projectName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-dark-subtle border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${activeTab === tab.id ? tab.color : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'weather' && (
          <div className="space-y-6">
            <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-2">Weather Integration</h2>
              <p className="text-gray-400 text-sm">
                Real-time weather data and construction impact analysis. Weather is automatically
                fetched based on project location and can be used to auto-populate daily reports.
              </p>
            </div>
            <WeatherWidget projectSlug={projectSlug} />
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-2">Data Export</h2>
              <p className="text-gray-400 text-sm">
                Export project data in CSV format for use in Excel, Google Sheets, or other tools.
                Apply date filters to export specific time periods.
              </p>
            </div>
            <ExportPanel projectSlug={projectSlug} />
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-2">Calendar Subscriptions</h2>
              <p className="text-gray-400 text-sm">
                Subscribe to project calendars to see milestones, critical path tasks, and deadlines
                directly in Outlook, Google Calendar, or Apple Calendar.
              </p>
            </div>
            <CalendarSubscription projectSlug={projectSlug} />
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <div className="bg-dark-subtle rounded-lg p-4 border border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-2">Webhook Notifications</h2>
              <p className="text-gray-400 text-sm">
                Send real-time notifications to external systems when events occur in your project.
                Integrate with Slack, Teams, Zapier, or custom endpoints.
              </p>
            </div>
            <WebhookManager projectSlug={projectSlug} />
          </div>
        )}
      </main>
    </div>
  );
}
