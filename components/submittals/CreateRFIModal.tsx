'use client';

import { useState } from 'react';
import {
  X,
  FileQuestion,
  Loader2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface Shortage {
  lineItemId: string;
  productName: string;
  submittalId: string;
  submittalNumber: string;
  submitted: number;
  required: number;
  variance: number;
  variancePercent: number;
  unit: string;
  tradeCategory?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface CreateRFIModalProps {
  projectSlug: string;
  shortage: Shortage;
  onClose: () => void;
  onCreated?: (rfiId: string) => void;
}

export default function CreateRFIModal({ projectSlug, shortage, onClose, onCreated }: CreateRFIModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const trapRef = useFocusTrap({ isActive: true, onEscape: onClose });
  const [form, setForm] = useState({
    title: `Quantity Discrepancy - ${shortage.productName}`,
    question: `Submittal ${shortage.submittalNumber} shows a quantity discrepancy for "${shortage.productName}".\n\nSubmitted: ${shortage.submitted} ${shortage.unit}\nRequired: ${shortage.required} ${shortage.unit}\nShortage: ${Math.abs(shortage.variance)} ${shortage.unit} (${Math.abs(shortage.variancePercent).toFixed(1)}% under)\n\nPlease advise on one of the following:\n1. Confirm the reduced quantity is acceptable\n2. Submit additional quantities to meet the requirement\n3. Provide alternative product substitution`,
    priority: shortage.severity === 'CRITICAL' ? 'URGENT' : shortage.severity === 'HIGH' ? 'HIGH' : 'NORMAL',
    assignedToName: '',
    assignedToEmail: '',
    specSection: '',
    drawingRef: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/rfis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          relatedSubmittalId: shortage.submittalId,
          relatedLineItemId: shortage.lineItemId
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`RFI #${data.rfiNumber} created successfully`);
        onCreated?.(data.id);
        onClose();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create RFI');
      }
    } catch (error) {
      toast.error('Failed to create RFI');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="create-rfi-title" className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800">
          <div className="flex items-center gap-3">
            <FileQuestion className="w-5 h-5 text-blue-400" />
            <h2 id="create-rfi-title" className="text-lg font-semibold text-white">Create RFI from Shortage</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Shortage Summary */}
        <div className="px-5 py-3 bg-red-950/50 border-b border-red-900">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Shortage: {shortage.productName}</span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Missing {Math.abs(shortage.variance)} {shortage.unit} ({Math.abs(shortage.variancePercent).toFixed(1)}% under requirement)
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">RFI Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Question */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Question / Request</label>
            <textarea
              value={form.question}
              onChange={(e) => updateForm('question', e.target.value)}
              required
              rows={6}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => updateForm('priority', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Assign To (Name)</label>
              <input
                type="text"
                value={form.assignedToName}
                onChange={(e) => updateForm('assignedToName', e.target.value)}
                placeholder="e.g., John Smith"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                  text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={form.assignedToEmail}
                onChange={(e) => updateForm('assignedToEmail', e.target.value)}
                placeholder="e.g., john@example.com"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                  text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* References */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Spec Section</label>
              <input
                type="text"
                value={form.specSection}
                onChange={(e) => updateForm('specSection', e.target.value)}
                placeholder="e.g., 08 71 00"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                  text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Drawing Reference</label>
              <input
                type="text"
                value={form.drawingRef}
                onChange={(e) => updateForm('drawingRef', e.target.value)}
                placeholder="e.g., A-101"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                  text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-end gap-3 bg-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.title || !form.question}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
              text-white rounded-lg flex items-center gap-2 transition-colors font-medium"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              <><Send className="w-4 h-4" /> Create RFI</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
