"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Package, Check, X, AlertTriangle, Clock,
  RefreshCw, ChevronDown, ChevronUp, Loader2,
  DollarSign, Building2, Calendar, Filter, Edit2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Types
interface LaborEntry {
  id: string;
  workerName: string;
  tradeType: string;
  date: string;
  hoursWorked: number;
  hourlyRate: number;
  totalCost: number;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  budgetItem?: { id: string; name: string } | null;
  confidence?: number;
}

interface MaterialEntry {
  id: string;
  procurementNumber: string;
  description: string;
  itemType: string;
  vendorName: string | null;
  quantity: number | null;
  unit: string | null;
  actualCost: number | null;
  actualDelivery: string | null;
  status: string;
  budgetItem?: { id: string; name: string } | null;
  confidence?: number;
}

interface BudgetItem {
  id: string;
  name: string;
  category: string;
  phaseName: string | null;
}

interface ReviewData {
  laborPending: LaborEntry[];
  laborApproved: LaborEntry[];
  laborRejected: LaborEntry[];
  materialsPending: MaterialEntry[];
  materialsReceived: MaterialEntry[];
  budgetItems: BudgetItem[];
}

interface LaborMaterialReviewProps {
  projectSlug: string;
}

interface LaborUpdates {
  workerName: string;
  hoursWorked: number;
  hourlyRate: number;
  totalCost: number;
  description: string | null;
  budgetItemId?: string;
}

interface MaterialUpdates {
  description: string;
  quantity: number | null;
  unit: string | null;
  actualCost: number | null;
  budgetItemId?: string;
}

type ReviewUpdates = LaborUpdates | MaterialUpdates;

