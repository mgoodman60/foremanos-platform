/**
 * Document Classifier - Smart routing for optimal processing
 * 
 * Determines which processor to use based on document characteristics:
 * - GPT-4o Vision: Complex architectural plans, site photos, hand-drawn sketches
 * - Claude 3 Haiku + OCR: Text-heavy schedules, specifications, reports
 * - Basic OCR: Simple text documents, emails, memos
 */

import { PDFDocument } from 'pdf-lib';

export type ProcessorType = 'gpt-4o-vision' | 'claude-haiku-ocr' | 'basic-ocr';

export interface DocumentClassification {
  processorType: ProcessorType;
  confidence: number; // 0-1
  reason: string;
}

/**
 * Classify document and determine optimal processor
 */
export async function classifyDocument(
  fileName: string,
  fileType: string,
  buffer?: Buffer
): Promise<DocumentClassification> {
  const lowerFileName = fileName.toLowerCase();
  
  // Image files always use vision
  if (['jpg', 'jpeg', 'png', 'tiff', 'heic'].includes(fileType)) {
    return {
      processorType: 'gpt-4o-vision',
      confidence: 1.0,
      reason: 'Image file - requires visual analysis',
    };
  }
  
  // Non-PDF text files use basic OCR
  if (['txt', 'md', 'csv'].includes(fileType)) {
    return {
      processorType: 'basic-ocr',
      confidence: 1.0,
      reason: 'Simple text file',
    };
  }
  
  // DOCX/DOC files - text extraction for RAG
  if (['docx', 'doc'].includes(fileType)) {
    return {
      processorType: 'basic-ocr', // Will be handled by DOCX processor
      confidence: 1.0,
      reason: 'Word document - text extraction for RAG system',
    };
  }
  
  // For PDFs, analyze filename patterns and page count
  if (fileType === 'pdf') {
    // Regulatory documents - HIGH confidence for Haiku (90% cost savings)
    if (isRegulatoryDocument(lowerFileName)) {
      return {
        processorType: 'claude-haiku-ocr',
        confidence: 0.98,
        reason: 'Regulatory/code document (text-heavy, no visual analysis needed)',
      };
    }
    
    // Architectural/Engineering plans - HIGH confidence for Vision
    if (isArchitecturalPlan(lowerFileName)) {
      return {
        processorType: 'gpt-4o-vision',
        confidence: 0.95,
        reason: 'Architectural/engineering plan with drawings',
      };
    }
    
    // Schedules - HIGH confidence for Haiku
    if (isSchedule(lowerFileName)) {
      return {
        processorType: 'claude-haiku-ocr',
        confidence: 0.95,
        reason: 'Schedule or equipment list (text-heavy table)',
      };
    }
    
    // Specifications - HIGH confidence for Haiku
    if (isSpecification(lowerFileName)) {
      return {
        processorType: 'claude-haiku-ocr',
        confidence: 0.90,
        reason: 'Specification or technical document (text-heavy)',
      };
    }
    
    // Site photos or progress reports - Vision
    if (isSitePhoto(lowerFileName)) {
      return {
        processorType: 'gpt-4o-vision',
        confidence: 0.90,
        reason: 'Site photo or progress documentation',
      };
    }
    
    // Analyze page count if buffer is provided
    if (buffer) {
      try {
        const pageCount = await getPdfPageCount(buffer);
        
        // Single page documents - likely text
        if (pageCount === 1) {
          return {
            processorType: 'basic-ocr',
            confidence: 0.70,
            reason: 'Single-page document (likely simple text)',
          };
        }
        
        // Multi-page (>10) documents with "schedule" indicators
        if (pageCount > 10 && containsScheduleKeywords(lowerFileName)) {
          return {
            processorType: 'claude-haiku-ocr',
            confidence: 0.85,
            reason: 'Multi-page document with schedule keywords',
          };
        }
      } catch (error) {
        console.error('Error analyzing PDF:', error);
      }
    }
  }
  
  // Default to Vision for PDFs (conservative approach)
  return {
    processorType: 'gpt-4o-vision',
    confidence: 0.60,
    reason: 'Default to high-quality vision analysis',
  };
}

/**
 * Check if filename indicates regulatory/code document
 */
