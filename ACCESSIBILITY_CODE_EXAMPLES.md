# Accessibility Code Examples - Modal ARIA Patterns

This document shows the exact code patterns applied to all custom modals for accessibility compliance.

## Standard Pattern Applied

### Before (Non-Accessible)
```tsx
return (
  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Modal Title</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* modal content */}
      </div>
    </div>
  </div>
);
```

### After (Accessible)
```tsx
return (
  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="bg-white rounded-lg shadow-2xl max-w-2xl w-full"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-bold">Modal Title</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* modal content */}
      </div>
    </div>
  </div>
);
```

### Key Changes
1. **Modal container gets 3 attributes:**
   - `role="dialog"` - Identifies as dialog
   - `aria-modal="true"` - Blocks background interaction
   - `aria-labelledby="unique-id"` - Points to title

2. **Modal title gets unique ID:**
   - `id="unique-id"` - Matches aria-labelledby value

3. **Close button gets label:**
   - `aria-label="Close"` - Describes action for screen readers

---

## Complete Examples from ForemanOS

### Example 1: Document Category Modal

**File:** `components/document-category-modal.tsx`

```tsx
// Lines 73-95
return (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-category-modal-title"
      className="bg-[#2d333b] border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-[#2d333b] border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 id="document-category-modal-title" className="text-lg font-semibold text-[#F8FAFC]">
            {fileName ? 'Select Document Category' : 'Step 1: Choose Document Category'}
          </h2>
          {fileName && (
            <p className="text-sm text-gray-400 mt-1">File: {fileName}</p>
          )}
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-[#F8FAFC] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* ... rest of modal content */}
    </div>
  </div>
);
```

---

### Example 2: Quick Capture Modal with Shadcn Button

**File:** `components/quick-capture-modal.tsx`

```tsx
// Lines 152-166
return (
  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-capture-modal-title"
      className="bg-[#1F2328] border border-gray-700 rounded-lg w-full max-w-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 id="quick-capture-modal-title" className="text-lg font-semibold text-[#F8FAFC]">
          Quick Capture
        </h3>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white hover:bg-[#2d333b]"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      {/* ... rest of modal content */}
    </div>
  </div>
);
```

**Note:** Works with both native `<button>` and Shadcn `<Button>` components

---

### Example 3: Workflow Modal with Dynamic Title

**File:** `components/workflow-modal.tsx`

```tsx
// Lines 450-475
return (
  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflow-modal-title"
      className="bg-[#2d333b] rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="bg-[#1F2328] px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-[#F97316]" />
          <div>
            <h2 id="workflow-modal-title" className="text-xl font-bold text-white">
              {selectedWorkflow ? selectedWorkflow.name : 'Daily Report Workflows'}
            </h2>
            {selectedWorkflow && (
              <p className="text-sm text-gray-400">
                {getCompletionPercentage()}% complete
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-[#2d333b] rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      {/* ... rest of modal content */}
    </div>
  </div>
);
```

**Note:** Dynamic title content still works with aria-labelledby

---

## ARIA Attribute Reference

### role="dialog"
**Purpose:** Identifies the element as a dialog window
**Screen Reader Behavior:** Announces "dialog" when user enters
**Required:** Yes (for custom modals)

**Example:**
```tsx
<div role="dialog">
  {/* dialog content */}
</div>
```

---

### aria-modal="true"
**Purpose:** Indicates content outside the dialog is inert
**Screen Reader Behavior:** Prevents navigation to background content
**Required:** Yes (for modal dialogs)

**Example:**
```tsx
<div role="dialog" aria-modal="true">
  {/* dialog content */}
</div>
```

---

### aria-labelledby
**Purpose:** References the element that labels the dialog
**Screen Reader Behavior:** Announces the title when entering dialog
**Required:** Yes (or use aria-label)

**Example:**
```tsx
<div role="dialog" aria-labelledby="my-dialog-title">
  <h2 id="my-dialog-title">Settings</h2>
</div>
```

**Alternative with aria-label:**
```tsx
<div role="dialog" aria-label="Settings Dialog">
  <h2>Settings</h2>
</div>
```

---

