/**
 * ForemanOS Design Tokens
 *
 * Centralized color palette and design system values for consistent theming.
 * This file standardizes all color values used across the application.
 *
 * DO NOT import this file into components yet - it's a reference document.
 * Future refactoring will replace hardcoded values with these tokens.
 *
 * @see app/globals.css for CSS custom properties
 * @see tailwind.config.ts for Tailwind theme configuration
 */

/**
 * Primary Brand Colors
 *
 * Orange is the primary brand color for ForemanOS, representing construction,
 * energy, and action. Used for CTAs, primary actions, and brand elements.
 */
export const primaryColors = {
  orange: {
    50: '#FFF7ED',   // Lightest - subtle backgrounds
    100: '#FFEDD5',  // Very light - hover states on light backgrounds
    200: '#FED7AA',  // Light - borders, dividers
    300: '#FDBA74',  // Medium light - secondary elements
    400: '#FB923C',  // Medium - gradients, accents
    500: '#F97316',  // DEFAULT - Primary CTA, main brand color
    600: '#EA580C',  // Hover - Primary button hover state
    700: '#C2410C',  // Active - Primary button active/pressed state
    800: '#9A3412',  // Dark - text on light backgrounds
    900: '#7C2D12',  // Darkest - deep contrast
  },
} as const;

/**
 * Secondary Brand Colors
 *
 * Blue represents trust, professionalism, and construction blueprints.
 * Used for secondary actions, links, and informational elements.
 */
export const secondaryColors = {
  blue: {
    50: '#EFF6FF',   // Lightest - backgrounds for blue sections
    100: '#DBEAFE',  // Very light - hover states
    200: '#BFDBFE',  // Light - borders
    300: '#93C5FD',  // Medium light
    400: '#60A5FA',  // Medium - icons, badges
    500: '#3B82F6',  // DEFAULT - Info color, secondary elements
    600: '#2563EB',  // Primary blue - Links, secondary CTAs
    700: '#1D4ED8',  // Hover - Link hover state
    800: '#1E40AF',  // Active - darker links
    900: '#1E3A8A',  // Darkest
    // Brand-specific blues
    brand: '#003B71',      // Primary brand blue for client theme
    brandDark: '#002849',  // Deep blue for hover states
    brandLight: '#0052a3', // Lighter brand blue for gradients
  },
} as const;

/**
 * Semantic Colors
 *
 * Colors that communicate meaning: success, warning, error, and info states.
 * Used for status indicators, alerts, and user feedback.
 */
export const semanticColors = {
  success: {
    50: '#ECFDF5',   // Background for success messages
    100: '#D1FAE5',  // Light success background
    200: '#A7F3D0',  // Border color
    300: '#6EE7B7',  // Medium
    400: '#34D399',  // Medium bright
    500: '#10B981',  // DEFAULT - Success green, positive indicators
    600: '#059669',  // Hover state
    700: '#047857',  // Active/pressed state
    800: '#065F46',  // Dark text
    900: '#064E3B',  // Darkest
  },
  warning: {
    50: '#FFFBEB',   // Background
    100: '#FEF3C7',  // Light
    200: '#FDE68A',  // Border
    300: '#FCD34D',  // Medium
    400: '#FBBF24',  // Medium bright
    500: '#F59E0B',  // DEFAULT - Warning amber
    600: '#D97706',  // Hover
    700: '#B45309',  // Active
    800: '#92400E',  // Dark
    900: '#78350F',  // Darkest
  },
  error: {
    50: '#FEF2F2',   // Background
    100: '#FEE2E2',  // Light
    200: '#FECACA',  // Border
    300: '#FCA5A5',  // Medium
    400: '#F87171',  // Medium bright
    500: '#EF4444',  // DEFAULT - Error red, alerts, critical states
    600: '#DC2626',  // Hover
    700: '#B91C1C',  // Active
    800: '#991B1B',  // Dark
    900: '#7F1D1D',  // Darkest
  },
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',  // DEFAULT - Info blue
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
} as const;

/**
 * Background Colors
 *
 * Dark theme backgrounds used for application UI, cards, and containers.
 * GitHub-inspired dark backgrounds for code/technical feel.
 */
