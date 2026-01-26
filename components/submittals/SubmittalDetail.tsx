'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Package,
  Calculator,
  FileCheck,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Edit2,
  Trash2,
  History,
  FileEdit,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import VerificationHistory from './VerificationHistory';
import QuantityVarianceCharts from './QuantityVarianceCharts';
import InlineQuantityEditor from './InlineQuantityEditor';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { RequirementAutoImport } from './RequirementAutoImport';
import ApprovalWorkflow from './ApprovalWorkflow';
import SpecSectionLinker from './SpecSectionLinker';
import { FileSpreadsheet, ClipboardCheck, Library } from 'lucide-react';

interface LineItem {
  id: string;
  productName: string;
  manufacturer?: string;
  modelNumber?: string;
  partNumber?: string;
  submittedQty: number;
  requiredQty?: number;
  unit: string;
  unitPrice?: number;
  csiDivision?: string;
  csiTitle?: string;
  specSection?: string;
  tradeCategory?: string;
  complianceStatus: string;
  varianceQty?: number;
  variancePercent?: number;
  verifiedAt?: string;
  verificationNotes?: string;
  notes?: string;
  hardwareSet?: {
    setNumber: string;
    setName: string;
    doorCount: number;
  };
}

interface Submittal {
  id: string;
  submittalNumber: string;
  title: string;
  submittalType: string;
  specSection?: string;
  status: string;
  dueDate?: string;
  submittedBy?: string;
  reviewComments?: string;
  stampStatus?: string;
}

