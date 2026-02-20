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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import {
  Flag, Calendar, Plus, Check, AlertTriangle,
  Clock, DollarSign, Edit, Trash2
} from 'lucide-react';

interface Milestone {
  id: string;
  name: string;
  description?: string;
  plannedDate: string;
  forecastDate?: string;
  actualDate?: string;
  status: string;
  category: string;
  isCritical: boolean;
  paymentLinked: boolean;
  paymentAmount?: number;
  linkedTaskIds: string[];
  notes?: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  UPCOMING: { color: 'bg-blue-600', icon: Calendar, label: 'Upcoming' },
  IN_PROGRESS: { color: 'bg-yellow-600', icon: Clock, label: 'In Progress' },
  COMPLETED: { color: 'bg-green-600', icon: Check, label: 'Completed' },
  AT_RISK: { color: 'bg-orange-600', icon: AlertTriangle, label: 'At Risk' },
  DELAYED: { color: 'bg-red-600', icon: AlertTriangle, label: 'Delayed' },
  MISSED: { color: 'bg-red-800', icon: AlertTriangle, label: 'Missed' }
};

const CATEGORIES = [
  { value: 'PROJECT', label: 'Project' },
  { value: 'PHASE', label: 'Phase' },
  { value: 'PERMIT', label: 'Permit/Inspection' },
  { value: 'SUBMITTAL', label: 'Submittal' },
  { value: 'PROCUREMENT', label: 'Procurement' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'REGULATORY', label: 'Regulatory' },
  { value: 'CLIENT', label: 'Client Review' },
  { value: 'SUBSTANTIAL_COMPLETION', label: 'Substantial Completion' },
  { value: 'FINAL_COMPLETION', label: 'Final Completion' }
];

