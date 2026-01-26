"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Receipt, Plus, Check, X, Clock, DollarSign,
  Building2, Calendar, Loader2, ChevronDown, ChevronUp
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  description?: string;
  amount: number;
  laborAmount: number;
  materialsAmount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'DISPUTED';
  invoiceDate: string;
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  BudgetItem?: { name: string; costCode?: string; tradeType?: string };
  Subcontractor?: { companyName: string; tradeType?: string };
}

interface Summary {
  total: number;
  pending: number;
  approved: number;
  paid: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PAID: 'bg-green-500/20 text-green-400 border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  DISPUTED: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
};

export default function InvoiceManager() {
  const params = useParams();
  const slug = params?.slug as string;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    description: '',
    amount: '',
    laborAmount: '',
    materialsAmount: '',
    invoiceDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: '',
    notes: ''
  });

  useEffect(() => {
    if (slug) fetchInvoices();
  }, [slug]);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/invoices`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success('Invoice created');
        setShowAddModal(false);
        setFormData({
          invoiceNumber: '',
          description: '',
          amount: '',
          laborAmount: '',
          materialsAmount: '',
          invoiceDate: format(new Date(), 'yyyy-MM-dd'),
          dueDate: '',
          notes: ''
        });
        fetchInvoices();
      } else {
        toast.error('Failed to create invoice');
      }
    } catch (error) {
      toast.error('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Invoice ${status.toLowerCase()}`);
        fetchInvoices();
      }
    } catch (error) {
      toast.error('Failed to update invoice');
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
              <div className="text-sm text-gray-400">Total Invoices</div>
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
              <div className="text-2xl font-bold text-green-400">{formatCurrency(summary.totalPaid)}</div>
              <div className="text-sm text-gray-400">Paid</div>
            </CardContent>
          </Card>
          <Card className="bg-[#2d333b] border-gray-700">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(summary.totalPending)}</div>
              <div className="text-sm text-gray-400">Outstanding</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Receipt className="h-5 w-5 text-green-400" />
          Subcontractor Invoices
        </h3>
        <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" /> Add Invoice
        </Button>
      </div>

      {/* Invoice List */}
      <div className="space-y-2">
        {invoices.length === 0 ? (
          <Card className="bg-[#2d333b] border-gray-700">
            <CardContent className="p-8 text-center text-gray-400">
              No invoices yet
            </CardContent>
          </Card>
        ) : (
          invoices.map((inv) => (
            <Card key={inv.id} className="bg-[#2d333b] border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-gray-400">#{inv.invoiceNumber}</span>
                      <Badge className={STATUS_COLORS[inv.status]}>
                        {inv.status}
                      </Badge>
                    </div>
                    <h4 className="text-white font-medium">
                      {inv.Subcontractor?.companyName || inv.description || 'Invoice'}
                    </h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(inv.amount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(inv.invoiceDate), 'MMM d, yyyy')}
                      </span>
                      {inv.BudgetItem && (
                        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                          {inv.BudgetItem.costCode || inv.BudgetItem.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(inv.id, 'APPROVED')}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {inv.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(inv.id, 'PAID')}
                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                      className="text-gray-400"
                    >
                      {expandedId === inv.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {expandedId === inv.id && (
                  <div className="mt-4 pt-4 border-t border-gray-700 text-sm grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-400">Labor:</span>
                      <span className="text-white ml-2">{formatCurrency(inv.laborAmount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Materials:</span>
                      <span className="text-white ml-2">{formatCurrency(inv.materialsAmount)}</span>
                    </div>
                    {inv.dueDate && (
                      <div>
                        <span className="text-gray-400">Due:</span>
                        <span className="text-white ml-2">{format(new Date(inv.dueDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    {inv.paidDate && (
                      <div>
                        <span className="text-gray-400">Paid:</span>
                        <span className="text-green-400 ml-2">{format(new Date(inv.paidDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    {inv.notes && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Notes:</span>
                        <span className="text-white ml-2">{inv.notes}</span>
                      </div>
                    )}
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
            <DialogTitle>Add Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice # *</Label>
                <Input
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                  required
                />
              </div>
              <div>
                <Label>Total Amount *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#1F2328] border-gray-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Labor Amount</Label>
                <Input
                  type="number"
                  value={formData.laborAmount}
                  onChange={(e) => setFormData({ ...formData, laborAmount: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                />
              </div>
              <div>
                <Label>Materials Amount</Label>
                <Input
                  type="number"
                  value={formData.materialsAmount}
                  onChange={(e) => setFormData({ ...formData, materialsAmount: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                  required
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="bg-[#1F2328] border-gray-600"
                />
              </div>
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
