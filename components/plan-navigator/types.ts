export interface DocumentNode {
  id: string;
  name: string;
  type: string;
  category?: string;
  sheetNumber?: string;
  outgoingRefs: number;
  incomingRefs: number;
}

export interface DocumentReference {
  sourceDocumentId: string;
  targetDocumentId: string;
  referenceType: string;
  location: string;
  context: string;
  sourceDoc?: DocumentNode;
  targetDoc?: DocumentNode;
  summary?: string;
}

export interface SheetDocument {
  id: string;
  name: string;
  category: string;
  sheetNumber?: string;
  discipline?: string;
  url?: string;
  summary?: string;
}
