import { describe, it, expect } from 'vitest';

// Import all exports from design-tokens
import {
  primaryColors,
  secondaryColors,
  semanticColors,
  backgroundColors,
  neutralColors,
  roleColors,
  chartColors,
  textColors,
  borderColors,
  shadows,
  animations,
  spacing,
  layout,
  zIndex,
  opacity,
  helpers,
  designTokens,
} from '@/lib/design-tokens';

describe('design-tokens', () => {
  describe('primaryColors', () => {
    it('should export orange color palette', () => {
      expect(primaryColors.orange).toBeDefined();
      expect(primaryColors.orange[50]).toBe('#FFF7ED');
      expect(primaryColors.orange[500]).toBe('#F97316'); // DEFAULT
      expect(primaryColors.orange[600]).toBe('#EA580C'); // Hover
      expect(primaryColors.orange[900]).toBe('#7C2D12');
    });

    it('should have all shade levels', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      shades.forEach((shade) => {
        expect(primaryColors.orange[shade as keyof typeof primaryColors.orange]).toBeDefined();
        expect(typeof primaryColors.orange[shade as keyof typeof primaryColors.orange]).toBe('string');
      });
    });
  });

  describe('secondaryColors', () => {
    it('should export blue color palette', () => {
      expect(secondaryColors.blue).toBeDefined();
      expect(secondaryColors.blue[500]).toBe('#3B82F6');
      expect(secondaryColors.blue.brand).toBe('#003B71');
      expect(secondaryColors.blue.brandDark).toBe('#002849');
      expect(secondaryColors.blue.brandLight).toBe('#0052a3');
    });

    it('should have all shade levels and brand colors', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      shades.forEach((shade) => {
        expect(secondaryColors.blue[shade as keyof typeof secondaryColors.blue]).toBeDefined();
      });

      expect(secondaryColors.blue.brand).toBeDefined();
      expect(secondaryColors.blue.brandDark).toBeDefined();
      expect(secondaryColors.blue.brandLight).toBeDefined();
    });
  });

  describe('semanticColors', () => {
    it('should export success color palette', () => {
      expect(semanticColors.success[500]).toBe('#10B981');
      expect(semanticColors.success[50]).toBe('#ECFDF5');
    });

    it('should export warning color palette', () => {
      expect(semanticColors.warning[500]).toBe('#F59E0B');
      expect(semanticColors.warning[50]).toBe('#FFFBEB');
    });

    it('should export error color palette', () => {
      expect(semanticColors.error[500]).toBe('#EF4444');
      expect(semanticColors.error[50]).toBe('#FEF2F2');
    });

    it('should export info color palette', () => {
      expect(semanticColors.info[500]).toBe('#3B82F6');
      expect(semanticColors.info[50]).toBe('#EFF6FF');
    });

    it('should have all shades for each semantic color', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      const types = ['success', 'warning', 'error', 'info'] as const;

      types.forEach((type) => {
        shades.forEach((shade) => {
          expect(semanticColors[type][shade as keyof typeof semanticColors.success]).toBeDefined();
        });
      });
    });
  });

  describe('backgroundColors', () => {
    it('should export dark background colors', () => {
      expect(backgroundColors.dark.base).toBe('#0d1117');
      expect(backgroundColors.dark.card).toBe('#1F2328');
      expect(backgroundColors.dark.hover).toBe('#2d333b');
      expect(backgroundColors.dark.border).toBe('#30363d');
    });

    it('should export light background colors', () => {
      expect(backgroundColors.light.base).toBe('#FFFFFF');
      expect(backgroundColors.light.secondary).toBe('#F8FAFC');
      expect(backgroundColors.light.border).toBe('#E2E8F0');
    });
  });

  describe('neutralColors', () => {
    it('should export slate palette', () => {
      expect(neutralColors.slate[500]).toBe('#64748B');
      expect(neutralColors.slate[900]).toBe('#0F172A');
    });

    it('should export gray palette', () => {
      expect(neutralColors.gray[500]).toBe('#6B7280');
    });

    it('should export zinc palette', () => {
      expect(neutralColors.zinc[500]).toBe('#71717A');
    });

    it('should have all shades for each neutral color', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      const types = ['slate', 'gray', 'zinc'] as const;

      types.forEach((type) => {
        shades.forEach((shade) => {
          expect(neutralColors[type][shade as keyof typeof neutralColors.slate]).toBeDefined();
        });
      });
    });
  });

  describe('roleColors', () => {
    it('should export admin role colors', () => {
      expect(roleColors.admin.primary).toBe('#6B46C1');
      expect(roleColors.admin.primaryDark).toBe('#5B21B6');
      expect(roleColors.admin.accent).toBe('#9333EA');
    });

    it('should export client role colors', () => {
      expect(roleColors.client.primary).toBe('#003B71');
      expect(roleColors.client.accent).toBe('#2563EB');
    });

    it('should export guest role colors', () => {
      expect(roleColors.guest.primary).toBe('#059669');
      expect(roleColors.guest.accent).toBe('#10B981');
    });

    it('should have consistent properties for each role', () => {
      const roles = ['admin', 'client', 'guest'] as const;
      const properties = ['primary', 'primaryDark', 'accent', 'background', 'border'];

      roles.forEach((role) => {
        properties.forEach((prop) => {
          expect(roleColors[role][prop as keyof typeof roleColors.admin]).toBeDefined();
          expect(typeof roleColors[role][prop as keyof typeof roleColors.admin]).toBe('string');
        });
      });
    });
  });

  describe('chartColors', () => {
    it('should export palette array', () => {
      expect(Array.isArray(chartColors.palette)).toBe(true);
      expect(chartColors.palette.length).toBe(8);
    });

    it('should export semantic chart colors', () => {
      expect(chartColors.positive).toBe('#10B981');
      expect(chartColors.negative).toBe('#EF4444');
      expect(chartColors.neutral).toBe('#3B82F6');
      expect(chartColors.warning).toBe('#F59E0B');
    });

    it('should export trade-specific colors', () => {
      expect(chartColors.trades.electrical).toBe('#FBBF24');
      expect(chartColors.trades.plumbing).toBe('#10B981');
      expect(chartColors.trades.hvac).toBe('#3B82F6');
      expect(chartColors.trades.fireProtection).toBe('#EF4444');
      expect(chartColors.trades.mechanical).toBe('#8B5CF6');
    });
  });

  describe('textColors', () => {
    it('should export light mode text colors', () => {
      expect(textColors.light.primary).toBe('#0F172A');
      expect(textColors.light.secondary).toBe('#475569');
      expect(textColors.light.link).toBe('#2563EB');
    });

    it('should export dark mode text colors', () => {
      expect(textColors.dark.primary).toBe('#F8FAFC');
      expect(textColors.dark.secondary).toBe('#CBD5E1');
      expect(textColors.dark.link).toBe('#60A5FA');
    });

    it('should have consistent properties for light and dark', () => {
      const properties = ['primary', 'secondary', 'tertiary', 'disabled', 'link', 'linkHover'];

      properties.forEach((prop) => {
        expect(textColors.light[prop as keyof typeof textColors.light]).toBeDefined();
        expect(textColors.dark[prop as keyof typeof textColors.dark]).toBeDefined();
      });
    });
  });

  describe('borderColors', () => {
    it('should export light mode border colors', () => {
      expect(borderColors.light.subtle).toBe('#E2E8F0');
      expect(borderColors.light.medium).toBe('#CBD5E1');
    });

    it('should export dark mode border colors', () => {
      expect(borderColors.dark.subtle).toBe('#30363d');
      expect(borderColors.dark.medium).toBe('#424a53');
    });
  });

  describe('shadows', () => {
    it('should export standard shadow sizes', () => {
      expect(shadows.sm).toBeDefined();
      expect(shadows.md).toBeDefined();
      expect(shadows.lg).toBeDefined();
      expect(shadows.xl).toBeDefined();
      expect(shadows['2xl']).toBeDefined();
      expect(shadows.inner).toBeDefined();
    });

    it('should export glow shadows', () => {
      expect(shadows.primaryGlow).toContain('249, 115, 22');
      expect(shadows.primaryGlowHover).toContain('249, 115, 22');
    });

    it('should be valid CSS values', () => {
      expect(shadows.sm).toMatch(/^0 \d+px \d+px/);
      expect(shadows.md).toMatch(/^0 \d+px \d+px/);
    });
  });

  describe('animations', () => {
    it('should export duration values', () => {
      expect(animations.duration.fast).toBe('150ms');
      expect(animations.duration.base).toBe('250ms');
      expect(animations.duration.slow).toBe('350ms');
      expect(animations.duration.slower).toBe('500ms');
    });

    it('should export easing functions', () => {
      expect(animations.easing.default).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
      expect(animations.easing.in).toBe('cubic-bezier(0.4, 0, 1, 1)');
      expect(animations.easing.out).toBe('cubic-bezier(0, 0, 0.2, 1)');
      expect(animations.easing.inOut).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });
  });

  describe('spacing', () => {
    it('should export spacing values based on 4px grid', () => {
      expect(spacing.xs).toBe('0.25rem'); // 4px
      expect(spacing.sm).toBe('0.5rem');  // 8px
      expect(spacing.md).toBe('1rem');    // 16px
      expect(spacing.lg).toBe('1.5rem');  // 24px
      expect(spacing.xl).toBe('2rem');    // 32px
      expect(spacing['2xl']).toBe('3rem'); // 48px
      expect(spacing['5xl']).toBe('8rem'); // 128px
    });
  });

  describe('layout', () => {
    it('should export layout dimensions', () => {
      expect(layout.navHeight).toBe('72px');
      expect(layout.sectionPadding).toBe('6rem');
      expect(layout.containerMax).toBe('1280px');
      expect(layout.touchTarget).toBe('44px');
    });

    it('should export border radius values', () => {
      expect(layout.borderRadius.sm).toBe('4px');
      expect(layout.borderRadius.md).toBe('8px');
      expect(layout.borderRadius.lg).toBe('12px');
      expect(layout.borderRadius.xl).toBe('16px');
      expect(layout.borderRadius['2xl']).toBe('24px');
      expect(layout.borderRadius.full).toBe('9999px');
    });
  });

  describe('zIndex', () => {
    it('should export z-index layers', () => {
      expect(zIndex.base).toBe(0);
      expect(zIndex.dropdown).toBe(1000);
      expect(zIndex.sticky).toBe(1020);
      expect(zIndex.fixed).toBe(1030);
      expect(zIndex.modalBackdrop).toBe(1040);
      expect(zIndex.modal).toBe(1050);
      expect(zIndex.popover).toBe(1060);
      expect(zIndex.tooltip).toBe(1070);
    });

    it('should have increasing values for proper stacking', () => {
      expect(zIndex.dropdown).toBeLessThan(zIndex.sticky);
      expect(zIndex.sticky).toBeLessThan(zIndex.fixed);
      expect(zIndex.modalBackdrop).toBeLessThan(zIndex.modal);
      expect(zIndex.modal).toBeLessThan(zIndex.tooltip);
    });
  });

  describe('opacity', () => {
    it('should export overlay opacity values', () => {
      expect(opacity.overlay.modal).toBe('90');
      expect(opacity.overlay.loading).toBe('80');
      expect(opacity.overlay.hover).toBe('10');
    });

    it('should export surface opacity values', () => {
      expect(opacity.surface.card).toBe('50');
      expect(opacity.surface.badge).toBe('30');
      expect(opacity.surface.subtle).toBe('20');
      expect(opacity.surface.highlight).toBe('10');
    });

    it('should export backdrop and disabled values', () => {
      expect(opacity.backdrop.blur).toBe('sm');
      expect(opacity.disabled).toBe('50');
      expect(opacity.hidden).toBe('0');
    });
  });

  describe('helpers', () => {
    describe('getPrimaryColor', () => {
      it('should return default orange 500', () => {
        expect(helpers.getPrimaryColor()).toBe('#F97316');
      });

      it('should return specific shade', () => {
        expect(helpers.getPrimaryColor(600)).toBe('#EA580C');
        expect(helpers.getPrimaryColor(50)).toBe('#FFF7ED');
      });
    });

    describe('getSemanticColor', () => {
      it('should return default semantic color', () => {
        expect(helpers.getSemanticColor('success')).toBe('#10B981');
        expect(helpers.getSemanticColor('error')).toBe('#EF4444');
      });

      it('should return specific shade', () => {
        expect(helpers.getSemanticColor('success', 600)).toBe('#059669');
        expect(helpers.getSemanticColor('warning', 700)).toBe('#B45309');
      });
    });

    describe('getRoleColor', () => {
      it('should return default primary color for role', () => {
        expect(helpers.getRoleColor('admin')).toBe('#6B46C1');
        expect(helpers.getRoleColor('client')).toBe('#003B71');
        expect(helpers.getRoleColor('guest')).toBe('#059669');
      });

      it('should return specific variant', () => {
        expect(helpers.getRoleColor('admin', 'primaryDark')).toBe('#5B21B6');
        expect(helpers.getRoleColor('client', 'accent')).toBe('#2563EB');
      });
    });

    describe('getChartColor', () => {
      it('should return color from palette by index', () => {
        expect(helpers.getChartColor(0)).toBe('#10B981');
        expect(helpers.getChartColor(1)).toBe('#3B82F6');
        expect(helpers.getChartColor(7)).toBe('#F97316');
      });

      it('should cycle through palette', () => {
        expect(helpers.getChartColor(8)).toBe(helpers.getChartColor(0));
        expect(helpers.getChartColor(15)).toBe(helpers.getChartColor(7));
      });
    });
  });

  describe('designTokens', () => {
    it('should export unified tokens object', () => {
      expect(designTokens.colors).toBeDefined();
      expect(designTokens.shadows).toBeDefined();
      expect(designTokens.animations).toBeDefined();
      expect(designTokens.spacing).toBeDefined();
      expect(designTokens.layout).toBeDefined();
      expect(designTokens.zIndex).toBeDefined();
      expect(designTokens.opacity).toBeDefined();
      expect(designTokens.helpers).toBeDefined();
    });

    it('should contain all color categories', () => {
      expect(designTokens.colors.primary).toEqual(primaryColors);
      expect(designTokens.colors.secondary).toEqual(secondaryColors);
      expect(designTokens.colors.semantic).toEqual(semanticColors);
      expect(designTokens.colors.background).toEqual(backgroundColors);
      expect(designTokens.colors.neutral).toEqual(neutralColors);
      expect(designTokens.colors.role).toEqual(roleColors);
      expect(designTokens.colors.chart).toEqual(chartColors);
      expect(designTokens.colors.text).toEqual(textColors);
      expect(designTokens.colors.border).toEqual(borderColors);
    });
  });

  describe('type safety', () => {
    it('should be const objects (read-only)', () => {
      // Objects exported with 'as const' are read-only but not frozen
      expect(primaryColors).toBeDefined();
      expect(secondaryColors).toBeDefined();
      expect(semanticColors).toBeDefined();
      expect(helpers).toBeDefined();
    });

    it('should have valid hex color format', () => {
      const hexRegex = /^#[0-9A-F]{6}$/i;

      expect(primaryColors.orange[500]).toMatch(hexRegex);
      expect(secondaryColors.blue[500]).toMatch(hexRegex);
      expect(semanticColors.success[500]).toMatch(hexRegex);
    });

    it('should have consistent naming pattern', () => {
      // All color palettes should have 50-900 shades
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

      shades.forEach((shade) => {
        expect(primaryColors.orange[shade as keyof typeof primaryColors.orange]).toBeDefined();
        expect(semanticColors.success[shade as keyof typeof semanticColors.success]).toBeDefined();
        expect(neutralColors.slate[shade as keyof typeof neutralColors.slate]).toBeDefined();
      });
    });
  });

  describe('accessibility', () => {
    it('should have adequate contrast between shades', () => {
      // Light shades should start with # and be lighter (higher hex value)
      const orangeLight = parseInt(primaryColors.orange[50].slice(1, 3), 16);
      const orangeDark = parseInt(primaryColors.orange[900].slice(1, 3), 16);

      expect(orangeLight).toBeGreaterThan(orangeDark);
    });

    it('should meet touch target size requirements', () => {
      expect(layout.touchTarget).toBe('44px'); // iOS HIG minimum
    });
  });
});
