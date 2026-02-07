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

describe('Collapsible Section Accessibility', () => {
  it('TakeoffTable category toggles have aria-expanded', () => {
    // Read TakeoffTable source
    const source = readComponent('components/takeoff/TakeoffTable.tsx');
    // Verify aria-expanded is present near toggle/collapse logic
    expect(source).toContain('aria-expanded');
  });

  it('earthwork-calculator toggles have aria-expanded', () => {
    const source = readComponent('components/earthwork-calculator.tsx');
    expect(source).toContain('aria-expanded');
  });

  it('scope-gap-analysis toggles have aria-expanded', () => {
    const source = readComponent('components/scope-gap-analysis.tsx');
    expect(source).toContain('aria-expanded');
  });
});

describe('Form Accessibility', () => {
  it('crew-performance-form uses fieldset for form groups', () => {
    const source = readComponent('components/crew-performance-form.tsx');
    expect(source).toContain('<fieldset');
    expect(source).toContain('<legend');
  });

  it('crew-performance-form has aria-required on required fields', () => {
    const source = readComponent('components/crew-performance-form.tsx');
    expect(source).toContain('aria-required="true"');
  });

  it('guest-credential-modal uses aria-label not title on icon buttons', () => {
    const source = readComponent('components/guest-credential-modal.tsx');
    expect(source).toContain('aria-label=');
    // Check that Copy buttons specifically use aria-label
    expect(source).toMatch(/aria-label=["']Copy/);
  });
});

describe('Wizard Accessibility', () => {
  it('onboarding-wizard has aria-current on active step', () => {
    const source = readComponent('components/onboarding-wizard.tsx');
    expect(source).toContain('aria-current');
  });

  it('onboarding-wizard progress bar has proper ARIA attributes', () => {
    const source = readComponent('components/onboarding-wizard.tsx');
    expect(source).toContain('role="progressbar"');
    expect(source).toContain('aria-valuenow');
    expect(source).toContain('aria-valuemin');
    expect(source).toContain('aria-valuemax');
    expect(source).toContain('aria-label');
  });
});