export default function MilestoneTracker() {
  const params = useParams();
  const slug = params?.slug as string;

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const [form, setForm] = useState({
    name: '',
    description: '',
    plannedDate: '',
    category: 'PROJECT',
    isCritical: false,
    paymentLinked: false,
    paymentAmount: ''
  });

  const fetchMilestones = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/milestones`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMilestones(data.milestones || []);
      setStats(data.stats);
    } catch (err) {
      toast.error('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMilestones();
  }, [slug]);

  const handleSave = async () => {
    try {
      const url = editingMilestone
        ? `/api/projects/${slug}/milestones/${editingMilestone.id}`
        : `/api/projects/${slug}/milestones`;
      const method = editingMilestone ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          paymentAmount: form.paymentLinked ? parseFloat(form.paymentAmount) : null
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(editingMilestone ? 'Milestone updated' : 'Milestone created');
      setShowAddModal(false);
      setEditingMilestone(null);
      resetForm();
      fetchMilestones();
    } catch (err) {
      toast.error('Failed to save milestone');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this milestone?')) return;

    try {
      const res = await fetch(`/api/projects/${slug}/milestones/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Milestone deleted');
      fetchMilestones();
    } catch (err) {
      toast.error('Failed to delete milestone');
    }
  };

  const handleComplete = async (milestone: Milestone) => {
    try {
      const res = await fetch(`/api/projects/${slug}/milestones/${milestone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualDate: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Milestone marked complete');
      fetchMilestones();
    } catch (err) {
      toast.error('Failed to update milestone');
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      plannedDate: '',
      category: 'PROJECT',
      isCritical: false,
      paymentLinked: false,
      paymentAmount: ''
    });
  };

  const openEdit = (m: Milestone) => {
    setEditingMilestone(m);
    setForm({
      name: m.name,
      description: m.description || '',
      plannedDate: m.plannedDate.split('T')[0],
      category: m.category,
      isCritical: m.isCritical,
      paymentLinked: m.paymentLinked,
      paymentAmount: m.paymentAmount?.toString() || ''
    });
    setShowAddModal(true);
  };

  const filteredMilestones = milestones.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'critical') return m.isCritical;
    return m.status === filter;
  });

  const getVarianceDays = (m: Milestone) => {
    if (m.actualDate) {
      return differenceInDays(new Date(m.actualDate), new Date(m.plannedDate));
    }
    if (m.forecastDate) {
      return differenceInDays(new Date(m.forecastDate), new Date(m.plannedDate));
    }
    return 0;
  };

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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">Total</div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-sm text-gray-400">Completed</div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-2xl font-bold text-blue-400">{stats.upcoming}</div>
            <div className="text-sm text-gray-400">Upcoming</div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-2xl font-bold text-yellow-400">{stats.inProgress}</div>
            <div className="text-sm text-gray-400">In Progress</div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-2xl font-bold text-orange-400">{stats.atRisk}</div>
            <div className="text-sm text-gray-400">At Risk</div>
          </Card>
          <Card className="p-4 bg-dark-card border-gray-700">
            <div className="text-2xl font-bold text-red-400">{stats.delayed}</div>
            <div className="text-sm text-gray-400">Delayed</div>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => { resetForm(); setEditingMilestone(null); setShowAddModal(true); }}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Add Milestone
        </Button>
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 bg-dark-card border-gray-700">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Milestones</SelectItem>
            <SelectItem value="critical">Critical Only</SelectItem>
            <SelectItem value="UPCOMING">Upcoming</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="AT_RISK">At Risk</SelectItem>
            <SelectItem value="DELAYED">Delayed</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Milestone List */}
      <div className="space-y-3">
        {filteredMilestones.length === 0 ? (
          <Card className="p-8 bg-dark-card border-gray-700 text-center text-gray-400">
            <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
            <p>No milestones found</p>
          </Card>
        ) : (
          filteredMilestones.map(m => {
            const config = STATUS_CONFIG[m.status] || STATUS_CONFIG.UPCOMING;
            const StatusIcon = config.icon;
            const variance = getVarianceDays(m);

            return (
              <Card key={m.id} className="p-4 bg-dark-card border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <StatusIcon className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{m.name}</h3>
                        {m.isCritical && (
                          <Badge className="bg-red-600 text-white">Critical</Badge>
                        )}
                        {m.paymentLinked && (
                          <Badge className="bg-green-600 text-white">
                            <DollarSign className="h-3 w-3 mr-1" aria-hidden="true" />
                            ${m.paymentAmount?.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-sm text-gray-400 mt-1">{m.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-400">
                          <Calendar className="h-4 w-4 inline mr-1" aria-hidden="true" />
                          Planned: {format(new Date(m.plannedDate), 'MMM d, yyyy')}
                        </span>
                        {m.actualDate && (
                          <span className="text-green-400">
                            <Check className="h-4 w-4 inline mr-1" aria-hidden="true" />
                            Completed: {format(new Date(m.actualDate), 'MMM d, yyyy')}
                          </span>
                        )}
                        {variance !== 0 && !m.actualDate && (
                          <span className={variance > 0 ? 'text-red-400' : 'text-green-400'}>
                            {variance > 0 ? `${variance}d late` : `${Math.abs(variance)}d early`}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="mt-2">
                        {CATEGORIES.find(c => c.value === m.category)?.label || m.category}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {m.status !== 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-400 hover:text-green-300"
                        onClick={() => handleComplete(m)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-400 hover:text-blue-300"
                      onClick={() => openEdit(m)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(m.id)}
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
              {editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-dark-surface border-gray-600"
                placeholder="Milestone name"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-dark-surface border-gray-600"
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Planned Date *</Label>
                <Input
                  type="date"
                  value={form.plannedDate}
                  onChange={(e) => setForm({ ...form, plannedDate: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                />
              </div>

              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="bg-dark-surface border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={form.isCritical}
                  onCheckedChange={(v) => setForm({ ...form, isCritical: v as boolean })}
                />
                <Label className="font-normal">Critical Path</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={form.paymentLinked}
                  onCheckedChange={(v) => setForm({ ...form, paymentLinked: v as boolean })}
                />
                <Label className="font-normal">Payment Linked</Label>
              </div>
            </div>

            {form.paymentLinked && (
              <div>
                <Label>Payment Amount</Label>
                <Input
                  type="number"
                  value={form.paymentAmount}
                  onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
                  className="bg-dark-surface border-gray-600"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name || !form.plannedDate}>
              {editingMilestone ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
