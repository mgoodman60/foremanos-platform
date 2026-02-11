/**
 * Chart Theme Utilities
 *
 * Provides consistent styling for Recharts components across the application.
 * Uses design tokens for color consistency and supports dark/light mode theming.
 *
 * @see lib/design-tokens.ts for color palette reference
 */

import {
  backgroundColors,
  neutralColors,
  semanticColors,
  textColors,
  borderColors,
  chartColors,
} from './design-tokens';

/**
 * Chart theme configuration for Recharts components
 */
export interface ChartTheme {
  grid: {
    stroke: string;
    strokeDasharray: string;
  };
  axis: {
    stroke: string;
    tick: {
      fill: string;
      fontSize: number;
    };
  };
  tooltip: {
    contentStyle: {
      backgroundColor: string;
      border: string;
      borderRadius: string;
      boxShadow?: string;
    };
    labelStyle: {
      color: string;
      fontWeight?: number;
    };
  };
  legend: {
    wrapperStyle: {
      color: string;
      fontSize?: number;
    };
  };
}

/**
 * Creates a Recharts theme configuration for dark or light mode
 *
 * @param isDark - Whether to use dark mode theme (default: true)
 * @returns Chart theme configuration object
 *
 * @example
 * ```tsx
 * const theme = createChartTheme(true);
 *
 * <LineChart data={data}>
 *   <CartesianGrid {...theme.grid} />
 *   <XAxis {...theme.axis} />
 *   <YAxis {...theme.axis} />
 *   <Tooltip {...theme.tooltip} />
 *   <Legend {...theme.legend} />
 * </LineChart>
 * ```
 */
export const createChartTheme = (isDark = true): ChartTheme => ({
  grid: {
    stroke: isDark ? neutralColors.gray[700] : neutralColors.gray[200],
    strokeDasharray: '3 3',
  },
  axis: {
    stroke: isDark ? neutralColors.gray[600] : neutralColors.gray[400],
    tick: {
      fill: isDark ? neutralColors.gray[400] : neutralColors.gray[600],
      fontSize: 12,
    },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: isDark ? backgroundColors.dark.card : backgroundColors.light.base,
      border: `1px solid ${isDark ? borderColors.dark.subtle : borderColors.light.medium}`,
      borderRadius: '8px',
      boxShadow: isDark
        ? '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)'
        : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    },
    labelStyle: {
      color: isDark ? textColors.dark.primary : textColors.light.primary,
      fontWeight: 500,
    },
  },
  legend: {
    wrapperStyle: {
      color: isDark ? textColors.dark.secondary : textColors.light.secondary,
      fontSize: 12,
    },
  },
});

/**
 * Status indicator colors with main color and background tint
 */
export interface StatusColorResult {
  main: string;
  bg: string;
  border: string;
}

/**
 * Get color coding for performance indicators (CPI/SPI) or status values
 *
 * @param value - Performance index value (typically 0-2, where 1.0 = on target)
 * @returns Object with main color, background tint, and border color
 *
 * @example
 * ```tsx
 * const cpi = 0.95;
 * const colors = getStatusColor(cpi);
 *
 * <div style={{
 *   color: colors.main,
 *   backgroundColor: colors.bg,
 *   border: `1px solid ${colors.border}`
 * }}>
 *   CPI: {cpi.toFixed(2)}
 * </div>
 * ```
 */
export const getStatusColor = (value: number): StatusColorResult => {
  // Green: >= 1.0 (on target or better)
  if (value >= 1.0) {
    return {
      main: semanticColors.success[500],
      bg: `${semanticColors.success[500]}1A`, // 10% opacity
      border: semanticColors.success[600],
    };
  }

  // Amber: 0.9-0.99 (at risk, needs monitoring)
  if (value >= 0.9) {
    return {
      main: semanticColors.warning[500],
      bg: `${semanticColors.warning[500]}1A`,
      border: semanticColors.warning[600],
    };
  }

  // Red: < 0.9 (critical, action required)
  return {
    main: semanticColors.error[500],
    bg: `${semanticColors.error[500]}1A`,
    border: semanticColors.error[600],
  };
};

/**
 * Get percentage-based status color (for completion percentages)
 *
 * @param percentage - Completion percentage (0-100)
 * @param target - Target percentage to compare against (default: 100)
 * @returns Status color result
 *
 * @example
 * ```tsx
 * const complete = 75;
 * const colors = getPercentageStatusColor(complete, 80);
 * // Returns warning color since 75 < 80
 * ```
 */
export const getPercentageStatusColor = (
  percentage: number,
  target = 100
): StatusColorResult => {
  const ratio = percentage / target;
  return getStatusColor(ratio);
};

/**
 * Get variance status color (positive = good, negative = bad)
 *
 * @param variance - Variance value (positive or negative)
 * @returns Status color result
 *
 * @example
 * ```tsx
 * const costVariance = -5000; // Over budget
 * const colors = getVarianceStatusColor(costVariance);
 * // Returns error color for negative variance
 * ```
 */
