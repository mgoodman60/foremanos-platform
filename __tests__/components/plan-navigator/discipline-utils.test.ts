import { describe, it, expect, vi } from 'vitest';

// Mock lucide-react icons so we don't need the full icon library in the test environment
vi.mock('lucide-react', () => ({
  Building: {},
  Layers: {},
  Zap: {},
  Droplet: {},
  Wind: {},
  Flame: {},
  MapPin: {},
  Layout: {},
}));

import {
  classifyDiscipline,
  extractSheetNumber,
  generateDocumentSummary,
  generateReferenceSummary,
} from '@/components/plan-navigator/discipline-utils';
import type { DocumentReference, DocumentNode } from '@/components/plan-navigator/types';

// ---------------------------------------------------------------------------
// Helpers to build minimal test fixtures
// ---------------------------------------------------------------------------
function makeNode(overrides: Partial<DocumentNode>): DocumentNode {
  return { id: '', name: '', type: '', outgoingRefs: 0, incomingRefs: 0, ...overrides };
}

function makeRef(overrides: Partial<Omit<DocumentReference, 'sourceDoc' | 'targetDoc'>> & {
  sourceDoc?: Partial<DocumentNode>;
  targetDoc?: Partial<DocumentNode>;
} = {}): DocumentReference {
  const { sourceDoc, targetDoc, ...rest } = overrides;
  return {
    sourceDocumentId: 'src-1',
    targetDocumentId: 'tgt-1',
    referenceType: '',
    location: '',
    context: '',
    ...rest,
    ...(sourceDoc ? { sourceDoc: makeNode(sourceDoc) } : {}),
    ...(targetDoc ? { targetDoc: makeNode(targetDoc) } : {}),
  };
}

