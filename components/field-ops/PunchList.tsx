'use client';

import { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, MapPin, User, Calendar, Camera,
  ChevronRight, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PunchListItem {
  id: string;
  itemNumber: number;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'REJECTED' | 'VOID';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  location: string | null;
  floor: string | null;
  room: string | null;
  assignedToName: string | null;
  category: string;
  photoIds: string[];
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  createdByUser: { id: string; username: string };
}

interface PunchListStats {
  status: string;
  _count: number;
}

interface PunchListProps {
  projectSlug: string;
  onCreateNew?: () => void;
  onSelect?: (item: PunchListItem) => void;
}

const ITEMS_PER_PAGE = 15;

export default function PunchList({ projectSlug, onCreateNew, onSelect }: PunchListProps) {
  const [items, setItems] = useState<PunchListItem[]>([]);
  const [stats, setStats] = useState<PunchListStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchItems();
  }, [projectSlug, filter, priorityFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, priorityFilter]);

  const fetchItems = async () => {
    try {
      let url = `/api/projects/${projectSlug}/punch-list?`;
      if (filter !== 'all') url += `status=${filter}&`;
      if (priorityFilter !== 'all') url += `priority=${priorityFilter}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch punch list');
      const data = await response.json();
      setItems(data.items);
      setStats(data.stats);
    } catch (error) {
      console.error('[Punch List] Error:', error);
      toast.error('Failed to load punch list');
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      COMPLETED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      VERIFIED: 'bg-green-500/20 text-green-400 border-green-500/30',
      REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
      VOID: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status] || styles.OPEN}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const PriorityIndicator = ({ priority }: { priority: string }) => {
    const styles: Record<string, string> = {
      LOW: 'bg-gray-500',
      NORMAL: 'bg-blue-500',
      HIGH: 'bg-orange-500',
      CRITICAL: 'bg-red-500',
    };

    return (
      <div className={`w-1 h-full absolute left-0 top-0 ${styles[priority] || styles.NORMAL}`} />
    );
  };

  const getStatCount = (status: string) => {
    const stat = stats.find(s => s.status === status);
    return stat?._count || 0;
  };

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const paginatedItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Open" count={getStatCount('OPEN')} color="blue" />
        <StatCard label="In Progress" count={getStatCount('IN_PROGRESS')} color="yellow" />
        <StatCard label="Completed" count={getStatCount('COMPLETED')} color="purple" />
        <StatCard label="Verified" count={getStatCount('VERIFIED')} color="green" />
        <StatCard label="Total" count={items.length} color="gray" />
      </div>

      {/* Main List */}
      <div className="bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList aria-hidden="true" className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">Punch List</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="all">All Status</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="VERIFIED">Verified</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="all">All Priority</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
            {onCreateNew && (
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium text-white transition-colors"
              >
                <Plus aria-hidden="true" className="w-4 h-4" />
                Add Item
              </button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="divide-y divide-gray-700">
          {items.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardList aria-hidden="true" className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No punch list items</p>
              {onCreateNew && (
                <button
                  onClick={onCreateNew}
                  className="mt-4 text-orange-400 hover:text-orange-300 text-sm"
                >
                  Add your first item
                </button>
              )}
            </div>
          ) : (
            paginatedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect?.(item)}
                className="px-6 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors group relative"
              >
                <PriorityIndicator priority={item.priority} />
                
                <div className="flex items-start justify-between pl-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-gray-400 text-sm">#{item.itemNumber}</span>
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-gray-400 uppercase">{item.category}</span>
                    </div>
                    
                    <h3 className="text-white font-medium mb-1">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-400 line-clamp-1 mb-2">{item.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {item.location && (
                        <span className="flex items-center gap-1">
                          <MapPin aria-hidden="true" className="w-3 h-3" />
                          {item.location}
                          {item.floor && ` · ${item.floor}`}
                          {item.room && ` · ${item.room}`}
                        </span>
                      )}
                      
                      {item.assignedToName && (
                        <span className="flex items-center gap-1">
                          <User aria-hidden="true" className="w-3 h-3" />
                          {item.assignedToName}
                        </span>
                      )}
                      
                      {item.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar aria-hidden="true" className="w-3 h-3" />
                          {format(new Date(item.dueDate), 'MMM d')}
                        </span>
                      )}
                      
                      {item.photoIds.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera aria-hidden="true" className="w-3 h-3" />
                          {item.photoIds.length}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight aria-hidden="true" className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, items.length)} of {items.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    gray: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
  };

  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
}
