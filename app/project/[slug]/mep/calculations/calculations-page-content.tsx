'use client';

import { useState, useEffect } from 'react';
import { Calculator, Zap, Cpu, Droplets, Plus, X, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

const CALC_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; unit: string }> = {
  ELECTRICAL_DEMAND: { label: 'Electrical Demand', icon: Zap, color: 'bg-yellow-900/50 border-yellow-700', unit: 'kW' },
  ELECTRICAL_PANEL_SCHEDULE: { label: 'Panel Schedule', icon: Zap, color: 'bg-yellow-800/50 border-yellow-700', unit: 'A' },
  HVAC_HEATING_LOAD: { label: 'Heating Load', icon: Cpu, color: 'bg-red-900/50 border-red-700', unit: 'BTU/hr' },
  HVAC_COOLING_LOAD: { label: 'Cooling Load', icon: Cpu, color: 'bg-blue-900/50 border-blue-700', unit: 'tons' },
  PLUMBING_FIXTURE_UNITS: { label: 'Fixture Units', icon: Droplets, color: 'bg-cyan-900/50 border-cyan-700', unit: 'FU' },
  PLUMBING_WATER_DEMAND: { label: 'Water Demand', icon: Droplets, color: 'bg-cyan-800/50 border-cyan-700', unit: 'GPM' },
  FIRE_WATER_DEMAND: { label: 'Fire Water Demand', icon: Droplets, color: 'bg-red-800/50 border-red-700', unit: 'GPM' },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-600',
  PENDING_REVIEW: 'bg-yellow-600',
  APPROVED: 'bg-green-600',
  SUPERSEDED: 'bg-red-600',
};

interface LoadCalculation {
  id: string;
  calcNumber: string;
  name: string;
  calcType: string;
  designLoad?: number;
  connectedLoad?: number;
  demandFactor?: number;
  diversityFactor?: number;
  safetyFactor?: number;
  unit?: string;
  status: string;
  preparedBy?: string;
  assumptions?: string;
  system?: { systemNumber: string; name: string };
  createdByUser?: { username: string };
}