### aria-label (on buttons)
**Purpose:** Provides accessible name for icon-only buttons
**Screen Reader Behavior:** Announces the label instead of just "button"
**Required:** Yes (for icon-only buttons)

**Example:**
```tsx
<button onClick={onClose} aria-label="Close">
  <X className="w-5 h-5" />
</button>
```

**Announces as:** "Close, button" instead of just "button"

---

## Unique ID Naming Convention

Use this pattern for modal title IDs:

```
[component-name]-modal-title
```

**Examples:**
- `document-category-modal-title`
- `guest-credential-modal-title`
- `quick-capture-modal-title`
- `batch-upload-modal-title`
- `weather-preferences-modal-title`
- `workflow-modal-title`
- `finalization-settings-modal-title`
- `document-metadata-modal-title`

**Why:** Ensures IDs are globally unique across the application

---

## Testing Commands

### Screen Reader Testing (NVDA on Windows)
```
1. Open modal
2. NVDA should announce: "Dialog, [Modal Title]"
3. Press Tab to navigate
4. NVDA should announce each element
5. On close button: "Close, button"
```

### Keyboard Navigation Testing
```
1. Open modal with mouse or keyboard
2. Press Tab - should focus first interactive element
3. Continue Tab through all elements
4. Press Escape - should close modal (if implemented)
5. Verify focus doesn't reach background elements
```

### Automated Testing (React Testing Library)
```typescript
import { render, screen } from '@testing-library/react';
import { DocumentCategoryModal } from '@/components/document-category-modal';

test('modal has proper ARIA attributes', () => {
  render(
    <DocumentCategoryModal
      isOpen={true}
      fileName="test.pdf"
      fileType="pdf"
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />
  );

  const dialog = screen.getByRole('dialog');

  // Check all required ARIA attributes
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAttribute('aria-labelledby', 'document-category-modal-title');

  // Check title exists and is correctly referenced
  const title = screen.getByText(/Select Document Category/i);
  expect(title).toHaveAttribute('id', 'document-category-modal-title');

  // Check close button has label
  const closeButton = screen.getByLabelText('Close');
  expect(closeButton).toBeInTheDocument();
});
```

---

## Common Mistakes to Avoid

### ❌ Wrong: ARIA on backdrop instead of modal content
```tsx
<div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/90">
  <div className="bg-white rounded-lg">
    <h2>Title</h2>
  </div>
</div>
```

### ✅ Correct: ARIA on modal content container
```tsx
<div className="fixed inset-0 bg-black/90">
  <div role="dialog" aria-modal="true" className="bg-white rounded-lg">
    <h2>Title</h2>
  </div>
</div>
```

---

### ❌ Wrong: aria-labelledby pointing to non-existent ID
```tsx
<div role="dialog" aria-labelledby="modal-title">
  <h2>Settings</h2> {/* Missing id attribute */}
</div>
```

### ✅ Correct: ID matches aria-labelledby
```tsx
<div role="dialog" aria-labelledby="modal-title">
  <h2 id="modal-title">Settings</h2>
</div>
```

---

### ❌ Wrong: Generic aria-label
```tsx
<button onClick={onClose} aria-label="Button">
  <X />
</button>
```

### ✅ Correct: Descriptive aria-label
```tsx
<button onClick={onClose} aria-label="Close">
  <X />
</button>
```

---

## Browser DevTools Inspection

### Chrome DevTools
1. Open DevTools (F12)
2. Elements tab
3. Select modal element
4. Check Accessibility pane (bottom right)
5. Verify:
   - Role: dialog
   - Name: [Modal Title]
   - Properties: modal=true

### Firefox DevTools
1. Open DevTools (F12)
2. Inspector tab
3. Right-click modal element
4. "Show Accessibility Properties"
5. Verify same attributes

---

## Resources

- [ARIA Dialog Pattern (W3C)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: ARIA role="dialog"](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/dialog_role)
- [Shadcn Dialog Component](https://ui.shadcn.com/docs/components/dialog) - Fully accessible reference implementation

---

**Last Updated:** 2026-01-30
**Maintained by:** ForemanOS UI/UX Team
