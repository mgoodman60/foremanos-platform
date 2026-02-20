'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import {
  Package, Plus, Truck, Check, AlertTriangle,
  ShoppingCart, Calendar, DollarSign, Edit, Trash2, Search
} from 'lucide-react';

interface Procurement {
  id: string;
  procurementNumber: string;
  description: string;
  itemType: string;
  specifications?: string;
  quantity?: number;
  unit?: string;
  vendorName?: string;
  requiredDate?: string;
  leadTime?: number;
  orderDate?: string;
  expectedDelivery?: string;
  actualDelivery?: string;
  budgetedCost?: number;
  quotedCost?: number;
  actualCost?: number;
  purchaseOrder?: string;
  trackingNumber?: string;
  status: string;
  notes?: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  IDENTIFIED: { color: 'bg-gray-600', label: 'Identified', icon: Search },
  SPEC_REVIEW: { color: 'bg-blue-600', label: 'Spec Review', icon: Search },
  BIDDING: { color: 'bg-purple-600', label: 'Bidding', icon: ShoppingCart },
  AWARDED: { color: 'bg-indigo-600', label: 'Awarded', icon: Check },
  ORDERED: { color: 'bg-yellow-600', label: 'Ordered', icon: ShoppingCart },
  IN_TRANSIT: { color: 'bg-orange-600', label: 'In Transit', icon: Truck },
  RECEIVED: { color: 'bg-green-600', label: 'Received', icon: Package },
  INSTALLED: { color: 'bg-emerald-600', label: 'Installed', icon: Check },
  CANCELLED: { color: 'bg-red-600', label: 'Cancelled', icon: AlertTriangle }
};

const ITEM_TYPES = [
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'LONG_LEAD_ITEM', label: 'Long Lead Item' },
  { value: 'SPECIALTY_ITEM', label: 'Specialty Item' },
  { value: 'OWNER_FURNISHED', label: 'Owner Furnished' }
];

const STATUS_OPTIONS = [
  'IDENTIFIED', 'SPEC_REVIEW', 'BIDDING', 'AWARDED',
  'ORDERED', 'IN_TRANSIT', 'RECEIVED', 'INSTALLED', 'CANCELLED'
];

