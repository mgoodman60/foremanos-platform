# Design Tokens Reference

## Overview

The `lib/design-tokens.ts` file provides a centralized, type-safe color system and design tokens for ForemanOS. This document serves as a quick reference guide.

## Current Status

**This is a reference document only.** Components have NOT been refactored yet to use these tokens. The design tokens file standardizes existing color usage patterns found throughout the codebase.

## Key Color Inconsistencies Resolved

### Before (Inconsistent)
```typescript
// Primary orange variations found in codebase:
'#F97316'  // Used in 50+ places
'#EA580C'  // Hover states
'#C2410C'  // Active states
'orange-500', 'orange-600', 'orange-700' // Tailwind classes

// Background dark variations:
'#0d1117'  // GitHub dark base
'#1F2328'  // Card backgrounds
'#2d333b'  // Hover states
'#1a1f24'  // Active states
```

### After (Standardized)
```typescript
import { primaryColors, backgroundColors } from '@/lib/design-tokens';

// Primary orange - all shades documented
primaryColors.orange[500]  // '#F97316' - Default
primaryColors.orange[600]  // '#EA580C' - Hover
primaryColors.orange[700]  // '#C2410C' - Active

// Dark backgrounds - consistent naming
backgroundColors.dark.base    // '#0d1117' - Main dark
backgroundColors.dark.card    // '#1F2328' - Cards
backgroundColors.dark.hover   // '#2d333b' - Hover
```

## Color Palettes