// ---------------------------------------------------------------------------
// classifyDiscipline
// ---------------------------------------------------------------------------
describe('classifyDiscipline', () => {
  describe('Architectural discipline', () => {
    it('should match the "A-" prefix pattern', () => {
      expect(classifyDiscipline('A-101 Floor Plan', '')).toBe('Architectural');
    });

    it('should match the "A0" prefix pattern', () => {
      expect(classifyDiscipline('A001 Cover Sheet', '')).toBe('Architectural');
    });

    it('should match the "A1" prefix pattern', () => {
      expect(classifyDiscipline('A101 Floor Plan', '')).toBe('Architectural');
    });

    it('should match the "A2" prefix pattern', () => {
      expect(classifyDiscipline('A201 Elevation', '')).toBe('Architectural');
    });

    it('should match the "ARCH" keyword', () => {
      expect(classifyDiscipline('ARCH-001 General Notes', '')).toBe('Architectural');
    });

    it('should match the "architectural" keyword case-insensitively', () => {
      expect(classifyDiscipline('architectural drawings package', '')).toBe('Architectural');
    });
  });

  describe('Structural discipline', () => {
    it('should match the "S-" prefix pattern', () => {
      expect(classifyDiscipline('S-201 Foundation Plan', '')).toBe('Structural');
    });

    it('should match the "S0" prefix pattern', () => {
      expect(classifyDiscipline('S001 Structural Notes', '')).toBe('Structural');
    });

    it('should match the "S1" prefix pattern', () => {
      expect(classifyDiscipline('S101 Framing Plan', '')).toBe('Structural');
    });

    it('should match the "STRUCT" keyword', () => {
      expect(classifyDiscipline('STRUCT-001 Details', '')).toBe('Structural');
    });

    it('should match the "structural" keyword case-insensitively', () => {
      expect(classifyDiscipline('structural framing plan', '')).toBe('Structural');
    });
  });

  describe('Electrical discipline', () => {
    it('should match the "E-" prefix pattern', () => {
      expect(classifyDiscipline('E-101 Power Plan', '')).toBe('Electrical');
    });

    it('should match the "E0" prefix pattern', () => {
      expect(classifyDiscipline('E001 Electrical Notes', '')).toBe('Electrical');
    });

    it('should match the "E1" prefix pattern', () => {
      expect(classifyDiscipline('E101 Lighting Plan', '')).toBe('Electrical');
    });

    it('should match the "ELEC" keyword', () => {
      expect(classifyDiscipline('ELEC-001 Panel Schedule', '')).toBe('Electrical');
    });

    it('should match the "electrical" keyword case-insensitively', () => {
      expect(classifyDiscipline('electrical one-line diagram', '')).toBe('Electrical');
    });
  });

  describe('Plumbing discipline', () => {
    it('should match the "P-" prefix pattern', () => {
      expect(classifyDiscipline('P-101 Plumbing Plan', '')).toBe('Plumbing');
    });

    it('should match the "P0" prefix pattern', () => {
      expect(classifyDiscipline('P001 Plumbing Notes', '')).toBe('Plumbing');
    });

    it('should match the "P1" prefix pattern', () => {
      expect(classifyDiscipline('P101 Sanitary Plan', '')).toBe('Plumbing');
    });

    it('should match the "PLUMB" keyword', () => {
      expect(classifyDiscipline('PLUMB-001 Riser Diagram', '')).toBe('Plumbing');
    });

    it('should match the "plumbing" keyword case-insensitively', () => {
      expect(classifyDiscipline('plumbing fixture schedule', '')).toBe('Plumbing');
    });
  });

  describe('Mechanical discipline', () => {
    it('should match the "M-" prefix pattern', () => {
      expect(classifyDiscipline('M-101 HVAC Plan', '')).toBe('Mechanical');
    });

    it('should match the "M0" prefix pattern', () => {
      expect(classifyDiscipline('M001 Mechanical Notes', '')).toBe('Mechanical');
    });

    it('should match the "M1" prefix pattern', () => {
      expect(classifyDiscipline('M101 Duct Layout', '')).toBe('Mechanical');
    });

    it('should match the "MECH" keyword', () => {
      expect(classifyDiscipline('MECH-001 Equipment Schedule', '')).toBe('Mechanical');
    });

    it('should match the "mechanical" keyword case-insensitively', () => {
      expect(classifyDiscipline('mechanical equipment plan', '')).toBe('Mechanical');
    });

    it('should match the "HVAC" keyword', () => {
      expect(classifyDiscipline('HVAC system overview', '')).toBe('Mechanical');
    });
  });

  describe('Fire Protection discipline', () => {
    // Implementation note: The 'FP-', 'FP0', and 'FP1' patterns in DISCIPLINE_CONFIG
    // are effectively shadowed by Plumbing's 'P-', 'P0', and 'P1' patterns because the
    // function iterates the config object in insertion order and Plumbing precedes Fire
    // Protection. 'FP001' uppercased contains 'P0', and 'FP101' contains 'P1', so
    // Plumbing wins for those inputs. The reliable unambiguous pattern for Fire
    // Protection is the 'FIRE' keyword.

    it('should match the "FIRE" keyword in the document name', () => {
      expect(classifyDiscipline('FIRE suppression overview', '')).toBe('Fire Protection');
    });

    it('should match the "FIRE" keyword case-insensitively', () => {
      expect(classifyDiscipline('fire protection riser diagram', '')).toBe('Fire Protection');
    });

    it('should match the "FIRE" keyword when embedded in a longer name', () => {
      expect(classifyDiscipline('Building FIRE Alarm Plan', '')).toBe('Fire Protection');
    });

    it('should match the "FIRE" keyword in the category field', () => {
      expect(classifyDiscipline('Sheet 001', 'FIRE protection drawings')).toBe('Fire Protection');
    });

    // Document the actual (shadowed) behaviour of FP prefix patterns
    it('should return Plumbing for "FP001" because "P0" matches Plumbing first', () => {
      // This documents a known limitation: FP0/FP1/FP- prefixes are shadowed by
      // Plumbing's P0/P1/P- patterns since Plumbing is iterated first.
      expect(classifyDiscipline('FP001 Sprinkler Notes', '')).toBe('Plumbing');
    });

    it('should return Plumbing for "FP101" because "P1" matches Plumbing first', () => {
      expect(classifyDiscipline('FP101 Sprinkler Plan', '')).toBe('Plumbing');
    });
  });

  describe('Civil discipline', () => {
    it('should match the "C-" prefix pattern', () => {
      expect(classifyDiscipline('C-101 Grading Plan', '')).toBe('Civil');
    });

    it('should match the "C0" prefix pattern', () => {
      expect(classifyDiscipline('C001 Civil Notes', '')).toBe('Civil');
    });

    it('should match the "C1" prefix pattern', () => {
      expect(classifyDiscipline('C101 Utility Plan', '')).toBe('Civil');
    });

    it('should match the "CIVIL" keyword', () => {
      expect(classifyDiscipline('CIVIL site plan', '')).toBe('Civil');
    });

    it('should match the "SITE" keyword', () => {
      expect(classifyDiscipline('SITE layout plan', '')).toBe('Civil');
    });

    it('should match the "GRADING" keyword', () => {
      expect(classifyDiscipline('GRADING and drainage plan', '')).toBe('Civil');
    });
  });

  describe('General discipline', () => {
    it('should match the "G-" prefix pattern', () => {
      expect(classifyDiscipline('G-001 General Notes', '')).toBe('General');
    });

    it('should match the "G0" prefix pattern', () => {
      expect(classifyDiscipline('G001 Legend Sheet', '')).toBe('General');
    });

    it('should match the "COVER" keyword', () => {
      expect(classifyDiscipline('COVER Sheet', '')).toBe('General');
    });

    it('should match the "INDEX" keyword', () => {
      expect(classifyDiscipline('INDEX of Drawings', '')).toBe('General');
    });

    it('should match the "TITLE" keyword', () => {
      expect(classifyDiscipline('TITLE Sheet', '')).toBe('General');
    });
  });

  describe('Case insensitivity', () => {
    it('should match "A1" pattern case-insensitively', () => {
      // 'a101' uppercased -> 'A101' which contains 'A1'
      expect(classifyDiscipline('a101 floor plan', '')).toBe('Architectural');
    });

    it('should match "structural" keyword case-insensitively in name', () => {
      // Uses the explicit 'structural' keyword pattern, which is uppercased to 'STRUCTURAL'
      expect(classifyDiscipline('structural framing plan', '')).toBe('Structural');
    });

    it('should match "E1" pattern case-insensitively', () => {
      // 'e101' uppercased -> 'E101' which contains 'E1'
      expect(classifyDiscipline('e101 lighting plan', '')).toBe('Electrical');
    });

    it('should match "M1" pattern case-insensitively', () => {
      // 'm101' uppercased -> 'M101' which contains 'M1'
      expect(classifyDiscipline('m101 equipment plan', '')).toBe('Mechanical');
    });
  });

  describe('Category fallback', () => {
    it('should match a pattern found in the category when the name does not match', () => {
      expect(classifyDiscipline('Sheet 001', 'ARCH drawings')).toBe('Architectural');
    });

    it('should match the "structural" pattern in the category field', () => {
      expect(classifyDiscipline('Sheet 002', 'structural set')).toBe('Structural');
    });

    it('should match the "ELEC" pattern found in the category field', () => {
      expect(classifyDiscipline('Drawing 003', 'ELEC package')).toBe('Electrical');
    });
  });

  describe('Other fallback', () => {
    it('should return "Other" when no pattern matches name or category', () => {
      expect(classifyDiscipline('Random Document', 'miscellaneous')).toBe('Other');
    });

    it('should return "Other" for empty strings', () => {
      expect(classifyDiscipline('', '')).toBe('Other');
    });

    it('should return "Other" for a purely numeric name', () => {
      expect(classifyDiscipline('12345', '')).toBe('Other');
    });
  });
});

