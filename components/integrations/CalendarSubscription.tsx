'use client';

import { useState } from 'react';
import { Calendar, Link2, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarSubscriptionProps {
  projectSlug: string;
}

const calendarTypes = [
  { id: 'milestones', label: 'Milestones', description: 'Project milestones and key dates', color: 'text-yellow-400' },
  { id: 'critical-path', label: 'Critical Path', description: 'Critical path tasks only', color: 'text-red-400' },
  { id: 'schedule', label: 'Full Schedule', description: 'All schedule tasks', color: 'text-blue-400' },
  { id: 'deadlines', label: 'Deadlines', description: 'Submittals and procurement', color: 'text-orange-400' },
  { id: 'all', label: 'Combined', description: 'All events in one calendar', color: 'text-green-400' },
];

export default function CalendarSubscription({ projectSlug }: CalendarSubscriptionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getCalendarUrl = (type: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://foremanos.site';
    return `${baseUrl}/api/projects/${projectSlug}/calendar/${type}.ics`;
  };

  const copyToClipboard = async (type: string) => {
    const url = getCalendarUrl(type);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(type);
      toast.success('Calendar URL copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const downloadCalendar = (type: string) => {
    const url = getCalendarUrl(type);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectSlug}-${type}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-dark-surface rounded-lg p-6">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Calendar Subscriptions</h3>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Subscribe to project calendars in Outlook, Google Calendar, or Apple Calendar
      </p>

      <div className="space-y-3">
        {calendarTypes.map((cal) => (
          <div key={cal.id} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className={`font-medium ${cal.color}`}>{cal.label}</h4>
                <p className="text-sm text-gray-400">{cal.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(cal.id)}
                  className="p-2 hover:bg-gray-700 rounded transition-colors"
                  title="Copy subscription URL"
                >
                  {copiedId === cal.id ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => downloadCalendar(cal.id)}
                  className="p-2 hover:bg-gray-700 rounded transition-colors"
                  title="Download .ics file"
                >
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Link2 className="h-3 w-3" />
              <span className="truncate">{getCalendarUrl(cal.id)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h4 className="text-sm font-medium text-blue-400 mb-2">How to Subscribe</h4>
        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
          <li>Copy the calendar URL above</li>
          <li>In your calendar app, find &quot;Add calendar from URL&quot;</li>
          <li>Paste the URL and save</li>
          <li>Calendar will auto-update as project changes</li>
        </ol>
      </div>
    </div>
  );
}
