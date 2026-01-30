'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter,
  ChevronDown,
  HardDrive,
  MapPin,
  Calendar,
  DollarSign,
  ExternalLink,
  Edit,
  Trash2,
  X,
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';

interface Equipment {
  id: string;
  equipmentTag: string;
  name: string;
  equipmentType: string;
  manufacturer?: string;
  model?: string;
  capacity?: string;
  level?: string;
  room?: string;
  status: string;
  estimatedCost?: number;
  extractedFromBIM: boolean;
  system?: {
    systemNumber: string;
    name: string;
    systemType: string;
  };
  _count: {
    submittals: number;
    maintenanceSchedules: number;
  };
}

interface EquipmentListProps {
  projectSlug: string;
}

const STATUS_COLORS: Record<string, string> = {
  SPECIFIED: 'bg-gray-600 text-gray-100',
  SUBMITTAL_PENDING: 'bg-yellow-600 text-yellow-100',
  SUBMITTAL_APPROVED: 'bg-blue-600 text-blue-100',
  ORDERED: 'bg-purple-600 text-purple-100',
  DELIVERED: 'bg-cyan-600 text-cyan-100',
  STAGED: 'bg-indigo-600 text-indigo-100',
  INSTALLED: 'bg-green-600 text-green-100',
  CONNECTED: 'bg-green-700 text-green-100',
  TESTED: 'bg-emerald-600 text-emerald-100',
  OPERATIONAL: 'bg-emerald-700 text-emerald-100',
  DEFICIENT: 'bg-red-600 text-red-100',
  REPLACED: 'bg-gray-500 text-gray-100',
};

const EQUIPMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'AHU', label: 'Air Handling Unit' },
  { value: 'RTU', label: 'Rooftop Unit' },
  { value: 'CHILLER', label: 'Chiller' },
  { value: 'BOILER', label: 'Boiler' },
  { value: 'PANEL', label: 'Electrical Panel' },
  { value: 'TRANSFORMER', label: 'Transformer' },
  { value: 'PUMP_HVAC', label: 'HVAC Pump' },
  { value: 'PUMP_PLUMBING', label: 'Plumbing Pump' },
  { value: 'WATER_HEATER', label: 'Water Heater' },
  { value: 'FIRE_PUMP', label: 'Fire Pump' },
];

