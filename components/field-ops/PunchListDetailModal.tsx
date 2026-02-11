'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ClipboardList,
  Calendar,
  User,
  Clock,
  MapPin,
  Edit2,
  Save,
  CheckCircle,
  AlertTriangle,
  Camera,
  Wrench,
  Building,
  FileText,
  XCircle,
  Shield,
} from 'lucide-react';

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

interface PunchListDetailModalProps {
  item: PunchListItem | null;
  projectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const TRADE_LABELS: Record<TradeType, string> = {
  general_contractor: 'General Contractor',
  concrete_masonry: 'Concrete/Masonry',
  carpentry_framing: 'Carpentry/Framing',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac_mechanical: 'HVAC/Mechanical',
  drywall_finishes: 'Drywall/Finishes',
  site_utilities: 'Site/Utilities',
  structural_steel: 'Structural Steel',
  roofing: 'Roofing',
  glazing_windows: 'Glazing/Windows',
  painting_coating: 'Painting/Coating',
  flooring: 'Flooring',
};

const CATEGORY_LABELS: Record<PunchListCategory, string> = {
  GENERAL: 'General',
  SAFETY: 'Safety',
  QUALITY: 'Quality',
  INCOMPLETE_WORK: 'Incomplete Work',
  DAMAGED: 'Damaged',
  DEFECTIVE: 'Defective',
  CODE_VIOLATION: 'Code Violation',
  DESIGN_CHANGE: 'Design Change',
};

export default function PunchListDetailModal({
  item,
  projectSlug,
  open,
  onOpenChange,
  onUpdate,
}: PunchListDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'NORMAL' as PunchListPriority,
    status: 'OPEN' as PunchListStatus,
    location: '',
    floor: '',
    room: '',
    assignedToName: '',
    trade: '' as TradeType | '',
    category: 'GENERAL' as PunchListCategory,
    dueDate: '',
    notes: '',
  });

  useEffect(() => {
    if (item) {
      setEditForm({
        title: item.title,
        description: item.description || '',
        priority: item.priority,
        status: item.status,
        location: item.location || '',
        floor: item.floor || '',
        room: item.room || '',
        assignedToName: item.assignedToName || '',
        trade: item.trade || '',
        category: item.category,
        dueDate: item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : '',
        notes: item.notes || '',
      });
      setCompletionNotes(item.completionNotes || '');
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/punch-list/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          priority: editForm.priority,
          status: editForm.status,
          location: editForm.location || null,
          floor: editForm.floor || null,
          room: editForm.room || null,
          assignedToName: editForm.assignedToName || null,
          trade: editForm.trade || null,
          category: editForm.category,
          dueDate: editForm.dueDate || null,
          notes: editForm.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update item');

      toast.success('Item updated successfully');
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('[Punch List Modal] Save error:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/punch-list/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          completionNotes: completionNotes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to complete item');

      toast.success('Item marked as completed');
      setShowCompleteForm(false);
      onUpdate?.();
    } catch (error) {
      console.error('[Punch List Modal] Complete error:', error);
      toast.error('Failed to complete item');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/punch-list/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VERIFIED' }),
      });

      if (!response.ok) throw new Error('Failed to verify item');

      toast.success('Item verified');
      onUpdate?.();
    } catch (error) {
      console.error('[Punch List Modal] Verify error:', error);
      toast.error('Failed to verify item');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/punch-list/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      if (!response.ok) throw new Error('Failed to reject item');

      toast.success('Item rejected - reopened for correction');
      onUpdate?.();
    } catch (error) {
      console.error('[Punch List Modal] Reject error:', error);
      toast.error('Failed to reject item');
    } finally {
      setSaving(false);
    }
  };

  const handleStartProgress = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/punch-list/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast.success('Item marked as in progress');
      onUpdate?.();
    } catch (error) {
      console.error('[Punch List Modal] Progress error:', error);
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const StatusBadge = ({ status }: { status: PunchListStatus }) => {
    const styles: Record<PunchListStatus, string> = {
      OPEN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      COMPLETED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      VERIFIED: 'bg-green-500/20 text-green-400 border-green-500/30',
      REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
      VOID: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const PriorityBadge = ({ priority }: { priority: PunchListPriority }) => {
    const styles: Record<PunchListPriority, string> = {
      LOW: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      NORMAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[priority]}`}>
        {priority}
      </span>
    );
  };

  const CategoryBadge = ({ category }: { category: PunchListCategory }) => {
    const isSafety = category === 'SAFETY';
    const isCodeViolation = category === 'CODE_VIOLATION';

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${
        isSafety
          ? 'bg-red-500/20 text-red-400 border-red-500/30'
          : isCodeViolation
          ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      }`}>
        {(isSafety || isCodeViolation) && <AlertTriangle aria-hidden="true" className="w-3 h-3" />}
        {CATEGORY_LABELS[category]}
      </span>
    );
  };

  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && !['COMPLETED', 'VERIFIED', 'VOID'].includes(item.status);
  const canComplete = ['OPEN', 'IN_PROGRESS', 'REJECTED'].includes(item.status);
  const canVerify = item.status === 'COMPLETED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-dark-subtle border-gray-700">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList aria-hidden="true" className="w-5 h-5 text-orange-400" />
              <DialogTitle className="text-white">Item #{item.itemNumber}</DialogTitle>
              <StatusBadge status={item.status} />
              <PriorityBadge priority={item.priority} />
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle aria-hidden="true" className="w-3 h-3" />
                  Overdue
                </span>
              )}
            </div>
            {!isEditing && !['COMPLETED', 'VERIFIED', 'VOID'].includes(item.status) && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <DialogDescription className="text-gray-400">
            Created by {item.createdByUser.username} on {format(new Date(item.createdAt), 'MMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {isEditing ? (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as PunchListPriority })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as PunchListCategory })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Assigned To</label>
                  <input
                    type="text"
                    value={editForm.assignedToName}
                    onChange={(e) => setEditForm({ ...editForm, assignedToName: e.target.value })}
                    placeholder="Name"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Trade */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Trade</label>
                  <select
                    value={editForm.trade}
                    onChange={(e) => setEditForm({ ...editForm, trade: e.target.value as TradeType | '' })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select trade...</option>
                    {Object.entries(TRADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as PunchListStatus })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="VOID">Void</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Location</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Location/Area</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      placeholder="e.g., Building A"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Floor</label>
                    <input
                      type="text"
                      value={editForm.floor}
                      onChange={(e) => setEditForm({ ...editForm, floor: e.target.value })}
                      placeholder="e.g., 2nd Floor"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Room</label>
                    <input
                      type="text"
                      value={editForm.room}
                      onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                      placeholder="e.g., Room 201"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors disabled:opacity-50"
                >
                  <Save aria-hidden="true" className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* View Mode */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium text-white">{item.title}</h3>
                  <CategoryBadge category={item.category} />
                </div>
                {item.description && (
                  <p className="text-gray-300 whitespace-pre-wrap">{item.description}</p>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {item.assignedToName && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <User aria-hidden="true" className="w-4 h-4" />
                    <span>Assigned to: <span className="text-white">{item.assignedToName}</span></span>
                  </div>
                )}
                {item.trade && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Wrench aria-hidden="true" className="w-4 h-4" />
                    <span>Trade: <span className="text-white">{TRADE_LABELS[item.trade]}</span></span>
                  </div>
                )}
                {item.dueDate && (
                  <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                    <Clock aria-hidden="true" className="w-4 h-4" />
                    <span>Due: <span className={isOverdue ? 'text-red-400' : 'text-white'}>{format(new Date(item.dueDate), 'MMM d, yyyy')}</span></span>
                  </div>
                )}
                {(item.location || item.floor || item.room) && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin aria-hidden="true" className="w-4 h-4" />
                    <span>Location: <span className="text-white">
                      {[item.location, item.floor, item.room].filter(Boolean).join(' > ')}
                    </span></span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {item.notes && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText aria-hidden="true" className="w-4 h-4 text-gray-400" />
                    <h4 className="text-sm font-medium text-gray-300">Notes</h4>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}

              {/* Photos */}
              {item.photoIds.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera aria-hidden="true" className="w-4 h-4 text-gray-400" />
                    <h4 className="text-sm font-medium text-gray-300">Photos ({item.photoIds.length})</h4>
                  </div>
                  <div className="text-sm text-gray-400">
                    Photo attachments available
                  </div>
                </div>
              )}

              {/* Completion Info */}
              {item.completedAt && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle aria-hidden="true" className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-medium text-purple-400">Completed</h4>
                    <span className="text-xs text-gray-400">
                      {format(new Date(item.completedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {item.completionNotes && (
                    <p className="text-white text-sm whitespace-pre-wrap">{item.completionNotes}</p>
                  )}
                </div>
              )}

              {/* Verification Info */}
              {item.verifiedAt && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Shield aria-hidden="true" className="w-4 h-4 text-green-400" />
                    <h4 className="text-sm font-medium text-green-400">Verified</h4>
                    <span className="text-xs text-gray-400">
                      {format(new Date(item.verifiedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              )}

              {/* Complete Form */}
              {showCompleteForm ? (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Mark as Complete</h4>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows={3}
                    placeholder="Completion notes (optional)..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCompleteForm(false)}
                      className="px-3 py-1.5 text-gray-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMarkComplete}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm text-white disabled:opacity-50"
                    >
                      <CheckCircle aria-hidden="true" className="w-4 h-4" />
                      {isSaving ? 'Completing...' : 'Mark Complete'}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                {item.status === 'OPEN' && (
                  <button
                    onClick={handleStartProgress}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white transition-colors disabled:opacity-50"
                  >
                    <Clock aria-hidden="true" className="w-4 h-4" />
                    Start Progress
                  </button>
                )}

                {canComplete && !showCompleteForm && (
                  <button
                    onClick={() => setShowCompleteForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
                  >
                    <CheckCircle aria-hidden="true" className="w-4 h-4" />
                    Mark Complete
                  </button>
                )}

                {canVerify && (
                  <>
                    <button
                      onClick={handleReject}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors disabled:opacity-50"
                    >
                      <XCircle aria-hidden="true" className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={handleVerify}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors disabled:opacity-50"
                    >
                      <Shield aria-hidden="true" className="w-4 h-4" />
                      Verify
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