export default function LaborMaterialReview({ projectSlug }: LaborMaterialReviewProps) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('labor-pending');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editModal, setEditModal] = useState<{ type: 'labor' | 'material'; item: LaborEntry | MaterialEntry } | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/budget/review`);
      if (res.ok) {
        const reviewData = await res.json();
        setData(reviewData);
      } else {
        toast.error('Failed to load review data');
      }
    } catch (error) {
      console.error('Error fetching review data:', error);
      toast.error('Failed to load review data');
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (type: 'labor' | 'material', ids: string[]) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/budget/review/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ids }),
      });

      if (res.ok) {
        toast.success(`${ids.length} ${type} entr${ids.length > 1 ? 'ies' : 'y'} approved`);
        setSelectedItems(new Set());
        fetchData();
      } else {
        toast.error('Failed to approve entries');
      }
    } catch (error) {
      toast.error('Error approving entries');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (type: 'labor' | 'material', ids: string[]) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/budget/review/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ids }),
      });

      if (res.ok) {
        toast.success(`${ids.length} ${type} entr${ids.length > 1 ? 'ies' : 'y'} rejected`);
        setSelectedItems(new Set());
        fetchData();
      } else {
        toast.error('Failed to reject entries');
      }
    } catch (error) {
      toast.error('Error rejecting entries');
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = async (type: 'labor' | 'material', id: string, updates: ReviewUpdates) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/budget/review/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, updates }),
      });

      if (res.ok) {
        toast.success('Entry updated');
        setEditModal(null);
        fetchData();
      } else {
        toast.error('Failed to update entry');
      }
    } catch (error) {
      toast.error('Error updating entry');
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelectAll = (items: { id: string }[]) => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    const pct = Math.round(confidence * 100);
    if (pct >= 80) {
      return <Badge className="bg-green-600/20 text-green-400 text-xs">AI {pct}%</Badge>;
    } else if (pct >= 60) {
      return <Badge className="bg-yellow-600/20 text-yellow-400 text-xs">AI {pct}%</Badge>;
    } else {
      return <Badge className="bg-red-600/20 text-red-400 text-xs">AI {pct}%</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="bg-[#2d333b] border-gray-700">
        <CardContent className="p-8 text-center text-gray-400">
          No data available for review.
        </CardContent>
      </Card>
    );
  }

  const pendingLaborCount = data.laborPending.length;
  const pendingMaterialCount = data.materialsPending.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Check className="h-6 w-6 text-green-400" />
            Labor & Material Review
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Review AI-extracted entries before they affect the budget
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchData}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Labor Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{pendingLaborCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Labor Approved</p>
                <p className="text-2xl font-bold text-green-400">{data.laborApproved.length}</p>
              </div>
              <Check className="h-8 w-8 text-green-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Materials Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{pendingMaterialCount}</p>
              </div>
              <Package className="h-8 w-8 text-yellow-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Materials Received</p>
                <p className="text-2xl font-bold text-green-400">{data.materialsReceived.length}</p>
              </div>
              <Package className="h-8 w-8 text-green-400/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Review Tabs */}
      <Card className="bg-[#2d333b] border-gray-700">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedItems(new Set()); }}>
          <CardHeader className="pb-0">
            <TabsList className="bg-[#1F2328] border border-gray-600">
              <TabsTrigger value="labor-pending" className="data-[state=active]:bg-yellow-600">
                <Users className="h-4 w-4 mr-2" />
                Labor Pending {pendingLaborCount > 0 && <Badge className="ml-2 bg-yellow-600">{pendingLaborCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="labor-approved" className="data-[state=active]:bg-green-600">
                <Check className="h-4 w-4 mr-2" />
                Labor Approved
              </TabsTrigger>
              <TabsTrigger value="material-pending" className="data-[state=active]:bg-yellow-600">
                <Package className="h-4 w-4 mr-2" />
                Materials Pending {pendingMaterialCount > 0 && <Badge className="ml-2 bg-yellow-600">{pendingMaterialCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="material-received" className="data-[state=active]:bg-green-600">
                <Check className="h-4 w-4 mr-2" />
                Materials Received
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Labor Pending Tab */}
            <TabsContent value="labor-pending">
              {data.laborPending.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Check className="h-12 w-12 mx-auto mb-4 text-green-400" />
                  <p>All labor entries have been reviewed!</p>
                </div>
              ) : (
                <>
                  {/* Bulk Actions */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === data.laborPending.length}
                        onChange={() => toggleSelectAll(data.laborPending)}
                        className="rounded border-gray-600"
                      />
                      <span className="text-sm text-gray-400">
                        {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select all'}
                      </span>
                    </div>
                    {selectedItems.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove('labor', Array.from(selectedItems))}
                          disabled={processing}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve Selected
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject('labor', Array.from(selectedItems))}
                          disabled={processing}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject Selected
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Labor Table */}
                  <div className="space-y-2">
                    {data.laborPending.map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-lg border ${selectedItems.has(entry.id) ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-[#1F2328]'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(entry.id)}
                              onChange={() => toggleSelect(entry.id)}
                              className="mt-1 rounded border-gray-600"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">{entry.workerName}</span>
                                <Badge className="bg-blue-600/20 text-blue-400">{entry.tradeType || 'General'}</Badge>
                                {getConfidenceBadge(entry.confidence)}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                <span className="mr-4"><Calendar className="h-3 w-3 inline mr-1" />{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                                <span className="mr-4"><Clock className="h-3 w-3 inline mr-1" />{entry.hoursWorked} hrs @ {formatCurrency(entry.hourlyRate)}/hr</span>
                              </div>
                              {entry.description && (
                                <p className="text-sm text-gray-500 mt-1 italic">{entry.description}</p>
                              )}
                              {entry.budgetItem && (
                                <p className="text-xs text-blue-400 mt-1">→ {entry.budgetItem.name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-green-400">{formatCurrency(entry.totalCost)}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditModal({ type: 'labor', item: entry })}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove('labor', [entry.id])}
                              disabled={processing}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject('labor', [entry.id])}
                              disabled={processing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Labor Approved Tab */}
            <TabsContent value="labor-approved">
              {data.laborApproved.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="h-12 w-12 mx-auto mb-4" />
                  <p>No approved labor entries yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.laborApproved.slice(0, 20).map((entry) => (
                    <div key={entry.id} className="p-4 rounded-lg border border-gray-700 bg-[#1F2328]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-400" />
                          <span className="font-medium text-white">{entry.workerName}</span>
                          <Badge className="bg-blue-600/20 text-blue-400">{entry.tradeType || 'General'}</Badge>
                          <span className="text-sm text-gray-400">{format(new Date(entry.date), 'MMM d')}</span>
                          <span className="text-sm text-gray-400">{entry.hoursWorked} hrs</span>
                        </div>
                        <span className="font-medium text-green-400">{formatCurrency(entry.totalCost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Material Pending Tab */}
            <TabsContent value="material-pending">
              {data.materialsPending.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Check className="h-12 w-12 mx-auto mb-4 text-green-400" />
                  <p>All material entries have been reviewed!</p>
                </div>
              ) : (
                <>
                  {/* Bulk Actions */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === data.materialsPending.length}
                        onChange={() => toggleSelectAll(data.materialsPending)}
                        className="rounded border-gray-600"
                      />
                      <span className="text-sm text-gray-400">
                        {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select all'}
                      </span>
                    </div>
                    {selectedItems.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove('material', Array.from(selectedItems))}
                          disabled={processing}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve Selected
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject('material', Array.from(selectedItems))}
                          disabled={processing}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject Selected
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Material Table */}
                  <div className="space-y-2">
                    {data.materialsPending.map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-lg border ${selectedItems.has(entry.id) ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-[#1F2328]'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(entry.id)}
                              onChange={() => toggleSelect(entry.id)}
                              className="mt-1 rounded border-gray-600"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">{entry.description}</span>
                                <Badge className="bg-purple-600/20 text-purple-400">{entry.itemType}</Badge>
                                {getConfidenceBadge(entry.confidence)}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                <span className="mr-4">#{entry.procurementNumber}</span>
                                {entry.vendorName && <span className="mr-4"><Building2 className="h-3 w-3 inline mr-1" />{entry.vendorName}</span>}
                                {entry.quantity && <span>{entry.quantity} {entry.unit}</span>}
                              </div>
                              {entry.actualDelivery && (
                                <p className="text-xs text-gray-500 mt-1">Delivered: {format(new Date(entry.actualDelivery), 'MMM d, yyyy')}</p>
                              )}
                              {entry.budgetItem && (
                                <p className="text-xs text-blue-400 mt-1">→ {entry.budgetItem.name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-green-400">
                              {entry.actualCost ? formatCurrency(entry.actualCost) : '-'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditModal({ type: 'material', item: entry })}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove('material', [entry.id])}
                              disabled={processing}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject('material', [entry.id])}
                              disabled={processing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Material Received Tab */}
            <TabsContent value="material-received">
              {data.materialsReceived.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="h-12 w-12 mx-auto mb-4" />
                  <p>No received materials yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.materialsReceived.slice(0, 20).map((entry) => (
                    <div key={entry.id} className="p-4 rounded-lg border border-gray-700 bg-[#1F2328]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-400" />
                          <span className="font-medium text-white">{entry.description}</span>
                          <Badge className="bg-purple-600/20 text-purple-400">{entry.itemType}</Badge>
                          {entry.vendorName && <span className="text-sm text-gray-400">{entry.vendorName}</span>}
                        </div>
                        <span className="font-medium text-green-400">
                          {entry.actualCost ? formatCurrency(entry.actualCost) : '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Edit Modal */}
      {editModal && (
        <EditEntryModal
          type={editModal.type}
          item={editModal.item}
          budgetItems={data.budgetItems}
          onClose={() => setEditModal(null)}
          onSave={handleEdit}
          processing={processing}
        />
      )}
    </div>
  );
}

// Type guard to check if an entry is a LaborEntry
function isLaborEntry(entry: LaborEntry | MaterialEntry): entry is LaborEntry {
  return 'workerName' in entry && 'hoursWorked' in entry && 'hourlyRate' in entry;
}

// Form data types for the edit modal (using string values for inputs)
interface LaborFormData {
  workerName: string;
  hoursWorked: string;
  hourlyRate: string;
  description: string | null;
  budgetItemId: string | null;
}

interface MaterialFormData {
  description: string;
  quantity: string;
  unit: string | null;
  actualCost: string;
  budgetItemId: string | null;
}

// Edit Entry Modal Component
function EditEntryModal({
  type,
  item,
  budgetItems,
  onClose,
  onSave,
  processing
}: {
  type: 'labor' | 'material';
  item: LaborEntry | MaterialEntry;
  budgetItems: BudgetItem[];
  onClose: () => void;
  onSave: (type: 'labor' | 'material', id: string, updates: ReviewUpdates) => void;
  processing: boolean;
}) {
  // Initialize form data based on type
  const [laborFormData, setLaborFormData] = useState<LaborFormData>(() => {
    if (isLaborEntry(item)) {
      return {
        workerName: item.workerName,
        hoursWorked: String(item.hoursWorked),
        hourlyRate: String(item.hourlyRate),
        description: item.description,
        budgetItemId: item.budgetItem?.id || null,
      };
    }
    return { workerName: '', hoursWorked: '0', hourlyRate: '0', description: null, budgetItemId: null };
  });

  const [materialFormData, setMaterialFormData] = useState<MaterialFormData>(() => {
    if (!isLaborEntry(item)) {
      return {
        description: item.description,
        quantity: item.quantity != null ? String(item.quantity) : '',
        unit: item.unit,
        actualCost: item.actualCost != null ? String(item.actualCost) : '',
        budgetItemId: item.budgetItem?.id || null,
      };
    }
    return { description: '', quantity: '', unit: null, actualCost: '', budgetItemId: null };
  });

  const handleSave = () => {
    if (type === 'labor') {
      const hours = parseFloat(laborFormData.hoursWorked);
      const rate = parseFloat(laborFormData.hourlyRate);
      onSave(type, item.id, {
        workerName: laborFormData.workerName,
        hoursWorked: hours,
        hourlyRate: rate,
        totalCost: hours * rate,
        description: laborFormData.description,
        budgetItemId: laborFormData.budgetItemId || undefined,
      });
    } else {
      onSave(type, item.id, {
        description: materialFormData.description,
        quantity: materialFormData.quantity ? parseFloat(materialFormData.quantity) : null,
        unit: materialFormData.unit,
        actualCost: materialFormData.actualCost ? parseFloat(materialFormData.actualCost) : null,
        budgetItemId: materialFormData.budgetItemId || undefined,
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#2d333b] border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            Edit {type === 'labor' ? 'Labor' : 'Material'} Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {type === 'labor' ? (
            <>
              <div>
                <label className="text-sm text-gray-400">Worker Name</label>
                <Input
                  value={laborFormData.workerName}
                  onChange={(e) => setLaborFormData({ ...laborFormData, workerName: e.target.value })}
                  className="bg-[#1F2328] border-gray-600 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Hours Worked</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={laborFormData.hoursWorked}
                    onChange={(e) => setLaborFormData({ ...laborFormData, hoursWorked: e.target.value })}
                    className="bg-[#1F2328] border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Hourly Rate</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={laborFormData.hourlyRate}
                    onChange={(e) => setLaborFormData({ ...laborFormData, hourlyRate: e.target.value })}
                    className="bg-[#1F2328] border-gray-600 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Description</label>
                <Textarea
                  value={laborFormData.description || ''}
                  onChange={(e) => setLaborFormData({ ...laborFormData, description: e.target.value })}
                  className="bg-[#1F2328] border-gray-600 text-white"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm text-gray-400">Description</label>
                <Input
                  value={materialFormData.description}
                  onChange={(e) => setMaterialFormData({ ...materialFormData, description: e.target.value })}
                  className="bg-[#1F2328] border-gray-600 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Quantity</label>
                  <Input
                    type="number"
                    value={materialFormData.quantity}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, quantity: e.target.value })}
                    className="bg-[#1F2328] border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Unit</label>
                  <Input
                    value={materialFormData.unit || ''}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, unit: e.target.value })}
                    className="bg-[#1F2328] border-gray-600 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Actual Cost</label>
                <Input
                  type="number"
                  step="0.01"
                  value={materialFormData.actualCost}
                  onChange={(e) => setMaterialFormData({ ...materialFormData, actualCost: e.target.value })}
                  className="bg-[#1F2328] border-gray-600 text-white"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-gray-400">Link to Budget Item</label>
            <Select
              value={(type === 'labor' ? laborFormData.budgetItemId : materialFormData.budgetItemId) || ''}
              onValueChange={(v) => {
                if (type === 'labor') {
                  setLaborFormData({ ...laborFormData, budgetItemId: v || null });
                } else {
                  setMaterialFormData({ ...materialFormData, budgetItemId: v || null });
                }
              }}
            >
              <SelectTrigger className="bg-[#1F2328] border-gray-600 text-white">
                <SelectValue placeholder="Select budget item..." />
              </SelectTrigger>
              <SelectContent className="bg-[#2d333b] border-gray-600">
                <SelectItem value="" className="text-gray-400">None</SelectItem>
                {budgetItems.map((bi) => (
                  <SelectItem key={bi.id} value={bi.id} className="text-white">
                    {bi.name} ({bi.phaseName || bi.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-gray-400">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
