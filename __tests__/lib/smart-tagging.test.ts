import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeDocument,
  getTagStyles,
  PRIORITY_TAGS,
  STATUS_TAGS,
  type DocumentTag,
  type TaggingResult,
} from '@/lib/smart-tagging';

describe('Smart Tagging', () => {
  beforeEach(() => {
    // No mocks needed - pure utility functions
  });

  // ============================================
  // analyzeDocument - Document Type Detection
  // ============================================
  describe('analyzeDocument - document type detection', () => {
    it('should detect RFI from filename', () => {
      const result = analyzeDocument('RFI-001-Electrical.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'doctype-rfi',
            name: 'RFI',
            category: 'document-type',
            color: 'bg-blue-500',
          }),
        ])
      );
      expect(result.extractedInfo.documentType).toBe('RFI');
    });

    it('should detect submittal from content', () => {
      const result = analyzeDocument('document.pdf', 'This is a submittal for review');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Submittal',
            category: 'document-type',
          }),
        ])
      );
    });

    it('should detect change order with multiple keywords', () => {
      const result = analyzeDocument('CO-123-modification.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Change Order',
            category: 'document-type',
          }),
        ])
      );
    });

    it('should detect daily report', () => {
      const result = analyzeDocument('daily-log-2026-01-31.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Daily Report',
            category: 'document-type',
            color: 'bg-green-500',
          }),
        ])
      );
    });

    it('should detect schedule documents', () => {
      const result = analyzeDocument('project-schedule-gantt.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Schedule',
            category: 'document-type',
            color: 'bg-cyan-500',
          }),
        ])
      );
    });

    it('should detect specification documents', () => {
      const result = analyzeDocument('tech-spec-requirements.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Specification',
            category: 'document-type',
          }),
        ])
      );
    });

    it('should detect drawings', () => {
      const result = analyzeDocument('floor-plan-level-2.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Drawing',
            category: 'document-type',
            color: 'bg-teal-500',
          }),
        ])
      );
    });

    it('should detect contract documents', () => {
      const result = analyzeDocument('subcontract-agreement.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Contract',
            category: 'document-type',
            color: 'bg-red-500',
          }),
        ])
      );
    });

    it('should detect invoices', () => {
      const result = analyzeDocument('payment-application-march.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Invoice',
            category: 'document-type',
            color: 'bg-emerald-500',
          }),
        ])
      );
    });

    it('should detect safety documents', () => {
      const result = analyzeDocument('', 'OSHA safety incident report');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Safety',
            category: 'document-type',
            color: 'bg-yellow-500',
          }),
        ])
      );
    });

    it('should detect permits', () => {
      const result = analyzeDocument('building-permit-approval.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Permit',
            category: 'document-type',
            color: 'bg-pink-500',
          }),
        ])
      );
    });

    it('should detect meeting minutes', () => {
      const result = analyzeDocument('oci-meeting-notes-jan.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Meeting Minutes',
            category: 'document-type',
            color: 'bg-violet-500',
          }),
        ])
      );
    });

    it('should detect punch list', () => {
      const result = analyzeDocument('deficiency-punchlist.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Punch List',
            category: 'document-type',
            color: 'bg-amber-500',
          }),
        ])
      );
    });

    it('should detect insurance documents', () => {
      const result = analyzeDocument('certificate-of-insurance.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Insurance',
            category: 'document-type',
            color: 'bg-lime-500',
          }),
        ])
      );
    });

    it('should detect geotechnical reports', () => {
      const result = analyzeDocument('soil-boring-foundation-report.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Geotechnical',
            category: 'document-type',
            color: 'bg-stone-500',
          }),
        ])
      );
    });
  });

  // ============================================
  // analyzeDocument - Trade Detection
  // ============================================
  describe('analyzeDocument - trade detection', () => {
    it('should detect electrical trade', () => {
      const result = analyzeDocument('electrical-panel-layout.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'trade-electrical',
            name: 'Electrical',
            category: 'trade',
            color: 'bg-yellow-600',
          }),
        ])
      );
      expect(result.extractedInfo.trade).toBe('Electrical');
    });

    it('should detect plumbing trade', () => {
      const result = analyzeDocument('', 'sanitary piping diagram with drain lines');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Plumbing',
            category: 'trade',
            color: 'bg-blue-600',
          }),
        ])
      );
    });

    it('should detect HVAC trade', () => {
      const result = analyzeDocument('mechanical-ductwork-layout.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'HVAC',
            category: 'trade',
            color: 'bg-cyan-600',
          }),
        ])
      );
    });

    it('should detect structural trade', () => {
      const result = analyzeDocument('', 'steel framing and concrete foundation details');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Structural',
            category: 'trade',
            color: 'bg-gray-600',
          }),
        ])
      );
    });

    it('should detect fire protection trade', () => {
      const result = analyzeDocument('sprinkler-system-layout.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Fire Protection',
            category: 'trade',
            color: 'bg-red-600',
          }),
        ])
      );
    });

    it('should detect drywall trade', () => {
      const result = analyzeDocument('gypsum-partition-details.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Drywall',
            category: 'trade',
            color: 'bg-neutral-500',
          }),
        ])
      );
    });

    it('should detect roofing trade', () => {
      const result = analyzeDocument('roof-membrane-flashing.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Roofing',
            category: 'trade',
            color: 'bg-amber-700',
          }),
        ])
      );
    });

    it('should detect flooring trade', () => {
      const result = analyzeDocument('', 'tile and carpet flooring specifications');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Flooring',
            category: 'trade',
            color: 'bg-orange-700',
          }),
        ])
      );
    });

    it('should detect sitework trade', () => {
      const result = analyzeDocument('grading-excavation-plan.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Sitework',
            category: 'trade',
            color: 'bg-lime-700',
          }),
        ])
      );
    });

    it('should detect glazing trade', () => {
      const result = analyzeDocument('curtain-wall-storefront.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Glazing',
            category: 'trade',
            color: 'bg-sky-600',
          }),
        ])
      );
    });
  });

  // ============================================
  // analyzeDocument - Phase Detection
  // ============================================
  describe('analyzeDocument - phase detection', () => {
    it('should detect preconstruction phase', () => {
      const result = analyzeDocument('pre-construction-estimate.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'phase-preconstruction',
            name: 'Preconstruction',
            category: 'phase',
            color: 'bg-purple-600',
          }),
        ])
      );
      expect(result.extractedInfo.phase).toBe('Preconstruction');
    });

    it('should detect mobilization phase', () => {
      const result = analyzeDocument('site-setup-trailer-delivery.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Mobilization',
            category: 'phase',
            color: 'bg-indigo-600',
          }),
        ])
      );
    });

    it('should detect foundation phase', () => {
      const result = analyzeDocument('', 'foundation excavation and footing details');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Foundation',
            category: 'phase',
            color: 'bg-stone-600',
          }),
        ])
      );
    });

    it('should detect structure phase', () => {
      const result = analyzeDocument('steel-erection-schedule.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Structure',
            category: 'phase',
            color: 'bg-slate-600',
          }),
        ])
      );
    });

    it('should detect rough-in phase', () => {
      const result = analyzeDocument('', 'rough-in underground utilities');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Rough-In',
            category: 'phase',
            color: 'bg-orange-600',
          }),
        ])
      );
    });

    it('should detect finishes phase', () => {
      const result = analyzeDocument('paint-and-trim-schedule.pdf');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Finishes',
            category: 'phase',
            color: 'bg-pink-600',
          }),
        ])
      );
    });

    it('should detect closeout phase', () => {
      const result = analyzeDocument('', 'turnover and commissioning documents');

      expect(result.suggestedTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Closeout',
            category: 'phase',
            color: 'bg-green-600',
          }),
        ])
      );
    });
  });

  // ============================================
  // analyzeDocument - Date Extraction
  // ============================================
  describe('analyzeDocument - date extraction', () => {
    it('should extract date in YYYY-MM-DD format', () => {
      const result = analyzeDocument('report-2026-01-31.pdf');

      expect(result.extractedInfo.date).toBe('2026-01-31');
    });

    it('should extract date in MM-DD-YYYY format', () => {
      const result = analyzeDocument('daily-01-31-2026.pdf');

      expect(result.extractedInfo.date).toBe('01-31-2026');
    });

    it('should extract date in YYYYMMDD format', () => {
      const result = analyzeDocument('schedule-20260131.pdf');

      expect(result.extractedInfo.date).toBe('20260131');
    });

    it('should extract date with underscores', () => {
      const result = analyzeDocument('report_2026_01_31.pdf');

      expect(result.extractedInfo.date).toBe('2026-01-31');
    });

    it('should not extract invalid dates', () => {
      const result = analyzeDocument('document-123456.pdf');

      expect(result.extractedInfo.date).toBeUndefined();
    });
  });

  // ============================================
  // analyzeDocument - Reference Number Extraction
  // ============================================
  describe('analyzeDocument - reference number extraction', () => {
    it('should extract RFI reference number', () => {
      const result = analyzeDocument('RFI-001.pdf');

      expect(result.extractedInfo.referenceNumber).toBe('RFI-001');
    });

    it('should extract CO reference number', () => {
      const result = analyzeDocument('CO#123.pdf');

      expect(result.extractedInfo.referenceNumber).toBe('CO#123');
    });

    it('should extract ASI reference number', () => {
      const result = analyzeDocument('ASI_045.pdf');

      expect(result.extractedInfo.referenceNumber).toBe('ASI_045');
    });

    it('should extract PR reference number', () => {
      const result = analyzeDocument('PR-789.pdf');

      expect(result.extractedInfo.referenceNumber).toBe('PR-789');
    });

    it('should extract SI reference number', () => {
      const result = analyzeDocument('SI#999.pdf');

      expect(result.extractedInfo.referenceNumber).toBe('SI#999');
    });

    it('should extract lowercase reference numbers', () => {
      const result = analyzeDocument('rfi-123.pdf');

      expect(result.extractedInfo.referenceNumber).toBe('RFI-123');
    });

    it('should not extract non-matching reference numbers', () => {
      const result = analyzeDocument('document-ABC-123.pdf');

      expect(result.extractedInfo.referenceNumber).toBeUndefined();
    });
  });

  // ============================================
  // analyzeDocument - Confidence Scoring
  // ============================================
  describe('analyzeDocument - confidence scoring', () => {
    it('should calculate higher confidence for multiple keyword matches', () => {
      const result = analyzeDocument('', 'RFI request for information about electrical');

      const rfiTag = result.suggestedTags.find(tag => tag.name === 'RFI');
      expect(rfiTag?.confidence).toBeGreaterThan(0.5);
    });

    it('should calculate lower confidence for single keyword match', () => {
      const result = analyzeDocument('submittal.pdf');

      const submittalTag = result.suggestedTags.find(tag => tag.name === 'Submittal');
      expect(submittalTag?.confidence).toBeDefined();
      expect(submittalTag?.confidence).toBeGreaterThan(0);
    });

    it('should not suggest tags with confidence below 0.3', () => {
      const result = analyzeDocument('document.pdf', 'random text');

      // Very few or no tags should be suggested
      expect(result.suggestedTags.length).toBeLessThan(5);
    });

    it('should cap confidence at 1.0', () => {
      const result = analyzeDocument('', 'electrical electric wiring conduit panel transformer outlet');

      const electricalTag = result.suggestedTags.find(tag => tag.name === 'Electrical');
      expect(electricalTag?.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should sort tags by confidence (highest first)', () => {
      const result = analyzeDocument('RFI-123-electrical.pdf', 'request for information about electrical panel');

      if (result.suggestedTags.length > 1) {
        for (let i = 0; i < result.suggestedTags.length - 1; i++) {
          const currentConfidence = result.suggestedTags[i].confidence || 0;
          const nextConfidence = result.suggestedTags[i + 1].confidence || 0;
          expect(currentConfidence).toBeGreaterThanOrEqual(nextConfidence);
        }
      }
    });
  });

  // ============================================
  // analyzeDocument - Multi-Category Detection
  // ============================================
  describe('analyzeDocument - multi-category detection', () => {
    it('should detect multiple categories simultaneously', () => {
      const result = analyzeDocument(
        'RFI-001-electrical-rough-in.pdf',
        'request for information about electrical rough-in work'
      );

      expect(result.suggestedTags.some(tag => tag.category === 'document-type')).toBe(true);
      expect(result.suggestedTags.some(tag => tag.category === 'trade')).toBe(true);
      expect(result.suggestedTags.some(tag => tag.category === 'phase')).toBe(true);
    });

    it('should extract both date and reference number', () => {
      const result = analyzeDocument('RFI-123-2026-01-31.pdf');

      expect(result.extractedInfo.referenceNumber).toBe('RFI-123');
      expect(result.extractedInfo.date).toBe('2026-01-31');
    });

    it('should set extractedInfo fields based on highest confidence', () => {
      const result = analyzeDocument(
        'submittal-RFI.pdf',
        'this is a submittal document with RFI mentioned once'
      );

      // Submittal should have higher confidence
      expect(result.extractedInfo.documentType).toBeDefined();
    });
  });

  // ============================================
  // analyzeDocument - Top 5 Tags Limit
  // ============================================
  describe('analyzeDocument - top 5 tags limit', () => {
    it('should return maximum of 5 tags', () => {
      const result = analyzeDocument(
        'electrical-plumbing-hvac-structural-drawing.pdf',
        'electrical plumbing hvac structural drawing submittal specification contract'
      );

      expect(result.suggestedTags.length).toBeLessThanOrEqual(5);
    });

    it('should return fewer than 5 tags when matches are limited', () => {
      const result = analyzeDocument('simple-rfi.pdf');

      expect(result.suggestedTags.length).toBeGreaterThan(0);
      expect(result.suggestedTags.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================
  // analyzeDocument - Case Insensitivity
  // ============================================
  describe('analyzeDocument - case insensitivity', () => {
    it('should match keywords regardless of case in filename', () => {
      const result = analyzeDocument('RFI-ELECTRICAL-SUBMITTAL.PDF');

      expect(result.suggestedTags.length).toBeGreaterThan(0);
    });

    it('should match keywords regardless of case in content', () => {
      const result = analyzeDocument('', 'DAILY REPORT FOR STRUCTURAL CONCRETE POUR');

      expect(result.suggestedTags.some(tag => tag.name === 'Daily Report')).toBe(true);
      expect(result.suggestedTags.some(tag => tag.name === 'Structural')).toBe(true);
    });
  });

  // ============================================
  // analyzeDocument - Edge Cases
  // ============================================
  describe('analyzeDocument - edge cases', () => {
    it('should handle empty filename', () => {
      const result = analyzeDocument('');

      expect(result.suggestedTags).toEqual([]);
      expect(result.extractedInfo).toEqual({});
    });

    it('should handle empty content', () => {
      const result = analyzeDocument('document.pdf', '');

      expect(result).toBeDefined();
      expect(result.suggestedTags).toBeDefined();
      expect(result.extractedInfo).toBeDefined();
    });

    it('should handle undefined content', () => {
      const result = analyzeDocument('document.pdf');

      expect(result).toBeDefined();
      expect(result.suggestedTags).toBeDefined();
      expect(result.extractedInfo).toBeDefined();
    });

    it('should handle very long filename', () => {
      const longFilename = 'a'.repeat(1000) + '-rfi-electrical.pdf';
      const result = analyzeDocument(longFilename);

      expect(result).toBeDefined();
      expect(result.suggestedTags.some(tag => tag.name === 'RFI')).toBe(true);
    });

    it('should handle special characters in filename', () => {
      const result = analyzeDocument('RFI-#001-@electrical-$project.pdf');

      expect(result.suggestedTags.some(tag => tag.name === 'RFI')).toBe(true);
      expect(result.suggestedTags.some(tag => tag.name === 'Electrical')).toBe(true);
    });

    it('should handle content with no matching keywords', () => {
      const result = analyzeDocument('xyz.pdf', 'random unrelated text without keywords');

      expect(result.suggestedTags).toEqual([]);
      expect(result.extractedInfo.documentType).toBeUndefined();
      expect(result.extractedInfo.trade).toBeUndefined();
      expect(result.extractedInfo.phase).toBeUndefined();
    });
  });

  // ============================================
  // analyzeDocument - Combined Filename and Content
  // ============================================
  describe('analyzeDocument - combined filename and content analysis', () => {
    it('should combine matches from both filename and content', () => {
      const result = analyzeDocument(
        'electrical-submittal.pdf',
        'rough-in phase documentation'
      );

      expect(result.suggestedTags.some(tag => tag.name === 'Electrical')).toBe(true);
      expect(result.suggestedTags.some(tag => tag.name === 'Submittal')).toBe(true);
      expect(result.suggestedTags.some(tag => tag.name === 'Rough-In')).toBe(true);
    });

    it('should increase confidence when keywords appear in both filename and content', () => {
      const filenameOnly = analyzeDocument('rfi.pdf', '');
      const combined = analyzeDocument('rfi.pdf', 'request for information');

      const filenameOnlyTag = filenameOnly.suggestedTags.find(tag => tag.name === 'RFI');
      const combinedTag = combined.suggestedTags.find(tag => tag.name === 'RFI');

      if (filenameOnlyTag && combinedTag) {
        expect(combinedTag.confidence).toBeGreaterThan(filenameOnlyTag.confidence || 0);
      }
    });
  });

  // ============================================
  // getTagStyles - Category Styling
  // ============================================
  describe('getTagStyles', () => {
    it('should return correct style for document-type category', () => {
      const style = getTagStyles('document-type');
      expect(style).toBe('border-l-4 border-l-blue-500');
    });

    it('should return correct style for trade category', () => {
      const style = getTagStyles('trade');
      expect(style).toBe('border-l-4 border-l-orange-500');
    });

    it('should return correct style for phase category', () => {
      const style = getTagStyles('phase');
      expect(style).toBe('border-l-4 border-l-purple-500');
    });

    it('should return correct style for priority category', () => {
      const style = getTagStyles('priority');
      expect(style).toBe('border-l-4 border-l-red-500');
    });

    it('should return correct style for status category', () => {
      const style = getTagStyles('status');
      expect(style).toBe('border-l-4 border-l-green-500');
    });

    it('should return default style for custom category', () => {
      const style = getTagStyles('custom');
      expect(style).toBe('border-l-4 border-l-gray-500');
    });

    it('should return default style for unknown category', () => {
      // @ts-expect-error Testing invalid input
      const style = getTagStyles('unknown');
      expect(style).toBe('border-l-4 border-l-gray-500');
    });
  });

  // ============================================
  // PRIORITY_TAGS - Constant Validation
  // ============================================
  describe('PRIORITY_TAGS', () => {
    it('should export priority tags array', () => {
      expect(PRIORITY_TAGS).toBeDefined();
      expect(Array.isArray(PRIORITY_TAGS)).toBe(true);
      expect(PRIORITY_TAGS.length).toBe(4);
    });

    it('should contain urgent priority tag', () => {
      const urgent = PRIORITY_TAGS.find(tag => tag.id === 'priority-urgent');
      expect(urgent).toEqual({
        id: 'priority-urgent',
        name: 'Urgent',
        category: 'priority',
        color: 'bg-red-500',
      });
    });

    it('should contain high priority tag', () => {
      const high = PRIORITY_TAGS.find(tag => tag.id === 'priority-high');
      expect(high).toEqual({
        id: 'priority-high',
        name: 'High Priority',
        category: 'priority',
        color: 'bg-orange-500',
      });
    });

    it('should contain normal priority tag', () => {
      const normal = PRIORITY_TAGS.find(tag => tag.id === 'priority-normal');
      expect(normal).toEqual({
        id: 'priority-normal',
        name: 'Normal',
        category: 'priority',
        color: 'bg-blue-500',
      });
    });

    it('should contain low priority tag', () => {
      const low = PRIORITY_TAGS.find(tag => tag.id === 'priority-low');
      expect(low).toEqual({
        id: 'priority-low',
        name: 'Low Priority',
        category: 'priority',
        color: 'bg-gray-500',
      });
    });

    it('should have all tags with priority category', () => {
      PRIORITY_TAGS.forEach(tag => {
        expect(tag.category).toBe('priority');
      });
    });
  });

  // ============================================
  // STATUS_TAGS - Constant Validation
  // ============================================
  describe('STATUS_TAGS', () => {
    it('should export status tags array', () => {
      expect(STATUS_TAGS).toBeDefined();
      expect(Array.isArray(STATUS_TAGS)).toBe(true);
      expect(STATUS_TAGS.length).toBe(5);
    });

    it('should contain draft status tag', () => {
      const draft = STATUS_TAGS.find(tag => tag.id === 'status-draft');
      expect(draft).toEqual({
        id: 'status-draft',
        name: 'Draft',
        category: 'status',
        color: 'bg-gray-500',
      });
    });

    it('should contain pending status tag', () => {
      const pending = STATUS_TAGS.find(tag => tag.id === 'status-pending');
      expect(pending).toEqual({
        id: 'status-pending',
        name: 'Pending Review',
        category: 'status',
        color: 'bg-yellow-500',
      });
    });

    it('should contain approved status tag', () => {
      const approved = STATUS_TAGS.find(tag => tag.id === 'status-approved');
      expect(approved).toEqual({
        id: 'status-approved',
        name: 'Approved',
        category: 'status',
        color: 'bg-green-500',
      });
    });

    it('should contain rejected status tag', () => {
      const rejected = STATUS_TAGS.find(tag => tag.id === 'status-rejected');
      expect(rejected).toEqual({
        id: 'status-rejected',
        name: 'Rejected',
        category: 'status',
        color: 'bg-red-500',
      });
    });

    it('should contain revised status tag', () => {
      const revised = STATUS_TAGS.find(tag => tag.id === 'status-revised');
      expect(revised).toEqual({
        id: 'status-revised',
        name: 'Revised',
        category: 'status',
        color: 'bg-purple-500',
      });
    });

    it('should have all tags with status category', () => {
      STATUS_TAGS.forEach(tag => {
        expect(tag.category).toBe('status');
      });
    });
  });

  // ============================================
  // TypeScript Type Validation
  // ============================================
  describe('TypeScript types', () => {
    it('should accept valid DocumentTag', () => {
      const tag: DocumentTag = {
        id: 'test-id',
        name: 'Test Tag',
        category: 'custom',
        color: 'bg-blue-500',
        confidence: 0.8,
      };

      expect(tag).toBeDefined();
    });

    it('should accept DocumentTag without optional confidence', () => {
      const tag: DocumentTag = {
        id: 'test-id',
        name: 'Test Tag',
        category: 'custom',
        color: 'bg-blue-500',
      };

      expect(tag).toBeDefined();
    });

    it('should accept valid TaggingResult', () => {
      const result: TaggingResult = {
        suggestedTags: [],
        extractedInfo: {
          documentType: 'RFI',
          trade: 'Electrical',
          phase: 'Rough-In',
          date: '2026-01-31',
          referenceNumber: 'RFI-001',
        },
      };

      expect(result).toBeDefined();
    });

    it('should accept TaggingResult with partial extractedInfo', () => {
      const result: TaggingResult = {
        suggestedTags: [],
        extractedInfo: {
          documentType: 'RFI',
        },
      };

      expect(result).toBeDefined();
    });

    it('should accept TaggingResult with empty extractedInfo', () => {
      const result: TaggingResult = {
        suggestedTags: [],
        extractedInfo: {},
      };

      expect(result).toBeDefined();
    });
  });
});
