/**
 * Advanced Document Intelligence
 * Cross-document referencing and version comparison
 */

import { prisma } from './db';

interface DocumentReference {
  sourceDocumentId: string;
  targetDocumentId: string;
  referenceType: string; // 'sheet_reference', 'detail_callout', 'spec_reference'
  location: string; // Where in the source document
  context: string; // Surrounding text
}

interface VersionChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * Extract cross-document references from chunks
 */
export async function extractCrossReferences(
  documentId: string
): Promise<DocumentReference[]> {
  try {
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      include: {
        Document: {
          include: {
            Project: {
              include: {
                Document: {
                  select: {
                    id: true,
                    name: true,
                    fileName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const references: DocumentReference[] = [];
    const projectDocuments = chunks[0]?.Document?.Project?.Document || [];

    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;
      const content = chunk.content;

      // Check for sheet references in metadata
      if (metadata?.crossReferences && Array.isArray(metadata.crossReferences)) {
        for (const ref of metadata.crossReferences) {
          // Try to match reference to actual documents
          const targetDoc = findDocumentByReference(ref, projectDocuments);
          if (targetDoc) {
            references.push({
              sourceDocumentId: documentId,
              targetDocumentId: targetDoc.id,
              referenceType: 'sheet_reference',
              location: `Page ${chunk.pageNumber || 'unknown'}`,
              context: ref
            });
          }
        }
      }

      // Parse content for references
      const contentRefs = parseContentReferences(content, projectDocuments);
      references.push(...contentRefs.map(ref => ({
        ...ref,
        sourceDocumentId: documentId
      })));
    }

    console.log(`[DOC_INTELLIGENCE] Found ${references.length} cross-references in document ${documentId}`);
    return references;
  } catch (error) {
    console.error('[DOC_INTELLIGENCE] Error extracting cross-references:', error);
    return [];
  }
}

/**
 * Find document by reference text
 */
function findDocumentByReference(
  reference: string,
  documents: Array<{ id: string; name: string; fileName: string }>
): { id: string } | null {
  const refLower = reference.toLowerCase();

  // Pattern: "See Sheet A-101" or "Detail on A3.2"
  const sheetMatch = reference.match(/\b([A-Z]-?\d+\.?\d*)\b/);
  if (sheetMatch) {
    const sheetNum = sheetMatch[1];
    const doc = documents.find(d => 
      d.name.includes(sheetNum) || d.fileName.includes(sheetNum)
    );
    if (doc) return { id: doc.id };
  }

  // Pattern: Document name match
  for (const doc of documents) {
    if (refLower.includes(doc.name.toLowerCase()) || 
        doc.name.toLowerCase().includes(refLower)) {
      return { id: doc.id };
    }
  }

  return null;
}

/**
 * Parse text content for document references
 */
function parseContentReferences(
  content: string,
  documents: Array<{ id: string; name: string; fileName: string }>
): Omit<DocumentReference, 'sourceDocumentId'>[] {
  const references: Omit<DocumentReference, 'sourceDocumentId'>[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: "See Sheet X" or "Refer to Drawing Y"
    const seeMatch = line.match(/(?:See|Refer to|Detail on|Shown on)\s+(?:Sheet|Drawing|Detail|Plan)\s+([A-Z]-?\d+\.?\d*)/i);
    if (seeMatch) {
      const targetDoc = findDocumentByReference(seeMatch[1], documents);
      if (targetDoc) {
        references.push({
          targetDocumentId: targetDoc.id,
          referenceType: 'sheet_reference',
          location: `Line ${i + 1}`,
          context: line.trim()
        });
      }
    }

    // Pattern 2: "Detail [number]"
    const detailMatch = line.match(/Detail\s+(\d+\/[A-Z]\d+|\d+)/i);
    if (detailMatch) {
      // Detail references typically stay within same document
      // but could reference other sheets
      const targetDoc = findDocumentByReference(detailMatch[1], documents);
      if (targetDoc) {
        references.push({
          targetDocumentId: targetDoc.id,
          referenceType: 'detail_callout',
          location: `Line ${i + 1}`,
          context: line.trim()
        });
      }
    }
  }

  return references;
}

/**
 * Compare two document versions
 */
export async function compareDocumentVersions(
  oldDocumentId: string,
  newDocumentId: string
): Promise<{
  changes: VersionChange[];
  summary: string;
}> {
  try {
    const [oldDoc, newDoc] = await Promise.all([
      prisma.document.findUnique({
        where: { id: oldDocumentId },
        include: { DocumentChunk: true }
      }),
      prisma.document.findUnique({
        where: { id: newDocumentId },
        include: { DocumentChunk: true }
      })
    ]);

    if (!oldDoc || !newDoc) {
      throw new Error('One or both documents not found');
    }

    const changes: VersionChange[] = [];

    // Compare metadata
    if (oldDoc.name !== newDoc.name) {
      changes.push({
        field: 'document_name',
        oldValue: oldDoc.name,
        newValue: newDoc.name,
        changeType: 'modified'
      });
    }

    // Compare chunk counts (page additions/removals)
    const oldPageCount = oldDoc.DocumentChunk.length;
    const newPageCount = newDoc.DocumentChunk.length;
    
    if (oldPageCount !== newPageCount) {
      if (newPageCount > oldPageCount) {
        changes.push({
          field: 'page_count',
          oldValue: oldPageCount,
          newValue: newPageCount,
          changeType: 'added'
        });
      } else {
        changes.push({
          field: 'page_count',
          oldValue: oldPageCount,
          newValue: newPageCount,
          changeType: 'removed'
        });
      }
    }

    // Compare chunk metadata (for matching pages)
    const minPageCount = Math.min(oldPageCount, newPageCount);
    for (let i = 0; i < minPageCount; i++) {
      const oldChunk = oldDoc.DocumentChunk[i];
      const newChunk = newDoc.DocumentChunk[i];
      const oldMeta = oldChunk.metadata as any;
      const newMeta = newChunk.metadata as any;

      // Compare sheet numbers
      if (oldMeta?.sheet_number !== newMeta?.sheet_number) {
        changes.push({
          field: `page_${i + 1}_sheet_number`,
          oldValue: oldMeta?.sheet_number,
          newValue: newMeta?.sheet_number,
          changeType: 'modified'
        });
      }

      // Compare dimensions count
      const oldDimCount = (oldMeta?.labeled_dimensions?.length || 0) + 
                          (oldMeta?.derived_dimensions?.length || 0);
      const newDimCount = (newMeta?.labeled_dimensions?.length || 0) + 
                          (newMeta?.derived_dimensions?.length || 0);
      
      if (oldDimCount !== newDimCount) {
        changes.push({
          field: `page_${i + 1}_dimensions`,
          oldValue: oldDimCount,
          newValue: newDimCount,
          changeType: newDimCount > oldDimCount ? 'added' : 'removed'
        });
      }
    }

    // Generate summary
    const addedChanges = changes.filter(c => c.changeType === 'added').length;
    const removedChanges = changes.filter(c => c.changeType === 'removed').length;
    const modifiedChanges = changes.filter(c => c.changeType === 'modified').length;

    const summary = `Found ${changes.length} changes: ${addedChanges} additions, ${removedChanges} removals, ${modifiedChanges} modifications`;

    console.log(`[DOC_INTELLIGENCE] Version comparison: ${summary}`);

    return { changes, summary };
  } catch (error: any) {
    console.error('[DOC_INTELLIGENCE] Error comparing versions:', error);
    throw error;
  }
}

/**
 * Get related documents (documents that reference or are referenced by this document)
 */
export async function getRelatedDocuments(
  documentId: string
): Promise<Array<{
  id: string;
  name: string;
  relationshipType: string;
  context: string;
}>> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        Project: {
          include: {
            Document: {
              select: {
                id: true,
                name: true,
                fileName: true
              }
            }
          }
        }
      }
    });

    if (!document || !document.Project) {
      return [];
    }

    // Extract references from this document
    const outgoingRefs = await extractCrossReferences(documentId);

    // Check which other documents reference this one
    const incomingRefs: DocumentReference[] = [];
    for (const doc of document.Project.Document) {
      if (doc.id !== documentId) {
        const refs = await extractCrossReferences(doc.id);
        const refsToThisDoc = refs.filter(r => r.targetDocumentId === documentId);
        incomingRefs.push(...refsToThisDoc);
      }
    }

    // Combine and format
    const related = new Map<string, any>();

    for (const ref of outgoingRefs) {
      const doc = document.Project.Document.find((d: any) => d.id === ref.targetDocumentId);
      if (doc && !related.has(doc.id)) {
        related.set(doc.id, {
          id: doc.id,
          name: doc.name,
          relationshipType: 'references',
          context: ref.context
        });
      }
    }

    for (const ref of incomingRefs) {
      const doc = document.Project.Document.find((d: any) => d.id === ref.sourceDocumentId);
      if (doc && !related.has(doc.id)) {
        related.set(doc.id, {
          id: doc.id,
          name: doc.name,
          relationshipType: 'referenced_by',
          context: ref.context
        });
      }
    }

    return Array.from(related.values());
  } catch (error) {
    console.error('[DOC_INTELLIGENCE] Error getting related documents:', error);
    return [];
  }
}
