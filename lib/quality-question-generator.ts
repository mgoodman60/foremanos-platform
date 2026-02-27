/**
 * Quality Question Generator
 * Generates targeted questions from quality check results for human-in-the-loop review.
 */
import type { QualityCheckResult, ExtractedData } from './vision-api-quality';

export interface QualityQuestionInput {
  pageNumber: number;
  field: string;
  questionText: string;
  questionType: 'yes_no' | 'multiple_choice' | 'free_text';
  options?: string[];
  generatedFrom: 'quality_check' | 'dead_letter';
}

const TRADES = ['Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Protection', 'Civil'];
const COMMON_SCALES = ['1/4" = 1\'-0"', '1/8" = 1\'-0"', '3/16" = 1\'-0"', '1/2" = 1\'-0"', '1" = 1\'-0"', 'As Noted', 'NTS'];

export function generateQualityQuestions(
  data: ExtractedData,
  qualityResult: QualityCheckResult,
  pageNumber: number,
  _discipline: string,
): QualityQuestionInput[] {
  const questions: QualityQuestionInput[] = [];
  const isDeadLetter = qualityResult.score < 20;
  const from = isDeadLetter ? 'dead_letter' as const : 'quality_check' as const;

  // Check each issue and generate targeted questions
  for (const issue of qualityResult.issues) {
    if (issue.includes('sheet number') && questions.length < 5) {
      questions.push({
        pageNumber,
        field: 'sheetNumber',
        questionText: `What is the sheet number for page ${pageNumber}?`,
        questionType: 'free_text',
        generatedFrom: from,
      });
    }

    if (issue.includes('sheet title') && questions.length < 5) {
      questions.push({
        pageNumber,
        field: 'sheetTitle',
        questionText: `What is the drawing title for page ${pageNumber}?`,
        questionType: 'free_text',
        generatedFrom: from,
      });
    }

    if (issue.includes('scale') && questions.length < 5) {
      questions.push({
        pageNumber,
        field: 'scale',
        questionText: `What is the drawing scale for page ${pageNumber}?`,
        questionType: 'multiple_choice',
        options: COMMON_SCALES,
        generatedFrom: from,
      });
    }

    if (issue.includes('structural elements') && questions.length < 5) {
      questions.push({
        pageNumber,
        field: 'drawingType',
        questionText: `What type of drawing is page ${pageNumber}?`,
        questionType: 'multiple_choice',
        options: ['Floor Plan', 'Elevation', 'Section', 'Detail', 'Schedule', 'Site Plan', 'Other'],
        generatedFrom: from,
      });
    }
  }

  // If discipline unknown, ask about it
  if ((!data.discipline || data.discipline === 'Unknown' || data.discipline === 'N/A') && questions.length < 5) {
    questions.push({
      pageNumber,
      field: 'discipline',
      questionText: `What discipline is page ${pageNumber}${data.sheetNumber ? ` (Sheet ${data.sheetNumber})` : ''}?`,
      questionType: 'multiple_choice',
      options: TRADES,
      generatedFrom: from,
    });
  }

  // Dead letter pages get extra questions
  if (isDeadLetter && questions.length < 5) {
    questions.push({
      pageNumber,
      field: '_isBlankPage',
      questionText: `Does page ${pageNumber} contain meaningful drawing content, or is it blank/cover page?`,
      questionType: 'multiple_choice',
      options: ['Has drawing content', 'Blank page', 'Cover/title page', 'Table of contents'],
      generatedFrom: 'dead_letter',
    });
  }

  // Max 5 per page
  return questions.slice(0, 5);
}
