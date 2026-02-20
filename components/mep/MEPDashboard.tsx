'use client';

import { useState, useEffect } from 'react';
import { 
  Server, 
  HardDrive, 
  FileCheck, 
  Wrench, 
  AlertTriangle,
  Clock,
  Zap,
  Droplets,
  Flame,
  Cpu,
  RefreshCw,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface MEPStats {
  totalSystems: number;
  totalEquipment: number;
  totalSubmittals: number;
  pendingSubmittals: number;
  totalMaintenanceSchedules: number;
  upcomingMaintenance: number;
  overdueMaintenance: number;
  totalCalculations: number;
  equipmentByStatus: Record<string, number>;
  systemsByType: Record<string, number>;
}

interface MEPDashboardProps {
  projectSlug: string;
}

const SYSTEM_TYPE_ICONS: Record<string, any> = {
  HVAC: Cpu,
  ELECTRICAL: Zap,
  PLUMBING: Droplets,
  FIRE_PROTECTION: Flame,
};

const SYSTEM_TYPE_COLORS: Record<string, string> = {
  HVAC: 'bg-blue-900/50 border-blue-700 text-blue-300',
  ELECTRICAL: 'bg-yellow-900/50 border-yellow-700 text-yellow-300',
  PLUMBING: 'bg-cyan-900/50 border-cyan-700 text-cyan-300',
  FIRE_PROTECTION: 'bg-red-900/50 border-red-700 text-red-300',
  CONTROLS: 'bg-purple-900/50 border-purple-700 text-purple-300',
  LOW_VOLTAGE: 'bg-green-900/50 border-green-700 text-green-300',
  SPECIALTY: 'bg-gray-700/50 border-gray-600 text-gray-300',
};

export default function MEPDashboard({ projectSlug }: MEPDashboardProps) {
  const [stats, setStats] = useState<MEPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchModels();
  }, [projectSlug]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch MEP stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch(`/api/autodesk/models?projectSlug=${projectSlug}`);
      if (res.ok) {
        const data = await res.json();
        setModels(data.models?.filter((m: any) => m.status === 'completed') || []);
      }
    } catch (error) {
      // Models API might not be available
      console.log('Autodesk models not available');
    }
  };

  const handleBIMImport = async (modelId: string) => {
    setImporting(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/bim-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId })
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchStats();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to import from BIM');
      }
    } catch (error) {
      toast.error('Failed to import from BIM');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>Failed to load MEP data</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Systems"
          value={stats.totalSystems}
          icon={Server}
          color="blue"
        />
        <StatCard
          title="Equipment Items"
          value={stats.totalEquipment}
          icon={HardDrive}
          color="green"
        />
        <StatCard
          title="Open Submittals"
          value={stats.pendingSubmittals}
          total={stats.totalSubmittals}
          icon={FileCheck}
          color="yellow"
        />
        <StatCard
          title="Maintenance Due"
          value={stats.upcomingMaintenance}
          alert={stats.overdueMaintenance}
          icon={Wrench}
          color="purple"
        />
      </div>

      {/* BIM Import Section */}
      {models.length > 0 && (
        <div className="bg-dark-surface border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" aria-hidden="true" />
            Import from BIM Models
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Auto-populate MEP equipment, systems, and load calculations from processed BIM models.
          </p>
          <div className="flex flex-wrap gap-2">
            {models.map(model => (
              <button
                key={model.id}
                onClick={() => handleBIMImport(model.id)}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                  text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-4 h-4" aria-hidden="true" />
                )}
                {model.fileName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Systems by Type */}
        <div className="bg-dark-surface border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-white mb-4">Systems by Type</h3>
          <div className="space-y-3">
            {Object.entries(stats.systemsByType).map(([type, count]) => {
              const Icon = SYSTEM_TYPE_ICONS[type] || Server;
              const colorClass = SYSTEM_TYPE_COLORS[type] || SYSTEM_TYPE_COLORS.SPECIALTY;
              
              return (
                <div
                  key={type}
                  className={`flex items-center justify-between p-3 rounded-lg border ${colorClass}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    <span className="font-medium">{type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-lg font-semibold">{count}</span>
                </div>
              );
            })}
            {Object.keys(stats.systemsByType).length === 0 && (
              <p className="text-gray-400 text-center py-4">No systems created yet</p>
            )}
          </div>
        </div>

        {/* Equipment Status */}
        <div className="bg-dark-surface border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-white mb-4">Equipment Status</h3>
          <div className="space-y-2">
            {Object.entries(stats.equipmentByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between py-2">
                <span className="text-gray-300">{status.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ 
                        width: `${(count / stats.totalEquipment) * 100}%` 
                      }} 
                    />
                  </div>
                  <span className="text-white font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(stats.equipmentByStatus).length === 0 && (
              <p className="text-gray-400 text-center py-4">No equipment added yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {(stats.overdueMaintenance > 0 || stats.pendingSubmittals > 0) && (
        <div className="bg-dark-surface border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" aria-hidden="true" />
            Attention Required
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.overdueMaintenance > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <Clock className="w-5 h-5 text-red-400" aria-hidden="true" />
                <div>
                  <p className="text-red-300 font-medium">
                    {stats.overdueMaintenance} Overdue Maintenance
                  </p>
                  <p className="text-sm text-red-400/70">Tasks need immediate attention</p>
                </div>
              </div>
            )}
            {stats.pendingSubmittals > 0 && (
              <div className="flex items-center gap-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                <FileCheck className="w-5 h-5 text-yellow-400" aria-hidden="true" />
                <div>
                  <p className="text-yellow-300 font-medium">
                    {stats.pendingSubmittals} Pending Submittals
                  </p>
                  <p className="text-sm text-yellow-400/70">Awaiting review or response</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  total,
  alert,
  icon: Icon,
  color
}: {
  title: string;
  value: number;
  total?: number;
  alert?: number;
  icon: any;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-900/30 border-blue-700',
    green: 'bg-green-900/30 border-green-700',
    yellow: 'bg-yellow-900/30 border-yellow-700',
    purple: 'bg-purple-900/30 border-purple-700',
  };

  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-6 h-6 ${iconColors[color]}`} aria-hidden="true" />
        {alert !== undefined && alert > 0 && (
          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
            {alert} overdue
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal text-gray-400"> / {total}</span>
        )}
      </p>
      <p className="text-sm text-gray-400">{title}</p>
    </div>
  );
}
