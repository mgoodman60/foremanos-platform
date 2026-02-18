import { describe, it, expect } from 'vitest';
import { getDisciplinePrompt } from '@/lib/discipline-prompts';

describe('discipline-prompts', () => {
  const fileName = 'TestProject.pdf';
  const pageNum = 3;
  const noSymbols = '';

  describe('getDisciplinePrompt', () => {
    it('returns Architectural prompt for Architectural discipline', () => {
      const prompt = getDisciplinePrompt('Architectural', 'floor_plan', fileName, pageNum, noSymbols);

      expect(prompt).toContain('ARCHITECTURAL PLAN EXTRACTION');
      expect(prompt).toContain(`Page ${pageNum} of ${fileName}`);
      expect(prompt).toContain('ROOMS AND SPACES');
      expect(prompt).toContain('DOORS AND WINDOWS');
      expect(prompt).toContain('RESPOND WITH VALID JSON');
    });

    it('returns Structural prompt for Structural discipline', () => {
      const prompt = getDisciplinePrompt('Structural', 'foundation_plan', fileName, pageNum, noSymbols);

      expect(prompt).toContain('STRUCTURAL PLAN EXTRACTION');
      expect(prompt).toContain(`Page ${pageNum} of ${fileName}`);
      expect(prompt).toContain('STRUCTURAL MEMBERS');
      expect(prompt).toContain('REBAR AND REINFORCEMENT');
    });

    it('returns Mechanical prompt for Mechanical discipline', () => {
      const prompt = getDisciplinePrompt('Mechanical', 'mechanical_plan', fileName, pageNum, noSymbols);

      expect(prompt).toContain('MECHANICAL PLAN EXTRACTION');
      expect(prompt).toContain('EQUIPMENT');
      expect(prompt).toContain('DUCTWORK');
    });

    it('returns Electrical prompt for Electrical discipline', () => {
      const prompt = getDisciplinePrompt('Electrical', 'electrical_plan', fileName, pageNum, noSymbols);

      expect(prompt).toContain('ELECTRICAL PLAN EXTRACTION');
      expect(prompt).toContain('PANELS AND DISTRIBUTION');
      expect(prompt).toContain('CIRCUITS AND WIRING');
    });

    it('returns Plumbing prompt for Plumbing discipline', () => {
      const prompt = getDisciplinePrompt('Plumbing', 'plumbing_plan', fileName, pageNum, noSymbols);

      expect(prompt).toContain('PLUMBING PLAN EXTRACTION');
      expect(prompt).toContain('FIXTURES');
      expect(prompt).toContain('PIPING');
    });

    it('returns Civil prompt for Civil discipline', () => {
      const prompt = getDisciplinePrompt('Civil', 'site_plan', fileName, pageNum, noSymbols);

      expect(prompt).toContain('CIVIL/SITE PLAN EXTRACTION');
      expect(prompt).toContain('GRADING AND ELEVATIONS');
      expect(prompt).toContain('UTILITIES');
    });

    it('returns Schedule prompt for Schedule discipline', () => {
      const prompt = getDisciplinePrompt('Schedule', 'schedule', fileName, pageNum, noSymbols);

      expect(prompt).toContain('SCHEDULE EXTRACTION');
      expect(prompt).toContain('CRITICAL: Extract ALL rows and columns');
      expect(prompt).toContain('COLUMN HEADERS');
    });

    it('returns Generic prompt for unknown discipline', () => {
      const prompt = getDisciplinePrompt('Unknown', 'unknown', fileName, pageNum, noSymbols);

      expect(prompt).toContain('CONSTRUCTION DOCUMENT ANALYSIS');
      expect(prompt).toContain(`Page ${pageNum} of ${fileName}`);
      expect(prompt).toContain('EXTRACTION CATEGORIES');
      expect(prompt).toContain('20. SPECIAL DRAWING FEATURES');
    });

    it('returns Generic prompt for General discipline', () => {
      const prompt = getDisciplinePrompt('General', 'general_notes', fileName, pageNum, noSymbols);

      expect(prompt).toContain('CONSTRUCTION DOCUMENT ANALYSIS');
    });

    it('returns Generic prompt for Cover discipline', () => {
      const prompt = getDisciplinePrompt('Cover', 'cover', fileName, pageNum, noSymbols);

      expect(prompt).toContain('CONSTRUCTION DOCUMENT ANALYSIS');
    });

    it('returns Generic prompt for Fire Protection discipline', () => {
      const prompt = getDisciplinePrompt('Fire Protection', 'detail', fileName, pageNum, noSymbols);

      expect(prompt).toContain('CONSTRUCTION DOCUMENT ANALYSIS');
      expect(prompt).toContain('FIRE PROTECTION');
    });

    it('appends symbol hints when provided', () => {
      const symbolHints = '\nSYMBOL REFERENCE:\n- North Arrow: Look for arrow with N label.';
      const prompt = getDisciplinePrompt('Architectural', 'floor_plan', fileName, pageNum, symbolHints);

      expect(prompt).toContain('SYMBOL REFERENCE:');
      expect(prompt).toContain('North Arrow');
    });

    it('does not append symbol section when hints are empty', () => {
      const prompt = getDisciplinePrompt('Structural', 'framing_plan', fileName, pageNum, '');

      // No double newline before the IMPORTANT line
      expect(prompt).not.toContain('SYMBOL REFERENCE');
    });

    it('always ends with the IMPORTANT extraction instruction', () => {
      const disciplines = [
        'Architectural',
        'Structural',
        'Mechanical',
        'Electrical',
        'Plumbing',
        'Civil',
        'Schedule',
        'General',
      ];

      for (const disc of disciplines) {
        const prompt = getDisciplinePrompt(disc, 'unknown', fileName, pageNum, noSymbols);
        expect(prompt).toContain(
          'IMPORTANT: Extract EVERYTHING visible. Omit categories with no data rather than including empty arrays.'
        );
      }
    });

    it('substitutes fileName and pageNum correctly', () => {
      const prompt = getDisciplinePrompt('Plumbing', 'plumbing_plan', 'MyProject.pdf', 7, noSymbols);

      expect(prompt).toContain('Page 7 of MyProject.pdf');
    });

    it('Generic prompt includes continuationNotes and revisionClouds fields', () => {
      const prompt = getDisciplinePrompt('General', 'unknown', fileName, pageNum, noSymbols);

      expect(prompt).toContain('"continuationNotes"');
      expect(prompt).toContain('"revisionClouds"');
    });

    it('Generic prompt includes scales array in JSON schema', () => {
      const prompt = getDisciplinePrompt('General', 'unknown', fileName, pageNum, noSymbols);

      expect(prompt).toContain('"scales"');
    });
  });
});