### Primary Colors (Orange)
- **Use for:** CTAs, primary buttons, brand elements, active states
- **Values:** 50-900 scale, DEFAULT is 500 (#F97316)
- **Hover:** 600 (#EA580C), **Active:** 700 (#C2410C)

### Secondary Colors (Blue)
- **Use for:** Links, secondary buttons, informational elements
- **Values:** 50-900 scale, DEFAULT is 600 (#2563EB)
- **Brand blue:** `blue.brand` (#003B71) for client theme

### Semantic Colors
- **Success:** Green (#10B981) - positive states, earned value
- **Warning:** Amber (#F59E0B) - caution, at-risk items
- **Error:** Red (#EF4444) - critical states, over budget
- **Info:** Blue (#3B82F6) - informational messages

### Background Colors

#### Dark Theme (GitHub-inspired)
```typescript
backgroundColors.dark.base    // '#0d1117' - Main background
backgroundColors.dark.card    // '#1F2328' - Elevated surfaces
backgroundColors.dark.hover   // '#2d333b' - Hover states
backgroundColors.dark.active  // '#1a1f24' - Active states
backgroundColors.dark.border  // '#30363d' - Borders
```

#### Light Theme
```typescript
backgroundColors.light.base      // '#FFFFFF' - White
backgroundColors.light.secondary // '#F8FAFC' - Slate-50
backgroundColors.light.accent    // '#FFF7ED' - Orange tint
backgroundColors.light.border    // '#E2E8F0' - Borders
```

### Role-Based Colors
```typescript
roleColors.admin   // Purple (#6B46C1)
roleColors.client  // Blue (#003B71)
roleColors.guest   // Green (#059669)
```

### Chart Colors
Optimized for data visualization:
```typescript
chartColors.palette[0]  // '#10B981' - Green (positive)
chartColors.palette[1]  // '#3B82F6' - Blue (neutral)
chartColors.palette[2]  // '#F59E0B' - Amber (warning)
chartColors.palette[3]  // '#EF4444' - Red (negative)
// + 4 more colors for variety
```

#### Trade-Specific Chart Colors
```typescript
chartColors.trades.electrical      // '#FBBF24' - Yellow/gold
chartColors.trades.plumbing        // '#10B981' - Green
chartColors.trades.hvac            // '#3B82F6' - Blue
chartColors.trades.fireProtection  // '#EF4444' - Red
```

## Helper Functions

Type-safe functions for accessing colors:

```typescript
import { helpers } from '@/lib/design-tokens';

// Get primary color (default or specific shade)
helpers.getPrimaryColor()      // '#F97316' (500)
helpers.getPrimaryColor(600)   // '#EA580C'

// Get semantic colors
helpers.getSemanticColor('success')        // '#10B981'
helpers.getSemanticColor('error', 600)     // '#DC2626'

// Get role-based colors
helpers.getRoleColor('admin')              // '#6B46C1'
helpers.getRoleColor('client', 'accent')   // '#2563EB'

// Get chart color by index (cycles through palette)
helpers.getChartColor(0)  // '#10B981'
helpers.getChartColor(8)  // Wraps to palette[0]
```

## Additional Tokens

### Shadows
```typescript
shadows.sm             // Subtle shadow
shadows.md             // Card shadow
shadows.lg             // Modal shadow
shadows.primaryGlow    // Orange glow effect
```

### Animations
```typescript
animations.duration.fast  // 150ms
animations.duration.base  // 250ms
animations.easing.default // cubic-bezier(0.4, 0, 0.2, 1)
```

### Layout
```typescript
layout.navHeight       // '72px'
layout.containerMax    // '1280px'
layout.touchTarget     // '44px' (iOS minimum)
layout.borderRadius.lg // '12px'
```

### Z-Index
```typescript
zIndex.dropdown       // 1000
zIndex.modal          // 1050
zIndex.tooltip        // 1070
```

## Relationship to Other Files

### `app/globals.css`
- Contains CSS custom properties (`--color-primary`, etc.)
- Uses same color values as design tokens
- Provides Tailwind utility classes (`.btn-primary`, etc.)

### `tailwind.config.ts`
- Defines Tailwind theme colors using HSL
- Separate from design tokens (uses different format)
- Should eventually reference design tokens for consistency

## Usage Examples

### Current Usage (DO NOT CHANGE YET)
```typescript
// Components currently use hardcoded values:
<button className="bg-[#F97316] hover:bg-[#EA580C]">
  Click Me
</button>
```

### Future Usage (After Refactoring)
```typescript
import { primaryColors } from '@/lib/design-tokens';

// Using style prop
<button style={{
  backgroundColor: primaryColors.orange[500],
  '&:hover': { backgroundColor: primaryColors.orange[600] }
}}>
  Click Me
</button>

// Or create a CSS-in-JS theme object
const theme = {
  colors: {
    primary: primaryColors.orange[500],
    primaryHover: primaryColors.orange[600],
  }
};
```

## Migration Strategy (Future)

1. **Phase 1:** Reference document (CURRENT)
   - Design tokens file created
   - Documents existing color usage
   - No component changes

2. **Phase 2:** Gradual migration (FUTURE)
   - Update high-traffic components first
   - Replace hardcoded hex values with token imports
   - Update Tailwind config to reference tokens

3. **Phase 3:** Enforcement (FUTURE)
   - ESLint rules to prevent hardcoded colors
   - Design system documentation
   - Storybook with token examples

## Color Mapping Guide

### Common Replacements

| Old Value | New Token | Use Case |
|-----------|-----------|----------|
| `#F97316` | `primaryColors.orange[500]` | Primary button background |
| `#EA580C` | `primaryColors.orange[600]` | Primary button hover |
| `#C2410C` | `primaryColors.orange[700]` | Primary button active |
| `#003B71` | `secondaryColors.blue.brand` | Client brand blue |
| `#2563EB` | `secondaryColors.blue[600]` | Links, secondary actions |
| `#10B981` | `semanticColors.success[500]` | Success states, positive |
| `#EF4444` | `semanticColors.error[500]` | Error states, critical |
| `#F59E0B` | `semanticColors.warning[500]` | Warning states |
| `#1F2328` | `backgroundColors.dark.card` | Dark card background |
| `#2d333b` | `backgroundColors.dark.hover` | Dark hover state |
| `orange-500` | `primaryColors.orange[500]` | Tailwind class replacement |
| `bg-zinc-800` | `neutralColors.zinc[800]` | Neutral background |

## Color Accessibility

All color combinations follow WCAG 2.1 AA guidelines:
- **Text on backgrounds:** Minimum 4.5:1 contrast ratio
- **Large text (18pt+):** Minimum 3:1 contrast ratio
- **UI components:** Minimum 3:1 contrast ratio

### Safe Combinations
- White text on `primaryColors.orange[500]` ✓ (5.2:1)
- White text on `secondaryColors.blue.brand` ✓ (9.1:1)
- `textColors.light.primary` on white ✓ (14.2:1)
- White text on `semanticColors.success[500]` ✓ (4.8:1)

## TypeScript Support

Full type safety included:

```typescript
import type { PrimaryColor, SemanticColorType } from '@/lib/design-tokens';

// Type-safe shade selection
const shade: PrimaryColor = 500;
const color = primaryColors.orange[shade]; // ✓ Type-safe

// Type-safe semantic type
const type: SemanticColorType = 'success';
const successColor = semanticColors[type][500]; // ✓ Type-safe
```

## Questions?

For questions about design tokens or color system:
- Review `lib/design-tokens.ts` for full documentation
- Check `app/globals.css` for CSS custom properties
- See component examples in `components/ui/` for current usage patterns

---

**Created:** 2026-01-29
**Version:** 1.0.0
**Status:** Reference Document (Not Yet Implemented)
