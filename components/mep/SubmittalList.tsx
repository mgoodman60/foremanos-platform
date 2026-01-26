'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileCheck, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Edit,
  FileText,
  User,
  Eye,
  Package
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Submittal {
  id: string;
  submittalNumber: string;
  title: string;
  submittalType: string;
  specSection?: string;
  status: string;
  dueDate?: string;
  submittedDate?: string;
  reviewedDate?: string;
  approvedDate?: string;
  reviewer?: string;
  reviewerName?: string;
  reviewComments?: string;
  stampStatus?: string;
  submittedBy?: string;
  revision: number;
  system?: { systemNumber: string; name: string };
  equipment?: { equipmentTag: string; name: string };
  createdByUser?: { username: string };
}

interface SubmittalListProps {
  projectSlug: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  PENDING: { color: 'bg-gray-600', icon: Clock, label: 'Pending' },
  SUBMITTED: { color: 'bg-blue-600', icon: FileText, label: 'Submitted' },
  UNDER_REVIEW: { color: 'bg-yellow-600', icon: Clock, label: 'Under Review' },
  APPROVED: { color: 'bg-green-600', icon: CheckCircle, label: 'Approved' },
  APPROVED_AS_NOTED: { color: 'bg-green-500', icon: CheckCircle, label: 'Approved as Noted' },
  REVISE_RESUBMIT: { color: 'bg-orange-600', icon: AlertTriangle, label: 'Revise & Resubmit' },
  REJECTED: { color: 'bg-red-600', icon: X, label: 'Rejected' },
  VOID: { color: 'bg-gray-500', icon: X, label: 'Void' },
};

const SUBMITTAL_TYPES = [
  { value: 'PRODUCT_DATA', label: 'Product Data' },
  { value: 'SHOP_DRAWINGS', label: 'Shop Drawings' },
  { value: 'SAMPLES', label: 'Samples' },
  { value: 'CALCULATIONS', label: 'Calculations' },
  { value: 'TEST_REPORTS', label: 'Test Reports' },
  { value: 'CERTIFICATIONS', label: 'Certifications' },
  { value: 'WARRANTIES', label: 'Warranties' },
  { value: 'O_AND_M_MANUALS', label: 'O&M Manuals' },
  { value: 'AS_BUILTS', label: 'As-Builts' },
];

