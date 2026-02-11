'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, FileText, DollarSign, Calendar, Clock, CheckCircle2, 
  XCircle, AlertTriangle, ChevronRight, ChevronDown, Search,
  Filter, RefreshCw, Edit2, Trash2, Send, Eye, Download,
  TrendingUp, TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

type ChangeOrderStatus = 'DRAFT' | 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'VOIDED';

interface ChangeOrder {
  id: string;
  orderNumber: string;
  title: string;
  description: string | null;
  requestedBy: string | null;
  status: ChangeOrderStatus;
  originalAmount: number;
  proposedAmount: number;
  approvedAmount: number | null;
  scheduleImpactDays: number | null;
  submittedDate: string;
  reviewedDate: string | null;
  approvedDate: string | null;
  approvedBy: string | null;
  notes: string | null;
  budgetItem?: {
    id: string;
    name: string;
    costCode: string | null;
  } | null;
}

interface BudgetItem {
  id: string;
  name: string;
  costCode: string | null;
  budgetedAmount: number;
}

interface ChangeOrderSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalApprovedValue: number;
  totalPendingValue: number;
  netBudgetImpact: number;
}

interface ChangeOrderManagerProps {
  projectSlug: string;
  budgetId?: string;
}

const STATUS_CONFIG: Record<ChangeOrderStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: FileText },
  PENDING: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Eye },
  APPROVED: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  VOIDED: { label: 'Voided', color: 'bg-gray-600/20 text-gray-400 border-gray-600/30', icon: XCircle },
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function ChangeOrderManager({ projectSlug, budgetId }: ChangeOrderManagerProps) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [summary, setSummary] = useState<ChangeOrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCO, setSelectedCO] = useState<ChangeOrder | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requestedBy: '',
    proposedAmount: '',
    scheduleImpactDays: '',
    budgetItemId: '',
    notes: '',
  });

  const fetchChangeOrders = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/change-orders`);
      if (!response.ok) throw new Error('Failed to fetch change orders');
      const data = await response.json();
      setChangeOrders(data.changeOrders);
      setSummary(data.summary);
    } catch (error) {
      console.error('[ChangeOrders] Error:', error);
      toast.error('Failed to load change orders');
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  const fetchBudgetItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/budget/items`);
      if (!response.ok) return;
      const data = await response.json();
      setBudgetItems(data.items || []);
    } catch (error) {
      console.error('[ChangeOrders] Failed to load budget items:', error);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchChangeOrders();
    fetchBudgetItems();
  }, [fetchChangeOrders, fetchBudgetItems]);

  const handleCreateCO = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          requestedBy: formData.requestedBy || null,
          proposedAmount: parseFloat(formData.proposedAmount) || 0,
          scheduleImpactDays: formData.scheduleImpactDays ? parseInt(formData.scheduleImpactDays) : null,
          budgetItemId: formData.budgetItemId || null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create change order');
      
      toast.success('Change order created');
      setShowCreateModal(false);
      resetForm();
      fetchChangeOrders();
    } catch (error) {
      console.error('[ChangeOrders] Create error:', error);
      toast.error('Failed to create change order');
    }
  };

  const handleUpdateStatus = async (coId: string, newStatus: ChangeOrderStatus, approvedAmount?: number) => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/change-orders/${coId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          approvedAmount: approvedAmount,
          ...(newStatus === 'APPROVED' ? { approvedDate: new Date().toISOString() } : {}),
          ...(newStatus === 'REJECTED' ? { rejectedDate: new Date().toISOString() } : {}),
        }),
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      toast.success(`Change order ${newStatus.toLowerCase()}`);
      fetchChangeOrders();
    } catch (error) {
      console.error('[ChangeOrders] Update error:', error);
      toast.error('Failed to update change order');
    }
  };

  const handleDeleteCO = async (coId: string) => {
    if (!confirm('Are you sure you want to delete this change order?')) return;
    
    try {
      const response = await fetch(`/api/projects/${projectSlug}/change-orders/${coId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      
      toast.success('Change order deleted');
      fetchChangeOrders();
    } catch (error) {
      console.error('[ChangeOrders] Delete error:', error);
      toast.error('Failed to delete change order');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      requestedBy: '',
      proposedAmount: '',
      scheduleImpactDays: '',
      budgetItemId: '',
      notes: '',
    });
  };

  const filteredOrders = changeOrders.filter(co => {
    const matchesSearch = !searchQuery || 
      co.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      co.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      co.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || co.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const StatusBadge = ({ status }: { status: ChangeOrderStatus }) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Total COs</p>
                  <p className="text-2xl font-bold text-white">{summary.total}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">{summary.pending}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(summary.totalPendingValue)}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Approved</p>
                  <p className="text-2xl font-bold text-green-400">{summary.approved}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(summary.totalApprovedValue)}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${summary.netBudgetImpact >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Net Impact</p>
                  <p className={`text-xl font-bold ${summary.netBudgetImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {summary.netBudgetImpact >= 0 ? '+' : ''}{formatCurrency(summary.netBudgetImpact)}
                  </p>
                </div>
                {summary.netBudgetImpact >= 0 
                  ? <TrendingUp className="w-8 h-8 text-green-500/50" />
                  : <TrendingDown className="w-8 h-8 text-red-500/50" />
                }
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Change Orders
            </CardTitle>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              New CO
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search change orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-700"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-gray-900/50 border-gray-700">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No change orders found</p>
              {changeOrders.length === 0 && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="outline"
                  className="mt-4"
                >
                  Create First Change Order
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map(co => (
                <div 
                  key={co.id}
                  className="border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors"
                >
                  <button
                    onClick={() => setExpandedId(expandedId === co.id ? null : co.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {expandedId === co.id 
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                      }
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-400">{co.orderNumber}</span>
                          <span className="text-sm text-white">{co.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={co.status} />
                          {co.budgetItem && (
                            <span className="text-xs text-gray-400">
                              {co.budgetItem.costCode || co.budgetItem.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {formatCurrency(co.status === 'APPROVED' && co.approvedAmount ? co.approvedAmount : co.proposedAmount)}
                      </p>
                      {co.scheduleImpactDays && (
                        <p className={`text-xs ${co.scheduleImpactDays > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {co.scheduleImpactDays > 0 ? '+' : ''}{co.scheduleImpactDays} days
                        </p>
                      )}
                    </div>
                  </button>
                  
                  {expandedId === co.id && (
                    <div className="px-4 pb-4 border-t border-gray-700 bg-gray-900/30">
                      <div className="pt-3 space-y-3">
                        {co.description && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Description</p>
                            <p className="text-sm text-gray-300">{co.description}</p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <p className="text-xs text-gray-400">Requested By</p>
                            <p className="text-sm text-white">{co.requestedBy || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Submitted</p>
                            <p className="text-sm text-white">
                              {format(new Date(co.submittedDate), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Proposed Amount</p>
                            <p className="text-sm text-white">{formatCurrency(co.proposedAmount)}</p>
                          </div>
                          {co.approvedAmount && (
                            <div>
                              <p className="text-xs text-gray-400">Approved Amount</p>
                              <p className="text-sm text-green-400">{formatCurrency(co.approvedAmount)}</p>
                            </div>
                          )}
                        </div>
                        
                        {co.notes && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Notes</p>
                            <p className="text-sm text-gray-300">{co.notes}</p>
                          </div>
                        )}
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                          {co.status === 'DRAFT' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(co.id, 'SUBMITTED')}
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Submit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => handleDeleteCO(co.id)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </>
                          )}
                          {(co.status === 'SUBMITTED' || co.status === 'UNDER_REVIEW' || co.status === 'PENDING') && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleUpdateStatus(co.id, 'APPROVED', co.proposedAmount)}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-400 border-red-400/50 hover:bg-red-500/10"
                                onClick={() => handleUpdateStatus(co.id, 'REJECTED')}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                              {co.status === 'SUBMITTED' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateStatus(co.id, 'UNDER_REVIEW')}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Start Review
                                </Button>
                              )}
                            </>
                          )}
                          {co.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400"
                              onClick={() => handleUpdateStatus(co.id, 'VOIDED')}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Void
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Change Order</DialogTitle>
            <DialogDescription>
              Add a new change order to track budget modifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Additional electrical outlets"
                className="bg-gray-900/50 border-gray-700"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the scope of the change..."
                className="bg-gray-900/50 border-gray-700"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Proposed Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    value={formData.proposedAmount}
                    onChange={(e) => setFormData({ ...formData, proposedAmount: e.target.value })}
                    placeholder="0.00"
                    className="pl-10 bg-gray-900/50 border-gray-700"
                  />
                </div>
              </div>
              <div>
                <Label>Schedule Impact (days)</Label>
                <Input
                  type="number"
                  value={formData.scheduleImpactDays}
                  onChange={(e) => setFormData({ ...formData, scheduleImpactDays: e.target.value })}
                  placeholder="0"
                  className="bg-gray-900/50 border-gray-700"
                />
              </div>
            </div>
            <div>
              <Label>Requested By</Label>
              <Input
                value={formData.requestedBy}
                onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                placeholder="Name or company"
                className="bg-gray-900/50 border-gray-700"
              />
            </div>
            {budgetItems.length > 0 && (
              <div>
                <Label>Link to Budget Item</Label>
                <Select 
                  value={formData.budgetItemId} 
                  onValueChange={(val) => setFormData({ ...formData, budgetItemId: val })}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-700">
                    <SelectValue placeholder="Select budget item (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.costCode ? `${item.costCode} - ` : ''}{item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="bg-gray-900/50 border-gray-700"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCO}
              disabled={!formData.title || !formData.proposedAmount}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Change Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