function isRegulatoryDocument(fileName: string): boolean {
  const regulatoryPatterns = [
    /\bada\b/i,
    /\bibc\b/i,
    /\bnfpa\b/i,
    /\bcode\b/i,
    /\bstandard\b/i,
    /\bregulat\w+\b/i,
    /\bcompliance\b/i,
    /\bbuilding\s*code\b/i,
    /\bfire\s*code\b/i,
    /\bplumbing\s*code\b/i,
    /\belectrical\s*code\b/i,
    /\bmechanical\s*code\b/i,
    /\bzoning\b/i,
    /\bordnance\b/i,
    /\baccessibility\b/i,
    /\blife\s*safety\b/i,
    /\benergy\s*code\b/i,
    /\biecc\b/i,
    /\basce\b/i,
    /\bastm\b/i,
    /\bawwa\b/i,
    /\bieee\b/i,
  ];
  
  return regulatoryPatterns.some(pattern => pattern.test(fileName));
}

/**
 * Check if filename indicates architectural/engineering plan
 */
function isArchitecturalPlan(fileName: string): boolean {
  const planPatterns = [
    /\bplan\b/i,
    /\bsheet\b/i,
    /\bdrawing\b/i,
    /\bsite\s*plan\b/i,
    /\bfloor\s*plan\b/i,
    /\belevation\b/i,
    /\bsection\b/i,
    /\bdetail\b/i,
    /[AaSsEeMmPpCc]-\d+/, // Sheet numbers like A-101, S-001, E-203
    /\barchitectural\b/i,
    /\bstructural\b/i,
    /\bmechanical\b/i,
    /\belectrical\b/i,
    /\bplumbing\b/i,
  ];
  
  return planPatterns.some(pattern => pattern.test(fileName));
}

/**
 * Check if filename indicates schedule document
 */
function isSchedule(fileName: string): boolean {
  const schedulePatterns = [
    /\bschedule\b/i,
    /\bdoor\s*schedule\b/i,
    /\bwindow\s*schedule\b/i,
    /\bequipment\s*schedule\b/i,
    /\bfinish\s*schedule\b/i,
    /\broom\s*schedule\b/i,
    /\bfixture\s*schedule\b/i,
    /\bhardware\s*schedule\b/i,
    /\blight\w*\s*schedule\b/i,
  ];
  
  return schedulePatterns.some(pattern => pattern.test(fileName));
}

/**
 * Check if filename indicates specification
 */
function isSpecification(fileName: string): boolean {
  const specPatterns = [
    /\bspec\b/i,
    /\bspecification\b/i,
    /\bsubmittal\b/i,
    /\bproduct\s*data\b/i,
    /\bdata\s*sheet\b/i,
    /\bmaterial\s*spec\b/i,
    /\btechnical\s*spec\b/i,
    /\bcsi\s*\d+/i, // CSI division numbers
  ];
  
  return specPatterns.some(pattern => pattern.test(fileName));
}

/**
 * Check if filename indicates site photo or progress report
 */
function isSitePhoto(fileName: string): boolean {
  const photoPatterns = [
    /\bphoto\b/i,
    /\bpicture\b/i,
    /\bimage\b/i,
    /\bsite\s*photo\b/i,
    /\bprogress\s*photo\b/i,
    /\bprogress\s*report\b/i,
    /\binspection\b/i,
  ];
  
  return photoPatterns.some(pattern => pattern.test(fileName));
}

/**
 * Check if filename contains schedule-related keywords
 */
function containsScheduleKeywords(fileName: string): boolean {
  const keywords = ['schedule', 'door', 'window', 'equipment', 'finish', 'fixture'];
  return keywords.some(keyword => fileName.includes(keyword));
}

/**
 * Get PDF page count
 */
async function getPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error loading PDF:', error);
    throw error;
  }
}

/**
 * Get human-readable processor name
 */
export function getProcessorName(processorType: ProcessorType): string {
  const names: Record<ProcessorType, string> = {
    'gpt-4o-vision': 'GPT-4o Vision (High Detail)',
    'claude-haiku-ocr': 'Claude 3 Haiku + OCR (Text Analysis)',
    'basic-ocr': 'Basic OCR (Simple Text)',
  };
  return names[processorType];
}