export default function SubmittalList({ projectSlug }: SubmittalListProps) {
  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, underReview: 0, approved: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [reviewingSubmittal, setReviewingSubmittal] = useState<Submittal | null>(null);

  useEffect(() => {
    fetchSubmittals();
  }, [projectSlug, statusFilter]);

  const fetchSubmittals = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubmittals(data.submittals);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch submittals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmittals = submittals.filter(sub =>
    sub.title.toLowerCase().includes(search.toLowerCase()) ||
    sub.submittalNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddSubmittal = async (formData: any) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success('Submittal created successfully');
        setShowAddModal(false);
        fetchSubmittals();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create submittal');
      }
    } catch (error) {
      toast.error('Failed to create submittal');
    }
  };

  const handleReview = async (submittalId: string, reviewData: any) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/${submittalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      
      if (res.ok) {
        toast.success('Submittal reviewed successfully');
        setReviewingSubmittal(null);
        fetchSubmittals();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to review submittal');
      }
    } catch (error) {
      toast.error('Failed to review submittal');
    }
  };

  const isOverdue = (sub: Submittal) => {
    return sub.dueDate && 
      new Date(sub.dueDate) < new Date() && 
      !['APPROVED', 'APPROVED_AS_NOTED', 'VOID'].includes(sub.status);
  };

  return (
    <div className="p-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#1F2328] border border-gray-700 rounded-lg p-3">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-sm text-gray-400">Total</p>
        </div>
        <div className="bg-[#1F2328] border border-gray-700 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-300">{stats.pending}</p>
          <p className="text-sm text-gray-400">Pending</p>
        </div>
        <div className="bg-[#1F2328] border border-yellow-700/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-yellow-400">{stats.underReview}</p>
          <p className="text-sm text-gray-400">Under Review</p>
        </div>
        <div className="bg-[#1F2328] border border-green-700/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
          <p className="text-sm text-gray-400">Approved</p>
        </div>
        <div className="bg-[#1F2328] border border-red-700/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-red-400">{stats.overdue}</p>
          <p className="text-sm text-gray-400">Overdue</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-white">MEP Submittals</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
            flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Submittal
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search submittals..."
            className="w-full pl-10 pr-4 py-2 bg-[#1F2328] border border-gray-700 rounded-lg
              text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#1F2328] border border-gray-700 rounded-lg
            text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Submittal List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredSubmittals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No submittals found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmittals.map((sub) => {
            const statusConfig = STATUS_CONFIG[sub.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusConfig.icon;
            const overdue = isOverdue(sub);
            
            return (
              <div
                key={sub.id}
                className={`bg-[#1F2328] border rounded-lg p-4 transition-colors
                  ${overdue ? 'border-red-700' : 'border-gray-700 hover:border-gray-600'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                      <StatusIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-400">{sub.submittalNumber}</span>
                        <h3 className="text-white font-medium">{sub.title}</h3>
                        {sub.revision > 0 && (
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                            Rev {sub.revision}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
                        <span>{sub.submittalType.replace(/_/g, ' ')}</span>
                        {sub.specSection && <span>• {sub.specSection}</span>}
                        {sub.submittedBy && <span>• {sub.submittedBy}</span>}
                      </div>
                      {(sub.equipment || sub.system) && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                          {sub.equipment && (
                            <span>{sub.equipment.equipmentTag} - {sub.equipment.name}</span>
                          )}
                          {sub.system && !sub.equipment && (
                            <span>{sub.system.systemNumber} - {sub.system.name}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${statusConfig.color} text-white`}>
                      {statusConfig.label}
                    </span>
                    {overdue && (
                      <span className="px-2 py-1 bg-red-900 text-red-300 text-xs rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    {sub.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due: {new Date(sub.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {sub.reviewerName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {sub.reviewerName}
                      </span>
                    )}
                    {sub.stampStatus && (
                      <span className="text-green-400">{sub.stampStatus}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/project/${projectSlug}/mep/submittals/${sub.id}`}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded
                        flex items-center gap-1 transition-colors border border-slate-500"
                    >
                      <Eye className="w-3 h-3" /> View
                    </Link>
                    {['SUBMITTED', 'UNDER_REVIEW'].includes(sub.status) && (
                      <button
                        onClick={() => setReviewingSubmittal(sub)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded
                          flex items-center gap-1 transition-colors"
                      >
                        <Edit className="w-3 h-3" /> Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddSubmittalModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSubmittal}
        />
      )}

      {/* Review Modal */}
      {reviewingSubmittal && (
        <ReviewSubmittalModal
          submittal={reviewingSubmittal}
          onClose={() => setReviewingSubmittal(null)}
          onSubmit={(data) => handleReview(reviewingSubmittal.id, data)}
        />
      )}
    </div>
  );
}

function AddSubmittalModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    title: '',
    submittalType: 'PRODUCT_DATA',
    specSection: '',
    dueDate: '',
    submittedBy: '',
    contactEmail: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F2328] border border-gray-700 rounded-lg max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">New Submittal</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g., AHU-1 Product Data"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type *</label>
              <select
                value={formData.submittalType}
                onChange={(e) => setFormData({...formData, submittalType: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              >
                {SUBMITTAL_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Spec Section</label>
              <input
                type="text"
                value={formData.specSection}
                onChange={(e) => setFormData({...formData, specSection: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g., 23 05 00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Submitted By</label>
              <input
                type="text"
                value={formData.submittedBy}
                onChange={(e) => setFormData({...formData, submittedBy: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="Subcontractor name"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Create Submittal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReviewSubmittalModal({ 
  submittal, 
  onClose, 
  onSubmit 
}: { 
  submittal: Submittal; 
  onClose: () => void; 
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    status: 'APPROVED',
    reviewComments: '',
    stampStatus: 'Approved',
    resubmitDue: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F2328] border border-gray-700 rounded-lg max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-medium text-white">Review Submittal</h3>
            <p className="text-sm text-gray-400">{submittal.submittalNumber} - {submittal.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Decision *</label>
            <select
              value={formData.status}
              onChange={(e) => {
                const status = e.target.value;
                setFormData({
                  ...formData,
                  status,
                  stampStatus: status === 'APPROVED' ? 'Approved' :
                              status === 'APPROVED_AS_NOTED' ? 'Approved as Noted' :
                              status === 'REVISE_RESUBMIT' ? 'Revise and Resubmit' :
                              status === 'REJECTED' ? 'Rejected' : ''
                });
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="APPROVED">Approved</option>
              <option value="APPROVED_AS_NOTED">Approved as Noted</option>
              <option value="REVISE_RESUBMIT">Revise and Resubmit</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Review Comments</label>
            <textarea
              value={formData.reviewComments}
              onChange={(e) => setFormData({...formData, reviewComments: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="Enter review comments..."
            />
          </div>
          {formData.status === 'REVISE_RESUBMIT' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Resubmit Due Date</label>
              <input
                type="date"
                value={formData.resubmitDue}
                onChange={(e) => setFormData({...formData, resubmitDue: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
