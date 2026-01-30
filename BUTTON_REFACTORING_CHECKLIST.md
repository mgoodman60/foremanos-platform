# Button Refactoring Checklist

This document provides step-by-step instructions for refactoring custom button sizes to use the standardized Button component variants.

## Completed

- [x] Added `xl` size variant to `components/ui/button.tsx`
  - New variant: `xl: "h-12 rounded-md px-8"` (48px height)

## Components to Update

### High Priority - Login/Auth Forms

#### 1. `components/login-form.tsx`

**Lines to update**: 124, 186, 264

**Before** (Line 124):
```tsx
<input
  className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-600 bg-[#1F2328] rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] transition-all text-gray-100 placeholder-gray-500 touch-manipulation"
/>
```

**Before** (Line 186):
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-bold py-5 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-xl hover:shadow-2xl focus:ring-4 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none touch-manipulation text-lg"
>
```

**After** (Line 186):
```tsx
<Button
  type="submit"
  disabled={loading}
  size="xl"
  className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-bold rounded-xl transform hover:scale-[1.02] shadow-xl hover:shadow-2xl text-lg"
>
```

**Before** (Line 264):
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-semibold py-4 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-wait disabled:hover:scale-100 shadow-md hover:shadow-lg focus:ring-4 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none touch-manipulation text-base"
>
```

**After** (Line 264):
```tsx
<Button
  type="submit"
  disabled={loading}
  size="xl"
  className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-semibold rounded-lg transform hover:scale-[1.02] shadow-md hover:shadow-lg text-base"
>
```

**Note**: Remember to import Button component at the top:
```tsx
import { Button } from '@/components/ui/button';
```

---

#### 2. `app/signout/page.tsx`

**Lines to update**: 64, 82

**Before** (Line 64):
```tsx
<button
  onClick={handleSignOut}
  disabled={isSigningOut}
  className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl focus:ring-4 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none text-base"
>
```

**After** (Line 64):
```tsx
<Button
  onClick={handleSignOut}
  disabled={isSigningOut}
  size="xl"
  className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-bold rounded-xl transform hover:scale-[1.02] shadow-lg hover:shadow-xl text-base"
>
```

**Before** (Line 82):
```tsx
<button
  onClick={handleCancel}
  disabled={isSigningOut}
  className="w-full bg-[#1F2328] hover:bg-[#374151] text-gray-300 font-semibold py-4 px-6 rounded-xl transition-all border-2 border-gray-700 hover:border-gray-600 focus:ring-4 focus:ring-gray-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
>
```

**After** (Line 82):
```tsx
<Button
  onClick={handleCancel}
  disabled={isSigningOut}
  size="xl"
  variant="outline"
  className="w-full bg-[#1F2328] hover:bg-[#374151] text-gray-300 font-semibold rounded-xl border-2 border-gray-700 hover:border-gray-600 text-base"
>
```

**Import to add**:
```tsx
import { Button } from '@/components/ui/button';
```

---

### Medium Priority - Landing Pages

#### 3. `components/landing/hero.tsx`

**Line to update**: 72

**Before**:
```tsx
<Button className="btn-ribbon text-white font-bold text-lg px-8 py-4 w-full sm:w-auto min-h-[var(--touch-target)] shadow-2xl border-2 border-yellow-300">
```

**After**:
```tsx
<Button size="xl" className="btn-ribbon text-white font-bold text-lg w-full sm:w-auto min-h-[var(--touch-target)] shadow-2xl border-2 border-yellow-300">
```

**Note**: This component already uses the Button component, just needs the `size="xl"` prop added.

---

#### 4. `components/landing/features.tsx`

**Line to update**: 294

**Before**:
```tsx
<Button className="btn-ribbon text-white font-bold text-lg px-8 py-4 w-full sm:w-auto min-h-[var(--touch-target)] shadow-2xl border-2 border-yellow-300">
```

**After**:
```tsx
<Button size="xl" className="btn-ribbon text-white font-bold text-lg w-full sm:w-auto min-h-[var(--touch-target)] shadow-2xl border-2 border-yellow-300">
```

**Note**: This component already uses the Button component, just needs the `size="xl"` prop added.

---

### Medium Priority - Dashboard

#### 5. `app/dashboard/page.tsx`

**Lines to update**: 561, 568, 630, 729

**Line 561** (Small action button):
```tsx
// Before
className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-3 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-1"

// After - Use native button element with size="sm"
<Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1">
```

**Line 568** (Small action button):
```tsx
// Before
className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-1"

// After
<Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1">
```

**Line 630** (CTA button):
```tsx
// Before
className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg flex items-center gap-2 whitespace-nowrap"

// After
<Button size="lg" className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-bold transform hover:scale-105 shadow-lg flex items-center gap-2 whitespace-nowrap">
```

**Line 729** (CTA button):
```tsx
// Before
className="px-6 py-3 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-semibold inline-flex items-center gap-2 transition-colors"

// After
<Button size="lg" className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-semibold inline-flex items-center gap-2">
```

**Import to add** (if not already present):
```tsx
import { Button } from '@/components/ui/button';
```

---

### Low Priority - Modals

#### 6. `components/conversation-sidebar.tsx`

**Line to update**: 429

**Before**:
```tsx
className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-3 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
```

**After**:
```tsx
<Button size="lg" className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl">
```

**Import to add**:
```tsx
import { Button } from '@/components/ui/button';
```

---

## Testing Checklist

After each file update:

- [ ] File compiles without TypeScript errors
- [ ] Visual appearance matches previous design
- [ ] Hover states work correctly
- [ ] Focus states are accessible (keyboard navigation)
- [ ] Disabled states display correctly
- [ ] Touch targets meet 44x44px minimum
- [ ] Responsive behavior works on mobile

## Build Verification

Run after all changes:

```bash
npm run build
```

Expected result: Build succeeds with no errors.

## Summary

- **Total files to update**: 6
- **Total lines affected**: ~13
- **New variant added**: `xl` (48px height)
- **Estimated time**: 70 minutes
- **Benefit**: Standardized button sizing, reduced CSS duplication, improved maintainability
