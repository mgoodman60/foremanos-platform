import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

describe('Accessibility Primitives', () => {
  it('IconButton renders aria-label from tooltip prop', () => {
    const source = readComponent('components/ui/icon-button.tsx');
    // The button element should have aria-label={tooltip}
    expect(source).toMatch(/aria-label=\{tooltip\}/);
  });

  it('IconButton tooltip prop is required (not optional)', () => {
    const source = readComponent('components/ui/icon-button.tsx');
    // In the interface, tooltip should be a required string prop
    expect(source).toMatch(/tooltip:\s*string/);
    // And it should NOT have a ? making it optional
    expect(source).not.toMatch(/tooltip\?:\s*string/);
  });

  it('ToastClose button is always partially visible (opacity-50)', () => {
    const source = readComponent('components/ui/toast.tsx');
    const closeSection = source.substring(source.indexOf('ToastClose'));
    expect(closeSection).toContain('opacity-50');
    expect(closeSection).toContain('focus-visible:opacity-100');
  });

  it('Tailwind config includes client-primary color aliases', () => {
    const source = readComponent('tailwind.config.ts');
    expect(source).toContain("'client-primary'");
    expect(source).toContain("'client-primary-dark'");
  });
});