export const backgroundColors = {
  dark: {
    base: '#0d1117',      // Darkest - Main dark background (GitHub dark)
    card: '#1F2328',      // Card background, elevated surfaces
    hover: '#2d333b',     // Hover state for interactive elements
    active: '#1a1f24',    // Active/pressed state
    border: '#30363d',    // Border color for dark backgrounds
    subtle: '#161b22',    // Subtle variations
  },
  light: {
    base: '#FFFFFF',      // White - Main light background
    secondary: '#F8FAFC', // Secondary light background (slate-50)
    tertiary: '#F1F5F9',  // Tertiary background (slate-100)
    accent: '#FFF7ED',    // Accent background (orange-50 tint)
    border: '#E2E8F0',    // Light borders (slate-200)
  },
} as const;

/**
 * Neutral Colors
 *
 * Grayscale palette for text, borders, and UI elements.
 * Uses slate for slightly cooler tones than pure gray.
 */
export const neutralColors = {
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',  // Medium gray for secondary text
    600: '#475569',  // Text muted
    700: '#334155',  // Dark text
    800: '#1E293B',
    900: '#0F172A',  // Darkest text on light backgrounds
  },
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  zinc: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
  },
} as const;

/**
 * Role-Based Theme Colors
 *
 * Different color schemes for different user roles to provide
 * visual distinction and improve user experience.
 */
export const roleColors = {
  admin: {
    primary: '#6B46C1',      // Purple - Admin primary
    primaryDark: '#5B21B6',  // Deep purple hover
    accent: '#9333EA',       // Bright purple accent
    background: '#F5F3FF',   // Pale purple background
    border: '#DDD6FE',       // Light purple border
  },
  client: {
    primary: '#003B71',      // Brand blue
    primaryDark: '#002849',  // Deep blue hover
    accent: '#2563EB',       // Bright blue accent
    background: '#EFF6FF',   // Pale blue background
    border: '#BFDBFE',       // Light blue border
  },
  guest: {
    primary: '#059669',      // Emerald green
    primaryDark: '#047857',  // Deep green hover
    accent: '#10B981',       // Bright green accent
    background: '#ECFDF5',   // Pale green background
    border: '#A7F3D0',       // Light green border
  },
} as const;

/**
 * Chart Colors
 *
 * Color palette for data visualizations, charts, and graphs.
 * Chosen for accessibility and visual distinction.
 */
export const chartColors = {
  palette: [
    '#10B981', // Green - positive, earned value
    '#3B82F6', // Blue - planned, forecast
    '#F59E0B', // Amber - warning, in progress
    '#EF4444', // Red - critical, over budget
    '#8B5CF6', // Purple - category 1
    '#EC4899', // Pink - category 2
    '#14B8A6', // Teal - category 3
    '#F97316', // Orange - category 4
  ],
  // Semantic chart colors
  positive: '#10B981',     // Green - success, on track
  negative: '#EF4444',     // Red - over budget, critical
  neutral: '#3B82F6',      // Blue - planned, baseline
  warning: '#F59E0B',      // Amber - at risk
  // Trade-specific colors (MEP systems)
  trades: {
    electrical: '#FBBF24',      // Yellow/gold
    plumbing: '#10B981',        // Green
    hvac: '#3B82F6',            // Blue
    fireProtection: '#EF4444',  // Red
    mechanical: '#8B5CF6',      // Purple
  },
} as const;

/**
 * Typography Colors
 *
 * Text color tokens for different hierarchy levels and contexts.
 */
export const textColors = {
  light: {
    primary: '#0F172A',    // Main text on light backgrounds (slate-900)
    secondary: '#475569',  // Secondary text (slate-600)
    tertiary: '#64748B',   // Tertiary/muted text (slate-500)
    disabled: '#94A3B8',   // Disabled text (slate-400)
    link: '#2563EB',       // Links (blue-600)
    linkHover: '#1E40AF',  // Link hover (blue-800)
  },
  dark: {
    primary: '#F8FAFC',    // Main text on dark backgrounds (slate-50)
    secondary: '#CBD5E1',  // Secondary text (slate-300)
    tertiary: '#94A3B8',   // Tertiary/muted text (slate-400)
    disabled: '#64748B',   // Disabled text (slate-500)
    link: '#60A5FA',       // Links on dark (blue-400)
    linkHover: '#93C5FD',  // Link hover on dark (blue-300)
  },
} as const;

