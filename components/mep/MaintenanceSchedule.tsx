'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Wrench, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Check,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

interface MaintenanceSchedule {
  id: string;
  scheduleNumber: string;
  name: string;
  frequency: string;
  taskDescription?: string;
  checklist?: string[];
  estimatedDuration?: number;
  assignedTo?: string;
  assignedContractor?: string;
  startDate: string;
  nextDueDate: string;
  lastCompletedDate?: string;
  isActive: boolean;
  regulatoryRequired: boolean;
  regulatoryCode?: string;
  isOverdue: boolean;
  daysToDue: number;
  system?: { systemNumber: string; name: string };
  equipment?: { equipmentTag: string; name: string };
  logs?: Array<{
    id: string;
    completedDate: string;
    completedByName: string;
    status: string;
    notes?: string;
  }>;
}

interface MaintenanceScheduleProps {
  projectSlug: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  CUSTOM: 'Custom',
};

export default function MaintenanceScheduleView({ projectSlug }: MaintenanceScheduleProps) {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, overdue: 0, dueThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [completingSchedule, setCompletingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [equipment, setEquipment] = useState<any[]>([]);

  useEffect(() => {
    fetchSchedules();
    fetchEquipment();
  }, [projectSlug, showOverdueOnly]);

  const fetchSchedules = async () => {
    try {
      const params = new URLSearchParams();
      params.append('active', 'true');
      if (showOverdueOnly) params.append('upcoming', '0');
      
      const res = await fetch(`/api/projects/${projectSlug}/mep/maintenance?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipment = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/equipment`);
      if (res.ok) {
        const data = await res.json();
        setEquipment(data.equipment);
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    }
  };

  const filteredSchedules = schedules.filter(sch =>
    sch.name.toLowerCase().includes(search.toLowerCase()) ||
    sch.scheduleNumber.toLowerCase().includes(search.toLowerCase()) ||
    sch.equipment?.equipmentTag.toLowerCase().includes(search.toLowerCase())
  );

  const handleComplete = async (scheduleId: string, completionData: any) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/maintenance/${scheduleId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completionData)
      });
      
      if (res.ok) {
        toast.success('Maintenance completed successfully');
        setCompletingSchedule(null);
        fetchSchedules();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to complete maintenance');
      }
    } catch (error) {
      toast.error('Failed to complete maintenance');
    }
  };

  const handleAddSchedule = async (formData: any) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success('Schedule created successfully');
        setShowAddModal(false);
        fetchSchedules();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create schedule');
      }
    } catch (error) {
      toast.error('Failed to create schedule');
    }
  };

  return (
    <div className="p-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1F2328] border border-gray-700 rounded-lg p-3">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-sm text-gray-400">Total Schedules</p>
        </div>
        <div className="bg-[#1F2328] border border-gray-700 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-400">{stats.active}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="bg-[#1F2328] border border-red-700/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-red-400">{stats.overdue}</p>
          <p className="text-sm text-gray-400">Overdue</p>
        </div>
        <div className="bg-[#1F2328] border border-yellow-700/50 rounded-lg p-3">
          <p className="text-2xl font-bold text-yellow-400">{stats.dueThisWeek}</p>
          <p className="text-sm text-gray-400">Due This Week</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-white">Maintenance Schedules</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
            flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Schedule
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
            placeholder="Search schedules..."
            className="w-full pl-10 pr-4 py-2 bg-[#1F2328] border border-gray-700 rounded-lg
              text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowOverdueOnly(!showOverdueOnly)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors
            ${showOverdueOnly 
              ? 'bg-red-600 text-white' 
              : 'bg-[#1F2328] border border-gray-700 text-gray-300 hover:bg-gray-700'}`}
        >
          <AlertTriangle className="w-4 h-4" />
          Overdue Only
        </button>
      </div>

      {/* Schedule List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No maintenance schedules found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSchedules.map((sch) => (
            <div
              key={sch.id}
              className={`bg-[#1F2328] border rounded-lg p-4 transition-colors
                ${sch.isOverdue ? 'border-red-700' : 'border-gray-700 hover:border-gray-600'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${sch.isOverdue ? 'bg-red-900' : 'bg-purple-900'}`}>
                    <Wrench className={`w-5 h-5 ${sch.isOverdue ? 'text-red-400' : 'text-purple-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-400">{sch.scheduleNumber}</span>
                      <h3 className="text-white font-medium">{sch.name}</h3>
                      {sch.regulatoryRequired && (
                        <span className="px-2 py-0.5 bg-orange-900/50 text-orange-300 text-xs rounded">
                          Regulatory
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
                      <span>{FREQUENCY_LABELS[sch.frequency] || sch.frequency}</span>
                      {sch.equipment && (
                        <span>• {sch.equipment.equipmentTag}</span>
                      )}
                      {sch.estimatedDuration && (
                        <span>• ~{sch.estimatedDuration} min</span>
                      )}
                    </div>
                    {sch.taskDescription && (
                      <p className="mt-2 text-sm text-gray-500">{sch.taskDescription}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {sch.isOverdue ? (
                    <span className="px-2 py-1 bg-red-600 text-white text-xs rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {Math.abs(sch.daysToDue)} days overdue
                    </span>
                  ) : sch.daysToDue <= 7 ? (
                    <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Due in {sch.daysToDue} days
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-600 text-gray-200 text-xs rounded">
                      {sch.daysToDue} days
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Next: {new Date(sch.nextDueDate).toLocaleDateString()}
                  </span>
                  {sch.lastCompletedDate && (
                    <span>
                      Last: {new Date(sch.lastCompletedDate).toLocaleDateString()}
                    </span>
                  )}
                  {sch.logs && sch.logs[0] && (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {sch.logs[0].completedByName}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setCompletingSchedule(sch)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded
                    flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" /> Complete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Complete Modal */}
      {completingSchedule && (
        <CompleteMaintenanceModal
          schedule={completingSchedule}
          onClose={() => setCompletingSchedule(null)}
          onSubmit={(data) => handleComplete(completingSchedule.id, data)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddScheduleModal
          equipment={equipment}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSchedule}
        />
      )}
    </div>
  );
}

function CompleteMaintenanceModal({
  schedule,
  onClose,
  onSubmit
}: {
  schedule: MaintenanceSchedule;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    status: 'COMPLETED',
    notes: '',
    findings: '',
    deficienciesFound: false,
    actualDuration: schedule.estimatedDuration || '',
  });
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const checklist = schedule.checklist || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F2328] border border-gray-700 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-medium text-white">Complete Maintenance</h3>
            <p className="text-sm text-gray-400">{schedule.scheduleNumber} - {schedule.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {checklist.length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Checklist</label>
              <div className="space-y-2 bg-gray-800 rounded-lg p-3">
                {checklist.map((item, idx) => (
                  <label key={idx} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkedItems[idx] || false}
                      onChange={(e) => setCheckedItems({...checkedItems, [idx]: e.target.checked})}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700"
                    />
                    <span className="text-sm text-gray-300">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="COMPLETED">Completed</option>
              <option value="PARTIAL">Partial Completion</option>
              <option value="DEFERRED">Deferred</option>
              <option value="ISSUE_FOUND">Issue Found</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Actual Duration (minutes)</label>
            <input
              type="number"
              value={formData.actualDuration}
              onChange={(e) => setFormData({...formData, actualDuration: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="Completion notes..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="deficiencies"
              checked={formData.deficienciesFound}
              onChange={(e) => setFormData({...formData, deficienciesFound: e.target.checked})}
              className="w-4 h-4 rounded border-gray-700 bg-gray-800"
            />
            <label htmlFor="deficiencies" className="text-sm text-gray-300">
              Deficiencies found requiring follow-up
            </label>
          </div>
          {formData.deficienciesFound && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Findings</label>
              <textarea
                value={formData.findings}
                onChange={(e) => setFormData({...formData, findings: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="Describe deficiencies found..."
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
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              Mark Complete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddScheduleModal({
  equipment,
  onClose,
  onSubmit
}: {
  equipment: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    frequency: 'MONTHLY',
    equipmentId: '',
    taskDescription: '',
    estimatedDuration: '',
    startDate: new Date().toISOString().split('T')[0],
    regulatoryRequired: false,
    regulatoryCode: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F2328] border border-gray-700 rounded-lg max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">New Maintenance Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Monthly Filter Change - AHU-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Frequency *</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Equipment</label>
            <select
              value={formData.equipmentId}
              onChange={(e) => setFormData({...formData, equipmentId: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select equipment...</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipmentTag} - {eq.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Task Description</label>
            <textarea
              value={formData.taskDescription}
              onChange={(e) => setFormData({...formData, taskDescription: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="Description of maintenance task..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Est. Duration (minutes)</label>
            <input
              type="number"
              value={formData.estimatedDuration}
              onChange={(e) => setFormData({...formData, estimatedDuration: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="regulatory"
              checked={formData.regulatoryRequired}
              onChange={(e) => setFormData({...formData, regulatoryRequired: e.target.checked})}
              className="w-4 h-4 rounded border-gray-700 bg-gray-800"
            />
            <label htmlFor="regulatory" className="text-sm text-gray-300">
              Regulatory requirement
            </label>
          </div>
          {formData.regulatoryRequired && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Regulatory Code</label>
              <input
                type="text"
                value={formData.regulatoryCode}
                onChange={(e) => setFormData({...formData, regulatoryCode: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g., NFPA 25"
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
              Create Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
