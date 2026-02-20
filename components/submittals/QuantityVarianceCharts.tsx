'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Package,
} from 'lucide-react';
import { semanticColors, neutralColors, chartColors } from '@/lib/design-tokens';

interface LineItem {
  id: string;
  productName: string;
  submittedQty: number;
  requiredQty?: number;
  unit: string;
  complianceStatus: string;
  varianceQty?: number;
  tradeCategory?: string;
}

interface QuantityVarianceChartsProps {
  lineItems: LineItem[];
  compact?: boolean;
}

const COLORS = {
  SUFFICIENT: semanticColors.success[500],
  INSUFFICIENT: semanticColors.error[500],
  EXCESS: semanticColors.warning[500],
  NO_REQUIREMENT: neutralColors.gray[500],
  UNVERIFIED: neutralColors.slate[600],
};

const STATUS_LABELS: Record<string, string> = {
  SUFFICIENT: 'Sufficient',
  INSUFFICIENT: 'Shortage',
  EXCESS: 'Excess',
  NO_REQUIREMENT: 'No Requirement',
  UNVERIFIED: 'Unverified',
};

const TRADE_LABELS: Record<string, string> = {
  doors: 'Doors & Frames',
  door_hardware: 'Door Hardware',
  windows: 'Windows',
  glazing: 'Glazing',
  finishes: 'Finishes',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  electrical: 'Electrical',
  fire_protection: 'Fire Protection',
  concrete: 'Concrete',
  masonry: 'Masonry',
  metals: 'Metals',
  roofing: 'Roofing',
  specialties: 'Specialties',
};

export default function QuantityVarianceCharts({ lineItems, compact = false }: QuantityVarianceChartsProps) {
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'variance'>('pie');

  // Calculate compliance distribution for pie chart
  const complianceDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    lineItems.forEach(item => {
      counts[item.complianceStatus] = (counts[item.complianceStatus] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: COLORS[status as keyof typeof COLORS] || neutralColors.slate[600],
    }));
  }, [lineItems]);

  // Calculate submitted vs required for bar chart
  const quantityComparison = useMemo(() => {
    return lineItems
      .filter(item => item.requiredQty !== null && item.requiredQty !== undefined)
      .slice(0, 10) // Top 10 items
      .map(item => ({
        name: item.productName.length > 15 
          ? item.productName.substring(0, 15) + '...' 
          : item.productName,
        submitted: item.submittedQty,
        required: item.requiredQty || 0,
        variance: item.varianceQty || 0,
        unit: item.unit,
        fullName: item.productName,
      }));
  }, [lineItems]);

  // Calculate variance data for line/area chart
  const varianceData = useMemo(() => {
    return lineItems
      .filter(item => item.varianceQty !== null && item.varianceQty !== undefined)
      .sort((a, b) => (a.varianceQty || 0) - (b.varianceQty || 0))
      .map((item, idx) => ({
        idx,
        name: item.productName.length > 12 
          ? item.productName.substring(0, 12) + '...' 
          : item.productName,
        variance: item.varianceQty || 0,
        fullName: item.productName,
        status: item.complianceStatus,
      }));
  }, [lineItems]);

  // Calculate by trade category
  const byCategory = useMemo(() => {
    const categories: Record<string, { sufficient: number; insufficient: number; excess: number; total: number }> = {};
    lineItems.forEach(item => {
      const cat = item.tradeCategory || 'other';
      if (!categories[cat]) {
        categories[cat] = { sufficient: 0, insufficient: 0, excess: 0, total: 0 };
      }
      categories[cat].total++;
      if (item.complianceStatus === 'SUFFICIENT') categories[cat].sufficient++;
      else if (item.complianceStatus === 'INSUFFICIENT') categories[cat].insufficient++;
      else if (item.complianceStatus === 'EXCESS') categories[cat].excess++;
    });
    return Object.entries(categories).map(([cat, counts]) => ({
      category: TRADE_LABELS[cat] || cat,
      ...counts,
    }));
  }, [lineItems]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-1">{data.fullName || label}</p>
          {payload.map((entry: any, idx: number) => (
            <p key={idx} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value} {data.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (lineItems.length === 0) {
    return (
      <div className="bg-slate-900 border-2 border-slate-600 rounded-xl p-8 text-center">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-500" aria-hidden="true" />
        <p className="text-slate-400">No line items to visualize</p>
        <p className="text-sm text-slate-500 mt-1">Add line items and run verification to see charts</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? '' : 'bg-slate-900 border-2 border-slate-600 rounded-xl p-4'}`}>
      {/* Chart Type Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" aria-hidden="true" />
          Quantity Analysis
        </h3>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1 text-sm transition-colors ${
              chartType === 'pie'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieChartIcon className="w-4 h-4" aria-hidden="true" />
            Status
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1 text-sm transition-colors ${
              chartType === 'bar'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            Comparison
          </button>
          <button
            onClick={() => setChartType('variance')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1 text-sm transition-colors ${
              chartType === 'variance'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            Variance
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className={`${compact ? 'h-64' : 'h-80'}`}>
        {chartType === 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={complianceDistribution}
                cx="50%"
                cy="50%"
                innerRadius={compact ? 40 : 60}
                outerRadius={compact ? 80 : 100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                labelLine={{ stroke: neutralColors.slate[500] }}
              >
                {complianceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke={neutralColors.slate[800]} strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
                        <p className="text-white font-medium">{data.name}</p>
                        <p className="text-sm" style={{ color: data.color }}>
                          {data.value} items
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ color: neutralColors.slate[400] }}
                formatter={(value) => <span className="text-slate-300">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={quantityComparison} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.slate[700]} />
              <XAxis
                dataKey="name"
                stroke={neutralColors.slate[400]}
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke={neutralColors.slate[400]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 20 }} />
              <Bar 
                dataKey="submitted"
                name="Submitted"
                fill={semanticColors.info[500]}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="required"
                name="Required"
                fill={chartColors.palette[4]} 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === 'variance' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={varianceData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.slate[700]} />
              <XAxis
                dataKey="name"
                stroke={neutralColors.slate[400]}
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke={neutralColors.slate[400]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
                        <p className="text-white font-medium mb-1">{data.fullName}</p>
                        <p className={`text-sm ${data.variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Variance: {data.variance > 0 ? '+' : ''}{data.variance}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{STATUS_LABELS[data.status]}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="variance"
                name="Variance"
                radius={[4, 4, 0, 0]}
              >
                {varianceData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.variance >= 0 ? semanticColors.success[500] : semanticColors.error[500]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category Breakdown */}
      {!compact && byCategory.length > 1 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" aria-hidden="true" />
            By Trade Category
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.slate[700]} />
                <XAxis type="number" stroke={neutralColors.slate[400]} />
                <YAxis
                  dataKey="category"
                  type="category"
                  stroke={neutralColors.slate[400]}
                  width={90}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
                          <p className="text-white font-medium mb-1">{label}</p>
                          {payload.map((entry: any, idx: number) => (
                            <p key={idx} style={{ color: entry.color }} className="text-sm">
                              {entry.name}: {entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="sufficient" name="Sufficient" stackId="a" fill={semanticColors.success[500]} />
                <Bar dataKey="insufficient" name="Shortage" stackId="a" fill={semanticColors.error[500]} />
                <Bar dataKey="excess" name="Excess" stackId="a" fill={semanticColors.warning[500]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
