'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ClipboardCheck,
  Calendar,
  Camera,
  DollarSign,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actor: {
    name: string;
    email: string;
  };
  href?: string;
}

interface RecentActivityFeedProps {
  projectSlug: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; dotColor: string }> = {
  document_upload: { icon: FileText, dotColor: 'bg-blue-400' },
  daily_report: { icon: ClipboardCheck, dotColor: 'bg-orange-400' },
  change_order: { icon: DollarSign, dotColor: 'bg-amber-400' },
  schedule_update: { icon: Calendar, dotColor: 'bg-cyan-400' },
  photo_upload: { icon: Camera, dotColor: 'bg-purple-400' },
};

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getInitial(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

export function RecentActivityFeed({ projectSlug }: RecentActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/activity?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const displayedItems = expanded ? activities : activities.slice(0, 5);

  return (
    <div className="bg-slate-900 border-2 border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-50">Recent Activity</h3>
        {activities.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 transition-colors"
          >
            {expanded ? 'Show less' : 'See all'}
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && activities.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No recent activity. Upload a document to get started.</p>
        </div>
      )}

      {/* Timeline */}
      {!loading && activities.length > 0 && (
        <ol role="feed" aria-label="Recent activity" className="relative">
          {displayedItems.map((item, index) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.document_upload;
            const IconComponent = config.icon;
            const isLast = index === displayedItems.length - 1;

            return (
              <li key={item.id} className="relative flex gap-4 pb-4">
                {/* Vertical line */}
                {!isLast && (
                  <div
                    className="absolute left-[17px] top-8 bottom-0 w-px bg-gray-700"
                    aria-hidden="true"
                  />
                )}

                {/* Dot + icon */}
                <div className="relative flex-shrink-0">
                  <div className={`w-[34px] h-[34px] rounded-full ${config.dotColor} bg-opacity-20 flex items-center justify-center`}>
                    <div className={`w-3 h-3 rounded-full ${config.dotColor}`} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="text-sm font-medium text-slate-50 hover:text-orange-400 transition-colors"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-slate-50">{item.title}</p>
                      )}
                      <p className="text-xs text-gray-400 truncate">{item.description}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                      {getRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 font-medium"
                      aria-label={`By ${item.actor.name}`}
                    >
                      {getInitial(item.actor.name)}
                    </div>
                    <span className="text-xs text-gray-500">{item.actor.name}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
