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
  MessageSquare,
  User,
  Clock,
  FileText,
  Send,
  Edit2,
  Save,
  DollarSign,
  CalendarClock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface RFI {
  id: string;
  rfiNumber: number;
  title: string;
  question: string;
  status: 'OPEN' | 'PENDING_RESPONSE' | 'RESPONDED' | 'CLOSED' | 'VOID';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedToName: string | null;
  assignedToEmail?: string | null;
  ballInCourt: string | null;
  dueDate: string | null;
  response: string | null;
  respondedAt?: string | null;
  specSection?: string | null;
  drawingRef?: string | null;
  createdAt: string;
  createdByUser: { id: string; username: string };
  comments: Array<{
    id: string;
    content: string;
    createdAt?: string;
    user?: { id: string; username: string };
  }>;
  costImpact: number | null;
  scheduleImpact: number | null;
  impactNotes: string | null;
}

interface RFIDetailModalProps {
  rfi: RFI | null;
  projectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export default function RFIDetailModal({
  rfi,
  projectSlug,
  open,
  onOpenChange,
  onUpdate,
}: RFIDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [responseText, setResponseText] = useState('');
  const [showResponseForm, setShowResponseForm] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    question: '',
    priority: 'NORMAL' as RFI['priority'],
    status: 'OPEN' as RFI['status'],
    assignedToName: '',
    assignedToEmail: '',
    ballInCourt: '',
    dueDate: '',
    specSection: '',
    drawingRef: '',
    costImpact: '',
    scheduleImpact: '',
    impactNotes: '',
  });

  useEffect(() => {
    if (rfi) {
      setEditForm({
        title: rfi.title,
        question: rfi.question,
        priority: rfi.priority,
        status: rfi.status,
        assignedToName: rfi.assignedToName || '',
        assignedToEmail: rfi.assignedToEmail || '',
        ballInCourt: rfi.ballInCourt || '',
        dueDate: rfi.dueDate ? format(new Date(rfi.dueDate), 'yyyy-MM-dd') : '',
        specSection: rfi.specSection || '',
        drawingRef: rfi.drawingRef || '',
        costImpact: rfi.costImpact?.toString() || '',
        scheduleImpact: rfi.scheduleImpact?.toString() || '',
        impactNotes: rfi.impactNotes || '',
      });
      setResponseText(rfi.response || '');
    }
  }, [rfi]);

  if (!rfi) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/rfis/${rfi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          question: editForm.question,
          priority: editForm.priority,
          status: editForm.status,
          assignedToName: editForm.assignedToName || null,
          assignedToEmail: editForm.assignedToEmail || null,
          ballInCourt: editForm.ballInCourt || null,
          dueDate: editForm.dueDate || null,
          specSection: editForm.specSection || null,
          drawingRef: editForm.drawingRef || null,
          costImpact: editForm.costImpact ? parseFloat(editForm.costImpact) : null,
          scheduleImpact: editForm.scheduleImpact ? parseInt(editForm.scheduleImpact) : null,
          impactNotes: editForm.impactNotes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update RFI');

      toast.success('RFI updated successfully');
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('[RFI Modal] Save error:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      toast.error('Please enter a response');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/rfis/${rfi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseText }),
      });

      if (!response.ok) throw new Error('Failed to submit response');

      toast.success('Response submitted');
      setShowResponseForm(false);
      onUpdate?.();
    } catch (error) {
      console.error('[RFI Modal] Response error:', error);
      toast.error('Failed to submit response');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRFI = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/rfis/${rfi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      });

      if (!response.ok) throw new Error('Failed to close RFI');

      toast.success('RFI closed');
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error('[RFI Modal] Close error:', error);
      toast.error('Failed to close RFI');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/projects/${projectSlug}/rfis/${rfi.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });

      if (!response.ok) throw new Error('Failed to add comment');

      toast.success('Comment added');
      setNewComment('');
      onUpdate?.();
    } catch (error) {
      console.error('[RFI Modal] Comment error:', error);
      toast.error('Failed to add comment');
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
      LOW: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      NORMAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      URGENT: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[priority] || styles.NORMAL}`}>
        {priority}
      </span>
    );
  };

  const isOverdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== 'CLOSED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-dark-subtle border-gray-700">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare aria-hidden="true" className="w-5 h-5 text-purple-400" />
              <DialogTitle className="text-white">RFI-{rfi.rfiNumber}</DialogTitle>
              <StatusBadge status={rfi.status} />
              <PriorityBadge priority={rfi.priority} />
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle aria-hidden="true" className="w-3 h-3" />
                  Overdue
                </span>
              )}
            </div>
            {!isEditing && rfi.status !== 'CLOSED' && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <DialogDescription className="text-gray-400">
            Created by {rfi.createdByUser.username} on {format(new Date(rfi.createdAt), 'MMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Main Content */}
          {isEditing ? (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Question */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Question</label>
                <textarea
                  value={editForm.question}
                  onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as RFI['priority'] })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as RFI['status'] })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="OPEN">Open</option>
                    <option value="PENDING_RESPONSE">Pending Response</option>
                    <option value="RESPONDED">Responded</option>
                    <option value="CLOSED">Closed</option>
                    <option value="VOID">Void</option>
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
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Ball In Court */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Ball In Court</label>
                  <input
                    type="text"
                    value={editForm.ballInCourt}
                    onChange={(e) => setEditForm({ ...editForm, ballInCourt: e.target.value })}
                    placeholder="Responsible party"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Spec Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Spec Section</label>
                  <input
                    type="text"
                    value={editForm.specSection}
                    onChange={(e) => setEditForm({ ...editForm, specSection: e.target.value })}
                    placeholder="e.g., 03 30 00"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Drawing Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Drawing Reference</label>
                <input
                  type="text"
                  value={editForm.drawingRef}
                  onChange={(e) => setEditForm({ ...editForm, drawingRef: e.target.value })}
                  placeholder="e.g., A-201, S-102"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Impact Assessment */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Impact Assessment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Cost Impact ($)</label>
                    <input
                      type="number"
                      value={editForm.costImpact}
                      onChange={(e) => setEditForm({ ...editForm, costImpact: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Schedule Impact (days)</label>
                    <input
                      type="number"
                      value={editForm.scheduleImpact}
                      onChange={(e) => setEditForm({ ...editForm, scheduleImpact: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm text-gray-400 mb-1">Impact Notes</label>
                  <textarea
                    value={editForm.impactNotes}
                    onChange={(e) => setEditForm({ ...editForm, impactNotes: e.target.value })}
                    rows={2}
                    placeholder="Describe the impact..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
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
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors disabled:opacity-50"
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
                <h3 className="text-lg font-medium text-white mb-2">{rfi.title}</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{rfi.question}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {rfi.assignedToName && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <User aria-hidden="true" className="w-4 h-4" />
                    <span>Assigned to: <span className="text-white">{rfi.assignedToName}</span></span>
                  </div>
                )}
                {rfi.ballInCourt && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <User aria-hidden="true" className="w-4 h-4" />
                    <span>Ball in court: <span className="text-white">{rfi.ballInCourt}</span></span>
                  </div>
                )}
                {rfi.dueDate && (
                  <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                    <Clock aria-hidden="true" className="w-4 h-4" />
                    <span>Due: <span className={isOverdue ? 'text-red-400' : 'text-white'}>{format(new Date(rfi.dueDate), 'MMM d, yyyy')}</span></span>
                  </div>
                )}
                {rfi.specSection && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <FileText aria-hidden="true" className="w-4 h-4" />
                    <span>Spec: <span className="text-white">{rfi.specSection}</span></span>
                  </div>
                )}
                {rfi.drawingRef && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <FileText aria-hidden="true" className="w-4 h-4" />
                    <span>Drawing: <span className="text-white">{rfi.drawingRef}</span></span>
                  </div>
                )}
              </div>

              {/* Impact Assessment */}
              {(rfi.costImpact !== null || rfi.scheduleImpact !== null) && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Impact Assessment</h4>
                  <div className="flex flex-wrap gap-3">
                    {rfi.costImpact !== null && rfi.costImpact !== 0 && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border ${
                        rfi.costImpact > 0
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-green-500/20 text-green-400 border-green-500/30'
                      }`}>
                        <DollarSign aria-hidden="true" className="w-4 h-4" />
                        {rfi.costImpact > 0 ? '+' : ''}${Math.abs(rfi.costImpact).toLocaleString()}
                      </span>
                    )}
                    {rfi.scheduleImpact !== null && rfi.scheduleImpact !== 0 && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border ${
                        rfi.scheduleImpact > 0
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          : 'bg-green-500/20 text-green-400 border-green-500/30'
                      }`}>
                        <CalendarClock aria-hidden="true" className="w-4 h-4" />
                        {rfi.scheduleImpact > 0 ? '+' : ''}{rfi.scheduleImpact} days
                      </span>
                    )}
                  </div>
                  {rfi.impactNotes && (
                    <p className="mt-3 text-sm text-gray-400">{rfi.impactNotes}</p>
                  )}
                </div>
              )}

              {/* Response Section */}
              {rfi.response ? (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle aria-hidden="true" className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-medium text-purple-400">Response</h4>
                    {rfi.respondedAt && (
                      <span className="text-xs text-gray-400">
                        {format(new Date(rfi.respondedAt), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <p className="text-white whitespace-pre-wrap">{rfi.response}</p>
                </div>
              ) : showResponseForm ? (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Add Response</h4>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                    placeholder="Enter your response to this RFI..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowResponseForm(false)}
                      className="px-3 py-1.5 text-gray-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitResponse}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm text-white disabled:opacity-50"
                    >
                      <Send aria-hidden="true" className="w-4 h-4" />
                      {isSaving ? 'Submitting...' : 'Submit Response'}
                    </button>
                  </div>
                </div>
              ) : rfi.status !== 'CLOSED' && (
                <button
                  onClick={() => setShowResponseForm(true)}
                  className="w-full py-3 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-purple-500 hover:text-purple-400 transition-colors"
                >
                  + Add Response
                </button>
              )}

              {/* Comments Section */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <MessageSquare aria-hidden="true" className="w-4 h-4" />
                  Comments ({rfi.comments.length})
                </h4>

                {rfi.comments.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {rfi.comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">{comment.user?.username || 'Unknown'}</span>
                          {comment.createdAt && (
                            <span className="text-xs text-gray-400">
                              {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              {rfi.status !== 'CLOSED' && (
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={handleCloseRFI}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors disabled:opacity-50"
                  >
                    <CheckCircle aria-hidden="true" className="w-4 h-4" />
                    Close RFI
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