export default function ProcurementTracker() {
  const params = useParams();
  const slug = params?.slug as string;

  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [atRisk, setAtRisk] = useState<Procurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Procurement | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    description: '',
    itemType: 'MATERIAL',
    specifications: '',
    quantity: '',
    unit: '',
    requiredDate: '',
    leadTime: '',
    budgetedCost: '',
    vendorName: ''
  });

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/procurement`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProcurements(data.procurements || []);
      setAtRisk(data.atRisk || []);
      setStats({
        total: data.total,
        byStatus: data.byStatus,
        totalBudgeted: data.totalBudgeted,
        totalCommitted: data.totalCommitted,
        totalActual: data.totalActual
      });
    } catch (err) {
      toast.error('Failed to load procurement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const handleSave = async () => {
    try {
      const url = editingItem
        ? `/api/projects/${slug}/procurement/${editingItem.id}`
        : `/api/projects/${slug}/procurement`;
      const method = editingItem ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: form.quantity ? parseFloat(form.quantity) : null,
          leadTime: form.leadTime ? parseInt(form.leadTime) : null,
          budgetedCost: form.budgetedCost ? parseFloat(form.budgetedCost) : null
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(editingItem ? 'Item updated' : 'Item created');
      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error('Failed to save item');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/procurement/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success('Status updated');
      fetchData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this procurement item?')) return;

    try {
      const res = await fetch(`/api/projects/${slug}/procurement/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Item deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const resetForm = () => {
    setForm({
      description: '',
      itemType: 'MATERIAL',
      specifications: '',
      quantity: '',
      unit: '',
      requiredDate: '',
      leadTime: '',
      budgetedCost: '',
      vendorName: ''
    });
  };

  const openEdit = (item: Procurement) => {
    setEditingItem(item);
    setForm({
      description: item.description,
      itemType: item.itemType,
      specifications: item.specifications || '',
      quantity: item.quantity?.toString() || '',
      unit: item.unit || '',
      requiredDate: item.requiredDate?.split('T')[0] || '',
      leadTime: item.leadTime?.toString() || '',
      budgetedCost: item.budgetedCost?.toString() || '',
      vendorName: item.vendorName || ''
    });
    setShowAddModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getDaysUntilRequired = (item: Procurement) => {
    if (!item.requiredDate) return null;
    return differenceInDays(new Date(item.requiredDate), new Date());
  };

  const filteredItems = procurements.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (search && !item.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <Card className="p-6 bg-dark-card border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3" />
          <div className="h-32 bg-gray-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Total Items</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Budgeted</div>
            <div className="text-2xl font-bold text-blue-400">
              {formatCurrency(stats.totalBudgeted)}
            </div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Committed</div>
            <div className="text-2xl font-bold text-yellow-400">
              {formatCurrency(stats.totalCommitted)}
            </div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-sm text-gray-400">Actual Spent</div>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency(stats.totalActual)}
            </div>
          </Card>
        </div>
      )}

      {/* At Risk Alert */}
      {atRisk.length > 0 && (
        <Card className="p-4 bg-red-900/20 border-red-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
            <span className="font-medium text-red-400">{atRisk.length} Items at Risk</span>
          </div>
          <div className="space-y-1">
            {atRisk.slice(0, 3).map(item => (
              <div key={item.id} className="text-sm text-gray-300">
                {item.description} - Required in {getDaysUntilRequired(item)} days
              </div>
            ))}
            {atRisk.length > 3 && (
              <div className="text-sm text-gray-400">+{atRisk.length - 3} more</div>
            )}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => { resetForm(); setEditingItem(null); setShowAddModal(true); }}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Add Item
        </Button>

        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 bg-dark-card border-gray-700"
        />

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 bg-dark-card border-gray-700">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <Card className="p-8 bg-dark-card border-gray-700 text-center text-gray-400">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p>No procurement items found</p>
          </Card>
        ) : (
          filteredItems.map(item => {
            const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.IDENTIFIED;
            const StatusIcon = config.icon;
            const daysUntilRequired = getDaysUntilRequired(item);
            const isUrgent = daysUntilRequired !== null && daysUntilRequired <= (item.leadTime || 14);

            return (
              <Card key={item.id} className="p-4 bg-dark-card border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <StatusIcon className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">
                          {item.procurementNumber}
                        </span>
                        <h3 className="font-semibold text-white">{item.description}</h3>
                        {isUrgent && !['RECEIVED', 'INSTALLED', 'CANCELLED'].includes(item.status) && (
                          <Badge className="bg-red-600 text-white">
                            <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" /> Urgent
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                        <Badge variant="outline">
                          {ITEM_TYPES.find(t => t.value === item.itemType)?.label}
                        </Badge>
                        {item.vendorName && (
                          <span>Vendor: {item.vendorName}</span>
                        )}
                        {item.quantity && item.unit && (
                          <span>Qty: {item.quantity} {item.unit}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {item.requiredDate && (
                          <span className={`flex items-center gap-1 ${isUrgent ? 'text-red-400' : 'text-gray-400'}`}>
                            <Calendar className="h-4 w-4" aria-hidden="true" />
                            Required: {format(new Date(item.requiredDate), 'MMM d, yyyy')}
                            {daysUntilRequired !== null && (
                              <span className="text-xs">
                                ({daysUntilRequired > 0 ? `${daysUntilRequired}d` : 'Overdue'})
                              </span>
                            )}
                          </span>
                        )}
                        {item.budgetedCost && (
                          <span className="text-gray-400">
                            <DollarSign className="h-4 w-4 inline" aria-hidden="true" />
                            Budget: {formatCurrency(item.budgetedCost)}
                          </span>
                        )}
                        {item.purchaseOrder && (
                          <span className="text-gray-400">PO: {item.purchaseOrder}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={item.status}
                      onValueChange={(v) => handleStatusChange(item.id, v)}
                    >
                      <SelectTrigger className="w-32 bg-dark-surface border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-400"
                      onClick={() => openEdit(item)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-dark-card border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Procurement Item' : 'Add Procurement Item'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Description *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-dark-surface border-gray-600"
                placeholder="Item description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Item Type</Label>
                <Select value={form.itemType} onValueChange={(v) => setForm({ ...form, itemType: v })}>
                  <SelectTrigger className="bg-dark-surface border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Vendor</Label>
                <Input
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  placeholder="Vendor name"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  placeholder="EA, LF, SF"
                />
              </div>
              <div>
                <Label>Budget</Label>
                <Input
                  type="number"
                  value={form.budgetedCost}
                  onChange={(e) => setForm({ ...form, budgetedCost: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Required Date</Label>
                <Input
                  type="date"
                  value={form.requiredDate}
                  onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>
              <div>
                <Label>Lead Time (days)</Label>
                <Input
                  type="number"
                  value={form.leadTime}
                  onChange={(e) => setForm({ ...form, leadTime: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  placeholder="14"
                />
              </div>
            </div>

            <div>
              <Label>Specifications</Label>
              <Textarea
                value={form.specifications}
                onChange={(e) => setForm({ ...form, specifications: e.target.value })}
                className="bg-dark-surface border-gray-600"
                placeholder="Technical specifications"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.description}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
