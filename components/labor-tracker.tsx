"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Users, Plus, Clock, DollarSign, Calendar,
  Loader2, TrendingUp, Wrench
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
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

interface LaborEntry {
  id: string;
  workerName: string;
  tradeType?: string;
  date: string;
  hoursWorked: number;
  hourlyRate: number;
  overtimeHours: number;
  overtimeRate?: number;
  totalCost: number;
  description?: string;
  status: string;
  BudgetItem?: { name: string; costCode?: string };
}

interface Summary {
  totalEntries: number;
  totalHours: number;
  totalCost: number;
  avgHourlyRate: number;
  byTrade: Record<string, { hours: number; cost: number; entries: number }>;
}

const TRADE_TYPES = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac_mechanical', label: 'HVAC' },
  { value: 'carpentry_framing', label: 'Carpentry' },
  { value: 'concrete_masonry', label: 'Concrete' },
  { value: 'drywall_finishes', label: 'Drywall' },
  { value: 'painting_coating', label: 'Painting' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'general_contractor', label: 'General' },
];

export default function LaborTracker() {
  const params = useParams();
  const slug = params?.slug as string;

  const [entries, setEntries] = useState<LaborEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState('week');

  const [formData, setFormData] = useState({
    workerName: '',
    tradeType: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hoursWorked: '',
    hourlyRate: '',
    overtimeHours: '',
    overtimeRate: '',
    description: ''
  });

  useEffect(() => {
    if (slug) fetchLaborEntries();
  }, [slug, dateRange]);

  const fetchLaborEntries = async () => {
    setLoading(true);
    try {
      let url = `/api/projects/${slug}/labor`;
      if (dateRange === 'week') {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        url += `?startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(end, 'yyyy-MM-dd')}`;
      } else if (dateRange === 'month') {
        const start = subWeeks(new Date(), 4);
        url += `?startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(new Date(), 'yyyy-MM-dd')}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.laborEntries);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching labor entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/labor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success('Labor entry added');
        setShowAddModal(false);
        setFormData({
          workerName: '',
          tradeType: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          hoursWorked: '',
          hourlyRate: '',
          overtimeHours: '',
          overtimeRate: '',
          description: ''
        });
        fetchLaborEntries();
      } else {
        toast.error('Failed to add entry');
      }
    } catch (error) {
      toast.error('Failed to add entry');
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
          <Card className="bg-dark-card border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock aria-hidden="true" className="h-5 w-5 text-blue-400" />
                <div>
                  <div className="text-2xl font-bold text-white">{summary.totalHours.toFixed(1)}</div>
                  <div className="text-sm text-gray-400">Total Hours</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-dark-card border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign aria-hidden="true" className="h-5 w-5 text-green-400" />
                <div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(summary.totalCost)}</div>
                  <div className="text-sm text-gray-400">Total Cost</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-dark-card border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp aria-hidden="true" className="h-5 w-5 text-yellow-400" />
                <div>
                  <div className="text-2xl font-bold text-white">${summary.avgHourlyRate.toFixed(2)}</div>
                  <div className="text-sm text-gray-400">Avg Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-dark-card border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users aria-hidden="true" className="h-5 w-5 text-purple-400" />
                <div>
                  <div className="text-2xl font-bold text-white">{summary.totalEntries}</div>
                  <div className="text-sm text-gray-400">Entries</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trade Breakdown */}
      {summary && Object.keys(summary.byTrade).length > 0 && (
        <Card className="bg-dark-card border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Wrench aria-hidden="true" className="h-4 w-4 text-blue-400" />
              By Trade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(summary.byTrade).map(([trade, data]) => (
                <div key={trade} className="p-3 bg-dark-surface rounded-lg">
                  <div className="text-xs text-gray-400 capitalize mb-1">
                    {trade.replace(/_/g, ' ')}
                  </div>
                  <div className="text-white font-medium">{data.hours.toFixed(1)} hrs</div>
                  <div className="text-green-400 text-sm">{formatCurrency(data.cost)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users aria-hidden="true" className="h-5 w-5 text-purple-400" />
          Labor Tracking
        </h3>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[120px] bg-dark-surface border-gray-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-dark-card border-gray-700">
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">Last 4 Weeks</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus aria-hidden="true" className="h-4 w-4 mr-1" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Entry List */}
      <div className="space-y-2">
        {entries.length === 0 ? (
          <Card className="bg-dark-card border-gray-700">
            <CardContent className="p-8 text-center text-gray-400">
              No labor entries for this period
            </CardContent>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} className="bg-dark-card border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{entry.workerName}</span>
                      {entry.tradeType && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {entry.tradeType.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar aria-hidden="true" className="h-3 w-3" />
                        {format(new Date(entry.date), 'MMM d')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock aria-hidden="true" className="h-3 w-3" />
                        {entry.hoursWorked}h {entry.overtimeHours > 0 && `+ ${entry.overtimeHours}h OT`}
                      </span>
                      <span>${entry.hourlyRate}/hr</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      {formatCurrency(entry.totalCost)}
                    </div>
                    {entry.description && (
                      <div className="text-xs text-gray-400 max-w-[150px] truncate">
                        {entry.description}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-dark-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Labor Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Worker Name *</Label>
                <Input
                  value={formData.workerName}
                  onChange={(e) => setFormData({ ...formData, workerName: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  required
                />
              </div>
              <div>
                <Label>Trade</Label>
                <Select
                  value={formData.tradeType}
                  onValueChange={(value) => setFormData({ ...formData, tradeType: value })}
                >
                  <SelectTrigger className="bg-dark-surface border-gray-600">
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-gray-700">
                    {TRADE_TYPES.map((trade) => (
                      <SelectItem key={trade.value} value={trade.value}>
                        {trade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  required
                />
              </div>
              <div>
                <Label>Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.hoursWorked}
                  onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  required
                />
              </div>
              <div>
                <Label>Hourly Rate *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>OT Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.overtimeHours}
                  onChange={(e) => setFormData({ ...formData, overtimeHours: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>
              <div>
                <Label>OT Rate (default 1.5x)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.overtimeRate}
                  onChange={(e) => setFormData({ ...formData, overtimeRate: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  placeholder="Auto: 1.5x base"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-dark-surface border-gray-600"
                placeholder="Work performed..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
