import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFs = vi.hoisted(() => ({
  readFileSync: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('fs', () => ({ default: mockFs, ...mockFs }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

import { loadSymbolContext, _resetCache } from '@/lib/symbol-context-loader';

const MINIMAL_LIBRARY = {
  metadata: { version: '1.0.0' },
  'Division 01 - General Requirements': [
    {
      id: 'D01-GEN-001',
      symbol_name: 'North Arrow',
      vision_hints: 'Look for prominent arrow with N label.',
    },
    {
      id: 'D01-GEN-002',
      symbol_name: 'Section Cut Marker',
      vision_hints: 'Circle with internal divider.',
    },
  ],
  'Division 22 - Plumbing': [
    {
      id: 'D22-PLB-001',
      symbol_name: 'Lavatory',
      vision_hints: 'Oval or rounded rectangle at wall.',
    },
    {
      id: 'D22-PLB-002',
      symbol_name: 'Water Closet',
      vision_hints: 'Elongated oval with tank against wall.',
    },
  ],
  'Division 26 - Electrical': [
    {
      id: 'D26-ELE-001',
      symbol_name: 'Duplex Receptacle',
      vision_hints: 'Circle with two short parallel lines.',
    },
  ],
  'Division 23 - Heating, Ventilating, and Air Conditioning (HVAC)': [
    {
      id: 'D23-MEC-001',
      symbol_name: 'Supply Air Duct',
      vision_hints: 'Rectangular outline with airflow arrows.',
    },
  ],
  'Common Hatch Patterns (Section Fills)': [
    {
      id: 'HATCH-001',
      symbol_name: 'Concrete',
      vision_hints: 'Random dots, not organized.',
    },
  ],
  'Common Line Types': [
    {
      id: 'LINE-001',
      symbol_name: 'Object Line',
      vision_hints: 'Standard solid line.',
    },
  ],
};

describe('symbol-context-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCache();
  });

  it('returns formatted symbol hints for a discipline', () => {
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(MINIMAL_LIBRARY));

    const result = loadSymbolContext('Plumbing');

    expect(result).toContain('SYMBOL REFERENCE:');
    expect(result).toContain('- North Arrow:');
    expect(result).toContain('- Lavatory:');
    expect(result).toContain('- Water Closet:');
    // Plumbing includes Div 01 + Div 22 + Hatch
    expect(result).toContain('- Concrete:');
    // Should NOT include Electrical (Div 26)
    expect(result).not.toContain('- Duplex Receptacle:');
  });

  it('returns empty string when library file is missing', () => {
    mockFs.readFileSync.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });

    const result = loadSymbolContext('Architectural');

    expect(result).toBe('');
  });

  it('returns General division symbols for unknown discipline', () => {
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(MINIMAL_LIBRARY));

    const result = loadSymbolContext('UnknownDiscipline');

    // Falls back to General which maps to Div 01 only
    expect(result).toContain('- North Arrow:');
    expect(result).not.toContain('- Lavatory:');
  });

  it('includes hatch patterns for Architectural discipline', () => {
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(MINIMAL_LIBRARY));

    const result = loadSymbolContext('Architectural');

    expect(result).toContain('- Concrete:');
    expect(result).toContain('- Object Line:');
  });

  it('includes HVAC symbols for Mechanical discipline', () => {
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(MINIMAL_LIBRARY));

    const result = loadSymbolContext('Mechanical');

    expect(result).toContain('- Supply Air Duct:');
    expect(result).toContain('- Concrete:'); // Hatch included for Mechanical
  });

  it('caches the library across calls', () => {
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(MINIMAL_LIBRARY));

    loadSymbolContext('Plumbing');
    loadSymbolContext('Electrical');

    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('caps symbols at MAX_SYMBOLS (20)', () => {
    // Create a library with 30+ symbols in one division
    const bigLibrary = {
      metadata: {},
      'Division 01 - General Requirements': Array.from({ length: 30 }, (_, i) => ({
        id: `D01-GEN-${i}`,
        symbol_name: `Symbol ${i}`,
        vision_hints: `Hint for symbol ${i}`,
      })),
    };
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(bigLibrary));

    const result = loadSymbolContext('General');

    const lineCount = result
      .split('\n')
      .filter((line: string) => line.startsWith('- Symbol')).length;
    expect(lineCount).toBeLessThanOrEqual(20);
  });

  it('skips symbols without vision_hints', () => {
    const libraryWithMissing = {
      metadata: {},
      'Division 01 - General Requirements': [
        { id: 'D01-1', symbol_name: 'Good', vision_hints: 'Has hints' },
        { id: 'D01-2', symbol_name: 'Bad', vision_hints: '' },
        { id: 'D01-3', symbol_name: 'Missing' },
      ],
    };
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(libraryWithMissing));

    const result = loadSymbolContext('General');

    expect(result).toContain('- Good:');
    expect(result).not.toContain('- Bad:');
    expect(result).not.toContain('- Missing:');
  });

  it('includes Electrical divisions (26, 27, 28) for Electrical', () => {
    mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(MINIMAL_LIBRARY));

    const result = loadSymbolContext('Electrical');

    expect(result).toContain('- Duplex Receptacle:');
    expect(result).toContain('- North Arrow:'); // Div 01
    // Should NOT include Plumbing or Mechanical
    expect(result).not.toContain('- Lavatory:');
    expect(result).not.toContain('- Supply Air Duct:');
  });
});
