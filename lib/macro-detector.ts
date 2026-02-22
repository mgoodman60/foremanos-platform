/**
 * Office Document Macro Detector
 *
 * Detects VBA macros in Office Open XML files (docx, xlsx, pptx)
 * by checking for the presence of vbaProject.bin within the ZIP archive.
 */

import JSZip from 'jszip';

interface MacroDetectionResult {
  hasMacros: boolean;
  macroType?: string;
  error?: string;
}

// Files that indicate macros in Office documents
const MACRO_INDICATORS = [
  'word/vbaProject.bin',      // DOCX/DOCM
  'xl/vbaProject.bin',        // XLSX/XLSM
  'ppt/vbaProject.bin',       // PPTX/PPTM
  'vbaProject.bin',           // Generic location
];

// Extensions that can contain macros
const MACRO_ENABLED_EXTENSIONS = [
  'docm', 'xlsm', 'pptm',     // Macro-enabled formats
  'docx', 'xlsx', 'pptx',     // Standard formats (can still contain macros if renamed)
  'doc', 'xls', 'ppt',        // Legacy formats
];

/**
 * Detects if an Office document contains VBA macros
 * @param buffer - The file buffer
 * @param fileName - The file name (used for extension check)
 * @returns Detection result with hasMacros flag
 */
export async function detectMacros(
  buffer: Buffer,
  fileName: string
): Promise<MacroDetectionResult> {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // Skip non-Office files
  if (!MACRO_ENABLED_EXTENSIONS.includes(extension)) {
    return { hasMacros: false };
  }

  // Legacy formats (doc, xls, ppt) require different detection
  // For now, we'll flag them as potentially containing macros
  if (['doc', 'xls', 'ppt'].includes(extension)) {
    // Check for OLE compound document with VBA
    // Magic bytes for OLE: D0 CF 11 E0 A1 B1 1A E1
    const oleMagic = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    if (buffer.subarray(0, 8).equals(oleMagic)) {
      // OLE files may contain macros - search for VBA signature
      const vbaSignature = Buffer.from('VBA');
      if (buffer.includes(vbaSignature)) {
        return {
          hasMacros: true,
          macroType: 'legacy-ole-vba',
        };
      }
    }
    return { hasMacros: false };
  }

  // Modern Office formats (docx, xlsx, pptx) are ZIP archives
  try {
    const zip = await JSZip.loadAsync(buffer);

    for (const indicator of MACRO_INDICATORS) {
      if (zip.file(indicator)) {
        return {
          hasMacros: true,
          macroType: 'vbaProject.bin',
        };
      }
    }

    return { hasMacros: false };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // If it's not a valid ZIP, it might be a corrupted or non-Office file
    return {
      hasMacros: false,
      error: `Failed to analyze file: ${errMsg}`,
    };
  }
}

/**
 * Check if file should be blocked due to macros
 * @param buffer - The file buffer
 * @param fileName - The file name
 * @returns true if file should be blocked
 */
export async function shouldBlockMacroFile(
  buffer: Buffer,
  fileName: string
): Promise<{ blocked: boolean; reason?: string }> {
  const result = await detectMacros(buffer, fileName);

  if (result.hasMacros) {
    return {
      blocked: true,
      reason: `File contains embedded macros (${result.macroType}). Macro-enabled documents are not allowed for security reasons.`,
    };
  }

  return { blocked: false };
}
