/**
 * Quality Validation Layer for Vision API Responses
 * 
 * Validates extracted data completeness and assigns confidence scores
 * to determine if response should be accepted or retried with different provider
 */

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

export interface ExtractedData {
  sheetNumber?: string;
  sheetTitle?: string;
  scale?: string;
  content?: string;
  [key: string]: any;
}

/**
 * Perform comprehensive quality check on extracted construction document data
 */
export function performQualityCheck(
  data: ExtractedData,
  pageNumber: number,
  minScore: number = 50
): QualityCheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Critical fields check (60 points total)
  
  // Sheet number (20 points)
  if (data.sheetNumber && data.sheetNumber.trim() !== '' && data.sheetNumber !== 'N/A') {
    score += 20;
  } else {
    issues.push('Missing or invalid sheet number');
    suggestions.push('Look for sheet number in title block (usually bottom-right corner)');
  }

  // Sheet title (15 points)
  if (data.sheetTitle && data.sheetTitle.trim() !== '' && data.sheetTitle !== 'N/A') {
    score += 15;
  } else {
    issues.push('Missing or invalid sheet title');
    suggestions.push('Look for drawing title in title block');
  }

  // Scale (15 points)
  if (data.scale && data.scale.trim() !== '' && data.scale !== 'N/A') {
    score += 15;
  } else {
    issues.push('Missing or invalid scale information');
    suggestions.push('Look for scale notation (e.g., 1/4"=1\'-0", 1:100)');
  }

  // Content quality (10 points)
  if (data.content) {
    const contentLength = data.content.length;
    if (contentLength > 500) {
      score += 10;
    } else if (contentLength > 200) {
      score += 5;
    } else if (contentLength > 50) {
      score += 2;
    } else {
      issues.push('Insufficient content extracted');
      suggestions.push('Ensure OCR is reading all visible text and annotations');
    }
  }

  // Structural elements check (40 points)
  const structuralFields = [
    'dimensions',
    'gridLines',
    'roomLabels',
    'doors',
    'windows',
    'equipment',
    'annotations',
    'symbols',
  ];

  let structuralFieldsFound = 0;
  structuralFields.forEach(field => {
    if (data[field] && 
        (Array.isArray(data[field]) ? data[field].length > 0 : data[field] !== 'N/A')) {
      structuralFieldsFound++;
    }
  });

  // Award points based on how many structural fields were found
  const structuralScore = Math.min(40, (structuralFieldsFound / structuralFields.length) * 40);
  score += structuralScore;

  if (structuralFieldsFound === 0) {
    issues.push('No structural elements detected');
    suggestions.push('Ensure extraction includes dimensions, grid lines, room labels, etc.');
  } else if (structuralFieldsFound < 3) {
    suggestions.push('Consider extracting more structural elements for better context');
  }

  // Determine if check passed
  const passed = score >= minScore && issues.length <= 2;

  return {
    passed,
    score,
    issues,
    suggestions,
  };
}

/**
 * Check if response indicates a blank or empty page
 */
export function isBlankPage(data: ExtractedData): boolean {
  // Check for explicit blank page indicators
  const blankIndicators = [
    'blank page',
    'empty page',
    'no content',
    'not applicable',
  ];

  const contentLower = (data.content || '').toLowerCase();
  if (blankIndicators.some(indicator => contentLower.includes(indicator))) {
    return true;
  }

  // Check if all critical fields are missing or N/A
  const criticalFieldsMissing = 
    (!data.sheetNumber || data.sheetNumber === 'N/A') &&
    (!data.sheetTitle || data.sheetTitle === 'N/A') &&
    (!data.scale || data.scale === 'N/A') &&
    (!data.content || data.content.length < 50);

  return criticalFieldsMissing;
}

/**
 * Format quality check result for logging
 */
export function formatQualityReport(result: QualityCheckResult, pageNumber: number): string {
  let report = `\n=== Quality Check: Page ${pageNumber} ===\n`;
  report += `Score: ${result.score}/100 (${result.passed ? 'PASSED' : 'FAILED'})\n`;
  
  if (result.issues.length > 0) {
    report += `\nIssues (${result.issues.length}):\n`;
    result.issues.forEach((issue, i) => {
      report += `  ${i + 1}. ${issue}\n`;
    });
  }
  
  if (result.suggestions.length > 0) {
    report += `\nSuggestions (${result.suggestions.length}):\n`;
    result.suggestions.forEach((suggestion, i) => {
      report += `  ${i + 1}. ${suggestion}\n`;
    });
  }
  
  report += `=================================\n`;
  return report;
}
