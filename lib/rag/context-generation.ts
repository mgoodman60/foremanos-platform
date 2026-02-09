/**
 * RAG Context Generation for Construction Document Analysis
 *
 * Extracted from lib/rag-enhancements.ts — intent-aware context
 * building with validation markers and protocol headers.
 */

import type { EnhancedChunk } from './types';
import { classifyQueryIntent } from './query-classification';
import { validateOCR } from './measurement-extraction';

/**
 * Generate enhanced context with validation markers
 */
export function generateEnhancedContext(
  chunks: EnhancedChunk[],
  query: string
): string {
  const intent = classifyQueryIntent(query);
  let context = '';

  // Add protocol header
  context += '=== DOCUMENT RETRIEVAL PROTOCOL ===\n';
  context += `Query Type: ${intent.type.toUpperCase()}\n`;
  if (intent.mepTrade) {
    context += `MEP Trade: ${intent.mepTrade.toUpperCase()}\n`;
  }
  if (intent.roomNumber) {
    context += `Room Number: ${intent.roomNumber}\n`;
  }
  context += `Notes-First Required: ${intent.requiresNotes}\n`;
  context += `Cross-Reference Required: ${intent.requiresCrossRef}\n`;
  context += `Regulatory Check Required: ${intent.requiresRegulatory}\n\n`;

  // Add validation instructions
  context += '=== RESPONSE GUIDELINES ===\n';
  context += '1. Do NOT make assumptions about content not explicitly shown\n';
  context += '2. If text is unclear or unreadable, state: "Not legible in provided documents"\n';
  context += '3. For measurements: Report value, unit, method (explicit/scaled), and source\n';
  context += '4. For requirements: Prioritize General Notes and mandatory language (SHALL, REQUIRED)\n';
  context += '5. Always cite sources with document name and page/sheet number\n';
  context += '6. Flag any discrepancies between documents\n';

  // Add MEP-specific instructions
  if (intent.type === 'mep') {
    context += '\n=== MEP-SPECIFIC INSTRUCTIONS ===\n';
    context += '1. Link device tags \u2194 circuit/pipe/duct \u2194 schedules \u2194 diagrams (where available)\n';
    context += '2. For diagrams (one-lines/risers): Treat as non-scale unless explicitly shown\n';
    context += '3. Do NOT infer routing, continuity, or connections beyond what is explicitly shown\n';
    context += '4. For abbreviations: Use project legend first; if missing, ask user\n';
    context += '5. For codes: Only reference codes explicitly cited in plans/specs\n';
    context += '6. Use non-authoritative compliance language (e.g., "appears consistent with...")\n';
    context += '7. For electrical: Report panel \u2192 circuit \u2192 device linkage only if documented\n';
    context += '8. For schedule dates: Compare to current date (December 20, 2025) if available\n';
  }

  // Add TAKEOFF-specific instructions
  if (intent.type === 'takeoff' || intent.isTakeoff) {
    context += '\n=== MATERIAL TAKEOFF INSTRUCTIONS ===\n';
    context += '\u26A0\uFE0F CRITICAL TAKEOFF RULES:\n';
    context += '1. Count/measure ONLY items explicitly shown, tagged, or scheduled\n';
    context += '2. Do NOT infer: routing, spacing, drops, concealed scope, or standard practices\n';
    context += '3. No waste factor unless explicitly requested by user\n';
    context += '4. Separate quantities into: Counted | Measured | Not Quantified\n\n';
    context += 'TRADE-SPECIFIC TAKEOFF RULES:\n';
    context += '\u2022 HVAC: Count equipment/devices from schedules. Measure ductwork ONLY if routing clearly shown and scaled.\n';
    context += '\u2022 Plumbing: Count fixtures from schedules. Measure piping ONLY if routing clearly shown and scaled.\n';
    context += '\u2022 Electrical: Count panels/devices/lighting. Measure conduit ONLY if explicitly shown and scaled.\n';
    context += '\u2022 Fire Alarm: Count devices/panels ONLY. Do NOT estimate cable/loop lengths.\n\n';
    context += 'CONFIDENCE SCORING:\n';
    context += '\u2022 HIGH: Schedule-based counts or explicitly dimensioned items\n';
    context += '\u2022 MEDIUM: Scaled quantities with visible scale or multiple sources\n';
    context += '\u2022 LOW: Partial documents, unreadable areas, or missing schedules\n\n';
    context += 'REQUIRED FIELDS FOR EACH ITEM:\n';
    context += 'Trade | System | Item_Type | Item_Tag_or_ID | Description | Quantity | Unit | Size_or_Rating |\n';
    context += 'Method (Counted/Dimensioned/Scaled/Not_Quantified) | Source_Refs | Exclusions_or_Notes |\n';
    context += 'Confidence | Confidence_Basis\n\n';
    context += 'WARNINGS TO FLAG:\n';
    context += '\u2022 "By Others" / NIC / Owner-furnished items\n';
    context += '\u2022 Potential duplicate counts across views\n';
    context += '\u2022 Non-IFC or early design status (SD/DD/90%)\n\n';
    context += 'OUTPUT STANDARD DISCLAIMERS:\n';
    context += '1. "Quantities based solely on provided documents and exclude unshown or inferred scope"\n';
    context += '2. "No waste factor applied - add appropriate overage per company standards"\n';
    context += '3. "Counts include only explicitly tagged or scheduled items"\n';
  }
  context += '\n';

  // Group chunks by retrieval method
  const precisionChunks = chunks.filter(c => c.retrievalMethod === 'precision');
  const notesChunks = chunks.filter(c => c.retrievalMethod === 'notes_first');
  const crossRefChunks = chunks.filter(c => c.retrievalMethod === 'cross_reference');
  const contextChunks = chunks.filter(c => c.retrievalMethod === 'context');

  // Add precision chunks first (highest priority)
  if (precisionChunks.length > 0) {
    context += '=== PRECISION MATCHES (Exact Identifiers) ===\n';
    precisionChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Precision Match ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      if (!validation.isLegible) {
        context += `\u26A0\uFE0F WARNING: Low OCR confidence - ${validation.issues.join(', ')}\n`;
      }
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }

  // Add notes chunks (for requirement queries)
  if (notesChunks.length > 0) {
    context += '\n=== GENERAL/KEYED NOTES (Requirements & Standards) ===\n';
    notesChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Note Section ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }

  // Add cross-referenced chunks
  if (crossRefChunks.length > 0) {
    context += '\n=== CROSS-REFERENCED CONTENT (Schedules, Details, Tags) ===\n';
    crossRefChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Cross-Reference ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }

  // Add context chunks
  if (contextChunks.length > 0) {
    context += '\n=== SUPPORTING CONTEXT ===\n';
    contextChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Context ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }

  return context;
}
