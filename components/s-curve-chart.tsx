"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts';
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { neutralColors, backgroundColors, borderColors, chartColors } from '@/lib/design-tokens';

interface CurvePoint {
  date: string;
  week: number;
  plannedValue: number;
  earnedValue: number | null;
  actualCost: number | null;
  percentComplete?: number;
}

interface SCurveData {
  hasHistoricalData: boolean;
  totalBudget: number;
  curve: CurvePoint[];
  currentWeek?: number;
}

export default function SCurveChart() {
  const params = useParams();
  const slug = params?.slug as string;

  const [data, setData] = useState<SCurveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) fetchSCurveData();
  }, [slug]);

  const fetchSCurveData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/budget/s-curve`);
      if (res.ok) {
        const curveData = await res.json();
        setData(curveData);
      } else if (res.status === 404) {
        setData(null);
      }
    } catch (error) {
      console.error('Error fetching S-curve data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-surface border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-gray-400 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-8 text-center text-gray-400">
          Budget not configured. Set up your budget to see the S-Curve.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-card border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Time-Phased Budget (S-Curve)
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchSCurveData}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {!data.hasHistoricalData && (
          <p className="text-sm text-yellow-400 mt-1">
            Showing projected curve. Add budget snapshots for actual tracking.
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data.curve}>
            <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
            <XAxis
              dataKey="date"
              stroke={neutralColors.gray[400]}
              tick={{ fill: neutralColors.gray[400], fontSize: 11 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              stroke={neutralColors.gray[400]}
              tick={{ fill: neutralColors.gray[400], fontSize: 11 }}
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="plannedValue"
              name="Planned Value (PV)"
              stroke={chartColors.neutral}
              strokeWidth={2}
              dot={false}
            />
            {data.hasHistoricalData && (
              <>
                <Line
                  type="monotone"
                  dataKey="earnedValue"
                  name="Earned Value (EV)"
                  stroke={chartColors.positive}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actualCost"
                  name="Actual Cost (AC)"
                  stroke={chartColors.negative}
                  strokeWidth={2}
                  dot={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend explanation */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-400">PV: Budgeted cost for work scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-400">EV: Budgeted cost for work performed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-400">AC: Actual cost incurred</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