export const getVarianceStatusColor = (variance: number): StatusColorResult => {
  if (variance >= 0) {
    return {
      main: semanticColors.success[500],
      bg: `${semanticColors.success[500]}1A`,
      border: semanticColors.success[600],
    };
  }

  // For negative variance, determine severity
  return {
    main: semanticColors.error[500],
    bg: `${semanticColors.error[500]}1A`,
    border: semanticColors.error[600],
  };
};

/**
 * Earned Value Management (EVM) color constants
 * Standardized colors for PV, EV, AC lines in S-curves
 */
export const evmColors = {
  plannedValue: chartColors.neutral,    // Blue - Planned Value (PV/BCWS)
  earnedValue: chartColors.positive,    // Green - Earned Value (EV/BCWP)
  actualCost: chartColors.warning,      // Amber - Actual Cost (AC/ACWP)
  budgetLine: chartColors.palette[4],    // Purple - Budget at Completion (BAC)
  forecastLine: chartColors.negative,   // Red - Estimate at Completion (EAC)
} as const;

/**
 * Default dark theme (most common use case)
 */
export const darkChartTheme = createChartTheme(true);

/**
 * Default light theme
 */
export const lightChartTheme = createChartTheme(false);

/**
 * Chart color palette utilities
 */
export const chartThemeHelpers = {
  /**
   * Get chart color by index (cycles through palette)
   */
  getChartColor: (index: number): string => {
    return chartColors.palette[index % chartColors.palette.length];
  },

  /**
   * Get trade-specific color for MEP systems
   */
  getTradeColor: (trade: keyof typeof chartColors.trades): string => {
    return chartColors.trades[trade];
  },

  /**
   * Format currency for chart labels and tooltips
   */
  formatCurrency: (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  },

  /**
   * Format percentage for chart labels
   */
  formatPercentage: (value: number, decimals = 1): string => {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Get responsive font sizes for different chart sizes
   */
  getResponsiveFontSizes: (chartWidth: number) => ({
    tick: chartWidth < 400 ? 10 : chartWidth < 600 ? 11 : 12,
    label: chartWidth < 400 ? 11 : chartWidth < 600 ? 12 : 13,
    legend: chartWidth < 400 ? 11 : 12,
    tooltip: chartWidth < 400 ? 12 : 13,
  }),
} as const;

/**
 * Common chart configuration presets
 */
export const chartPresets = {
  /**
   * S-Curve chart preset (for time-phased budget tracking)
   */
  sCurve: {
    lines: {
      plannedValue: {
        stroke: evmColors.plannedValue,
        strokeWidth: 2,
        strokeDasharray: '4 2',
        dot: false,
      },
      earnedValue: {
        stroke: evmColors.earnedValue,
        strokeWidth: 2.5,
        dot: false,
      },
      actualCost: {
        stroke: evmColors.actualCost,
        strokeWidth: 2,
        dot: false,
      },
    },
    budgetLine: {
      stroke: evmColors.budgetLine,
      strokeWidth: 2,
      strokeDasharray: '8 4',
    },
  },

  /**
   * Bar chart preset (for cost comparisons)
   */
  barChart: {
    bar: {
      radius: [4, 4, 0, 0], // Rounded top corners
      opacity: 0.9,
    },
  },

  /**
   * Pie chart preset (for category breakdowns)
   */
  pieChart: {
    innerRadius: 60,
    outerRadius: 100,
    paddingAngle: 2,
  },
} as const;

/**
 * Type exports for TypeScript usage
 */
export type EVMColorKey = keyof typeof evmColors;
export type ChartPresetType = keyof typeof chartPresets;

/**
 * Usage Examples:
 *
 * ```typescript
 * import { darkChartTheme, evmColors, getStatusColor, chartThemeHelpers } from '@/lib/chart-theme';
 *
 * // Apply theme to Recharts component
 * <LineChart data={data}>
 *   <CartesianGrid {...darkChartTheme.grid} />
 *   <XAxis {...darkChartTheme.axis} />
 *   <Tooltip {...darkChartTheme.tooltip} />
 * </LineChart>
 *
 * // Use EVM colors for S-curve lines
 * <Line dataKey="plannedValue" stroke={evmColors.plannedValue} />
 * <Line dataKey="earnedValue" stroke={evmColors.earnedValue} />
 *
 * // Get status-based colors for CPI/SPI indicators
 * const cpi = 0.95;
 * const statusColors = getStatusColor(cpi);
 * <Badge style={{ backgroundColor: statusColors.bg, color: statusColors.main }}>
 *   CPI: {cpi.toFixed(2)}
 * </Badge>
 *
 * // Format currency for tooltips
 * const formatted = chartThemeHelpers.formatCurrency(1234567);
 * // Returns: "$1.2M"
 * ```
 */
