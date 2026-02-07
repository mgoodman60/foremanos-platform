import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

// Matches Tailwind arbitrary value hex patterns like [#F97316] or [#abc]
const HEX_PATTERN = /\[#[0-9a-fA-F]{3,8}\]/g;

describe('Hardcoded Hex Audit - UI Primitives', () => {
  const uiPrimitives = [
    'components/ui/button.tsx',
    'components/ui/icon-button.tsx',
    'components/ui/toast.tsx',
    'components/ui/header-action-menu.tsx',
    'components/ui/upload-progress.tsx',
    'components/ui/customizable-widget.tsx',
    'components/ui/form-error.tsx',
    'components/ui/autosave-indicator.tsx',
    'components/ui/loading-spinner.tsx',
  ];

  uiPrimitives.forEach((file) => {
    it(`${file} has no hardcoded hex values in Tailwind classes`, () => {
      const source = readComponent(file);
      const matches = source.match(HEX_PATTERN);
      expect(matches).toBeNull();
    });
  });
});