interface SubmittalDetailProps {
  projectSlug: string;
  submittalId: string;
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  SUFFICIENT: { bg: 'bg-emerald-950', border: 'border-emerald-500', text: 'text-emerald-400', icon: CheckCircle },
  INSUFFICIENT: { bg: 'bg-red-950', border: 'border-red-500', text: 'text-red-400', icon: XCircle },
  EXCESS: { bg: 'bg-amber-950', border: 'border-amber-500', text: 'text-amber-400', icon: AlertTriangle },
  NO_REQUIREMENT: { bg: 'bg-slate-800', border: 'border-slate-500', text: 'text-slate-400', icon: HelpCircle },
  UNVERIFIED: { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-400', icon: HelpCircle },
};

const TRADE_CATEGORIES = [
  { value: 'doors', label: 'Doors & Frames' },
  { value: 'door_hardware', label: 'Door Hardware' },
  { value: 'windows', label: 'Windows' },
  { value: 'glazing', label: 'Glazing' },
  { value: 'finishes', label: 'Finishes' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'fire_protection', label: 'Fire Protection' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'metals', label: 'Metals' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'specialties', label: 'Specialties' },
];

export default function SubmittalDetail({ projectSlug, submittalId }: SubmittalDetailProps) {
  const [submittal, setSubmittal] = useState<Submittal | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [stats, setStats] = useState({ total: 0, sufficient: 0, insufficient: 0, excess: 0, unverified: 0 });
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAutoImportModal, setShowAutoImportModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'items' | 'charts' | 'history' | 'approval' | 'specs'>('items');
  const [exporting, setExporting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [projectSlug, submittalId]);

  const fetchData = async () => {
    try {
      // Fetch submittal
      const subRes = await fetch(`/api/projects/${projectSlug}/mep/submittals/${submittalId}`);
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubmittal(subData.submittal);
      }

      // Fetch line items
      const itemsRes = await fetch(`/api/projects/${projectSlug}/mep/submittals/${submittalId}/line-items`);
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setLineItems(itemsData.lineItems);
        setStats(itemsData.stats);
      }
    } catch (error) {
      console.error('Failed to fetch submittal data:', error);
      toast.error('Failed to load submittal');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/${submittalId}/verify`, {
        method: 'POST'
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Verification complete: ${data.report.overallStatus}`);
        fetchData(); // Refresh data
      } else {
        const error = await res.json();
        toast.error(error.error || 'Verification failed');
      }
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleAddLineItem = async (formData: any) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/${submittalId}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success('Line item added');
        setShowAddModal(false);
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to add line item');
      }
    } catch (error) {
      toast.error('Failed to add line item');
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleLineItemUpdate = (lineItemId: string, field: string, value: number) => {
    setLineItems(prev => prev.map(item => 
      item.id === lineItemId ? { ...item, [field]: value } : item
    ));
    // Refresh data to get updated variance calculations
    fetchData();
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submittalId })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Submittal_Verification_${submittal?.submittalNumber || 'report'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Report exported successfully');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to export report');
      }
    } catch (error) {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!submittal) {
    return (
      <div className="p-6 text-center text-gray-400">
        Submittal not found
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with back link */}
      <div className="flex items-center gap-4">
        <Link
          href={`/project/${projectSlug}/mep/submittals`}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-blue-400 text-lg">{submittal.submittalNumber}</span>
            <h1 className="text-xl font-semibold text-white">{submittal.title}</h1>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
            <span>{submittal.submittalType.replace(/_/g, ' ')}</span>
            {submittal.specSection && <span>• {submittal.specSection}</span>}
            {submittal.submittedBy && <span>• {submittal.submittedBy}</span>}
          </div>
        </div>
      </div>

      {/* Verification Stats Ribbon - HIGH CONTRAST */}
      <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-400" />
            Quantity Verification
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying || lineItems.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500
                text-white rounded-lg flex items-center gap-2 transition-colors font-medium"
            >
              {verifying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Verify Against Project Data</>
              )}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || lineItems.length === 0}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-gray-800 disabled:text-gray-500
                text-white rounded-lg flex items-center gap-2 transition-colors font-medium border border-slate-500"
            >
              {exporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="w-4 h-4" /> Export PDF</>
              )}
            </button>
          </div>
        </div>

        {/* Stats Cards with DISTINCT borders */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-800 border-2 border-slate-500 rounded-lg p-3">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-sm text-slate-300 font-medium">Total Items</p>
          </div>
          <div className="bg-emerald-950 border-2 border-emerald-500 rounded-lg p-3">
            <p className="text-2xl font-bold text-emerald-400">{stats.sufficient}</p>
            <p className="text-sm text-emerald-300 font-medium">Sufficient</p>
          </div>
          <div className="bg-red-950 border-2 border-red-500 rounded-lg p-3">
            <p className="text-2xl font-bold text-red-400">{stats.insufficient}</p>
            <p className="text-sm text-red-300 font-medium">Shortages</p>
          </div>
          <div className="bg-amber-950 border-2 border-amber-500 rounded-lg p-3">
            <p className="text-2xl font-bold text-amber-400">{stats.excess}</p>
            <p className="text-sm text-amber-300 font-medium">Excess</p>
          </div>
          <div className="bg-slate-800 border-2 border-slate-500 rounded-lg p-3">
            <p className="text-2xl font-bold text-slate-300">{stats.unverified}</p>
            <p className="text-sm text-slate-400 font-medium">Unverified</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'items'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Package className="w-4 h-4" />
          Line Items
          <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full">{stats.total}</span>
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'charts'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Charts
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('approval')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'approval'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Approval
        </button>
        <button
          onClick={() => setActiveTab('specs')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'specs'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Library className="w-4 h-4" />
          Specs
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'specs' ? (
        <SpecSectionLinker
          projectSlug={projectSlug}
          submittalId={submittalId}
          currentSpecSection={submittal?.specSection}
          tradeCategory={lineItems[0]?.tradeCategory}
          onSpecSectionChange={(section) => {
            setSubmittal(prev => prev ? { ...prev, specSection: section } : null);
          }}
        />
      ) : activeTab === 'approval' ? (
        <ApprovalWorkflow
          projectSlug={projectSlug}
          submittalId={submittalId}
          currentStatus={submittal?.status || 'draft'}
          onStatusChange={(newStatus) => {
            setSubmittal(prev => prev ? { ...prev, status: newStatus } : null);
          }}
        />
      ) : activeTab === 'history' ? (
        <VerificationHistory projectSlug={projectSlug} submittalId={submittalId} />
      ) : activeTab === 'charts' ? (
        <QuantityVarianceCharts lineItems={lineItems} />
      ) : (
        <>
          {/* Line Items Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Submittal Line Items
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAutoImportModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg
                  flex items-center gap-2 transition-colors font-medium border-2 border-emerald-400"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Auto-Import from Schedules
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                  flex items-center gap-2 transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Line Item
              </button>
            </div>
          </div>

          {/* Filter Controls */}
          {lineItems.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                    text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Status Filter */}
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-slate-500" />
                {(['all', 'SUFFICIENT', 'INSUFFICIENT', 'EXCESS', 'UNVERIFIED'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                      filterStatus === status
                        ? status === 'all' ? 'bg-slate-600 text-white'
                          : status === 'SUFFICIENT' ? 'bg-emerald-600 text-white'
                          : status === 'INSUFFICIENT' ? 'bg-red-600 text-white'
                          : status === 'EXCESS' ? 'bg-amber-600 text-white'
                          : 'bg-slate-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line Items List */}
          {lineItems.length === 0 ? (
        <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-12 text-center">
          <FileCheck className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-slate-300 font-medium">No line items added yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Add products and materials to verify quantities against project requirements
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
              flex items-center gap-2 mx-auto transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Line Item
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lineItems
            .filter(item => filterStatus === 'all' || item.complianceStatus === filterStatus)
            .filter(item => 
              searchTerm === '' || 
              item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.modelNumber?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((item) => {
            const config = STATUS_CONFIG[item.complianceStatus] || STATUS_CONFIG.UNVERIFIED;
            const StatusIcon = config.icon;
            const isExpanded = expandedItems.has(item.id);

            return (
              <div
                key={item.id}
                className={`${config.bg} border-2 ${config.border} rounded-xl overflow-hidden transition-all`}
              >
                {/* Main Row */}
                <div
                  className="p-4 cursor-pointer hover:bg-black/20 transition-colors"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className={`p-2 rounded-lg bg-black/30`}>
                      <StatusIcon className={`w-5 h-5 ${config.text}`} />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-white font-medium truncate">{item.productName}</h3>
                        {item.manufacturer && (
                          <span className="text-sm text-slate-400">by {item.manufacturer}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
                        {item.modelNumber && (
                          <span className="text-slate-400">Model: {item.modelNumber}</span>
                        )}
                        {item.csiDivision && (
                          <span className="text-slate-500">CSI {item.csiDivision}</span>
                        )}
                        {item.tradeCategory && (
                          <span className="px-2 py-0.5 bg-black/30 rounded text-slate-300 text-xs">
                            {TRADE_CATEGORIES.find(t => t.value === item.tradeCategory)?.label || item.tradeCategory}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Display with Inline Editing */}
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-baseline gap-2 justify-end">
                        <InlineQuantityEditor
                          lineItemId={item.id}
                          projectSlug={projectSlug}
                          currentValue={item.submittedQty}
                          unit={item.unit}
                          field="submittedQty"
                          onUpdate={(val) => handleLineItemUpdate(item.id, 'submittedQty', val)}
                        />
                      </div>
                      {item.requiredQty !== null && item.requiredQty !== undefined && (
                        <div className="text-sm mt-1">
                          <span className="text-slate-400">Required: </span>
                          <span className={config.text}>{item.requiredQty} {item.unit}</span>
                        </div>
                      )}
                      {item.varianceQty !== null && item.varianceQty !== undefined && (
                        <div className={`text-sm font-medium ${config.text}`}>
                          {item.varianceQty >= 0 ? '+' : ''}{item.varianceQty} ({item.variancePercent?.toFixed(1)}%)
                        </div>
                      )}
                    </div>

                    {/* Expand Arrow */}
                    <div className="p-1">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Verification Notes */}
                      {item.verificationNotes && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-slate-400 mb-1">Verification Result:</p>
                          <p className={`text-sm ${config.text} bg-black/30 p-3 rounded-lg`}>
                            {item.verificationNotes}
                          </p>
                        </div>
                      )}

                      {/* Hardware Set Link */}
                      {item.hardwareSet && (
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Linked Hardware Set:</p>
                          <div className="bg-black/30 p-3 rounded-lg">
                            <p className="text-white font-medium">Set {item.hardwareSet.setNumber}</p>
                            <p className="text-sm text-slate-400">{item.hardwareSet.setName}</p>
                            <p className="text-sm text-blue-400">{item.hardwareSet.doorCount} doors use this set</p>
                          </div>
                        </div>
                      )}

                      {/* Additional Details */}
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Details:</p>
                        <div className="bg-black/30 p-3 rounded-lg space-y-1 text-sm">
                          {item.partNumber && <p><span className="text-slate-500">Part #:</span> <span className="text-white">{item.partNumber}</span></p>}
                          {item.specSection && <p><span className="text-slate-500">Spec:</span> <span className="text-white">{item.specSection}</span></p>}
                          {item.unitPrice && <p><span className="text-slate-500">Unit Price:</span> <span className="text-white">${item.unitPrice.toFixed(2)}</span></p>}
                          {item.verifiedAt && <p><span className="text-slate-500">Verified:</span> <span className="text-white">{new Date(item.verifiedAt).toLocaleString()}</span></p>}
                        </div>
                      </div>

                      {/* Notes */}
                      {item.notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-slate-400 mb-1">Notes:</p>
                          <p className="text-sm text-slate-300 bg-black/30 p-3 rounded-lg">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Add Line Item Modal */}
      {showAddModal && (
        <AddLineItemModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddLineItem}
          projectSlug={projectSlug}
        />
      )}

      {/* Auto-Import Modal */}
      {showAutoImportModal && (
        <RequirementAutoImport
          projectSlug={projectSlug}
          submittalId={submittalId}
          onClose={() => setShowAutoImportModal(false)}
          onImported={() => {
            setShowAutoImportModal(false);
            fetchData();
          }}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={[
          { key: 'v', description: 'Verify all quantities', action: handleVerify },
          { key: 'a', description: 'Add new line item', action: () => setShowAddModal(true) },
          { key: 'e', description: 'Export PDF report', action: handleExportPDF },
        ]}
      />
    </div>
  );
}

// =============================================================================
// ADD LINE ITEM MODAL
// =============================================================================

function AddLineItemModal({
  onClose,
  onSubmit,
  projectSlug
}: {
  onClose: () => void;
  onSubmit: (data: any) => void;
  projectSlug: string;
}) {
  const [formData, setFormData] = useState({
    productName: '',
    manufacturer: '',
    modelNumber: '',
    partNumber: '',
    submittedQty: '',
    unit: 'EA',
    unitPrice: '',
    csiDivision: '',
    tradeCategory: '',
    specSection: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border-2 border-slate-600 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b-2 border-slate-600">
          <h3 className="text-lg font-semibold text-white">Add Line Item</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Product Info */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Product Name *</label>
            <input
              type="text"
              value={formData.productName}
              onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Mortise Lockset L9453P"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="e.g., Schlage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Model Number</label>
              <input
                type="text"
                value={formData.modelNumber}
                onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="e.g., L9453P 06A 626"
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Quantity *</label>
              <input
                type="number"
                value={formData.submittedQty}
                onChange={(e) => setFormData({ ...formData, submittedQty: e.target.value })}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Unit *</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="EA">EA (Each)</option>
                <option value="SET">SET</option>
                <option value="LF">LF (Linear Feet)</option>
                <option value="SF">SF (Square Feet)</option>
                <option value="CY">CY (Cubic Yards)</option>
                <option value="GAL">GAL (Gallons)</option>
                <option value="TON">TON</option>
                <option value="LB">LB (Pounds)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Unit Price</label>
              <input
                type="number"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="$"
              />
            </div>
          </div>

          {/* Categorization */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Trade Category</label>
              <select
                value={formData.tradeCategory}
                onChange={(e) => setFormData({ ...formData, tradeCategory: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select category...</option>
                {TRADE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">CSI Division</label>
              <input
                type="text"
                value={formData.csiDivision}
                onChange={(e) => setFormData({ ...formData, csiDivision: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="e.g., 08 71 00"
              />
            </div>
          </div>

          {/* Spec Section & Part Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Spec Section</label>
              <input
                type="text"
                value={formData.specSection}
                onChange={(e) => setFormData({ ...formData, specSection: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="e.g., 2.1.A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Part Number</label>
              <input
                type="text"
                value={formData.partNumber}
                onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                  text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="Manufacturer part #"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border-2 border-slate-600 rounded-lg
                text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Add Line Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
