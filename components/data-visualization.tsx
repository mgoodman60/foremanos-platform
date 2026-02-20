'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { chartColors, backgroundColors, neutralColors, textColors } from '@/lib/design-tokens';

interface DataVisualizationProps {
  type: 'bar' | 'line' | 'pie' | 'area' | 'table';
  data: any[];
  config?: {
    xKey?: string;
    yKeys?: string[];
    colors?: string[];
    title?: string;
    width?: number;
    height?: number;
  };
}

const DEFAULT_COLORS = chartColors.palette;

export function DataVisualization({ type, data, config = {} }: DataVisualizationProps) {
  const {
    xKey = 'name',
    yKeys = ['value'],
    colors = DEFAULT_COLORS,
    title,
    width: _width,
    height = 400,
  } = config;

  // Ensure data is valid
  const validData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    return data;
  }, [data]);

  if (validData.length === 0) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <p className="font-semibold">No data available</p>
        <p className="text-sm">The visualization data is empty or invalid.</p>
      </div>
    );
  }

  // Render table
  if (type === 'table') {
    const headers = Object.keys(validData[0]);
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-gray-700">
        {title && (
          <div className="bg-dark-card px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-lg text-slate-50">{title}</h3>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-dark-card">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-dark-surface divide-y divide-gray-700">
              {validData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-dark-card transition-colors">
                  {headers.map((header) => (
                    <td
                      key={`${rowIndex}-${header}`}
                      className="px-6 py-4 whitespace-nowrap text-sm text-slate-50"
                    >
                      {typeof row[header] === 'number'
                        ? row[header].toLocaleString()
                        : row[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Helper function to render the appropriate chart
  const renderChart = () => {
    const tooltipStyle = {
      backgroundColor: backgroundColors.dark.card,
      border: `1px solid ${neutralColors.gray[700]}`,
      borderRadius: '6px',
      color: textColors.dark.primary,
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart data={validData}>
            <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
            <XAxis dataKey={xKey} stroke={neutralColors.gray[400]} />
            <YAxis stroke={neutralColors.gray[400]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ color: textColors.dark.primary }} />
            {yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );
      
      case 'line':
        return (
          <LineChart data={validData}>
            <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
            <XAxis dataKey={xKey} stroke={neutralColors.gray[400]} />
            <YAxis stroke={neutralColors.gray[400]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ color: textColors.dark.primary }} />
            {yKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], r: 4 }}
              />
            ))}
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart data={validData}>
            <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
            <XAxis dataKey={xKey} stroke={neutralColors.gray[400]} />
            <YAxis stroke={neutralColors.gray[400]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ color: textColors.dark.primary }} />
            {yKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        );
      
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={validData}
              dataKey={yKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={({ name, percent }) =>
                `${name}: ${((percent || 0) * 100).toFixed(1)}%`
              }
              labelLine={{ stroke: neutralColors.gray[400] }}
            >
              {validData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ color: textColors.dark.primary }} />
          </PieChart>
        );
      
      default:
        // Default to bar chart if type is not recognized
        return (
          <BarChart data={validData}>
            <CartesianGrid strokeDasharray="3 3" stroke={neutralColors.gray[700]} />
            <XAxis dataKey={xKey} stroke={neutralColors.gray[400]} />
            <YAxis stroke={neutralColors.gray[400]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ color: textColors.dark.primary }} />
            {yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );
    }
  };

  // Render charts
  const chart = renderChart();
  
  return (
    <div className="my-6 p-4 bg-dark-card border border-gray-700 rounded-lg">
      {title && (
        <h3 className="font-semibold text-lg mb-4 text-slate-50">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
    </div>
  );
}
