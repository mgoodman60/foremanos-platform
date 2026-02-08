'use client';

import { useState } from 'react';
import { Edit2, Save, X, Loader2 } from 'lucide-react';

interface InlineEditSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  editForm?: React.ReactNode;
  canEdit: boolean;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
}

export default function InlineEditSection({
  title,
  icon,
  children,
  editForm,
  canEdit,
  onSave,
  onCancel,
}: InlineEditSectionProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
      setEditing(false);
    } catch {
      // Error handling is expected to be in the parent via toast
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    setEditing(false);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
        {canEdit && editForm && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label={`Edit ${title}`}
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>
      {editing && editForm ? editForm : children}
    </div>
  );
}