/**
 * Border Colors
 *
 * Border color tokens for different contexts and emphasis levels.
 */
export const borderColors = {
  light: {
    subtle: '#E2E8F0',   // Subtle borders (slate-200)
    medium: '#CBD5E1',   // Medium borders (slate-300)
    strong: '#94A3B8',   // Strong borders (slate-400)
    interactive: '#64748B', // Interactive element borders (slate-500)
  },
  dark: {
    subtle: '#30363d',   // Subtle borders on dark
    medium: '#424a53',   // Medium borders on dark
    strong: '#57606a',   // Strong borders on dark
    interactive: '#6e7781', // Interactive borders on dark
  },
} as const;

/**
 * Shadow Tokens
 *
 * Elevation system using box-shadows for depth hierarchy.
 */
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  // Colored shadows for emphasis
  primaryGlow: '0 0 20px rgba(249, 115, 22, 0.4), 0 0 40px rgba(249, 115, 22, 0.2)',
  primaryGlowHover: '0 0 30px rgba(249, 115, 22, 0.6), 0 0 60px rgba(249, 115, 22, 0.3)',
} as const;

/**
 * Animation Tokens
 *
 * Timing and easing functions for consistent animations.
 */
export const animations = {
  duration: {
    fast: '150ms',
    base: '250ms',
    slow: '350ms',
    slower: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

/**
 * Spacing Tokens
 *
 * Standardized spacing values based on 4px grid system.
 */
export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
  '5xl': '8rem',   // 128px
} as const;

/**
 * Layout Tokens
 *
 * Layout-related values for consistent page structure.
 */
export const layout = {
  navHeight: '72px',
  sectionPadding: '6rem',
  containerMax: '1280px',
  touchTarget: '44px', // Minimum touch target size (iOS HIG)
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
  },
} as const;

/**
 * Z-Index Tokens
 *
 * Layer hierarchy for stacking contexts.
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

/**
 * Type-safe color helper functions
 */
export const helpers = {
  /**
   * Get primary orange color by shade
   */
  getPrimaryColor: (shade: keyof typeof primaryColors.orange = 500) => {
    return primaryColors.orange[shade];
  },

  /**
   * Get semantic color by type and shade
   */
  getSemanticColor: (
    type: keyof typeof semanticColors,
    shade: keyof typeof semanticColors.success = 500
  ) => {
    return semanticColors[type][shade];
  },

  /**
   * Get role-based theme color
   */
  getRoleColor: (
    role: keyof typeof roleColors,
    variant: keyof typeof roleColors.admin = 'primary'
  ) => {
    return roleColors[role][variant];
  },

  /**
   * Get chart color by index (cycles through palette)
   */
  getChartColor: (index: number) => {
    return chartColors.palette[index % chartColors.palette.length];
  },
} as const;

/**
 * Export all tokens as a single object for convenience
 */
export const designTokens = {
  colors: {
    primary: primaryColors,
    secondary: secondaryColors,
    semantic: semanticColors,
    background: backgroundColors,
    neutral: neutralColors,
    role: roleColors,
    chart: chartColors,
    text: textColors,
    border: borderColors,
  },
  shadows,
  animations,
  spacing,
  layout,
  zIndex,
  helpers,
} as const;

/**
 * Type exports for TypeScript usage
 */
export type PrimaryColor = keyof typeof primaryColors.orange;
export type SemanticColorType = keyof typeof semanticColors;
export type RoleType = keyof typeof roleColors;
export type ChartColorIndex = number;

/**
 * Usage Examples:
 *
 * ```typescript
 * import { primaryColors, semanticColors, helpers } from '@/lib/design-tokens';
 *
 * // Direct access
 * const buttonBg = primaryColors.orange[500];        // '#F97316'
 * const buttonHover = primaryColors.orange[600];     // '#EA580C'
 *
 * // Using helpers
 * const primary = helpers.getPrimaryColor();         // '#F97316'
 * const success = helpers.getSemanticColor('success'); // '#10B981'
 *
 * // Chart colors
 * const color1 = helpers.getChartColor(0);           // '#10B981'
 * const color2 = helpers.getChartColor(1);           // '#3B82F6'
 *
 * // Role colors
 * const adminPrimary = helpers.getRoleColor('admin'); // '#6B46C1'
 * ```
 */

export default designTokens;
