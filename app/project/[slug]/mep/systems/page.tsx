'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Server, 
  Search,
  ChevronDown,
  Cpu,
  Zap,
  Droplets,
  Flame,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const SYSTEM_TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  HVAC: { icon: Cpu, color: 'bg-blue-900/50 border-blue-700 text-blue-300' },
  ELECTRICAL: { icon: Zap, color: 'bg-yellow-900/50 border-yellow-700 text-yellow-300' },
  PLUMBING: { icon: Droplets, color: 'bg-cyan-900/50 border-cyan-700 text-cyan-300' },
  FIRE_PROTECTION: { icon: Flame, color: 'bg-red-900/50 border-red-700 text-red-300' },
  CONTROLS: { icon: Cpu, color: 'bg-purple-900/50 border-purple-700 text-purple-300' },
  LOW_VOLTAGE: { icon: Zap, color: 'bg-green-900/50 border-green-700 text-green-300' },
  SPECIALTY: { icon: Server, color: 'bg-gray-700/50 border-gray-600 text-gray-300' },
};

const STATUS_CONFIG: Record<string, string> = {
  DESIGN: 'bg-gray-600',
  SUBMITTAL: 'bg-yellow-600',
  FABRICATION: 'bg-purple-600',
  ROUGH_IN: 'bg-blue-600',
  INSTALLATION: 'bg-cyan-600',
  TESTING: 'bg-orange-600',
  COMMISSIONING: 'bg-green-600',
  OPERATIONAL: 'bg-emerald-600',
  DEFICIENT: 'bg-red-600',
};

export default function SystemsPage({ params }: { params: { slug: string } }) {
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchSystems();
  }, [params.slug, typeFilter]);

  const fetchSystems = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (typeFilter) queryParams.append('type', typeFilter);
      
      const res = await fetch(`/api/projects/${params.slug}/mep/systems?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setSystems(data.systems);
      }
    } catch (error) {
      console.error('Failed to fetch systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSystems = systems.filter(sys =>
    sys.name.toLowerCase().includes(search.toLowerCase()) ||
    sys.systemNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddSystem = async (formData: any) => {
    try {
      const res = await fetch(`/api/projects/${params.slug}/mep/systems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success('System created successfully');
        setShowAddModal(false);
        fetchSystems();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create system');
      }
    } catch (error) {
      toast.error('Failed to create system');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-white">MEP Systems</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
            flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add System
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search systems..."
            className="w-full pl-10 pr-4 py-2 bg-[#1F2328] border border-gray-700 rounded-lg
              text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-[#1F2328] border border-gray-700 rounded-lg
            text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="HVAC">HVAC</option>
          <option value="ELECTRICAL">Electrical</option>
          <option value="PLUMBING">Plumbing</option>
          <option value="FIRE_PROTECTION">Fire Protection</option>
          <option value="CONTROLS">Controls</option>
          <option value="LOW_VOLTAGE">Low Voltage</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredSystems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No systems found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSystems.map((sys) => {
            const config = SYSTEM_TYPE_CONFIG[sys.systemType] || SYSTEM_TYPE_CONFIG.SPECIALTY;
            const Icon = config.icon;
            
            return (
              <div
                key={sys.id}
                className={`border rounded-lg p-4 ${config.color}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-black/20 rounded-lg">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{sys.systemNumber}</span>
                        <h3 className="font-medium text-white">{sys.name}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm opacity-80">
                        <span>{sys.systemType.replace(/_/g, ' ')}</span>
                        {sys.designCapacity && <span>• {sys.designCapacity}</span>}
                        {sys.servingArea && <span>• {sys.servingArea}</span>}
                      </div>
                      {sys.description && (
                        <p className="mt-2 text-sm opacity-70">{sys.description}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded text-white ${STATUS_CONFIG[sys.status] || 'bg-gray-600'}`}>
                    {sys.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 text-sm">
                  <span>{sys._count.equipment} equipment</span>
                  <span>{sys._count.submittals} submittals</span>
                  <span>{sys._count.maintenanceSchedules} PM schedules</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddSystemModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSystem}
        />
      )}
    </div>
  );
}

function AddSystemModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    systemType: 'HVAC',
    description: '',
    designCapacity: '',
    servingArea: '',
    mainLocation: '',
    installingContractor: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F2328] border border-gray-700 rounded-lg max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">Add System</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">System Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g., HVAC System - Zone 1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">System Type *</label>
            <select
              value={formData.systemType}
              onChange={(e) => setFormData({...formData, systemType: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="HVAC">HVAC</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="FIRE_PROTECTION">Fire Protection</option>
              <option value="CONTROLS">Controls</option>
              <option value="LOW_VOLTAGE">Low Voltage</option>
              <option value="SPECIALTY">Specialty</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Design Capacity</label>
            <input
              type="text"
              value={formData.designCapacity}
              onChange={(e) => setFormData({...formData, designCapacity: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 50 tons, 400 amp"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Serving Area</label>
            <input
              type="text"
              value={formData.servingArea}
              onChange={(e) => setFormData({...formData, servingArea: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Building A - Floors 1-3"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Installing Contractor</label>
            <input
              type="text"
              value={formData.installingContractor}
              onChange={(e) => setFormData({...formData, installingContractor: e.target.value})}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                text-white focus:border-blue-500 focus:outline-none"
            />
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
              Create System
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
