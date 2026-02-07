'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, Save, Trash2, Plus, Calculator, MapPin,
  ChevronDown, ChevronRight, AlertCircle, Check, X, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { TAKEOFF_CATEGORIES } from '@/lib/takeoff-categories';

interface UnitPrice {
  id: string;
  category: string;
  subCategory: string | null;
  unit: string;
  unitCost: number;
  laborRate: number | null;
  source: string;
  isProjectSpecific: boolean;
  isDefault?: boolean;
}

interface UnitPriceManagerProps {
  projectSlug: string;
  onClose?: () => void;
  onPricesUpdated?: () => void;
}

export function UnitPriceManager({ projectSlug, onClose, onPricesUpdated }: UnitPriceManagerProps) {
  const [projectPrices, setProjectPrices] = useState<UnitPrice[]>([]);
  const [defaultPrices, setDefaultPrices] = useState<UnitPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState('default');
  const [regions, setRegions] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New price form state
  const [newPrice, setNewPrice] = useState({
    category: '',
    subCategory: '',
    unit: '',
    unitCost: 0,
    laborRate: 65,
    supplier: '',
    notes: '',
  });

  useEffect(() => {
    fetchPrices();
  }, [projectSlug, region]);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/projects/${projectSlug}/unit-prices?region=${region}&includeDefaults=true`
      );
      if (!res.ok) throw new Error('Failed to fetch prices');
      
      const data = await res.json();
      setProjectPrices(data.projectPrices || []);
      setDefaultPrices(data.defaultPrices || []);
      setRegions(data.regions || ['default']);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error('Failed to load unit prices');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrice = async (price: Partial<UnitPrice>) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/unit-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...price,
          region,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to save price');
      
      toast.success('Price saved successfully');
      setEditingPrice(null);
      setShowAddForm(false);
      fetchPrices();
      onPricesUpdated?.();
    } catch (error) {
      console.error('Error saving price:', error);
      toast.error('Failed to save price');
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm('Delete this custom price? Default pricing will be used instead.')) return;
    
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/unit-prices?id=${priceId}`,
        { method: 'DELETE' }
      );
      
      if (!res.ok) throw new Error('Failed to delete price');
      
      toast.success('Price deleted');
      fetchPrices();
      onPricesUpdated?.();
    } catch (error) {
      console.error('Error deleting price:', error);
      toast.error('Failed to delete price');
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getCategoryName = (id: string): string => {
    return TAKEOFF_CATEGORIES.find(c => c.id === id)?.name || id;
  };

  // Group prices by category
  const allPrices = [...projectPrices, ...defaultPrices];
  const pricesByCategory = allPrices.reduce((acc, price) => {
    const cat = price.category.toLowerCase();
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(price);
    return acc;
  }, {} as Record<string, UnitPrice[]>);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-[#161B22] rounded-lg border border-gray-700 max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Unit Price Manager</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Region Selector */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="bg-[#21262D] border border-gray-600 rounded px-2 py-1 text-sm text-white"
            >
              {regions.map(r => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Price
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-orange-500 h-8 w-8" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* Add Price Form */}
            {showAddForm && (
              <div className="bg-[#21262D] rounded-lg p-4 mb-4 border border-blue-500">
                <h3 className="text-sm font-medium text-white mb-3">Add Custom Price</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    value={newPrice.category}
                    onChange={(e) => setNewPrice({ ...newPrice, category: e.target.value, subCategory: '' })}
                    className="bg-[#161B22] border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  >
                    <option value="">Select Category</option>
                    {TAKEOFF_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  
                  <select
                    value={newPrice.subCategory}
                    onChange={(e) => setNewPrice({ ...newPrice, subCategory: e.target.value })}
                    className="bg-[#161B22] border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                    disabled={!newPrice.category}
                  >
                    <option value="">Select Sub-Category</option>
                    {TAKEOFF_CATEGORIES.find(c => c.id === newPrice.category)?.subCategories.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    placeholder="Unit (e.g., CY, SF)"
                    value={newPrice.unit}
                    onChange={(e) => setNewPrice({ ...newPrice, unit: e.target.value.toUpperCase() })}
                    className="bg-[#161B22] border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                  
                  <input
                    type="number"
                    placeholder="Unit Cost"
                    value={newPrice.unitCost || ''}
                    onChange={(e) => setNewPrice({ ...newPrice, unitCost: parseFloat(e.target.value) || 0 })}
                    className="bg-[#161B22] border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                  
                  <input
                    type="number"
                    placeholder="Labor Rate/hr"
                    value={newPrice.laborRate || ''}
                    onChange={(e) => setNewPrice({ ...newPrice, laborRate: parseFloat(e.target.value) || 65 })}
                    className="bg-[#161B22] border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                  
                  <input
                    type="text"
                    placeholder="Supplier (optional)"
                    value={newPrice.supplier}
                    onChange={(e) => setNewPrice({ ...newPrice, supplier: e.target.value })}
                    className="bg-[#161B22] border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                  
                  <div className="col-span-2 flex gap-2">
                    <button
                      onClick={() => handleSavePrice(newPrice)}
                      disabled={!newPrice.category || !newPrice.unit || !newPrice.unitCost}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Price Categories */}
            {Object.entries(pricesByCategory).map(([category, prices]) => (
              <div key={category} className="border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 bg-[#21262D] hover:bg-[#2D333B] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-medium text-white">{getCategoryName(category)}</span>
                    <span className="text-xs text-gray-500">({prices.length} items)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {prices.some(p => p.isProjectSpecific) && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                        Custom
                      </span>
                    )}
                  </div>
                </button>
                
                {expandedCategories.has(category) && (
                  <div className="divide-y divide-gray-700">
                    {prices.map((price) => (
                      <div
                        key={price.id}
                        className={`p-3 flex items-center justify-between ${
                          price.isProjectSpecific ? 'bg-blue-500/5' : 'bg-[#161B22]'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white">
                              {price.subCategory || 'General'}
                            </span>
                            <span className="text-xs text-gray-500">per {price.unit}</span>
                            {price.isProjectSpecific && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                Project
                              </span>
                            )}
                            {price.isDefault && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-green-400">
                              {formatCurrency(price.unitCost)}
                            </div>
                            {price.laborRate && (
                              <div className="text-xs text-gray-500">
                                Labor: {formatCurrency(price.laborRate)}/hr
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {!price.isDefault && (
                              <>
                                <button
                                  onClick={() => handleSavePrice({
                                    category: price.category,
                                    subCategory: price.subCategory,
                                    unit: price.unit,
                                    unitCost: price.unitCost,
                                    laborRate: price.laborRate,
                                  })}
                                  className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                  title="Override with project price"
                                >
                                  <Calculator className="w-4 h-4 text-gray-400" />
                                </button>
                                {price.isProjectSpecific && (
                                  <button
                                    onClick={() => handleDeletePrice(price.id)}
                                    className="p-1.5 hover:bg-red-900/30 rounded transition-colors"
                                    title="Delete custom price"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </button>
                                )}
                              </>
                            )}
                            {price.isDefault && (
                              <button
                                onClick={() => {
                                  setNewPrice({
                                    category: price.category,
                                    subCategory: price.subCategory || '',
                                    unit: price.unit,
                                    unitCost: price.unitCost,
                                    laborRate: price.laborRate || 65,
                                    supplier: '',
                                    notes: '',
                                  });
                                  setShowAddForm(true);
                                }}
                                className="p-1.5 hover:bg-blue-900/30 rounded transition-colors"
                                title="Create project override"
                              >
                                <Plus className="w-4 h-4 text-blue-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {Object.keys(pricesByCategory).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No unit prices configured</p>
                <p className="text-sm">Click "Add Price" to create custom pricing</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 bg-[#21262D]">
        <p className="text-xs text-gray-500">
          💡 Project-specific prices override default rates. Default prices are based on 2024 national averages.
        </p>
      </div>
    </div>
  );
}
