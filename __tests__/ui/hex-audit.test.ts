import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

// Matches Tailwind arbitrary value hex patterns like [#F97316] or [#abc]
const TAILWIND_HEX_PATTERN = /\[#[0-9a-fA-F]{3,8}\]/g;

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
      const matches = source.match(TAILWIND_HEX_PATTERN);
      expect(matches).toBeNull();
    });
  });
});

describe('Hardcoded Hex Audit - All Components', () => {
  // Dynamically discover all component TSX files
  function getAllComponentFiles(): string[] {
    const componentsDir = path.join(process.cwd(), 'components');
    const files: string[] = [];

    function walkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
          // Convert to relative path from cwd
          const relativePath = path.relative(process.cwd(), fullPath);
          files.push(relativePath.replace(/\\/g, '/'));
        }
      }
    }

    walkDir(componentsDir);
    return files;
  }

  const componentFiles = getAllComponentFiles();

  componentFiles.forEach((file) => {
    it(`${file} has no hardcoded Tailwind hex values`, () => {
      const source = readComponent(file);
      const matches = source.match(TAILWIND_HEX_PATTERN);
      if (matches) {
        // Provide helpful error showing which hex values remain
        expect(matches).toEqual([]);
      }
    });
  });
});

describe('Hardcoded Hex Audit - Project Pages', () => {
  function getAllProjectPageFiles(): string[] {
    const pagesDir = path.join(process.cwd(), 'app', 'project', '[slug]');
    const files: string[] = [];

    if (!fs.existsSync(pagesDir)) {
      return files;
    }

    function walkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
          // Convert to relative path from cwd
          const relativePath = path.relative(process.cwd(), fullPath);
          files.push(relativePath.replace(/\\/g, '/'));
        }
      }
    }

    walkDir(pagesDir);
    return files;
  }

  const pageFiles = getAllProjectPageFiles();

  pageFiles.forEach((file) => {
    it(`${file} has no hardcoded Tailwind hex values`, () => {
      const source = readComponent(file);
      const matches = source.match(TAILWIND_HEX_PATTERN);
      if (matches) {
        expect(matches).toEqual([]);
      }
    });
  });
});
