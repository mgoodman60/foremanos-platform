'use client';

import { useState, useEffect } from 'react';
import {
  Calculator,
  Mountain,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface EarthworkCalculatorProps {
  projectSlug: string;
  onCalculationComplete?: (result: CalculationResult) => void;
}

interface Document {
  id: string;
  name: string;
  createdAt: string;
}

interface CalculationResult {
  cutVolumeCY: number;
  fillVolumeCY: number;
  netVolumeCY: number;
  cutAreaSF: number;
  fillAreaSF: number;
  balancePoint: string;
  shrinkageFactor: number;
  swellFactor: number;
  adjustedCutCY: number;
  adjustedFillCY: number;
  method: string;
  costEstimate: {
    excavationCost: number;
    fillCost: number;
    compactionCost: number;
    importCost: number;
    exportCost: number;
    gradingCost: number;
    totalCost: number;
    laborHours: number;
    regionalMultiplier: number;
    breakdown: {
      item: string;
      quantity: number;
      unit: string;
      unitCost: number;
      total: number;
    }[];
  };
}

const SOIL_TYPES = [
  { id: 'clay', name: 'Clay', shrinkage: '90%', swell: '130%' },
  { id: 'sand', name: 'Sand', shrinkage: '95%', swell: '115%' },
  { id: 'gravel', name: 'Gravel', shrinkage: '95%', swell: '112%' },
  { id: 'topsoil', name: 'Topsoil', shrinkage: '90%', swell: '125%' },
  { id: 'rock', name: 'Rock', shrinkage: '100%', swell: '150%' },
  { id: 'mixed', name: 'Mixed Soil', shrinkage: '92%', swell: '120%' },
];

export default function EarthworkCalculator({
  projectSlug,
  onCalculationComplete,
}: EarthworkCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [report, setReport] = useState<string>('');
  
  // Form state
  const [method, setMethod] = useState<'simple' | 'from-documents'>('simple');
  const [soilType, setSoilType] = useState('mixed');
  const [areaSF, setAreaSF] = useState('');
  const [avgCutDepth, setAvgCutDepth] = useState('');
  const [avgFillDepth, setAvgFillDepth] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  
  // Fetch relevant documents on mount
  useEffect(() => {
    if (isExpanded) {
      fetchDocuments();
    }
  }, [isExpanded, projectSlug]);
  
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/earthwork`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.relevantDocuments || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };
  
  const handleCalculate = async () => {
    setLoading(true);
    setResult(null);
    setReport('');
    
    try {
      interface EarthworkPayload {
        method: string;
        soilType: string;
        areaSF?: number;
        avgCutDepthFt?: number;
        avgFillDepthFt?: number;
        documentIds?: string[];
        siteParams?: { siteAreaSF: number };
      }
      const payload: EarthworkPayload = { method, soilType };
      
      if (method === 'simple') {
        if (!areaSF) {
          toast.error('Please enter the site area');
          setLoading(false);
          return;
        }
        payload.areaSF = parseFloat(areaSF);
        payload.avgCutDepthFt = parseFloat(avgCutDepth) || 0;
        payload.avgFillDepthFt = parseFloat(avgFillDepth) || 0;
        
        if (payload.avgCutDepthFt === 0 && payload.avgFillDepthFt === 0) {
          toast.error('Please enter at least one depth value (cut or fill)');
          setLoading(false);
          return;
        }
      } else if (method === 'from-documents') {
        if (selectedDocs.length === 0) {
          toast.error('Please select at least one document');
          setLoading(false);
          return;
        }
        payload.documentIds = selectedDocs;
        // Provide site area as fallback
        if (areaSF) {
          payload.siteParams = { siteAreaSF: parseFloat(areaSF) };
        }
      }
      
      const res = await fetch(`/api/projects/${projectSlug}/earthwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Calculation failed');
      }
      
      const data = await res.json();
      setResult(data.result);
      setReport(data.report);
      
      toast.success('Earthwork calculation complete!');
      
      if (onCalculationComplete) {
        onCalculationComplete(data.result);
      }
      
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to calculate earthwork');
    } finally {
      setLoading(false);
    }
  };
  
  const downloadReport = () => {
    if (!report) return;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earthwork-report-${projectSlug}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const toggleDocSelection = (docId: string) => {
    setSelectedDocs(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };
  
  return (
    <div className="bg-dark-card rounded-lg border border-gray-700">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-dark-hover transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-900/30 rounded-lg">
            <Mountain aria-hidden="true" className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-50">Earthwork Calculator</h3>
            <p className="text-sm text-gray-400">Calculate cut/fill volumes from plans</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          {/* Method Selection */}
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Calculation Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMethod('simple')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    method === 'simple'
                      ? 'border-amber-500 bg-amber-900/30 text-amber-100'
                      : 'border-gray-600 hover:border-gray-500 text-gray-300'
                  }`}
                >
                  <Calculator aria-hidden="true" className="w-5 h-5 mb-1" />
                  <div className="font-medium text-sm">Quick Estimate</div>
                  <div className="text-xs text-gray-400">From area & depths</div>
                </button>
                <button
                  onClick={() => setMethod('from-documents')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    method === 'from-documents'
                      ? 'border-amber-500 bg-amber-900/30 text-amber-100'
                      : 'border-gray-600 hover:border-gray-500 text-gray-300'
                  }`}
                >
                  <FileText aria-hidden="true" className="w-5 h-5 mb-1" />
                  <div className="font-medium text-sm">From Documents</div>
                  <div className="text-xs text-gray-400">AI extraction</div>
                </button>
              </div>
            </div>
            
            {/* Soil Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Soil Type
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {SOIL_TYPES.map((soil) => (
                  <option key={soil.id} value={soil.id}>
                    {soil.name} (Shrink: {soil.shrinkage}, Swell: {soil.swell})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Simple Method Inputs */}
            {method === 'simple' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Site Area (SF)
                  </label>
                  <input
                    type="number"
                    value={areaSF}
                    onChange={(e) => setAreaSF(e.target.value)}
                    placeholder="e.g., 50000"
                    className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Avg Cut Depth (ft)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={avgCutDepth}
                      onChange={(e) => setAvgCutDepth(e.target.value)}
                      placeholder="e.g., 2.5"
                      className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Avg Fill Depth (ft)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={avgFillDepth}
                      onChange={(e) => setAvgFillDepth(e.target.value)}
                      placeholder="e.g., 1.0"
                      className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Document Selection */}
            {method === 'from-documents' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Documents
                </label>
                {documents.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm bg-dark-surface rounded-lg">
                    <Info aria-hidden="true" className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                    No grading/survey documents found.
                    Upload site survey or grading plans first.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {documents.map((doc) => (
                      <label
                        key={doc.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedDocs.includes(doc.id)
                            ? 'bg-amber-900/30 border border-amber-600'
                            : 'bg-dark-surface border border-transparent hover:bg-dark-hover'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc.id)}
                          onChange={() => toggleDocSelection(doc.id)}
                          className="rounded border-gray-600 bg-dark-surface text-amber-600 focus:ring-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-200 truncate">
                            {doc.name}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Optional area for fallback */}
                <div className="mt-3">
                  <label className="block text-xs text-gray-400 mb-1">
                    Site Area (optional fallback)
                  </label>
                  <input
                    type="number"
                    value={areaSF}
                    onChange={(e) => setAreaSF(e.target.value)}
                    placeholder="SF - used if extraction insufficient"
                    className="w-full px-3 py-2 text-sm bg-dark-surface border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
            
            {/* Calculate Button */}
            <button
              onClick={handleCalculate}
              disabled={loading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator aria-hidden="true" className="w-5 h-5" />
                  Calculate Earthwork
                </>
              )}
            </button>
          </div>
          
          {/* Results */}
          {result && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-50 flex items-center gap-2">
                  <CheckCircle aria-hidden="true" className="w-5 h-5 text-green-500" />
                  Calculation Results
                </h4>
                <button
                  onClick={downloadReport}
                  className="text-sm text-amber-500 hover:text-amber-400 flex items-center gap-1"
                >
                  <Download aria-hidden="true" className="w-4 h-4" />
                  Download Report
                </button>
              </div>
              
              {/* Volume Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-red-900/30 rounded-lg border border-red-800">
                  <div className="flex items-center gap-1 text-red-400 text-xs font-medium mb-1">
                    <TrendingDown aria-hidden="true" className="w-3 h-3" />
                    CUT
                  </div>
                  <div className="text-xl font-bold text-red-300">
                    {result.cutVolumeCY.toLocaleString()}
                  </div>
                  <div className="text-xs text-red-400">CY</div>
                </div>
                <div className="p-3 bg-green-900/30 rounded-lg border border-green-800">
                  <div className="flex items-center gap-1 text-green-400 text-xs font-medium mb-1">
                    <TrendingUp aria-hidden="true" className="w-3 h-3" />
                    FILL
                  </div>
                  <div className="text-xl font-bold text-green-300">
                    {result.fillVolumeCY.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-400">CY</div>
                </div>
                <div className={`p-3 rounded-lg border ${
                  result.netVolumeCY > 0
                    ? 'bg-blue-900/30 border-blue-800'
                    : result.netVolumeCY < 0
                    ? 'bg-orange-900/30 border-orange-800'
                    : 'bg-gray-800/50 border-gray-700'
                }`}>
                  <div className={`flex items-center gap-1 text-xs font-medium mb-1 ${
                    result.netVolumeCY > 0 ? 'text-blue-400' : result.netVolumeCY < 0 ? 'text-orange-400' : 'text-gray-400'
                  }`}>
                    <Minus aria-hidden="true" className="w-3 h-3" />
                    NET
                  </div>
                  <div className={`text-xl font-bold ${
                    result.netVolumeCY > 0 ? 'text-blue-300' : result.netVolumeCY < 0 ? 'text-orange-300' : 'text-gray-300'
                  }`}>
                    {result.netVolumeCY > 0 ? '+' : ''}{result.netVolumeCY.toLocaleString()}
                  </div>
                  <div className={`text-xs ${
                    result.netVolumeCY > 0 ? 'text-blue-400' : result.netVolumeCY < 0 ? 'text-orange-400' : 'text-gray-400'
                  }`}>
                    {result.netVolumeCY > 0 ? 'Export' : result.netVolumeCY < 0 ? 'Import' : 'Balanced'}
                  </div>
                </div>
              </div>
              
              {/* Balance Info */}
              <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-700">
                <div className="flex items-start gap-2">
                  <AlertCircle aria-hidden="true" className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-200">{result.balancePoint}</div>
                    <div className="text-sm text-amber-400 mt-1">
                      Adjusted for {(result.shrinkageFactor * 100).toFixed(0)}% shrinkage / {(result.swellFactor * 100).toFixed(0)}% swell
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Cost Estimate */}
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-dark-surface px-4 py-2 border-b border-gray-700">
                  <h5 className="font-medium text-slate-50">Cost Estimate</h5>
                  <p className="text-xs text-gray-400">
                    Regional multiplier: {result.costEstimate.regionalMultiplier}x (KY-Morehead)
                  </p>
                </div>
                <div className="divide-y divide-gray-700">
                  {result.costEstimate.breakdown.map((item, idx) => (
                    <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm bg-dark-card">
                      <div>
                        <span className="text-gray-200">{item.item}</span>
                        <span className="text-gray-400 ml-2">
                          {item.quantity.toLocaleString()} {item.unit} @ ${item.unitCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="font-medium text-gray-200">
                        ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-900/40 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-50">Total Earthwork Cost</div>
                    <div className="text-xs text-gray-400">
                      Est. {result.costEstimate.laborHours.toLocaleString()} labor hours
                    </div>
                  </div>
                  <div className="text-xl font-bold text-amber-400">
                    ${result.costEstimate.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
