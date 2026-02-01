import { describe, it, expect } from 'vitest';
import {
  AccessLevel,
  DOCUMENT_ACCESS_MAP,
  hasDocumentAccess,
  getAccessibleDocuments,
  isRestrictedQuery,
  getAccessDenialMessage,
} from '@/lib/access-control';

describe('Access Control Module', () => {
  describe('hasDocumentAccess', () => {
    describe('Admin access', () => {
      it('should grant admin access to all documents', () => {
        expect(hasDocumentAccess('admin', 'Budget.pdf')).toBe(true);
        expect(hasDocumentAccess('admin', 'Plans.pdf')).toBe(true);
        expect(hasDocumentAccess('admin', 'Geotech.pdf')).toBe(true);
        expect(hasDocumentAccess('admin', 'Critical Path Plan.docx')).toBe(true);
      });

      it('should grant admin access to unmapped documents', () => {
        expect(hasDocumentAccess('admin', 'UnknownDocument.pdf')).toBe(true);
        expect(hasDocumentAccess('admin', 'RandomFile.docx')).toBe(true);
      });
    });

    describe('Client access', () => {
      it('should grant client access to client-level documents', () => {
        expect(hasDocumentAccess('client', 'Budget.pdf')).toBe(true);
        expect(hasDocumentAccess('client', 'Critical Path Plan.docx')).toBe(true);
        expect(hasDocumentAccess('client', 'Project Overview.docx')).toBe(true);
        expect(hasDocumentAccess('client', 'Subcontracts')).toBe(true);
      });

      it('should grant client access to guest-level documents', () => {
        expect(hasDocumentAccess('client', 'Geotech.pdf')).toBe(true);
        expect(hasDocumentAccess('client', 'Plans.pdf')).toBe(true);
        expect(hasDocumentAccess('client', 'Plans')).toBe(true);
        expect(hasDocumentAccess('client', 'Schedule.pdf')).toBe(true);
        expect(hasDocumentAccess('client', 'Site Survey.pdf')).toBe(true);
        expect(hasDocumentAccess('client', 'Specs')).toBe(true);
      });

      it('should grant client access to unmapped documents (defaults to client level)', () => {
        expect(hasDocumentAccess('client', 'UnknownDocument.pdf')).toBe(true);
      });
    });

    describe('Guest access', () => {
      it('should grant guest access only to guest-level documents', () => {
        expect(hasDocumentAccess('guest', 'Geotech.pdf')).toBe(true);
        expect(hasDocumentAccess('guest', 'Plans.pdf')).toBe(true);
        expect(hasDocumentAccess('guest', 'Plans')).toBe(true);
        expect(hasDocumentAccess('guest', 'Schedule.pdf')).toBe(true);
        expect(hasDocumentAccess('guest', 'Site Survey.pdf')).toBe(true);
        expect(hasDocumentAccess('guest', 'Specs')).toBe(true);
      });

      it('should deny guest access to client-level documents', () => {
        expect(hasDocumentAccess('guest', 'Budget.pdf')).toBe(false);
        expect(hasDocumentAccess('guest', 'Critical Path Plan.docx')).toBe(false);
        expect(hasDocumentAccess('guest', 'Project Overview.docx')).toBe(false);
        expect(hasDocumentAccess('guest', 'Subcontracts')).toBe(false);
      });

      it('should deny guest access to unmapped documents (defaults to client level)', () => {
        expect(hasDocumentAccess('guest', 'UnknownDocument.pdf')).toBe(false);
      });
    });

    describe('Pending user access', () => {
      it('should deny pending users access to all documents', () => {
        expect(hasDocumentAccess('pending', 'Budget.pdf')).toBe(false);
        expect(hasDocumentAccess('pending', 'Plans.pdf')).toBe(false);
        expect(hasDocumentAccess('pending', 'Geotech.pdf')).toBe(false);
        expect(hasDocumentAccess('pending', 'UnknownDocument.pdf')).toBe(false);
      });
    });
  });

  describe('getAccessibleDocuments', () => {
    it('should return all documents for admin users', () => {
      const documents = getAccessibleDocuments('admin');
      expect(documents).toEqual(Object.keys(DOCUMENT_ACCESS_MAP));
      expect(documents.length).toBe(10);
    });

    it('should return client and guest documents for client users', () => {
      const documents = getAccessibleDocuments('client');
      expect(documents).toContain('Budget.pdf');
      expect(documents).toContain('Critical Path Plan.docx');
      expect(documents).toContain('Project Overview.docx');
      expect(documents).toContain('Subcontracts');
      expect(documents).toContain('Geotech.pdf');
      expect(documents).toContain('Plans.pdf');
      expect(documents).toContain('Plans');
      expect(documents).toContain('Schedule.pdf');
      expect(documents).toContain('Site Survey.pdf');
      expect(documents).toContain('Specs');
      expect(documents.length).toBe(10);
    });

    it('should return only guest documents for guest users', () => {
      const documents = getAccessibleDocuments('guest');
      expect(documents).toContain('Geotech.pdf');
      expect(documents).toContain('Plans.pdf');
      expect(documents).toContain('Plans');
      expect(documents).toContain('Schedule.pdf');
      expect(documents).toContain('Site Survey.pdf');
      expect(documents).toContain('Specs');
      expect(documents).not.toContain('Budget.pdf');
      expect(documents).not.toContain('Critical Path Plan.docx');
      expect(documents).not.toContain('Project Overview.docx');
      expect(documents).not.toContain('Subcontracts');
      expect(documents.length).toBe(6);
    });

    it('should return only guest documents for pending users', () => {
      const documents = getAccessibleDocuments('pending');
      expect(documents).toContain('Geotech.pdf');
      expect(documents).toContain('Plans.pdf');
      expect(documents).toContain('Plans');
      expect(documents).toContain('Schedule.pdf');
      expect(documents).toContain('Site Survey.pdf');
      expect(documents).toContain('Specs');
      expect(documents.length).toBe(6);
    });
  });

  describe('isRestrictedQuery', () => {
    describe('Admin and client users', () => {
      it('should allow admin users to query anything', () => {
        expect(isRestrictedQuery('What is the budget?', 'admin')).toBe(false);
        expect(isRestrictedQuery('Show me costs', 'admin')).toBe(false);
        expect(isRestrictedQuery('critical path plan', 'admin')).toBe(false);
      });

      it('should allow client users to query anything', () => {
        expect(isRestrictedQuery('What is the budget?', 'client')).toBe(false);
        expect(isRestrictedQuery('Show me costs', 'client')).toBe(false);
        expect(isRestrictedQuery('critical path plan', 'client')).toBe(false);
      });
    });

    describe('Guest and pending users', () => {
      it('should restrict budget-related queries', () => {
        expect(isRestrictedQuery('What is the budget?', 'guest')).toBe(true);
        expect(isRestrictedQuery('Show me the BUDGET breakdown', 'guest')).toBe(true);
        expect(isRestrictedQuery('budget summary', 'pending')).toBe(true);
      });

      it('should restrict cost-related queries', () => {
        expect(isRestrictedQuery('What is the cost?', 'guest')).toBe(true);
        expect(isRestrictedQuery('Show me COST estimates', 'guest')).toBe(true);
        expect(isRestrictedQuery('cost analysis', 'pending')).toBe(true);
      });

      it('should restrict price-related queries', () => {
        expect(isRestrictedQuery('What is the price?', 'guest')).toBe(true);
        expect(isRestrictedQuery('Show PRICE details', 'guest')).toBe(true);
        expect(isRestrictedQuery('unit price breakdown', 'pending')).toBe(true);
      });

      it('should restrict payment-related queries', () => {
        expect(isRestrictedQuery('When is payment due?', 'guest')).toBe(true);
        expect(isRestrictedQuery('PAYMENT schedule', 'guest')).toBe(true);
        expect(isRestrictedQuery('payment terms', 'pending')).toBe(true);
      });

      it('should restrict financial queries', () => {
        expect(isRestrictedQuery('Show financial data', 'guest')).toBe(true);
        expect(isRestrictedQuery('FINANCIAL report', 'guest')).toBe(true);
        expect(isRestrictedQuery('financial summary', 'pending')).toBe(true);
      });

      it('should restrict subcontract queries', () => {
        expect(isRestrictedQuery('Show subcontract details', 'guest')).toBe(true);
        expect(isRestrictedQuery('SUBCONTRACT information', 'guest')).toBe(true);
        expect(isRestrictedQuery('subcontract list', 'pending')).toBe(true);
      });

      it('should restrict project overview queries', () => {
        expect(isRestrictedQuery('Show project overview', 'guest')).toBe(true);
        expect(isRestrictedQuery('PROJECT OVERVIEW document', 'guest')).toBe(true);
        expect(isRestrictedQuery('project overview details', 'pending')).toBe(true);
      });

      it('should restrict critical path plan queries', () => {
        expect(isRestrictedQuery('Show critical path plan', 'guest')).toBe(true);
        expect(isRestrictedQuery('CRITICAL PATH PLAN details', 'guest')).toBe(true);
        expect(isRestrictedQuery('critical path plan analysis', 'pending')).toBe(true);
      });

      it('should allow non-restricted queries', () => {
        expect(isRestrictedQuery('What are the project specifications?', 'guest')).toBe(false);
        expect(isRestrictedQuery('Show me the site survey', 'guest')).toBe(false);
        expect(isRestrictedQuery('What is the schedule?', 'pending')).toBe(false);
        expect(isRestrictedQuery('Show me the plans', 'guest')).toBe(false);
      });
    });
  });

  describe('getAccessDenialMessage', () => {
    it('should return specific denial message when document name is provided', () => {
      const message = getAccessDenialMessage('Budget.pdf');
      expect(message).toBe(
        'Access denied. The document "Budget.pdf" is restricted to clients and admins only. Please contact your project administrator for access.'
      );
    });

    it('should return specific denial message for different document names', () => {
      const message = getAccessDenialMessage('Critical Path Plan.docx');
      expect(message).toContain('Critical Path Plan.docx');
      expect(message).toContain('restricted to clients and admins only');
    });

    it('should return generic denial message when no document name is provided', () => {
      const message = getAccessDenialMessage();
      expect(message).toBe(
        'Access denied. This information is restricted to clients and admins only. Please log in with client or admin credentials to access financial and administrative documents.'
      );
    });

    it('should return generic denial message when undefined is provided', () => {
      const message = getAccessDenialMessage(undefined);
      expect(message).toBe(
        'Access denied. This information is restricted to clients and admins only. Please log in with client or admin credentials to access financial and administrative documents.'
      );
    });
  });

  describe('DOCUMENT_ACCESS_MAP', () => {
    it('should contain all expected document mappings', () => {
      expect(DOCUMENT_ACCESS_MAP['Budget.pdf']).toBe('client');
      expect(DOCUMENT_ACCESS_MAP['Critical Path Plan.docx']).toBe('client');
      expect(DOCUMENT_ACCESS_MAP['Project Overview.docx']).toBe('client');
      expect(DOCUMENT_ACCESS_MAP['Subcontracts']).toBe('client');
      expect(DOCUMENT_ACCESS_MAP['Geotech.pdf']).toBe('guest');
      expect(DOCUMENT_ACCESS_MAP['Plans.pdf']).toBe('guest');
      expect(DOCUMENT_ACCESS_MAP['Plans']).toBe('guest');
      expect(DOCUMENT_ACCESS_MAP['Schedule.pdf']).toBe('guest');
      expect(DOCUMENT_ACCESS_MAP['Site Survey.pdf']).toBe('guest');
      expect(DOCUMENT_ACCESS_MAP['Specs']).toBe('guest');
    });

    it('should have 10 total document mappings', () => {
      expect(Object.keys(DOCUMENT_ACCESS_MAP).length).toBe(10);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string document names', () => {
      expect(hasDocumentAccess('admin', '')).toBe(true);
      expect(hasDocumentAccess('client', '')).toBe(true);
      expect(hasDocumentAccess('guest', '')).toBe(false); // Defaults to client level
      expect(hasDocumentAccess('pending', '')).toBe(false);
    });

    it('should handle case-sensitive document names', () => {
      // Document names are case-sensitive in the map
      expect(hasDocumentAccess('guest', 'budget.pdf')).toBe(false); // Not in map, defaults to client
      expect(hasDocumentAccess('guest', 'Budget.pdf')).toBe(false); // Client level
    });

    it('should handle queries with mixed case in isRestrictedQuery', () => {
      expect(isRestrictedQuery('BuDgEt', 'guest')).toBe(true);
      expect(isRestrictedQuery('CoSt', 'guest')).toBe(true);
      expect(isRestrictedQuery('CRITICAL PATH PLAN', 'guest')).toBe(true);
    });

    it('should handle queries with partial keyword matches', () => {
      expect(isRestrictedQuery('The budgetary constraints', 'guest')).toBe(true);
      expect(isRestrictedQuery('costly materials', 'guest')).toBe(true);
      expect(isRestrictedQuery('financial implications', 'guest')).toBe(true);
    });

    it('should handle empty queries', () => {
      expect(isRestrictedQuery('', 'guest')).toBe(false);
      expect(isRestrictedQuery('', 'pending')).toBe(false);
    });
  });
});