// ---------------------------------------------------------------------------
// extractSheetNumber
// ---------------------------------------------------------------------------
describe('extractSheetNumber', () => {
  it('should extract a 3-letter-digit sheet number from a descriptive name', () => {
    expect(extractSheetNumber('A101 - Floor Plan')).toBe('A101');
  });

  it('should extract a 4-digit sheet number', () => {
    expect(extractSheetNumber('S201 Structural Framing')).toBe('S201');
  });

  it('should extract a sheet number with a hyphen separator', () => {
    expect(extractSheetNumber('FP-101 Fire Protection')).toBe('FP-101');
  });

  it('should extract a 4-digit long sheet number', () => {
    expect(extractSheetNumber('M1001 Long number')).toBe('M1001');
  });

  it('should return undefined when the name does not start with a valid sheet number', () => {
    expect(extractSheetNumber('No sheet number')).toBeUndefined();
  });

  it('should uppercase the extracted sheet number', () => {
    expect(extractSheetNumber('a101 lowercase plan')).toBe('A101');
  });

  it('should extract two-letter prefix sheet numbers', () => {
    expect(extractSheetNumber('FP101 Sprinkler Plan')).toBe('FP101');
  });

  it('should extract single-letter prefix sheet numbers', () => {
    expect(extractSheetNumber('E201 Power Plan')).toBe('E201');
  });

  it('should return undefined for a name that starts with digits only', () => {
    // Pattern requires at least one letter at the start
    expect(extractSheetNumber('101 General Notes')).toBeUndefined();
  });

  it('should return undefined for an empty string', () => {
    expect(extractSheetNumber('')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateDocumentSummary
// ---------------------------------------------------------------------------
describe('generateDocumentSummary', () => {
  describe('Name keyword matching', () => {
    it('should return the floor plan description', () => {
      expect(generateDocumentSummary('A101 Floor Plan Level 1', 'plans_drawings', 'Architectural')).toBe(
        'Room layout and spatial organization'
      );
    });

    it('should return the elevation description', () => {
      expect(generateDocumentSummary('A201 South Elevation', 'plans_drawings', 'Architectural')).toBe(
        'Vertical views showing exterior/interior heights'
      );
    });

    it('should return the section description', () => {
      expect(generateDocumentSummary('A301 Building Section', 'plans_drawings', 'Architectural')).toBe(
        'Cut-through view revealing internal construction'
      );
    });

    it('should return the detail description', () => {
      expect(generateDocumentSummary('A401 Wall Detail', 'plans_drawings', 'Architectural')).toBe(
        'Enlarged view of specific construction assembly'
      );
    });

    it('should return the schedule description for a name containing "schedule"', () => {
      expect(generateDocumentSummary('Door Schedule', 'plans_drawings', 'Architectural')).toBe(
        'Tabular listing of components and specifications'
      );
    });

    it('should return the diagram description', () => {
      expect(generateDocumentSummary('E101 One-Line Diagram', 'plans_drawings', 'Electrical')).toBe(
        'Schematic showing system connections'
      );
    });

    it('should return the site description', () => {
      expect(generateDocumentSummary('C101 Site Plan', 'plans_drawings', 'Civil')).toBe(
        'Property boundaries, grading, and site features'
      );
    });

    it('should return the foundation description', () => {
      expect(generateDocumentSummary('S101 Foundation Plan', 'plans_drawings', 'Structural')).toBe(
        'Below-grade structural support systems'
      );
    });

    it('should return the roof description', () => {
      expect(generateDocumentSummary('A501 Roof Plan', 'plans_drawings', 'Architectural')).toBe(
        'Roofing materials and drainage'
      );
    });

    it('should return the reflected ceiling description', () => {
      expect(generateDocumentSummary('A601 Reflected Ceiling Plan', 'plans_drawings', 'Architectural')).toBe(
        'Ceiling layout with lighting and MEP'
      );
    });

    it('should return the budget description for a budget name', () => {
      expect(generateDocumentSummary('Project Budget 2025', 'budget_cost', 'Other')).toBe(
        'Cost breakdown and financial tracking'
      );
    });

    it('should return the grading description', () => {
      expect(generateDocumentSummary('Grading and Drainage Plan', 'plans_drawings', 'Civil')).toBe(
        'Site elevations and earthwork'
      );
    });

    it('should return the utility description', () => {
      expect(generateDocumentSummary('Utility Layout Plan', 'plans_drawings', 'Civil')).toBe(
        'Underground services and connections'
      );
    });

    it('should return the demolition description', () => {
      expect(generateDocumentSummary('Demolition Plan Level 1', 'plans_drawings', 'Architectural')).toBe(
        'Elements to be removed or modified'
      );
    });
  });

  describe('Category-based fallback', () => {
    it('should return category description combined with discipline content', () => {
      const result = generateDocumentSummary('Sheet 001', 'plans_drawings', 'Electrical');
      expect(result).toBe(
        'Construction drawing showing design intent and specifications - power distribution, lighting, and systems'
      );
    });

    it('should return category description without discipline when discipline is Other', () => {
      const result = generateDocumentSummary('Invoice Q3', 'budget_cost', 'Other');
      expect(result).toBe('Financial document for cost tracking and budget management');
    });

    it('should return schedule category description with discipline content', () => {
      // Name must not trigger name keywords ('Phase 2 Summary' avoids 'schedule')
      const result = generateDocumentSummary('Phase 2 Summary', 'schedule', 'Structural');
      expect(result).toBe(
        'Project timeline with task sequencing and milestones - load-bearing elements, foundations, and framing'
      );
    });

    it('should return specifications category description with discipline content', () => {
      // 'Spec Section 03300' triggers the 'section' name keyword first; use a neutral name
      const result = generateDocumentSummary('Division 03 Requirements', 'specifications', 'Architectural');
      expect(result).toBe(
        'Technical requirements and material standards - building layout, dimensions, and finishes'
      );
    });

    it('should return contracts category description without discipline for Other', () => {
      const result = generateDocumentSummary('RFI Log', 'contracts', 'Other');
      expect(result).toBe('Legal agreements, project contracts, RFIs, and submittals');
    });

    it('should return daily reports category description', () => {
      const result = generateDocumentSummary('Weekly Field Report', 'daily_reports', 'Other');
      expect(result).toBe('Project status reports and daily documentation');
    });

    it('should return photos category description', () => {
      // 'Site Photos' triggers the 'site' name keyword first; use a neutral name
      const result = generateDocumentSummary('Field Documentation', 'photos', 'Other');
      expect(result).toBe('Field photos and visual documentation');
    });
  });

  describe('Discipline-based fallback', () => {
    it('should return discipline drawing summary when category does not match', () => {
      const result = generateDocumentSummary('Unnamed Document', 'unknown_cat', 'Mechanical');
      expect(result).toBe('Drawing showing HVAC systems, ventilation, and equipment');
    });

    it('should return the Plumbing discipline fallback', () => {
      const result = generateDocumentSummary('P-Document', 'unknown_cat', 'Plumbing');
      expect(result).toBe('Drawing showing water supply, drainage, and fixtures');
    });

    it('should return the Fire Protection discipline fallback', () => {
      const result = generateDocumentSummary('FP-Document', 'unknown_cat', 'Fire Protection');
      expect(result).toBe('Drawing showing fire suppression systems and egress');
    });
  });

  describe('Default fallback', () => {
    it('should return the default fallback string when nothing matches', () => {
      const result = generateDocumentSummary('Unnamed Document', 'unknown_cat', 'Other');
      expect(result).toBe('Project documentation for reference');
    });

    it('should return the default fallback for empty inputs with Other discipline', () => {
      const result = generateDocumentSummary('', '', 'Other');
      expect(result).toBe('Project documentation for reference');
    });
  });
});

// ---------------------------------------------------------------------------
// generateReferenceSummary
// ---------------------------------------------------------------------------
describe('generateReferenceSummary', () => {
  describe('Detail references', () => {
    it('should mention the detail number when context contains a detail callout', () => {
      const ref = makeRef({
        referenceType: 'detail',
        context: 'See detail #3 at wall condition',
        targetDoc: { id: 'tgt-1', name: 'A401 Wall Details', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Detail 3');
      expect(result).toContain('A401 Wall Details');
    });

    it('should append "at wall condition" when context contains "wall"', () => {
      const ref = makeRef({
        referenceType: 'detail',
        context: 'detail #5 wall condition',
        targetDoc: { id: 'tgt-1', name: 'A501 Details', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('at wall condition');
    });

    it('should append "at floor connection" when context contains "floor"', () => {
      const ref = makeRef({
        referenceType: 'detail',
        context: 'detail #2 at floor connection',
        targetDoc: { id: 'tgt-1', name: 'A502 Details', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('at floor connection');
    });

    it('should return a fallback detail message when no detail number is found', () => {
      const ref = makeRef({
        referenceType: 'detail',
        context: 'see detail',
        targetDoc: { id: 'tgt-1', name: 'A401 Details', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('enlarged detail');
      expect(result).toContain('A401 Details');
    });
  });

  describe('Section references', () => {
    it('should mention the section identifier when referenceType is "section"', () => {
      const ref = makeRef({
        referenceType: 'section',
        context: 'see section A5',
        targetDoc: { id: 'tgt-1', name: 'A301 Sections', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Section');
      expect(result).toContain('A301 Sections');
    });

    it('should append "through wall assembly" when context contains "wall"', () => {
      const ref = makeRef({
        referenceType: 'section',
        context: 'section A3 through wall assembly',
        targetDoc: { id: 'tgt-1', name: 'A301 Sections', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('through wall assembly');
    });

    it('should append "of building envelope" when context contains "building"', () => {
      const ref = makeRef({
        referenceType: 'section',
        context: 'section B2 building envelope',
        targetDoc: { id: 'tgt-1', name: 'A302 Sections', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('of building envelope');
    });
  });

  describe('Cross-discipline coordination', () => {
    it('should describe Architectural to Structural coordination', () => {
      const ref = makeRef({
        referenceType: 'coordination',
        context: 'verify structural support',
        sourceDoc: { id: 'src-1', name: 'A101 Floor Plan', type: 'drawing' },
        targetDoc: { id: 'tgt-1', name: 'S101 Framing Plan', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Architectural');
      expect(result).toContain('Structural');
      expect(result).toContain('structural elements');
    });

    it('should describe a coordination with Mechanical target', () => {
      const ref = makeRef({
        referenceType: 'coordination',
        context: 'coordinate ductwork',
        sourceDoc: { id: 'src-1', name: 'A201 Elevation', type: 'drawing' },
        targetDoc: { id: 'tgt-1', name: 'M101 HVAC Plan', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Mechanical');
      expect(result).toContain('HVAC systems');
    });
  });

  describe('Sheet references', () => {
    it('should reference the sheet number found in context', () => {
      const ref = makeRef({
        referenceType: 'cross-reference',
        context: 'see sheet A101 for details',
        targetDoc: { id: 'tgt-1', name: 'A101 Floor Plan', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Sheet');
      expect(result).toContain('A101');
    });

    it('should include target discipline in the sheet reference summary', () => {
      const ref = makeRef({
        referenceType: 'cross-reference',
        context: 'see sheet S201',
        sourceDoc: { id: 'src-1', name: 'A101 Floor Plan', type: 'drawing' },
        targetDoc: { id: 'tgt-1', name: 'S201 Foundation Plan', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Structural');
    });
  });

  describe('Verify/confirm references', () => {
    it('should return a field verification message when context contains "verify"', () => {
      // referenceType must not be 'detail', 'section', 'elevation', 'schedule', or 'note'
      // because those branches return early before the verify check is reached.
      // Context must also not contain 'schedule' (another early branch).
      const ref = makeRef({
        referenceType: 'coordination',
        context: 'verify dimensions before installation',
        targetDoc: { id: 'tgt-1', name: 'S101 Foundation Plan', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Field verification required');
      expect(result).toContain('S101 Foundation Plan');
    });

    it('should return a field verification message when context contains "confirm"', () => {
      const ref = makeRef({
        referenceType: 'coordination',
        context: 'confirm alignment with structural drawings',
        targetDoc: { id: 'tgt-1', name: 'A101 Floor Plan', type: 'drawing' },
      });
      const result = generateReferenceSummary(ref);
      expect(result).toContain('Field verification required');
      expect(result).toContain('A101 Floor Plan');
    });
  });

  describe('Default fallback', () => {
    it('should return the default fallback when no conditions match', () => {
      const ref = makeRef({
        referenceType: '',
        context: '',
        location: '',
      });
      const result = generateReferenceSummary(ref);
      expect(result).toBe(
        'Cross-reference for construction coordination - click to view related documents'
      );
    });
  });
});
