'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  Ruler,
  Zap,
  Droplets,
  Wind,
  Building2,
  MapPin,
  Layers,
  Calculator,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

/** Shape of a document returned from /api/projects/:slug/documents */
interface ProjectDocument {
  name?: string;
  category?: string;
  [key: string]: unknown;
}

/** Shape of a takeoff line item from /api/projects/:slug/takeoffs */
interface TakeoffLineItem {
  category?: string;
  itemName?: string;
  unitCost?: number;
  [key: string]: unknown;
}

/** Shape of a takeoff containing line items */
interface TakeoffData {
  lineItems?: TakeoffLineItem[];
  [key: string]: unknown;
}

/** Shape of MEP extraction response */
interface MEPResponse {
  exists: boolean;
  electrical?: { itemCount?: number; total?: number };
  plumbing?: { itemCount?: number; total?: number };
  hvac?: { itemCount?: number; total?: number };
}

/** Shape of budget response */
interface BudgetResponse {
  items?: unknown[];
  budgetItems?: unknown[];
}

interface DataRequirement {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: 'documents' | 'structural' | 'mep' | 'sitework' | 'pricing';
  status: 'available' | 'partial' | 'missing' | 'loading';
  count?: number;
  details?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface TakeoffDataChecklistProps {
  projectSlug: string;
  onTriggerExtraction?: (type: string) => void;
}

export function TakeoffDataChecklist({ projectSlug, onTriggerExtraction }: TakeoffDataChecklistProps) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requirements, setRequirements] = useState<DataRequirement[]>([]);
  
  useEffect(() => {
    if (projectSlug) {
      checkDataAvailability();
    }
  }, [projectSlug]);

  const checkDataAvailability = async () => {
    try {
      setLoading(true);
      
      // Check multiple data sources in parallel
      const [documentsRes, takeoffsRes, mepRes, budgetRes, equipmentRes] = await Promise.allSettled([
        fetch(`/api/projects/${projectSlug}/documents`),
        fetch(`/api/projects/${projectSlug}/takeoffs`),
        fetch(`/api/projects/${projectSlug}/mep-takeoff`),
        fetch(`/api/projects/${projectSlug}/budget`),
        fetch(`/api/projects/${projectSlug}/equipment`),
      ]);

      // Parse responses
      const docs: { documents: ProjectDocument[] } = documentsRes.status === 'fulfilled' && documentsRes.value.ok
        ? await documentsRes.value.json() : { documents: [] };
      const takeoffs: { takeoffs: TakeoffData[] } = takeoffsRes.status === 'fulfilled' && takeoffsRes.value.ok
        ? await takeoffsRes.value.json() : { takeoffs: [] };
      const mep: MEPResponse = mepRes.status === 'fulfilled' && mepRes.value.ok
        ? await mepRes.value.json() : { exists: false };
      const budget: BudgetResponse = budgetRes.status === 'fulfilled' && budgetRes.value.ok
        ? await budgetRes.value.json() : { items: [] };
      const _equipment = equipmentRes.status === 'fulfilled' && equipmentRes.value.ok
        ? await equipmentRes.value.json() : { equipment: [] };

      // Categorize documents
      const documents: ProjectDocument[] = docs.documents || [];
      const planDocs = documents.filter((d: ProjectDocument) =>
        ['plan', 'drawing', 'floor', 'sheet', 'elevation', 'section'].some(k =>
          d.name?.toLowerCase().includes(k) || d.category?.toLowerCase().includes(k)
        )
      );
      const specDocs = documents.filter((d: ProjectDocument) =>
        ['spec', 'specification', 'technical'].some(k => d.name?.toLowerCase().includes(k))
      );
      const _scheduleDocs = documents.filter((d: ProjectDocument) =>
        ['schedule', 'timeline', 'phase'].some(k => d.name?.toLowerCase().includes(k))
      );

      // Calculate takeoff items by category
      const allLineItems: TakeoffLineItem[] = takeoffs.takeoffs?.flatMap((t: TakeoffData) => t.lineItems || []) || [];
      const structuralItems = allLineItems.filter((i: TakeoffLineItem) =>
        ['concrete', 'steel', 'masonry', 'lumber', 'wood', 'structural', 'foundation', 'footing', 'slab', 'beam', 'column'].some(k =>
          i.category?.toLowerCase().includes(k) || i.itemName?.toLowerCase().includes(k)
        )
      );
      const mepItems = allLineItems.filter((i: TakeoffLineItem) =>
        ['electrical', 'plumbing', 'hvac', 'mechanical', 'pipe', 'duct', 'conduit', 'wire'].some(k =>
          i.category?.toLowerCase().includes(k) || i.itemName?.toLowerCase().includes(k)
        )
      );
      const finishItems = allLineItems.filter((i: TakeoffLineItem) =>
        ['drywall', 'flooring', 'painting', 'finish', 'ceiling', 'trim', 'door', 'window'].some(k =>
          i.category?.toLowerCase().includes(k) || i.itemName?.toLowerCase().includes(k)
        )
      );
      const siteworkItems = allLineItems.filter((i: TakeoffLineItem) =>
        ['earthwork', 'grading', 'paving', 'concrete', 'landscape', 'site', 'excavation'].some(k =>
          i.category?.toLowerCase().includes(k) || i.itemName?.toLowerCase().includes(k)
        )
      );

      // MEP from dedicated extraction
      const _mepExtracted = mep.exists ? (
        (mep.electrical?.itemCount || 0) + 
        (mep.plumbing?.itemCount || 0) + 
        (mep.hvac?.itemCount || 0)
      ) : 0;

      // Build requirements list
      const reqs: DataRequirement[] = [
        // Documents Section
        {
          id: 'plans',
          name: 'Construction Plans',
          description: 'Floor plans, elevations, sections, details',
          icon: Layers,
          category: 'documents',
          status: planDocs.length > 0 ? 'available' : 'missing',
          count: planDocs.length,
          details: planDocs.length > 0 ? `${planDocs.length} plan document(s) uploaded` : 'Upload construction drawings (PDF/DWG/RVT)',
        },
        {
          id: 'specs',
          name: 'Specifications',
          description: 'Technical specifications, material specs',
          icon: FileText,
          category: 'documents',
          status: specDocs.length > 0 ? 'available' : 'partial',
          count: specDocs.length,
          details: specDocs.length > 0 ? `${specDocs.length} spec document(s)` : 'Optional: Upload specs for material details',
        },
        // Structural Section
        {
          id: 'structural',
          name: 'Structural Quantities',
          description: 'Concrete, steel, masonry, lumber',
          icon: Building2,
          category: 'structural',
          status: structuralItems.length >= 10 ? 'available' : structuralItems.length > 0 ? 'partial' : 'missing',
          count: structuralItems.length,
          details: structuralItems.length > 0 
            ? `${structuralItems.length} structural item(s) extracted`
            : 'Process plans to extract footings, slabs, beams, columns',
          action: structuralItems.length < 5 ? {
            label: 'Extract Quantities',
            onClick: () => onTriggerExtraction?.('structural')
          } : undefined,
        },
        {
          id: 'finishes',
          name: 'Finishes & Interiors',
          description: 'Drywall, flooring, paint, doors, windows',
          icon: Ruler,
          category: 'structural',
          status: finishItems.length >= 10 ? 'available' : finishItems.length > 0 ? 'partial' : 'missing',
          count: finishItems.length,
          details: finishItems.length > 0
            ? `${finishItems.length} finish item(s) extracted`
            : 'Process room schedules for finish quantities',
        },
        // MEP Section
        {
          id: 'electrical',
          name: 'Electrical Systems',
          description: 'Panels, circuits, outlets, lighting',
          icon: Zap,
          category: 'mep',
          status: (mep.electrical?.itemCount || 0) > 0 ? 'available' : mepItems.some((i: TakeoffLineItem) => i.category?.toLowerCase().includes('electrical')) ? 'partial' : 'missing',
          count: mep.electrical?.itemCount || mepItems.filter((i: TakeoffLineItem) => i.category?.toLowerCase().includes('electrical')).length,
          details: (mep.electrical?.itemCount || 0) > 0
            ? `${mep.electrical?.itemCount} electrical item(s) - $${(mep.electrical?.total || 0).toLocaleString()}`
            : 'Run MEP extraction for electrical data',
          action: {
            label: 'Extract Electrical',
            onClick: () => onTriggerExtraction?.('electrical')
          },
        },
        {
          id: 'plumbing',
          name: 'Plumbing Systems',
          description: 'Pipes, fixtures, water heaters, drains',
          icon: Droplets,
          category: 'mep',
          status: (mep.plumbing?.itemCount || 0) > 0 ? 'available' : mepItems.some((i: TakeoffLineItem) => i.category?.toLowerCase().includes('plumbing')) ? 'partial' : 'missing',
          count: mep.plumbing?.itemCount || mepItems.filter((i: TakeoffLineItem) => i.category?.toLowerCase().includes('plumbing')).length,
          details: (mep.plumbing?.itemCount || 0) > 0
            ? `${mep.plumbing?.itemCount} plumbing item(s) - $${(mep.plumbing?.total || 0).toLocaleString()}`
            : 'Run MEP extraction for plumbing data',
          action: {
            label: 'Extract Plumbing',
            onClick: () => onTriggerExtraction?.('plumbing')
          },
        },
        {
          id: 'hvac',
          name: 'HVAC Systems',
          description: 'Ductwork, equipment, controls',
          icon: Wind,
          category: 'mep',
          status: (mep.hvac?.itemCount || 0) > 0 ? 'available' : mepItems.some((i: TakeoffLineItem) => i.category?.toLowerCase().includes('hvac')) ? 'partial' : 'missing',
          count: mep.hvac?.itemCount || mepItems.filter((i: TakeoffLineItem) => i.category?.toLowerCase().includes('hvac')).length,
          details: (mep.hvac?.itemCount || 0) > 0
            ? `${mep.hvac?.itemCount} HVAC item(s) - $${(mep.hvac?.total || 0).toLocaleString()}`
            : 'Run MEP extraction for HVAC data',
          action: {
            label: 'Extract HVAC',
            onClick: () => onTriggerExtraction?.('hvac')
          },
        },
        // Sitework Section
        {
          id: 'sitework',
          name: 'Sitework & Earthwork',
          description: 'Grading, excavation, paving, utilities',
          icon: MapPin,
          category: 'sitework',
          status: siteworkItems.length >= 5 ? 'available' : siteworkItems.length > 0 ? 'partial' : 'missing',
          count: siteworkItems.length,
          details: siteworkItems.length > 0
            ? `${siteworkItems.length} sitework item(s) extracted`
            : 'Use Earthwork Calculator or process site plans',
          action: siteworkItems.length < 3 ? {
            label: 'Calculate Earthwork',
            onClick: () => onTriggerExtraction?.('earthwork')
          } : undefined,
        },
        // Pricing Section
        {
          id: 'pricing',
          name: 'Unit Pricing',
          description: 'Material costs, labor rates, regional factors',
          icon: Calculator,
          category: 'pricing',
          status: allLineItems.some((i: TakeoffLineItem) => i.unitCost && i.unitCost > 0) ? 'available' : 'partial',
          count: allLineItems.filter((i: TakeoffLineItem) => i.unitCost && i.unitCost > 0).length,
          details: allLineItems.filter((i: TakeoffLineItem) => (i.unitCost ?? 0) > 0).length > 0
            ? `${allLineItems.filter((i: TakeoffLineItem) => (i.unitCost ?? 0) > 0).length}/${allLineItems.length} items have prices`
            : 'Click Auto-Calculate to apply CSI pricing database',
          action: {
            label: 'Auto-Calculate Prices',
            onClick: () => onTriggerExtraction?.('pricing')
          },
        },
        {
          id: 'budget',
          name: 'Budget Integration',
          description: 'Compare against project budget',
          icon: FileText,
          category: 'pricing',
          status: (budget.items?.length || budget.budgetItems?.length || 0) > 0 ? 'available' : 'missing',
          count: budget.items?.length || budget.budgetItems?.length || 0,
          details: (budget.items?.length || budget.budgetItems?.length || 0) > 0
            ? `${budget.items?.length || budget.budgetItems?.length} budget line items linked`
            : 'Upload budget document to compare costs',
        },
      ];

      setRequirements(reqs);
    } catch (error) {
      console.error('Error checking data availability:', error);
      toast.error('Failed to check data status');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkDataAvailability();
    setRefreshing(false);
    toast.success('Data status refreshed');
  };

  // Calculate overall completion
  const availableCount = requirements.filter(r => r.status === 'available').length;
  const partialCount = requirements.filter(r => r.status === 'partial').length;
  const totalCount = requirements.length;
  const completionPercentage = totalCount > 0 
    ? Math.round(((availableCount * 100) + (partialCount * 50)) / totalCount)
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500/20 text-green-400 border-green-700">Complete</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-700">Partial</Badge>;
      case 'missing':
        return <Badge className="bg-red-500/20 text-red-400 border-red-700">Missing</Badge>;
      default:
        return null;
    }
  };

  const groupedRequirements = {
    documents: requirements.filter(r => r.category === 'documents'),
    structural: requirements.filter(r => r.category === 'structural'),
    mep: requirements.filter(r => r.category === 'mep'),
    sitework: requirements.filter(r => r.category === 'sitework'),
    pricing: requirements.filter(r => r.category === 'pricing'),
  };

  if (loading) {
    return (
      <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking data availability...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-card border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-dark-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-50">Data Requirements Checklist</h3>
            <p className="text-xs text-gray-400">
              {availableCount} of {totalCount} complete • {partialCount} partial
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-24">
            <Progress value={completionPercentage} className="h-2" />
          </div>
          <span className="text-sm font-medium text-slate-50">{completionPercentage}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            disabled={refreshing}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {/* Category Sections */}
          {Object.entries(groupedRequirements).map(([category, items]) => {
            if (items.length === 0) return null;
            
            const categoryLabels: Record<string, string> = {
              documents: 'Documents',
              structural: 'Structural & Finishes',
              mep: 'MEP Systems',
              sitework: 'Sitework',
              pricing: 'Pricing & Budget',
            };

            return (
              <div key={category}>
                <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  {categoryLabels[category]}
                </h4>
                <div className="space-y-2">
                  {items.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 bg-dark-surface rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(req.status)}
                        <req.icon className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-50">{req.name}</span>
                            {req.count !== undefined && req.count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {req.count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{req.details || req.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getStatusBadge(req.status)}
                        {req.action && req.status !== 'available' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={req.action.onClick}
                            className="text-xs border-blue-600 text-blue-400 hover:bg-blue-500/20"
                          >
                            {req.action.label}
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          {completionPercentage < 100 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">Incomplete Data</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Some takeoff data is missing or incomplete. Use the action buttons above to extract 
                    missing quantities, or upload additional documents for better accuracy.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TakeoffDataChecklist;
