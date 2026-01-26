"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  FileEdit, Plus, Check, X, Clock, AlertTriangle,
  DollarSign, Calendar, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ChangeOrder {
  id: string;
  orderNumber: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  proposedAmount: number;
  approvedAmount?: number;
  scheduleImpactDays?: number;
  submittedDate: string;
  approvedDate?: string;
  requestedBy?: string;
  notes?: string;
  BudgetItem?: { name: string; costCode?: string };
}

interface Summary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalApprovedValue: number;
  totalPendingValue: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  UNDER_REVIEW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  VOIDED: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

export default function ChangeOrderManager() {
  const params = useParams();
  const slug = params?.slug as string;

  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    proposedAmount: '',
    scheduleImpactDays: '',
    requestedBy: '',
    notes: ''
  });

  useEffect(() => {
    if (slug) fetchChangeOrders();
  }, [slug]);

  const fetchChangeOrders = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/change-orders`);
      if (res.ok) {
        const data = await res.json();
        setChangeOrders(data.changeOrders);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching change orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success('Change order created');
        setShowAddModal(false);
        setFormData({ title: '', description: '', proposedAmount: '', scheduleImpactDays: '', requestedBy: '', notes: '' });
        fetchChangeOrders();
      } else {
        toast.error('Failed to create change order');
      }
    } catch (error) {
      toast.error('Failed to create change order');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string, approvedAmount?: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/change-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approvedAmount })
      });
      if (res.ok) {
        toast.success(`Change order ${status.toLowerCase()}`);
        fetchChangeOrders();
      }
    } catch (error) {
      toast.error('Failed to update change order');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-[#2d333b] border-gray-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-white">{summary.total}</div>
              <div className="text-sm text-gray-400">Total COs</div>
            </CardContent>
          </Card>
          <Card className="bg-[#2d333b] border-gray-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-400">{summary.pending}</div>
              <div className="text-sm text-gray-400">Pending</div>
            </CardContent>
          </Card>
          <Card className="bg-[#2d333b] border-gray-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-400">{formatCurrency(summary.totalApprovedValue)}</div>
              <div className="text-sm text-gray-400">Approved Value</div>
            </CardContent>
          </Card>
          <Card className="bg-[#2d333b] border-gray-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(summary.totalPendingValue)}</div>
              <div className="text-sm text-gray-400">Pending Value</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileEdit className="h-5 w-5 text-blue-400" />
          Change Orders
        </h3>
        <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" /> New CO
        </Button>
      </div>

      {/* Change Order List */}
      <div className="space-y-2">
        {changeOrders.length === 0 ? (
          <Card className="bg-[#2d333b] border-gray-700">
            <CardContent className="p-8 text-center text-gray-400">
              No change orders yet
            </CardContent>
          </Card>
        ) : (
          changeOrders.map((co) => (
            <Card key={co.id} className="bg-[#2d333b] border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-gray-400">{co.orderNumber}</span>
                      <Badge className={STATUS_COLORS[co.status]}>
                        {co.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <h4 className="text-white font-medium">{co.title}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(co.proposedAmount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(co.submittedDate), 'MMM d, yyyy')}
                      </span>
                      {co.scheduleImpactDays && (
                        <span className="flex items-center gap-1 text-orange-400">
                          <Clock className="h-4 w-4" />
                          {co.scheduleImpactDays} days impact
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {co.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(co.id, 'APPROVED', co.proposedAmount.toString())}
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(co.id, 'REJECTED')}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === co.id ? null : co.id)}
                      className="text-gray-400"
                    >
                      {expandedId === co.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {expandedId === co.id && (
                  <div className="mt-4 pt-4 border-t border-gray-700 text-sm">
                    {co.description && <p className="text-gray-300 mb-2">{co.description}</p>}
                    {co.BudgetItem && (
                      <p className="text-gray-400">Budget Item: {co.BudgetItem.name} ({co.BudgetItem.costCode})</p>
                    )}
                    {co.approvedAmount && (
                      <p className="text-green-400 mt-2">Approved: {formatCurrency(co.approvedAmount)}</p>
                    )}
                    {co.notes && <p className="text-gray-400 mt-2">Notes: {co.notes}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#2d333b] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>New Change Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-[#1F2328] border-gray-600"
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#1F2328] border-gray-600"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Proposed Amount *</Label>
                <Input
                  type="number"
                  value={formData.proposedAmount}
                  onChange={(e) => setFormData({ ...formData, proposedAmount: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                  required
                />
              </div>
              <div>
                <Label>Schedule Impact (days)</Label>
                <Input
                  type="number"
                  value={formData.scheduleImpactDays}
                  onChange={(e) => setFormData({ ...formData, scheduleImpactDays: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                />
              </div>
            </div>
            <div>
              <Label>Requested By</Label>
              <Input
                value={formData.requestedBy}
                onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                className="bg-[#1F2328] border-gray-600"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