export default function EquipmentList({ projectSlug }: EquipmentListProps) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [systems, setSystems] = useState<any[]>([]);

  useEffect(() => {
    fetchEquipment();
    fetchSystems();
  }, [projectSlug, typeFilter, statusFilter]);

  const fetchEquipment = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const res = await fetch(`/api/projects/${projectSlug}/mep/equipment?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEquipment(data.equipment);
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystems = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/systems`);
      if (res.ok) {
        const data = await res.json();
        setSystems(data.systems);
      }
    } catch (error) {
      console.error('Failed to fetch systems:', error);
    }
  };

  const filteredEquipment = equipment.filter(eq =>
    eq.name.toLowerCase().includes(search.toLowerCase()) ||
    eq.equipmentTag.toLowerCase().includes(search.toLowerCase()) ||
    eq.manufacturer?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddEquipment = async (formData: any) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success('Equipment added successfully');
        setShowAddModal(false);
        fetchEquipment();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to add equipment');
      }
    } catch (error) {
      toast.error('Failed to add equipment');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-white">Equipment Schedule</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
            flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Equipment
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
            placeholder="Search equipment..."
            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-gray-700 rounded-lg
              text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-dark-surface border border-gray-700 rounded-lg
            text-white focus:border-blue-500 focus:outline-none"
        >
          {EQUIPMENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-dark-surface border border-gray-700 rounded-lg
            text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="SPECIFIED">Specified</option>
          <option value="SUBMITTAL_PENDING">Submittal Pending</option>
          <option value="SUBMITTAL_APPROVED">Submittal Approved</option>
          <option value="ORDERED">Ordered</option>
          <option value="DELIVERED">Delivered</option>
          <option value="INSTALLED">Installed</option>
          <option value="OPERATIONAL">Operational</option>
        </select>
      </div>

      {/* Equipment List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredEquipment.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No equipment found</p>
          <p className="text-sm mt-1">Add equipment manually or import from BIM</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEquipment.map((eq) => (
            <div
              key={eq.id}
              className="bg-dark-surface border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gray-800 rounded-lg">
                    <HardDrive className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400">{eq.equipmentTag}</span>
                      <h3 className="text-white font-medium">{eq.name}</h3>
                      {eq.extractedFromBIM && (
                        <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded">
                          BIM
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
                      <span>{eq.equipmentType.replace(/_/g, ' ')}</span>
                      {eq.manufacturer && <span>• {eq.manufacturer}</span>}
                      {eq.model && <span>{eq.model}</span>}
                      {eq.capacity && <span>• {eq.capacity}</span>}
                    </div>
                    {(eq.level || eq.room) && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                        <MapPin className="w-3 h-3" />
                        {eq.level}{eq.room && ` - ${eq.room}`}
                      </div>
                    )}
                    {eq.system && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                        <Cpu className="w-3 h-3" />
                        {eq.system.systemNumber} - {eq.system.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[eq.status] || 'bg-gray-600 text-gray-100'}`}>
                    {eq.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-700 text-sm">
                <span className="text-gray-400">
                  {eq._count.submittals} submittal{eq._count.submittals !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-400">
                  {eq._count.maintenanceSchedules} PM schedule{eq._count.maintenanceSchedules !== 1 ? 's' : ''}
                </span>
                {eq.estimatedCost && (
                  <span className="text-green-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {eq.estimatedCost.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAddModal && (
        <AddEquipmentModal
          systems={systems}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddEquipment}
        />
      )}
    </div>
  );
}

function AddEquipmentModal({
  systems,
  onClose,
  onSubmit
}: {
  systems: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    equipmentType: 'AHU',
    systemId: '',
    manufacturer: '',
    model: '',
    capacity: '',
    level: '',
    room: '',
    estimatedCost: '',
    notes: '',
    createMaintenanceSchedules: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-surface border border-gray-700 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">Add Equipment</h3>
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
              placeholder="e.g., Air Handling Unit - Zone 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type *</label>
              <select
                value={formData.equipmentType}
                onChange={(e) => setFormData({...formData, equipmentType: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              >
                <optgroup label="HVAC">
                  <option value="AHU">Air Handling Unit</option>
                  <option value="RTU">Rooftop Unit</option>
                  <option value="CHILLER">Chiller</option>
                  <option value="BOILER">Boiler</option>
                  <option value="VAV_BOX">VAV Box</option>
                  <option value="FCU">Fan Coil Unit</option>
                </optgroup>
                <optgroup label="Electrical">
                  <option value="PANEL">Electrical Panel</option>
                  <option value="TRANSFORMER">Transformer</option>
                  <option value="MDP">Main Distribution Panel</option>
                  <option value="VFD">Variable Frequency Drive</option>
                </optgroup>
                <optgroup label="Plumbing">
                  <option value="WATER_HEATER">Water Heater</option>
                  <option value="PUMP_PLUMBING">Pump</option>
                  <option value="FIXTURE">Plumbing Fixture</option>
                </optgroup>
                <optgroup label="Fire Protection">
                  <option value="FIRE_PUMP">Fire Pump</option>
                  <option value="FIRE_ALARM_PANEL">Fire Alarm Panel</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">System</label>
              <select
                value={formData.systemId}
                onChange={(e) => setFormData({...formData, systemId: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">None</option>
                {systems.map(sys => (
                  <option key={sys.id} value={sys.id}>
                    {sys.systemNumber} - {sys.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g., Carrier"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Capacity</label>
              <input
                type="text"
                value={formData.capacity}
                onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g., 10 tons, 200 amp"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Est. Cost</label>
              <input
                type="number"
                value={formData.estimatedCost}
                onChange={(e) => setFormData({...formData, estimatedCost: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Level/Floor</label>
              <input
                type="text"
                value={formData.level}
                onChange={(e) => setFormData({...formData, level: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g., Level 1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Room</label>
              <input
                type="text"
                value={formData.room}
                onChange={(e) => setFormData({...formData, room: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g., Mechanical Room 101"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createPM"
              checked={formData.createMaintenanceSchedules}
              onChange={(e) => setFormData({...formData, createMaintenanceSchedules: e.target.checked})}
              className="w-4 h-4 rounded border-gray-700 bg-gray-800"
            />
            <label htmlFor="createPM" className="text-sm text-gray-300">
              Create default PM schedules
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add Equipment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
