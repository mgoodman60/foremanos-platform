import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

describe('Design Token Compliance - Contrast', () => {
  it('button.tsx outline variant uses text-gray-100 (not text-gray-200)', () => {
    const source = readComponent('components/ui/button.tsx');
    // Find the outline variant line
    const outlineMatch = source.match(/outline:\s*\n?\s*"([^"]+)"/);
    expect(outlineMatch).toBeTruthy();
    const outlineClasses = outlineMatch![1];
    expect(outlineClasses).toContain('text-gray-100');
    expect(outlineClasses).not.toContain('text-gray-200');
  });

  it('button.tsx outline variant uses hover:bg-dark-hover (no hardcoded hex)', () => {
    const source = readComponent('components/ui/button.tsx');
    const outlineMatch = source.match(/outline:\s*\n?\s*"([^"]+)"/);
    expect(outlineMatch).toBeTruthy();
    const outlineClasses = outlineMatch![1];
    expect(outlineClasses).toContain('hover:bg-dark-hover');
    expect(outlineClasses).not.toMatch(/hover:bg-\[#/);
  });

  it('icon-button.tsx ghost variant uses text-gray-300 (not text-gray-400)', () => {
    const source = readComponent('components/ui/icon-button.tsx');
    expect(source).toContain("ghost: 'text-gray-300");
    expect(source).not.toContain("ghost: 'text-gray-400");
  });

  it('icon-button.tsx default variant uses text-gray-100 (not text-gray-200)', () => {
    const source = readComponent('components/ui/icon-button.tsx');
    expect(source).toContain("default: 'bg-gray-700 text-gray-100");
    expect(source).not.toContain("default: 'bg-gray-700 text-gray-200");
  });

  it('toast.tsx close button uses opacity-50 (not opacity-0)', () => {
    const source = readComponent('components/ui/toast.tsx');
    // Find ToastClose className
    const closeSection = source.substring(source.indexOf('ToastClose'));
    expect(closeSection).toContain('opacity-50');
    expect(closeSection).not.toMatch(/\bopacity-0\b/);
  });

  it('form-error.tsx help text uses dark:text-gray-300 (not dark:text-gray-400)', () => {
    const source = readComponent('components/ui/form-error.tsx');
    expect(source).toContain('dark:text-gray-300');
    expect(source).not.toContain('dark:text-gray-400');
  });
});
