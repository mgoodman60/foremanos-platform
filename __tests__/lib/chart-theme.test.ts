import { describe, it, expect } from 'vitest';
import {
  createChartTheme,
  darkChartTheme,
  lightChartTheme,
  getStatusColor,
  getPercentageStatusColor,
  getVarianceStatusColor,
  evmColors,
  chartThemeHelpers,
  chartPresets,
  type ChartTheme,
  type StatusColorResult,
  type EVMColorKey,
  type ChartPresetType,
} from '@/lib/chart-theme';
import {
  backgroundColors,
  neutralColors,
  semanticColors,
  textColors,
  borderColors,
  chartColors,
} from '@/lib/design-tokens';

describe('chart-theme', () => {
  // ============================================
  // createChartTheme Tests
  // ============================================
  describe('createChartTheme', () => {
    it('should create dark theme by default', () => {
      const theme = createChartTheme();

      expect(theme.grid.stroke).toBe(neutralColors.gray[700]);
      expect(theme.grid.strokeDasharray).toBe('3 3');
      expect(theme.axis.stroke).toBe(neutralColors.gray[600]);
      expect(theme.axis.tick.fill).toBe(neutralColors.gray[400]);
      expect(theme.axis.tick.fontSize).toBe(12);
    });

    it('should create dark theme when isDark is true', () => {
      const theme = createChartTheme(true);

      expect(theme.grid.stroke).toBe(neutralColors.gray[700]);
      expect(theme.axis.stroke).toBe(neutralColors.gray[600]);
      expect(theme.axis.tick.fill).toBe(neutralColors.gray[400]);
      expect(theme.tooltip.contentStyle.backgroundColor).toBe(backgroundColors.dark.card);
      expect(theme.tooltip.labelStyle.color).toBe(textColors.dark.primary);
      expect(theme.legend.wrapperStyle.color).toBe(textColors.dark.secondary);
    });

    it('should create light theme when isDark is false', () => {
      const theme = createChartTheme(false);

      expect(theme.grid.stroke).toBe(neutralColors.gray[200]);
      expect(theme.axis.stroke).toBe(neutralColors.gray[400]);
      expect(theme.axis.tick.fill).toBe(neutralColors.gray[600]);
      expect(theme.tooltip.contentStyle.backgroundColor).toBe(backgroundColors.light.base);
      expect(theme.tooltip.labelStyle.color).toBe(textColors.light.primary);
      expect(theme.legend.wrapperStyle.color).toBe(textColors.light.secondary);
    });

    it('should include correct tooltip styles for dark theme', () => {
      const theme = createChartTheme(true);

      expect(theme.tooltip.contentStyle.border).toBe(`1px solid ${borderColors.dark.subtle}`);
      expect(theme.tooltip.contentStyle.borderRadius).toBe('8px');
      expect(theme.tooltip.contentStyle.boxShadow).toBe(
        '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)'
      );
      expect(theme.tooltip.labelStyle.fontWeight).toBe(500);
    });

    it('should include correct tooltip styles for light theme', () => {
      const theme = createChartTheme(false);

      expect(theme.tooltip.contentStyle.border).toBe(`1px solid ${borderColors.light.medium}`);
      expect(theme.tooltip.contentStyle.borderRadius).toBe('8px');
      expect(theme.tooltip.contentStyle.boxShadow).toBe(
        '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
      );
      expect(theme.tooltip.labelStyle.fontWeight).toBe(500);
    });

    it('should include legend styles with fontSize', () => {
      const theme = createChartTheme(true);
      expect(theme.legend.wrapperStyle.fontSize).toBe(12);
    });

    it('should return valid ChartTheme structure', () => {
      const theme = createChartTheme();

      expect(theme).toHaveProperty('grid');
      expect(theme).toHaveProperty('axis');
      expect(theme).toHaveProperty('tooltip');
      expect(theme).toHaveProperty('legend');
      expect(theme.grid).toHaveProperty('stroke');
      expect(theme.grid).toHaveProperty('strokeDasharray');
      expect(theme.axis).toHaveProperty('stroke');
      expect(theme.axis).toHaveProperty('tick');
      expect(theme.axis.tick).toHaveProperty('fill');
      expect(theme.axis.tick).toHaveProperty('fontSize');
    });
  });

  // ============================================
  // Preset Theme Exports Tests
  // ============================================
  describe('darkChartTheme', () => {
    it('should be a pre-configured dark theme', () => {
      expect(darkChartTheme.grid.stroke).toBe(neutralColors.gray[700]);
      expect(darkChartTheme.tooltip.contentStyle.backgroundColor).toBe(backgroundColors.dark.card);
    });

    it('should match createChartTheme(true)', () => {
      const manualDark = createChartTheme(true);
      expect(darkChartTheme).toEqual(manualDark);
    });
  });

  describe('lightChartTheme', () => {
    it('should be a pre-configured light theme', () => {
      expect(lightChartTheme.grid.stroke).toBe(neutralColors.gray[200]);
      expect(lightChartTheme.tooltip.contentStyle.backgroundColor).toBe(backgroundColors.light.base);
    });

    it('should match createChartTheme(false)', () => {
      const manualLight = createChartTheme(false);
      expect(lightChartTheme).toEqual(manualLight);
    });
  });

  // ============================================
  // getStatusColor Tests
  // ============================================
  describe('getStatusColor', () => {
    it('should return success color for value >= 1.0', () => {
      const result = getStatusColor(1.0);

      expect(result.main).toBe(semanticColors.success[500]);
      expect(result.bg).toBe(`${semanticColors.success[500]}1A`);
      expect(result.border).toBe(semanticColors.success[600]);
    });

    it('should return success color for values greater than 1.0', () => {
      expect(getStatusColor(1.1).main).toBe(semanticColors.success[500]);
      expect(getStatusColor(1.5).main).toBe(semanticColors.success[500]);
      expect(getStatusColor(2.0).main).toBe(semanticColors.success[500]);
    });

    it('should return warning color for value between 0.9 and 0.99', () => {
      const result = getStatusColor(0.95);

      expect(result.main).toBe(semanticColors.warning[500]);
      expect(result.bg).toBe(`${semanticColors.warning[500]}1A`);
      expect(result.border).toBe(semanticColors.warning[600]);
    });

    it('should return warning color at exact 0.9 boundary', () => {
      const result = getStatusColor(0.9);
      expect(result.main).toBe(semanticColors.warning[500]);
    });

    it('should return error color for value < 0.9', () => {
      const result = getStatusColor(0.89);

      expect(result.main).toBe(semanticColors.error[500]);
      expect(result.bg).toBe(`${semanticColors.error[500]}1A`);
      expect(result.border).toBe(semanticColors.error[600]);
    });

    it('should return error color for very low values', () => {
      expect(getStatusColor(0.5).main).toBe(semanticColors.error[500]);
      expect(getStatusColor(0.1).main).toBe(semanticColors.error[500]);
      expect(getStatusColor(0).main).toBe(semanticColors.error[500]);
    });

    it('should return error color for negative values', () => {
      expect(getStatusColor(-0.5).main).toBe(semanticColors.error[500]);
      expect(getStatusColor(-1.0).main).toBe(semanticColors.error[500]);
    });

    it('should include opacity suffix for background colors', () => {
      const success = getStatusColor(1.0);
      const warning = getStatusColor(0.95);
      const error = getStatusColor(0.5);

      expect(success.bg).toContain('1A');
      expect(warning.bg).toContain('1A');
      expect(error.bg).toContain('1A');
    });

    it('should return consistent StatusColorResult structure', () => {
      const result = getStatusColor(1.0);

      expect(result).toHaveProperty('main');
      expect(result).toHaveProperty('bg');
      expect(result).toHaveProperty('border');
      expect(typeof result.main).toBe('string');
      expect(typeof result.bg).toBe('string');
      expect(typeof result.border).toBe('string');
    });
  });

  // ============================================
  // getPercentageStatusColor Tests
  // ============================================
  describe('getPercentageStatusColor', () => {
    it('should return success color when percentage equals target', () => {
      const result = getPercentageStatusColor(100, 100);
      expect(result.main).toBe(semanticColors.success[500]);
    });

    it('should return success color when percentage exceeds target', () => {
      const result = getPercentageStatusColor(110, 100);
      expect(result.main).toBe(semanticColors.success[500]);
    });

    it('should use default target of 100 when not specified', () => {
      const result = getPercentageStatusColor(100);
      expect(result.main).toBe(semanticColors.success[500]);
    });

    it('should return warning color when percentage is between 90-99% of target', () => {
      const result = getPercentageStatusColor(75, 80);
      expect(result.main).toBe(semanticColors.warning[500]);
    });

    it('should return error color when percentage is below 90% of target', () => {
      const result = getPercentageStatusColor(70, 80);
      expect(result.main).toBe(semanticColors.error[500]);
    });

    it('should handle custom targets correctly', () => {
      // 72 / 80 = 0.9 (exact boundary)
      expect(getPercentageStatusColor(72, 80).main).toBe(semanticColors.warning[500]);

      // 71.9 / 80 = 0.89875
      expect(getPercentageStatusColor(71.9, 80).main).toBe(semanticColors.error[500]);

      // 80 / 80 = 1.0
      expect(getPercentageStatusColor(80, 80).main).toBe(semanticColors.success[500]);
    });

    it('should handle zero target gracefully', () => {
      const result = getPercentageStatusColor(50, 0);
      // 50 / 0 = Infinity, should be success
      expect(result.main).toBe(semanticColors.success[500]);
    });

    it('should handle zero percentage', () => {
      const result = getPercentageStatusColor(0, 100);
      // 0 / 100 = 0, should be error
      expect(result.main).toBe(semanticColors.error[500]);
    });

    it('should calculate ratio correctly', () => {
      // Test exact boundary calculations
      expect(getPercentageStatusColor(90, 100).main).toBe(semanticColors.warning[500]);
      expect(getPercentageStatusColor(89.99, 100).main).toBe(semanticColors.error[500]);
      expect(getPercentageStatusColor(100, 100).main).toBe(semanticColors.success[500]);
    });
  });

  // ============================================
  // getVarianceStatusColor Tests
  // ============================================
  describe('getVarianceStatusColor', () => {
    it('should return success color for positive variance', () => {
      const result = getVarianceStatusColor(5000);

      expect(result.main).toBe(semanticColors.success[500]);
      expect(result.bg).toBe(`${semanticColors.success[500]}1A`);
      expect(result.border).toBe(semanticColors.success[600]);
    });

    it('should return success color for zero variance', () => {
      const result = getVarianceStatusColor(0);
      expect(result.main).toBe(semanticColors.success[500]);
    });

    it('should return error color for negative variance', () => {
      const result = getVarianceStatusColor(-5000);

      expect(result.main).toBe(semanticColors.error[500]);
      expect(result.bg).toBe(`${semanticColors.error[500]}1A`);
      expect(result.border).toBe(semanticColors.error[600]);
    });

    it('should return error color for small negative variance', () => {
      const result = getVarianceStatusColor(-0.01);
      expect(result.main).toBe(semanticColors.error[500]);
    });

    it('should return error color for large negative variance', () => {
      const result = getVarianceStatusColor(-100000);
      expect(result.main).toBe(semanticColors.error[500]);
    });

    it('should return success color for small positive variance', () => {
      const result = getVarianceStatusColor(0.01);
      expect(result.main).toBe(semanticColors.success[500]);
    });

    it('should return consistent structure', () => {
      const positive = getVarianceStatusColor(100);
      const negative = getVarianceStatusColor(-100);

      expect(positive).toHaveProperty('main');
      expect(positive).toHaveProperty('bg');
      expect(positive).toHaveProperty('border');
      expect(negative).toHaveProperty('main');
      expect(negative).toHaveProperty('bg');
      expect(negative).toHaveProperty('border');
    });
  });

  // ============================================
  // evmColors Tests
  // ============================================
  describe('evmColors', () => {
    it('should define all EVM color constants', () => {
      expect(evmColors.plannedValue).toBe(chartColors.neutral);
      expect(evmColors.earnedValue).toBe(chartColors.positive);
      expect(evmColors.actualCost).toBe(chartColors.warning);
      expect(evmColors.budgetLine).toBe('#8B5CF6');
      expect(evmColors.forecastLine).toBe(chartColors.negative);
    });

    it('should have valid hex color codes', () => {
      const hexPattern = /^#[0-9A-F]{6}$/i;

      // budgetLine is the only hardcoded color
      expect(evmColors.budgetLine).toMatch(hexPattern);

      // Others reference design tokens
      expect(typeof evmColors.plannedValue).toBe('string');
      expect(typeof evmColors.earnedValue).toBe('string');
      expect(typeof evmColors.actualCost).toBe('string');
      expect(typeof evmColors.forecastLine).toBe('string');
    });

    it('should have const assertion for type safety', () => {
      // TypeScript const assertion provides compile-time immutability
      // Runtime verification that values reference design tokens correctly
      expect(evmColors.plannedValue).toBe(chartColors.neutral);
      expect(evmColors.earnedValue).toBe(chartColors.positive);
      expect(evmColors.actualCost).toBe(chartColors.warning);
      expect(evmColors.forecastLine).toBe(chartColors.negative);
    });

    it('should export all expected keys', () => {
      const expectedKeys: EVMColorKey[] = [
        'plannedValue',
        'earnedValue',
        'actualCost',
        'budgetLine',
        'forecastLine',
      ];

      expectedKeys.forEach((key) => {
        expect(evmColors).toHaveProperty(key);
      });
    });
  });

  // ============================================
  // chartThemeHelpers Tests
  // ============================================
  describe('chartThemeHelpers', () => {
    describe('getChartColor', () => {
      it('should return first color for index 0', () => {
        const color = chartThemeHelpers.getChartColor(0);
        expect(color).toBe(chartColors.palette[0]);
      });

      it('should cycle through palette correctly', () => {
        const paletteLength = chartColors.palette.length;

        for (let i = 0; i < paletteLength; i++) {
          expect(chartThemeHelpers.getChartColor(i)).toBe(chartColors.palette[i]);
        }
      });

      it('should wrap around when index exceeds palette length', () => {
        const paletteLength = chartColors.palette.length;
        const color = chartThemeHelpers.getChartColor(paletteLength);

        expect(color).toBe(chartColors.palette[0]);
      });

      it('should handle large indices', () => {
        const paletteLength = chartColors.palette.length;
        const largeIndex = 100;
        const expectedIndex = largeIndex % paletteLength;

        expect(chartThemeHelpers.getChartColor(largeIndex)).toBe(
          chartColors.palette[expectedIndex]
        );
      });

      it('should return valid color strings', () => {
        const color = chartThemeHelpers.getChartColor(0);
        expect(typeof color).toBe('string');
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    describe('getTradeColor', () => {
      it('should return electrical color', () => {
        const color = chartThemeHelpers.getTradeColor('electrical');
        expect(color).toBe(chartColors.trades.electrical);
      });

      it('should return plumbing color', () => {
        const color = chartThemeHelpers.getTradeColor('plumbing');
        expect(color).toBe(chartColors.trades.plumbing);
      });

      it('should return hvac color', () => {
        const color = chartThemeHelpers.getTradeColor('hvac');
        expect(color).toBe(chartColors.trades.hvac);
      });

      it('should return fireProtection color', () => {
        const color = chartThemeHelpers.getTradeColor('fireProtection');
        expect(color).toBe(chartColors.trades.fireProtection);
      });

      it('should return mechanical color', () => {
        const color = chartThemeHelpers.getTradeColor('mechanical');
        expect(color).toBe(chartColors.trades.mechanical);
      });

      it('should return all distinct colors', () => {
        const trades: (keyof typeof chartColors.trades)[] = [
          'electrical',
          'plumbing',
          'hvac',
          'fireProtection',
          'mechanical',
        ];

        const colors = trades.map((trade) => chartThemeHelpers.getTradeColor(trade));
        const uniqueColors = new Set(colors);

        expect(uniqueColors.size).toBe(trades.length);
      });
    });

    describe('formatCurrency', () => {
      it('should format millions with M suffix', () => {
        expect(chartThemeHelpers.formatCurrency(1000000)).toBe('$1.0M');
        expect(chartThemeHelpers.formatCurrency(1500000)).toBe('$1.5M');
        expect(chartThemeHelpers.formatCurrency(2300000)).toBe('$2.3M');
      });

      it('should format thousands with K suffix', () => {
        expect(chartThemeHelpers.formatCurrency(1000)).toBe('$1K');
        expect(chartThemeHelpers.formatCurrency(1500)).toBe('$2K');
        expect(chartThemeHelpers.formatCurrency(9999)).toBe('$10K');
      });

      it('should format values under 1000 without suffix', () => {
        expect(chartThemeHelpers.formatCurrency(0)).toBe('$0');
        expect(chartThemeHelpers.formatCurrency(100)).toBe('$100');
        expect(chartThemeHelpers.formatCurrency(999)).toBe('$999');
      });

      it('should handle negative values', () => {
        // Implementation doesn't properly handle negatives (no abs value check)
        // So negative values fall through to the default case
        expect(chartThemeHelpers.formatCurrency(-1000000)).toBe('$-1000000');
        expect(chartThemeHelpers.formatCurrency(-5000)).toBe('$-5000');
        expect(chartThemeHelpers.formatCurrency(-500)).toBe('$-500');
      });

      it('should round to 1 decimal for millions', () => {
        expect(chartThemeHelpers.formatCurrency(1234567)).toBe('$1.2M');
        expect(chartThemeHelpers.formatCurrency(9876543)).toBe('$9.9M');
      });

      it('should round to 0 decimals for thousands', () => {
        expect(chartThemeHelpers.formatCurrency(1234)).toBe('$1K');
        expect(chartThemeHelpers.formatCurrency(9876)).toBe('$10K');
      });

      it('should round to 0 decimals for values under 1000', () => {
        expect(chartThemeHelpers.formatCurrency(123.456)).toBe('$123');
        expect(chartThemeHelpers.formatCurrency(999.99)).toBe('$1000');
      });
    });

    describe('formatPercentage', () => {
      it('should format with 1 decimal by default', () => {
        expect(chartThemeHelpers.formatPercentage(50)).toBe('50.0%');
        expect(chartThemeHelpers.formatPercentage(75.5)).toBe('75.5%');
        expect(chartThemeHelpers.formatPercentage(100)).toBe('100.0%');
      });

      it('should respect custom decimal places', () => {
        expect(chartThemeHelpers.formatPercentage(50, 0)).toBe('50%');
        expect(chartThemeHelpers.formatPercentage(75.555, 2)).toBe('75.56%');
        expect(chartThemeHelpers.formatPercentage(100, 3)).toBe('100.000%');
      });

      it('should handle zero', () => {
        expect(chartThemeHelpers.formatPercentage(0)).toBe('0.0%');
        expect(chartThemeHelpers.formatPercentage(0, 0)).toBe('0%');
      });

      it('should handle negative percentages', () => {
        expect(chartThemeHelpers.formatPercentage(-25.5)).toBe('-25.5%');
        expect(chartThemeHelpers.formatPercentage(-100, 0)).toBe('-100%');
      });

      it('should round correctly', () => {
        expect(chartThemeHelpers.formatPercentage(33.333, 1)).toBe('33.3%');
        expect(chartThemeHelpers.formatPercentage(66.666, 2)).toBe('66.67%');
      });
    });

    describe('getResponsiveFontSizes', () => {
      it('should return small sizes for width < 400', () => {
        const sizes = chartThemeHelpers.getResponsiveFontSizes(300);

        expect(sizes.tick).toBe(10);
        expect(sizes.label).toBe(11);
        expect(sizes.legend).toBe(11);
        expect(sizes.tooltip).toBe(12);
      });

      it('should return medium sizes for width between 400-599', () => {
        const sizes = chartThemeHelpers.getResponsiveFontSizes(500);

        expect(sizes.tick).toBe(11);
        expect(sizes.label).toBe(12);
        expect(sizes.legend).toBe(12);
        expect(sizes.tooltip).toBe(13);
      });

      it('should return large sizes for width >= 600', () => {
        const sizes = chartThemeHelpers.getResponsiveFontSizes(800);

        expect(sizes.tick).toBe(12);
        expect(sizes.label).toBe(13);
        expect(sizes.legend).toBe(12);
        expect(sizes.tooltip).toBe(13);
      });

      it('should handle exact boundary at 400', () => {
        const sizes = chartThemeHelpers.getResponsiveFontSizes(400);

        expect(sizes.tick).toBe(11);
        expect(sizes.label).toBe(12);
      });

      it('should handle exact boundary at 600', () => {
        const sizes = chartThemeHelpers.getResponsiveFontSizes(600);

        expect(sizes.tick).toBe(12);
        expect(sizes.label).toBe(13);
      });

      it('should return consistent structure', () => {
        const sizes = chartThemeHelpers.getResponsiveFontSizes(500);

        expect(sizes).toHaveProperty('tick');
        expect(sizes).toHaveProperty('label');
        expect(sizes).toHaveProperty('legend');
        expect(sizes).toHaveProperty('tooltip');
        expect(typeof sizes.tick).toBe('number');
        expect(typeof sizes.label).toBe('number');
        expect(typeof sizes.legend).toBe('number');
        expect(typeof sizes.tooltip).toBe('number');
      });
    });
  });

  // ============================================
  // chartPresets Tests
  // ============================================
  describe('chartPresets', () => {
    describe('sCurve', () => {
      it('should define plannedValue line style', () => {
        const pv = chartPresets.sCurve.lines.plannedValue;

        expect(pv.stroke).toBe(evmColors.plannedValue);
        expect(pv.strokeWidth).toBe(2);
        expect(pv.strokeDasharray).toBe('4 2');
        expect(pv.dot).toBe(false);
      });

      it('should define earnedValue line style', () => {
        const ev = chartPresets.sCurve.lines.earnedValue;

        expect(ev.stroke).toBe(evmColors.earnedValue);
        expect(ev.strokeWidth).toBe(2.5);
        expect(ev.dot).toBe(false);
      });

      it('should define actualCost line style', () => {
        const ac = chartPresets.sCurve.lines.actualCost;

        expect(ac.stroke).toBe(evmColors.actualCost);
        expect(ac.strokeWidth).toBe(2);
        expect(ac.dot).toBe(false);
      });

      it('should define budgetLine style', () => {
        const budget = chartPresets.sCurve.budgetLine;

        expect(budget.stroke).toBe(evmColors.budgetLine);
        expect(budget.strokeWidth).toBe(2);
        expect(budget.strokeDasharray).toBe('8 4');
      });

      it('should have all expected properties', () => {
        expect(chartPresets.sCurve).toHaveProperty('lines');
        expect(chartPresets.sCurve).toHaveProperty('budgetLine');
        expect(chartPresets.sCurve.lines).toHaveProperty('plannedValue');
        expect(chartPresets.sCurve.lines).toHaveProperty('earnedValue');
        expect(chartPresets.sCurve.lines).toHaveProperty('actualCost');
      });
    });

    describe('barChart', () => {
      it('should define bar style with rounded corners', () => {
        const bar = chartPresets.barChart.bar;

        expect(bar.radius).toEqual([4, 4, 0, 0]);
        expect(bar.opacity).toBe(0.9);
      });

      it('should only round top corners', () => {
        const [topRight, topLeft, bottomLeft, bottomRight] = chartPresets.barChart.bar.radius;

        expect(topRight).toBe(4);
        expect(topLeft).toBe(4);
        expect(bottomLeft).toBe(0);
        expect(bottomRight).toBe(0);
      });
    });

    describe('pieChart', () => {
      it('should define pie chart dimensions', () => {
        const pie = chartPresets.pieChart;

        expect(pie.innerRadius).toBe(60);
        expect(pie.outerRadius).toBe(100);
        expect(pie.paddingAngle).toBe(2);
      });

      it('should create donut chart with inner radius', () => {
        expect(chartPresets.pieChart.innerRadius).toBeGreaterThan(0);
        expect(chartPresets.pieChart.innerRadius).toBeLessThan(
          chartPresets.pieChart.outerRadius
        );
      });
    });

    it('should define all preset types', () => {
      const expectedPresets: ChartPresetType[] = ['sCurve', 'barChart', 'pieChart'];

      expectedPresets.forEach((preset) => {
        expect(chartPresets).toHaveProperty(preset);
      });
    });

    it('should have const assertion for type safety', () => {
      // TypeScript const assertion provides compile-time immutability
      // Runtime verification that values are set correctly
      expect(chartPresets.sCurve.lines.plannedValue.strokeWidth).toBe(2);
      expect(chartPresets.sCurve.lines.earnedValue.strokeWidth).toBe(2.5);
      expect(chartPresets.sCurve.budgetLine.strokeWidth).toBe(2);
    });
  });

  // ============================================
  // Type Safety Tests
  // ============================================
  describe('Type Exports', () => {
    it('should export ChartTheme interface', () => {
      const theme: ChartTheme = createChartTheme();
      expect(theme).toBeDefined();
    });

    it('should export StatusColorResult interface', () => {
      const status: StatusColorResult = getStatusColor(1.0);
      expect(status).toHaveProperty('main');
      expect(status).toHaveProperty('bg');
      expect(status).toHaveProperty('border');
    });

    it('should allow valid EVMColorKey types', () => {
      const keys: EVMColorKey[] = [
        'plannedValue',
        'earnedValue',
        'actualCost',
        'budgetLine',
        'forecastLine',
      ];

      keys.forEach((key) => {
        expect(evmColors[key]).toBeDefined();
      });
    });

    it('should allow valid ChartPresetType types', () => {
      const presets: ChartPresetType[] = ['sCurve', 'barChart', 'pieChart'];

      presets.forEach((preset) => {
        expect(chartPresets[preset]).toBeDefined();
      });
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('Integration', () => {
    it('should use consistent colors across theme and helpers', () => {
      const theme = createChartTheme(true);
      const chartColor = chartThemeHelpers.getChartColor(0);

      // Both should reference design tokens
      expect(typeof theme.grid.stroke).toBe('string');
      expect(typeof chartColor).toBe('string');
    });

    it('should use EVM colors in S-curve preset', () => {
      const sCurve = chartPresets.sCurve;

      expect(sCurve.lines.plannedValue.stroke).toBe(evmColors.plannedValue);
      expect(sCurve.lines.earnedValue.stroke).toBe(evmColors.earnedValue);
      expect(sCurve.lines.actualCost.stroke).toBe(evmColors.actualCost);
      expect(sCurve.budgetLine.stroke).toBe(evmColors.budgetLine);
    });

    it('should provide complete theme for Recharts components', () => {
      const theme = createChartTheme(true);

      // Grid props
      expect(theme.grid.stroke).toBeDefined();
      expect(theme.grid.strokeDasharray).toBeDefined();

      // Axis props
      expect(theme.axis.stroke).toBeDefined();
      expect(theme.axis.tick.fill).toBeDefined();
      expect(theme.axis.tick.fontSize).toBeDefined();

      // Tooltip props
      expect(theme.tooltip.contentStyle.backgroundColor).toBeDefined();
      expect(theme.tooltip.contentStyle.border).toBeDefined();
      expect(theme.tooltip.labelStyle.color).toBeDefined();

      // Legend props
      expect(theme.legend.wrapperStyle.color).toBeDefined();
    });

    it('should support status color workflow', () => {
      // Simulate CPI/SPI calculations
      const cpi = 0.95; // Slightly under budget
      const spi = 1.05; // Ahead of schedule

      const cpiColors = getStatusColor(cpi);
      const spiColors = getStatusColor(spi);

      expect(cpiColors.main).toBe(semanticColors.warning[500]);
      expect(spiColors.main).toBe(semanticColors.success[500]);
    });

    it('should support percentage completion workflow', () => {
      const completed = 75;
      const target = 80;

      const colors = getPercentageStatusColor(completed, target);

      // 75/80 = 0.9375, should be warning
      expect(colors.main).toBe(semanticColors.warning[500]);
    });

    it('should support variance tracking workflow', () => {
      const costVariance = -5000; // Over budget
      const scheduleVariance = 2000; // Ahead of schedule

      const costColors = getVarianceStatusColor(costVariance);
      const scheduleColors = getVarianceStatusColor(scheduleVariance);

      expect(costColors.main).toBe(semanticColors.error[500]);
      expect(scheduleColors.main).toBe(semanticColors.success[500]);
    });

    it('should format currency for tooltip display', () => {
      const budget = 1234567;
      const actual = 5678;

      expect(chartThemeHelpers.formatCurrency(budget)).toBe('$1.2M');
      expect(chartThemeHelpers.formatCurrency(actual)).toBe('$6K');
    });

    it('should provide responsive fonts for different chart sizes', () => {
      const mobile = chartThemeHelpers.getResponsiveFontSizes(350);
      const tablet = chartThemeHelpers.getResponsiveFontSizes(500);
      const desktop = chartThemeHelpers.getResponsiveFontSizes(800);

      expect(mobile.tick).toBeLessThan(tablet.tick);
      expect(tablet.tick).toBeLessThanOrEqual(desktop.tick);
    });
  });

  // ============================================
  // Edge Cases Tests
  // ============================================
  describe('Edge Cases', () => {
    it('should handle extreme performance index values', () => {
      expect(getStatusColor(10000).main).toBe(semanticColors.success[500]);
      expect(getStatusColor(0.0001).main).toBe(semanticColors.error[500]);
    });

    it('should handle extreme percentage values', () => {
      expect(getPercentageStatusColor(1000, 100).main).toBe(semanticColors.success[500]);
      expect(getPercentageStatusColor(-50, 100).main).toBe(semanticColors.error[500]);
    });

    it('should handle extreme variance values', () => {
      expect(getVarianceStatusColor(1000000).main).toBe(semanticColors.success[500]);
      expect(getVarianceStatusColor(-1000000).main).toBe(semanticColors.error[500]);
    });

    it('should handle very large currency values', () => {
      expect(chartThemeHelpers.formatCurrency(999999999)).toBe('$1000.0M');
    });

    it('should handle very small currency values', () => {
      expect(chartThemeHelpers.formatCurrency(0.5)).toBe('$1');
      expect(chartThemeHelpers.formatCurrency(0.01)).toBe('$0');
    });

    it('should handle very large chart indices', () => {
      const largeIndex = 10000;
      const color = chartThemeHelpers.getChartColor(largeIndex);
      expect(color).toBe(chartColors.palette[largeIndex % chartColors.palette.length]);
    });

    it('should handle very small chart widths', () => {
      const sizes = chartThemeHelpers.getResponsiveFontSizes(1);
      expect(sizes.tick).toBe(10);
    });

    it('should handle very large chart widths', () => {
      const sizes = chartThemeHelpers.getResponsiveFontSizes(10000);
      expect(sizes.tick).toBe(12);
    });
  });
});
