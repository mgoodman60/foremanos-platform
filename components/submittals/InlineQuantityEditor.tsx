'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Check, X, Loader2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface InlineQuantityEditorProps {
  lineItemId: string;
  projectSlug: string;
  currentValue: number;
  unit: string;
  field: 'submittedQty' | 'requiredQty';
  onUpdate: (newValue: number) => void;
}

export default function InlineQuantityEditor({
  lineItemId,
  projectSlug,
  currentValue,
  unit,
  field,
  onUpdate
}: InlineQuantityEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue.toString());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      toast.error('Please enter a valid positive number');
      return;
    }

    if (numValue === currentValue) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/line-items/${lineItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: numValue })
      });

      if (res.ok) {
        onUpdate(numValue);
        setEditing(false);
        toast.success('Quantity updated');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update quantity');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(currentValue.toString());
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1 hover:bg-slate-700/50 px-2 py-1 -mx-2 -my-1 rounded transition-colors"
        title="Click to edit"
      >
        <span className="font-medium">{currentValue}</span>
        <span className="text-slate-500">{unit}</span>
        <Edit2 className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        min="0"
        step="any"
        disabled={saving}
        className="w-20 px-2 py-1 bg-slate-700 border border-blue-500 rounded text-white text-sm
          focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="text-slate-500 text-sm">{unit}</span>
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      ) : (
        <>
          <button
            onClick={handleSave}
            className="p-1 hover:bg-emerald-900/50 rounded text-emerald-400"
            title="Save (Enter)"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-red-900/50 rounded text-red-400"
            title="Cancel (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
