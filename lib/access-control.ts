// Access control utilities for 3-role system

export type AccessLevel = 'admin' | 'client' | 'guest' | 'pending';

export type DocumentAccessLevel = 'admin' | 'client' | 'guest';

// Define which documents are accessible to each tier
export const DOCUMENT_ACCESS_MAP: Record<string, DocumentAccessLevel> = {
  'Budget.pdf': 'client',
  'Critical Path Plan.docx': 'client',
  'Project Overview.docx': 'client',
  'Subcontracts': 'client',
  'Geotech.pdf': 'guest',
  'Plans.pdf': 'guest',
  'Plans': 'guest',
  'Schedule.pdf': 'guest',
  'Site Survey.pdf': 'guest',
  'Specs': 'guest',
};

// Check if a user has access to a specific document
export function hasDocumentAccess(
  userLevel: AccessLevel,
  documentName: string
): boolean {
  const docAccess = DOCUMENT_ACCESS_MAP[documentName] || 'client';
  
  // Admin has access to everything
  if (userLevel === 'admin') {
    return true;
  }
  
  // Client can access client and guest documents
  if (userLevel === 'client') {
    return docAccess === 'client' || docAccess === 'guest';
  }
  
  // Guest can only access guest documents
  if (userLevel === 'guest') {
    return docAccess === 'guest';
  }
  
  // Pending users have no access
  return false;
}

// Get list of accessible document names for a user level
export function getAccessibleDocuments(userLevel: AccessLevel): string[] {
  if (userLevel === 'admin') {
    return Object.keys(DOCUMENT_ACCESS_MAP); // Full access
  }
  
  if (userLevel === 'client') {
    return Object.keys(DOCUMENT_ACCESS_MAP).filter(
      (docName) => DOCUMENT_ACCESS_MAP[docName] === 'client' || DOCUMENT_ACCESS_MAP[docName] === 'guest'
    );
  }
  
  // Guests only see 'guest' documents
  return Object.keys(DOCUMENT_ACCESS_MAP).filter(
    (docName) => DOCUMENT_ACCESS_MAP[docName] === 'guest'
  );
}

// Check if a query is about restricted content
export function isRestrictedQuery(query: string, userLevel: AccessLevel): boolean {
  if (userLevel === 'admin' || userLevel === 'client') {
    return false; // Admin and client users can access everything
  }
  
  const restrictedKeywords = [
    'budget',
    'cost',
    'price',
    'payment',
    'financial',
    'subcontract',
    'project overview',
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for restricted keywords
  if (lowerQuery.includes('critical path plan')) {
    return true; // Critical Path Plan.docx is restricted
  }
  
  return restrictedKeywords.some(keyword => lowerQuery.includes(keyword));
}

// Get access denial message
export function getAccessDenialMessage(documentName?: string): string {
  if (documentName) {
    return `Access denied. The document "${documentName}" is restricted to clients and admins only. Please contact your project administrator for access.`;
  }
  return 'Access denied. This information is restricted to clients and admins only. Please log in with client or admin credentials to access financial and administrative documents.';
}
