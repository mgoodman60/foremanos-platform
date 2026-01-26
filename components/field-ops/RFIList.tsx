'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, Calendar, User, AlertCircle,
  ChevronRight, RefreshCw, Clock, FileText, DollarSign, CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface RFI {
  id: string;
  rfiNumber: number;
  title: string;
  question: string;
  status: 'OPEN' | 'PENDING_RESPONSE' | 'RESPONDED' | 'CLOSED' | 'VOID';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedToName: string | null;
  ballInCourt: string | null;
  dueDate: string | null;
  response: string | null;
  createdAt: string;
  createdByUser: { id: string; username: string };
  comments: Array<{ id: string; content: string }>;
  // Impact assessment fields
  costImpact: number | null;
  scheduleImpact: number | null;
  impactNotes: string | null;
}

interface RFIListProps {
  projectSlug: string;
  onCreateNew?: () => void;
  onSelect?: (rfi: RFI) => void;
}

export default function RFIList({ projectSlug, onCreateNew, onSelect }: RFIListProps) {
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchRFIs();
  }, [projectSlug, filter]);

  const fetchRFIs = async () => {
    try {
      const url = filter === 'all'
        ? `/api/projects/${projectSlug}/rfis`
        : `/api/projects/${projectSlug}/rfis?status=${filter}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch RFIs');
      const data = await response.json();
      setRfis(data.rfis);
    } catch (error) {
      console.error('[RFI List] Error:', error);
      toast.error('Failed to load RFIs');
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      PENDING_RESPONSE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      RESPONDED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      CLOSED: 'bg-green-500/20 text-green-400 border-green-500/30',
      VOID: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status] || styles.OPEN}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const PriorityBadge = ({ priority }: { priority: string }) => {
    const styles: Record<string, string> = {
      LOW: 'text-gray-400',
      NORMAL: 'text-blue-400',
      HIGH: 'text-orange-400',
      URGENT: 'text-red-400',
    };

    return (
      <span className={`text-xs font-medium ${styles[priority] || styles.NORMAL}`}>
        {priority}
      </span>
    );
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">RFIs</h2>
          <span className="text-sm text-gray-400">({rfis.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="OPEN">Open</option>
            <option value="PENDING_RESPONSE">Pending Response</option>
            <option value="RESPONDED">Responded</option>
            <option value="CLOSED">Closed</option>
          </select>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              New RFI
            </button>
          )}
        </div>
      </div>

      {/* RFI List */}
      <div className="divide-y divide-gray-700">
        {rfis.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No RFIs yet</p>
            {onCreateNew && (
              <button
                onClick={onCreateNew}
                className="mt-4 text-purple-400 hover:text-purple-300 text-sm"
              >
                Create your first RFI
              </button>
            )}
          </div>
        ) : (
          rfis.map((rfi) => (
            <div
              key={rfi.id}
              onClick={() => onSelect?.(rfi)}
              className="px-6 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-medium">RFI-{rfi.rfiNumber}</span>
                    <StatusBadge status={rfi.status} />
                    <PriorityBadge priority={rfi.priority} />
                    {rfi.dueDate && isOverdue(rfi.dueDate) && rfi.status !== 'CLOSED' && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-white font-medium mb-1">{rfi.title}</h3>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">{rfi.question}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(rfi.createdAt), { addSuffix: true })}
                    </span>
                    
                    {rfi.assignedToName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {rfi.assignedToName}
                      </span>
                    )}
                    
                    {rfi.dueDate && (
                      <span className={`flex items-center gap-1 ${isOverdue(rfi.dueDate) ? 'text-red-400' : ''}`}>
                        <Clock className="w-3 h-3" />
                        Due {format(new Date(rfi.dueDate), 'MMM d')}
                      </span>
                    )}
                    
                    {rfi.comments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {rfi.comments.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Impact Assessment Badges */}
                  {(rfi.costImpact !== null || rfi.scheduleImpact !== null) && (
                    <div className="flex items-center gap-2 mt-2">
                      {rfi.costImpact !== null && rfi.costImpact !== 0 && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${
                          rfi.costImpact > 0 
                            ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                            : 'bg-green-500/20 text-green-400 border-green-500/30'
                        }`}>
                          <DollarSign className="w-3 h-3" />
                          {rfi.costImpact > 0 ? '+' : ''}${Math.abs(rfi.costImpact).toLocaleString()}
                        </span>
                      )}
                      {rfi.scheduleImpact !== null && rfi.scheduleImpact !== 0 && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${
                          rfi.scheduleImpact > 0 
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                            : 'bg-green-500/20 text-green-400 border-green-500/30'
                        }`}>
                          <CalendarClock className="w-3 h-3" />
                          {rfi.scheduleImpact > 0 ? '+' : ''}{rfi.scheduleImpact} days
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