export default function CalculationsPageContent({ projectSlug }: { projectSlug: string }) {
  const [calculations, setCalculations] = useState<LoadCalculation[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, byType: {}, approved: 0, pending: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [_selectedType, _setSelectedType] = useState<string>('');
  const [deleteCalcId, setDeleteCalcId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    calcType: '',
    connectedLoad: '',
    demandFactor: '0.8',
    diversityFactor: '1.0',
    safetyFactor: '1.15',
    assumptions: '',
  });

  useEffect(() => {
    fetchCalculations();
  }, [projectSlug]);

  const fetchCalculations = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/load-calculations`);
      if (res.ok) {
        const data = await res.json();
        setCalculations(data.calculations || []);
        setSummary(data.summary || { total: 0, byType: {}, approved: 0, pending: 0, draft: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch calculations:', error);
      toast.error('Failed to fetch calculations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCalculation = async () => {
    if (!formData.name || !formData.calcType) {
      toast.error('Name and calculation type are required');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/load-calculations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          calcType: formData.calcType,
          connectedLoad: parseFloat(formData.connectedLoad) || 0,
          demandFactor: parseFloat(formData.demandFactor) || 0.8,
          diversityFactor: parseFloat(formData.diversityFactor) || 1.0,
          safetyFactor: parseFloat(formData.safetyFactor) || 1.15,
          assumptions: formData.assumptions,
        }),
      });

      if (res.ok) {
        toast.success('Calculation created successfully');
        setShowAddModal(false);
        setFormData({ name: '', calcType: '', connectedLoad: '', demandFactor: '0.8', diversityFactor: '1.0', safetyFactor: '1.15', assumptions: '' });
        fetchCalculations();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create calculation');
      }
    } catch (error) {
      toast.error('Failed to create calculation');
    }
  };

  const handleDeleteCalculation = (id: string) => {
    setDeleteCalcId(id);
  };

  const doDeleteCalculation = async () => {
    const id = deleteCalcId;
    setDeleteCalcId(null);
    if (!id) return;

    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/load-calculations/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Calculation deleted');
        fetchCalculations();
      } else {
        toast.error('Failed to delete calculation');
      }
    } catch (error) {
      toast.error('Failed to delete calculation');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/load-calculations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (res.ok) {
        toast.success('Calculation approved');
        fetchCalculations();
      }
    } catch (error) {
      toast.error('Failed to approve calculation');
    }
  };

  const openAddModal = (type?: string) => {
    if (type) {
      setFormData(prev => ({ ...prev, calcType: type }));
    }
    setShowAddModal(true);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Load Calculations</h2>
          <p className="text-sm text-gray-400">
            Electrical, HVAC, and plumbing load calculations • {summary.total} total
          </p>
        </div>
        <button
          onClick={() => openAddModal()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
            flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Calculation
        </button>
      </div>

      {/* Calculation Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Object.entries(CALC_TYPE_CONFIG).map(([type, config]) => {
          const Icon = config.icon;
          const count = summary.byType?.[type] || 0;
          return (
            <div
              key={type}
              onClick={() => openAddModal(type)}
              className={`border rounded-lg p-4 ${config.color} cursor-pointer hover:opacity-80 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-6 h-6" />
                <div>
                  <h3 className="font-medium text-white">{config.label}</h3>
                  <p className="text-sm opacity-70">{count} calculation{count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calculations List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : calculations.length === 0 ? (
        <div className="text-center py-12 bg-dark-surface border border-gray-700 rounded-lg">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400">No load calculations yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Click a category above to create one
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {calculations.map((calc) => {
            const config = CALC_TYPE_CONFIG[calc.calcType] || { label: calc.calcType, icon: Calculator, color: 'bg-gray-700', unit: '' };
            const Icon = config.icon;

            return (
              <div
                key={calc.id}
                className="bg-dark-surface border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-400">{calc.calcNumber}</span>
                        <h3 className="text-white font-medium">{calc.name}</h3>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{config.label}</p>
                      {calc.connectedLoad && (
                        <p className="text-xs text-gray-500 mt-1">
                          Connected: {calc.connectedLoad} {calc.unit} × DF:{calc.demandFactor} × SF:{calc.safetyFactor}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-lg font-semibold text-white">
                        {calc.designLoad?.toFixed(1)} {calc.unit}
                      </span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded text-white ${STATUS_COLORS[calc.status] || 'bg-gray-600'}`}>
                        {calc.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {calc.status === 'DRAFT' && (
                        <button
                          onClick={() => handleApprove(calc.id)}
                          className="p-2 hover:bg-green-900/50 rounded text-green-400"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCalculation(calc.id)}
                        className="p-2 hover:bg-red-900/50 rounded text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Calculation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-dark-surface border border-gray-700 rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">New Load Calculation</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Calculation Type</label>
                <select
                  value={formData.calcType}
                  onChange={(e) => setFormData(prev => ({ ...prev, calcType: e.target.value }))}
                  className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select type...</option>
                  {Object.entries(CALC_TYPE_CONFIG).map(([type, config]) => (
                    <option key={type} value={type}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Main Panel A Load Schedule"
                  className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Connected Load ({formData.calcType ? CALC_TYPE_CONFIG[formData.calcType]?.unit : 'units'})
                  </label>
                  <input
                    type="number"
                    value={formData.connectedLoad}
                    onChange={(e) => setFormData(prev => ({ ...prev, connectedLoad: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Demand Factor</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.demandFactor}
                    onChange={(e) => setFormData(prev => ({ ...prev, demandFactor: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Diversity Factor</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.diversityFactor}
                    onChange={(e) => setFormData(prev => ({ ...prev, diversityFactor: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Safety Factor</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.safetyFactor}
                    onChange={(e) => setFormData(prev => ({ ...prev, safetyFactor: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Assumptions</label>
                <textarea
                  value={formData.assumptions}
                  onChange={(e) => setFormData(prev => ({ ...prev, assumptions: e.target.value }))}
                  placeholder="Design assumptions and notes..."
                  rows={3}
                  className="w-full px-3 py-2 bg-dark-card border border-gray-600 rounded-lg text-white resize-none"
                />
              </div>

              {formData.connectedLoad && (
                <div className="bg-dark-card rounded-lg p-4 border border-gray-600">
                  <p className="text-sm text-gray-400">Calculated Design Load:</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {(
                      parseFloat(formData.connectedLoad || '0') *
                      parseFloat(formData.demandFactor || '1') *
                      parseFloat(formData.diversityFactor || '1') *
                      parseFloat(formData.safetyFactor || '1.15')
                    ).toFixed(2)} {formData.calcType ? CALC_TYPE_CONFIG[formData.calcType]?.unit : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCalculation}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create Calculation
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteCalcId !== null}
        onConfirm={doDeleteCalculation}
        onCancel={() => setDeleteCalcId(null)}
        title="Delete Calculation"
        description="Are you sure you want to delete this calculation?"
        variant="destructive"
      />
    </div>
  );
}
