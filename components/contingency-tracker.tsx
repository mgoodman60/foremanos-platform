"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Shield, Plus, AlertTriangle, TrendingDown,
  Loader2, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ContingencyUsage {
  id: string;
  amount: number;
  reason: string;
  description?: string;
  approvedBy?: string;
  usedDate: string;
}

interface ContingencyData {
  totalContingency: number;
  totalUsed: number;
  remaining: number;
  percentUsed: number;
  usages: ContingencyUsage[];
}

export default function ContingencyTracker() {
  const params = useParams();
  const slug = params?.slug as string;

  const [data, setData] = useState<ContingencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    reason: '',
    description: ''
  });

  useEffect(() => {
    if (slug) fetchContingency();
  }, [slug]);

  const fetchContingency = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/contingency`);
      if (res.ok) {
        const contingencyData = await res.json();
        setData(contingencyData);
      } else if (res.status === 404) {
        setData(null);
      }
    } catch (error) {
      console.error('Error fetching contingency:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/contingency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success('Contingency usage recorded');
        setShowAddModal(false);
        setFormData({ amount: '', reason: '', description: '' });
        fetchContingency();
      } else {
        toast.error('Failed to record usage');
      }
    } catch (error) {
      toast.error('Failed to record usage');
    } finally {
      setSubmitting(false);
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

  const getStatusColor = (percentUsed: number) => {
    if (percentUsed >= 90) return 'text-red-400';
    if (percentUsed >= 70) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getProgressColor = (percentUsed: number) => {
    if (percentUsed >= 90) return 'bg-red-500';
    if (percentUsed >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-6 text-center text-gray-400">
          <Shield aria-hidden="true" className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>Budget not configured</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-card border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Shield aria-hidden="true" className="h-5 w-5 text-blue-400" />
            Contingency Tracking
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus aria-hidden="true" className="h-4 w-4 mr-1" /> Use
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Overview */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Contingency Usage</span>
            <span className={`text-lg font-bold ${getStatusColor(data.percentUsed)}`}>
              {data.percentUsed.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(data.percentUsed)}`}
              style={{ width: `${Math.min(data.percentUsed, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-gray-400">
              Used: <span className="text-white">{formatCurrency(data.totalUsed)}</span>
            </span>
            <span className="text-gray-400">
              Remaining: <span className={getStatusColor(data.percentUsed)}>{formatCurrency(data.remaining)}</span>
            </span>
          </div>
          <div className="text-center mt-1 text-xs text-gray-400">
            Total: {formatCurrency(data.totalContingency)}
          </div>
        </div>

        {/* Warning */}
        {data.percentUsed >= 70 && (
          <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${
            data.percentUsed >= 90 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            <AlertTriangle aria-hidden="true" className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">
              {data.percentUsed >= 90
                ? 'Critical: Contingency nearly exhausted!'
                : 'Warning: Contingency usage is high'}
            </span>
          </div>
        )}

        {/* Usage History */}
        {data.usages.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Usage</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {data.usages.slice(0, 5).map((usage) => (
                <div key={usage.id} className="p-2 bg-dark-surface rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{usage.reason}</span>
                    <span className="text-red-400 text-sm font-mono">
                      -{formatCurrency(usage.amount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {format(new Date(usage.usedDate), 'MMM d, yyyy')}
                    {usage.approvedBy && ` • ${usage.approvedBy}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Add Usage Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Record Contingency Usage</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-dark-surface border-gray-600"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label>Reason *</Label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="bg-dark-surface border-gray-600"
                placeholder="e.g., Unforeseen site conditions"
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-dark-surface border-gray-600"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
