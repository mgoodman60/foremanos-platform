"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  Download
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/budget-phases';

interface CostCodeItem {
  id: string;
  costCode: string;
  name: string;
  description?: string;
  budgetedAmount: number;
  actualCost: number;
  committedCost: number;
  forecastCost: number;
  variance: number;
  variancePercent: number;
  children?: CostCodeItem[];
  level: number;
}

interface CostCodeDrilldownProps {
  projectSlug: string;
  initialPhaseCode?: number;
  onItemClick?: (item: CostCodeItem) => void;
}

export default function CostCodeDrilldown({
  projectSlug,
  initialPhaseCode,
  onItemClick
}: CostCodeDrilldownProps) {
  const [data, setData] = useState<CostCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'variance' | 'budget'>('code');

  useEffect(() => {
    fetchCostCodes();
  }, [projectSlug, initialPhaseCode]);

  const fetchCostCodes = async () => {
    try {
      setLoading(true);
      const url = `/api/projects/${projectSlug}/budget/cost-codes${initialPhaseCode ? `?phase=${initialPhaseCode}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.costCodes || generateSampleData());
    } catch (error) {
      console.error('Error fetching cost codes:', error);
      setData(generateSampleData());
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = (): CostCodeItem[] => {
    return [
      {
        id: '1',
        costCode: '01',
        name: 'General Requirements',
        budgetedAmount: 150000,
        actualCost: 142000,
        committedCost: 148000,
        forecastCost: 155000,
        variance: -5000,
        variancePercent: -3.3,
        level: 0,
        children: [
          {
            id: '1-1',
            costCode: '01-100',
            name: 'Project Management',
            budgetedAmount: 50000,
            actualCost: 48000,
            committedCost: 50000,
            forecastCost: 52000,
            variance: -2000,
            variancePercent: -4,
            level: 1,
            children: [
              { id: '1-1-1', costCode: '01-100-10', name: 'Superintendent', budgetedAmount: 30000, actualCost: 29000, committedCost: 30000, forecastCost: 31000, variance: -1000, variancePercent: -3.3, level: 2 },
              { id: '1-1-2', costCode: '01-100-20', name: 'Project Manager', budgetedAmount: 20000, actualCost: 19000, committedCost: 20000, forecastCost: 21000, variance: -1000, variancePercent: -5, level: 2 }
            ]
          },
          {
            id: '1-2',
            costCode: '01-200',
            name: 'Site Facilities',
            budgetedAmount: 35000,
            actualCost: 32000,
            committedCost: 34000,
            forecastCost: 35000,
            variance: 0,
            variancePercent: 0,
            level: 1
          }
        ]
      },
      {
        id: '2',
        costCode: '03',
        name: 'Concrete',
        budgetedAmount: 450000,
        actualCost: 420000,
        committedCost: 445000,
        forecastCost: 460000,
        variance: -10000,
        variancePercent: -2.2,
        level: 0,
        children: [
          { id: '2-1', costCode: '03-100', name: 'Foundations', budgetedAmount: 200000, actualCost: 195000, committedCost: 200000, forecastCost: 205000, variance: -5000, variancePercent: -2.5, level: 1 },
          { id: '2-2', costCode: '03-200', name: 'Slabs on Grade', budgetedAmount: 150000, actualCost: 140000, committedCost: 148000, forecastCost: 155000, variance: -5000, variancePercent: -3.3, level: 1 },
          { id: '2-3', costCode: '03-300', name: 'Elevated Slabs', budgetedAmount: 100000, actualCost: 85000, committedCost: 97000, forecastCost: 100000, variance: 0, variancePercent: 0, level: 1 }
        ]
      },
      {
        id: '3',
        costCode: '26',
        name: 'Electrical',
        budgetedAmount: 380000,
        actualCost: 350000,
        committedCost: 375000,
        forecastCost: 370000,
        variance: 10000,
        variancePercent: 2.6,
        level: 0
      }
    ];
  };

  const toggleExpand = (code: string) => {
    const newExpanded = new Set(expandedCodes);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedCodes(newExpanded);
  };

  const expandAll = () => {
    const allCodes = new Set<string>();
    const collectCodes = (items: CostCodeItem[]) => {
      items.forEach(item => {
        allCodes.add(item.costCode);
        if (item.children) collectCodes(item.children);
      });
    };
    collectCodes(data);
    setExpandedCodes(allCodes);
  };

  const collapseAll = () => {
    setExpandedCodes(new Set());
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-500';
    if (variance < 0) return 'text-red-500';
    return 'text-gray-400';
  };

  const filterData = (items: CostCodeItem[]): CostCodeItem[] => {
    if (!searchTerm) return items;
    
    return items.filter(item => {
      const matches = 
        item.costCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (item.children) {
        const filteredChildren = filterData(item.children);
        if (filteredChildren.length > 0) {
          return true;
        }
      }
      
      return matches;
    }).map(item => ({
      ...item,
      children: item.children ? filterData(item.children) : undefined
    }));
  };

  const renderCostCodeRow = (item: CostCodeItem) => {
    const isExpanded = expandedCodes.has(item.costCode);
    const hasChildren = item.children && item.children.length > 0;
    const progressPercent = item.budgetedAmount > 0 
      ? Math.min(100, (item.actualCost / item.budgetedAmount) * 100)
      : 0;

    return (
      <React.Fragment key={item.id}>
        <div
          className={cn(
            'grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 items-center py-3 px-4 border-b border-gray-700 hover:bg-gray-800/50 transition-colors cursor-pointer',
            item.level === 0 && 'bg-gray-800/30 font-medium',
            item.level === 1 && 'bg-gray-800/10',
          )}
          style={{ paddingLeft: `${(item.level * 24) + 16}px` }}
          onClick={() => onItemClick?.(item)}
        >
          {/* Cost Code & Name */}
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(item.costCode);
                }}
                className="p-0.5 hover:bg-gray-700 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="text-xs font-mono text-gray-500 w-20">{item.costCode}</span>
            <span className="text-sm text-gray-200 truncate">{item.name}</span>
          </div>

          {/* Budget */}
          <div className="text-right">
            <span className="text-sm text-gray-300">{formatCurrency(item.budgetedAmount)}</span>
          </div>

          {/* Actual */}
          <div className="text-right">
            <span className="text-sm text-gray-300">{formatCurrency(item.actualCost)}</span>
          </div>

          {/* Committed */}
          <div className="text-right">
            <span className="text-sm text-gray-400">{formatCurrency(item.committedCost)}</span>
          </div>

          {/* Variance */}
          <div className="text-right flex items-center justify-end gap-1">
            {getVarianceIcon(item.variance)}
            <span className={cn('text-sm', getVarianceColor(item.variance))}>
              {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
            </span>
            <span className={cn('text-xs', getVarianceColor(item.variance))}>
              ({item.variancePercent >= 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-24">
            <Progress 
              value={progressPercent} 
              className={cn(
                'h-2',
                progressPercent > 100 ? '[&>div]:bg-red-500' : 
                progressPercent > 90 ? '[&>div]:bg-yellow-500' : 
                '[&>div]:bg-green-500'
              )}
            />
            <span className="text-xs text-gray-500 mt-0.5 block text-center">
              {progressPercent.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Render children if expanded */}
        {isExpanded && hasChildren && item.children!.map(child => renderCostCodeRow(child))}
      </React.Fragment>
    );
  };

  const filteredData = filterData(data);

  // Calculate totals
  const totals = data.reduce((acc, item) => ({
    budget: acc.budget + item.budgetedAmount,
    actual: acc.actual + item.actualCost,
    committed: acc.committed + item.committedCost,
    variance: acc.variance + item.variance
  }), { budget: 0, actual: 0, committed: 0, variance: 0 });

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-700 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-card border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-400" />
          Cost Code Drill-Down
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search cost codes..."
              className="pl-9 w-48 h-8 text-sm bg-gray-700 border-gray-600"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="border-gray-600 text-gray-300"
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="border-gray-600 text-gray-300"
          >
            Collapse
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 py-2 px-4 bg-dark-surface border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase">
        <div>Cost Code / Description</div>
        <div className="text-right">Budget</div>
        <div className="text-right">Actual</div>
        <div className="text-right">Committed</div>
        <div className="text-right">Variance</div>
        <div className="text-center">% Used</div>
      </div>

      {/* Data Rows */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredData.map(item => renderCostCodeRow(item))}
      </div>

      {/* Totals Row */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 py-3 px-4 bg-dark-surface border-t border-gray-700 font-semibold">
        <div className="text-gray-200">TOTAL</div>
        <div className="text-right text-gray-200">{formatCurrency(totals.budget)}</div>
        <div className="text-right text-gray-200">{formatCurrency(totals.actual)}</div>
        <div className="text-right text-gray-400">{formatCurrency(totals.committed)}</div>
        <div className={cn('text-right', getVarianceColor(totals.variance))}>
          {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
        </div>
        <div className="text-center text-gray-400">
          {totals.budget > 0 ? ((totals.actual / totals.budget) * 100).toFixed(0) : 0}%
        </div>
      </div>
    </Card>
  );
}
