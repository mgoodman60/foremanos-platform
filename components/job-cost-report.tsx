"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  FileSpreadsheet, Download, Upload, Plus, Edit2, Trash2,
  ChevronDown, ChevronUp, Filter, Search, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  BUDGET_PHASES,
  groupBudgetItemsByPhase,
  formatCurrency,
  PhaseGroup
} from '@/lib/budget-phases';

interface BudgetItem {
  id: string;
  name: string;
  description?: string;
  costCode?: string;
  phaseCode?: number;
  phaseName?: string;
  categoryNumber?: number;
  budgetedAmount: number;
  revisedBudget?: number;
  contractAmount?: number;
  actualCost: number;
  committedCost: number;
  billedToDate: number;
  budgetedHours: number;
  actualHours: number;
}

interface ProjectSummary {
  contractAmount: number;
  changeOrdersAmount: number;
  revisedAmount: number;
  prevBilled: number;
  openAmount: number;
}

export default function JobCostReport() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [phaseGroups, setPhaseGroups] = useState<PhaseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  
  const [projectSummary, setProjectSummary] = useState<ProjectSummary>({
    contractAmount: 0,
    changeOrdersAmount: 0,
    revisedAmount: 0,
    prevBilled: 0,
    openAmount: 0
  });
  
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    phaseCode: 100,
    categoryNumber: 1,
    budgetedAmount: 0,
    contractAmount: 0,
    budgetedHours: 0
  });

  // Grand totals
  const [grandTotals, setGrandTotals] = useState({
    contractAmount: 0,
    billedToDate: 0,
    actualCost: 0,
    budgetedAmount: 0,
    actualHours: 0,
    budgetedHours: 0
  });

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${slug}/budget/job-cost`);
      if (!res.ok) throw new Error('Failed to fetch budget');
      const data = await res.json();
      
      setBudgetItems(data.items || []);
      setProjectSummary(data.summary || projectSummary);
      
      // Group items by phase
      const groups = groupBudgetItemsByPhase(data.items || []);
      setPhaseGroups(groups);
      
      // Calculate grand totals
      const totals = groups.reduce((acc, group) => ({
        contractAmount: acc.contractAmount + group.totals.contractAmount,
        billedToDate: acc.billedToDate + group.totals.billedToDate,
        actualCost: acc.actualCost + group.totals.actualCost,
        budgetedAmount: acc.budgetedAmount + group.totals.budgetedAmount,
        actualHours: acc.actualHours + group.totals.actualHours,
        budgetedHours: acc.budgetedHours + group.totals.budgetedHours
      }), { contractAmount: 0, billedToDate: 0, actualCost: 0, budgetedAmount: 0, actualHours: 0, budgetedHours: 0 });
      setGrandTotals(totals);
      
      // Expand all phases by default
      setExpandedPhases(new Set(groups.map(g => g.phaseCode)));
    } catch (error) {
      console.error('Error fetching budget:', error);
      toast.error('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, [slug]);

  const togglePhase = (phaseCode: number) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseCode)) {
      newExpanded.delete(phaseCode);
    } else {
      newExpanded.add(phaseCode);
    }
    setExpandedPhases(newExpanded);
  };

  const expandAll = () => {
    setExpandedPhases(new Set(phaseGroups.map(g => g.phaseCode)));
  };

  const collapseAll = () => {
    setExpandedPhases(new Set());
  };

  const handleAddItem = async () => {
    try {
      const phase = BUDGET_PHASES.find(p => p.code === newItem.phaseCode);
      const res = await fetch(`/api/projects/${slug}/budget/job-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          phaseName: phase?.name || 'UNCATEGORIZED'
        })
      });
      
      if (!res.ok) throw new Error('Failed to add item');
      
      toast.success('Budget item added');
      setShowAddModal(false);
      setNewItem({
        name: '',
        description: '',
        phaseCode: 100,
        categoryNumber: 1,
        budgetedAmount: 0,
        contractAmount: 0,
        budgetedHours: 0
      });
      fetchBudgetData();
    } catch (error) {
      toast.error('Failed to add budget item');
    }
  };

  const handleExportCSV = () => {
    // Build CSV content in Walker Company format
    const headers = ['Phase', 'Cat.', 'Description', 'Contract Amount', 'Billed To Date', 'Actual', 'Budget', 'Pct', 'Overrun', 'Act Hrs', 'Bud Hrs', 'Hrs Pct', 'Hrs Over'];
    const rows: string[][] = [headers];
    
    for (const group of phaseGroups) {
      // Add phase header
      rows.push([`Phase: ${group.phaseCode} - ${group.phaseName}`, '', '', '', '', '', '', '', '', '', '', '', '']);
      
      for (const item of group.items) {
        rows.push([
          '',
          item.categoryNumber.toString(),
          item.name,
          item.contractAmount.toString(),
          item.billedToDate.toString(),
          item.actualCost.toString(),
          item.budgetedAmount.toString(),
          `${item.percentage}%`,
          item.overrun.toString(),
          item.actualHours.toString(),
          item.budgetedHours.toString(),
          `${item.hoursPercentage}%`,
          item.hoursOverrun.toString()
        ]);
      }
      
      // Add phase totals
      rows.push([
        `Phase ${group.phaseCode} Totals`,
        '',
        '',
        group.totals.contractAmount.toString(),
        group.totals.billedToDate.toString(),
        group.totals.actualCost.toString(),
        group.totals.budgetedAmount.toString(),
        `${group.totals.percentage}%`,
        group.totals.overrun.toString(),
        group.totals.actualHours.toString(),
        group.totals.budgetedHours.toString(),
        `${group.totals.hoursPercentage}%`,
        group.totals.hoursOverrun.toString()
      ]);
      
      rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '']); // Empty row between phases
    }
    
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-cost-report-${slug}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  // Filter groups based on search and selected phase
  const filteredGroups = phaseGroups.filter(group => {
    if (selectedPhase !== 'all' && group.phaseCode.toString() !== selectedPhase) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return group.phaseName.toLowerCase().includes(searchLower) ||
             group.items.some(item => item.name.toLowerCase().includes(searchLower));
    }
    return true;
  });

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div className="bg-dark-card rounded-lg p-8 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-400" />
        <p className="mt-2 text-gray-400">Loading job cost data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Job Cost Category Totals Report</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1" /> Import
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-dark-card border-gray-700 text-white">
                <DialogHeader>
                  <DialogTitle>Import Budget from PDF</DialogTitle>
                </DialogHeader>
                <div className="p-4">
                  <p className="text-gray-400 text-sm mb-4">
                    Upload a Walker Company Job Cost Report PDF to auto-import budget items.
                  </p>
                  <Input
                    type="file"
                    accept=".pdf"
                    className="bg-dark-surface border-gray-600"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      try {
                        toast.loading('Processing PDF...');
                        const res = await fetch(`/api/projects/${slug}/budget/import-pdf`, {
                          method: 'POST',
                          body: formData
                        });
                        
                        toast.dismiss();
                        if (!res.ok) throw new Error('Failed to import');
                        
                        const data = await res.json();
                        toast.success(`Imported ${data.itemsCreated} budget items`);
                        setShowImportModal(false);
                        fetchBudgetData();
                      } catch (error) {
                        toast.dismiss();
                        toast.error('Failed to import PDF');
                      }
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-dark-card border-gray-700 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Budget Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 p-4">
                  <div>
                    <label className="text-sm text-gray-400">Phase</label>
                    <Select
                      value={newItem.phaseCode.toString()}
                      onValueChange={(v) => setNewItem({...newItem, phaseCode: parseInt(v)})}
                    >
                      <SelectTrigger className="bg-dark-surface border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-card border-gray-700">
                        {BUDGET_PHASES.map(phase => (
                          <SelectItem key={phase.code} value={phase.code.toString()}>
                            {phase.code} - {phase.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">Description</label>
                    <Input
                      value={newItem.name}
                      onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                      placeholder="e.g., Site Superintendent"
                      className="bg-dark-surface border-gray-600"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Category #</label>
                      <Input
                        type="number"
                        value={newItem.categoryNumber}
                        onChange={(e) => setNewItem({...newItem, categoryNumber: parseInt(e.target.value) || 1})}
                        className="bg-dark-surface border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Budget Amount</label>
                      <Input
                        type="number"
                        value={newItem.budgetedAmount}
                        onChange={(e) => setNewItem({...newItem, budgetedAmount: parseFloat(e.target.value) || 0})}
                        className="bg-dark-surface border-gray-600"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Contract Amount</label>
                      <Input
                        type="number"
                        value={newItem.contractAmount}
                        onChange={(e) => setNewItem({...newItem, contractAmount: parseFloat(e.target.value) || 0})}
                        className="bg-dark-surface border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Budgeted Hours</label>
                      <Input
                        type="number"
                        value={newItem.budgetedHours}
                        onChange={(e) => setNewItem({...newItem, budgetedHours: parseFloat(e.target.value) || 0})}
                        className="bg-dark-surface border-gray-600"
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleAddItem} className="w-full">
                    Add Budget Item
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Project Summary Header - Walker Company Style */}
        <div className="bg-dark-surface rounded-lg p-4 border border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Contract:</span>
              <span className="ml-2 font-semibold text-green-400">{formatCurrency(projectSummary.contractAmount)}</span>
            </div>
            <div>
              <span className="text-gray-400">Change Orders:</span>
              <span className="ml-2 font-semibold text-yellow-400">{formatCurrency(projectSummary.changeOrdersAmount)}</span>
            </div>
            <div>
              <span className="text-gray-400">Revised:</span>
              <span className="ml-2 font-semibold text-blue-400">{formatCurrency(projectSummary.revisedAmount)}</span>
            </div>
            <div>
              <span className="text-gray-400">Prev. Billed:</span>
              <span className="ml-2 font-semibold">{formatCurrency(projectSummary.prevBilled)}</span>
            </div>
            <div>
              <span className="text-gray-400">Open:</span>
              <span className="ml-2 font-semibold text-emerald-400">{formatCurrency(projectSummary.openAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-dark-card rounded-lg p-3 border border-gray-700">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 bg-dark-surface border-gray-600 h-8"
          />
        </div>
        <Select value={selectedPhase} onValueChange={setSelectedPhase}>
          <SelectTrigger className="w-48 bg-dark-surface border-gray-600 h-8">
            <SelectValue placeholder="All Phases" />
          </SelectTrigger>
          <SelectContent className="bg-dark-card border-gray-700">
            <SelectItem value="all">All Phases</SelectItem>
            {BUDGET_PHASES.map(phase => (
              <SelectItem key={phase.code} value={phase.code.toString()}>
                {phase.code} - {phase.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            <ChevronDown className="h-4 w-4 mr-1" /> Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            <ChevronUp className="h-4 w-4 mr-1" /> Collapse All
          </Button>
        </div>
      </div>

      {/* Table Header */}
      <div className="bg-dark-card rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-surface text-gray-300">
              <tr>
                <th className="text-left px-3 py-2 w-8">Cat.</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Contract</th>
                <th className="text-right px-3 py-2">Billed</th>
                <th className="text-right px-3 py-2 border-l border-gray-700" colSpan={4}>
                  <div className="text-center">Cost</div>
                  <div className="flex justify-between text-xs mt-1 font-normal text-gray-400">
                    <span className="w-20 text-right">Actual</span>
                    <span className="w-20 text-right">Budget</span>
                    <span className="w-12 text-right">Pct</span>
                    <span className="w-20 text-right">Overrun</span>
                  </div>
                </th>
                <th className="text-right px-3 py-2 border-l border-gray-700" colSpan={4}>
                  <div className="text-center">Hours</div>
                  <div className="flex justify-between text-xs mt-1 font-normal text-gray-400">
                    <span className="w-12 text-right">Act</span>
                    <span className="w-12 text-right">Bud</span>
                    <span className="w-12 text-right">Pct</span>
                    <span className="w-12 text-right">Over</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => (
                <React.Fragment key={group.phaseCode}>
                  {/* Phase Header Row */}
                  <tr
                    className="bg-[#262c34] cursor-pointer hover:bg-dark-card border-t border-gray-700"
                    onClick={() => togglePhase(group.phaseCode)}
                  >
                    <td colSpan={2} className="px-3 py-2 font-semibold text-blue-400">
                      <div className="flex items-center gap-2">
                        {expandedPhases.has(group.phaseCode) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                        Phase: {group.phaseCode} - {group.phaseName}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400"></td>
                    <td className="px-3 py-2 text-right text-gray-400"></td>
                    <td className="px-3 py-2 text-right text-gray-400 border-l border-gray-700" colSpan={4}></td>
                    <td className="px-3 py-2 text-right text-gray-400 border-l border-gray-700" colSpan={4}></td>
                  </tr>
                  
                  {/* Phase Items */}
                  {expandedPhases.has(group.phaseCode) && group.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#262c34] border-t border-gray-700/50">
                      <td className="px-3 py-1.5 text-gray-400">{item.categoryNumber}</td>
                      <td className="px-3 py-1.5">{item.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {item.contractAmount > 0 ? formatNumber(item.contractAmount) : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {item.billedToDate > 0 ? formatNumber(item.billedToDate) : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono border-l border-gray-700">
                        {item.actualCost > 0 ? formatNumber(item.actualCost) : '0'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {formatNumber(item.budgetedAmount)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-400">
                        {item.percentage}%
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono ${
                        item.overrun > 0 ? 'text-red-400' : item.overrun < 0 ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {formatNumber(item.overrun)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono border-l border-gray-700">
                        {item.actualHours > 0 ? formatNumber(item.actualHours) : '0'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {item.budgetedHours > 0 ? formatNumber(item.budgetedHours) : '0'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-400">
                        {item.hoursPercentage}%
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono ${
                        item.hoursOverrun > 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {formatNumber(item.hoursOverrun)}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Phase Totals Row */}
                  {expandedPhases.has(group.phaseCode) && (
                    <tr className="bg-dark-surface font-semibold border-t border-gray-600">
                      <td colSpan={2} className="px-3 py-2 text-right text-gray-300">
                        Phase {group.phaseCode} Totals
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatNumber(group.totals.contractAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatNumber(group.totals.billedToDate)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono border-l border-gray-700">
                        {formatNumber(group.totals.actualCost)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatNumber(group.totals.budgetedAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-400">
                        {group.totals.percentage}%
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${
                        group.totals.overrun > 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {formatNumber(group.totals.overrun)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono border-l border-gray-700">
                        {formatNumber(group.totals.actualHours)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatNumber(group.totals.budgetedHours)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-400">
                        {group.totals.hoursPercentage}%
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${
                        group.totals.hoursOverrun > 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {formatNumber(group.totals.hoursOverrun)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              
              {/* Grand Totals Row */}
              <tr className="bg-blue-900/30 font-bold text-blue-300 border-t-2 border-blue-600">
                <td colSpan={2} className="px-3 py-3 text-right">
                  Job Totals
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatNumber(grandTotals.contractAmount)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatNumber(grandTotals.billedToDate)}
                </td>
                <td className="px-3 py-3 text-right font-mono border-l border-blue-700">
                  {formatNumber(grandTotals.actualCost)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatNumber(grandTotals.budgetedAmount)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {grandTotals.budgetedAmount > 0 ? 
                    Math.round((grandTotals.actualCost / grandTotals.budgetedAmount) * 100) : 0}%
                </td>
                <td className={`px-3 py-3 text-right font-mono ${
                  grandTotals.actualCost - grandTotals.budgetedAmount > 0 ? 'text-red-400' : 'text-green-400'
                }`}>
                  {formatNumber(grandTotals.actualCost - grandTotals.budgetedAmount)}
                </td>
                <td className="px-3 py-3 text-right font-mono border-l border-blue-700">
                  {formatNumber(grandTotals.actualHours)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {formatNumber(grandTotals.budgetedHours)}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {grandTotals.budgetedHours > 0 ?
                    Math.round((grandTotals.actualHours / grandTotals.budgetedHours) * 100) : 0}%
                </td>
                <td className={`px-3 py-3 text-right font-mono ${
                  grandTotals.actualHours - grandTotals.budgetedHours > 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {formatNumber(grandTotals.actualHours - grandTotals.budgetedHours)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredGroups.length === 0 && (
        <div className="bg-dark-card rounded-lg p-8 text-center border border-gray-700">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-500 mb-3" />
          <p className="text-gray-400">No budget items found.</p>
          <p className="text-sm text-gray-500 mt-1">
            Add items manually or import from a Walker Company PDF.
          </p>
        </div>
      )}
    </div>
  );
}
