import { describe, it, expect } from 'vitest';
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseFormData,
  type DateRange
} from '@/lib/types';

describe('lib/types', () => {
  // ============================================
  // EXPENSE_CATEGORIES Constant Tests
  // ============================================
  describe('EXPENSE_CATEGORIES', () => {
    it('should export EXPENSE_CATEGORIES as readonly array', () => {
      expect(EXPENSE_CATEGORIES).toBeDefined();
      expect(Array.isArray(EXPENSE_CATEGORIES)).toBe(true);
    });

    it('should contain all expected expense categories', () => {
      const expectedCategories = [
        'Food',
        'Transportation',
        'Housing',
        'Utilities',
        'Entertainment',
        'Healthcare',
        'Shopping',
        'Education',
        'Other'
      ];
      expect(EXPENSE_CATEGORIES).toEqual(expectedCategories);
    });

    it('should have exactly 9 categories', () => {
      expect(EXPENSE_CATEGORIES).toHaveLength(9);
    });

    it('should not contain duplicate categories', () => {
      const uniqueCategories = [...new Set(EXPENSE_CATEGORIES)];
      expect(uniqueCategories).toHaveLength(EXPENSE_CATEGORIES.length);
    });

    it('should contain only string values', () => {
      EXPENSE_CATEGORIES.forEach(category => {
        expect(typeof category).toBe('string');
      });
    });

    it('should contain categories in expected order', () => {
      expect(EXPENSE_CATEGORIES[0]).toBe('Food');
      expect(EXPENSE_CATEGORIES[1]).toBe('Transportation');
      expect(EXPENSE_CATEGORIES[2]).toBe('Housing');
      expect(EXPENSE_CATEGORIES[3]).toBe('Utilities');
      expect(EXPENSE_CATEGORIES[4]).toBe('Entertainment');
      expect(EXPENSE_CATEGORIES[5]).toBe('Healthcare');
      expect(EXPENSE_CATEGORIES[6]).toBe('Shopping');
      expect(EXPENSE_CATEGORIES[7]).toBe('Education');
      expect(EXPENSE_CATEGORIES[8]).toBe('Other');
    });

    it('should allow iteration over categories', () => {
      const categories: string[] = [];
      for (const category of EXPENSE_CATEGORIES) {
        categories.push(category);
      }
      expect(categories).toHaveLength(9);
    });

    it('should work with includes method', () => {
      expect(EXPENSE_CATEGORIES.includes('Food')).toBe(true);
      expect(EXPENSE_CATEGORIES.includes('Transportation')).toBe(true);
      expect(EXPENSE_CATEGORIES.includes('Invalid')).toBe(false);
    });
  });

  // ============================================
  // Expense Type Tests
  // ============================================
  describe('Expense type', () => {
    it('should accept valid Expense object', () => {
      const expense: Expense = {
        id: 'expense-1',
        amount: 99.99,
        category: 'Food',
        description: 'Lunch at restaurant',
        date: new Date('2026-01-31')
      };

      expect(expense.id).toBe('expense-1');
      expect(expense.amount).toBe(99.99);
      expect(expense.category).toBe('Food');
      expect(expense.description).toBe('Lunch at restaurant');
      expect(expense.date).toBeInstanceOf(Date);
    });

    it('should accept expense with any category string', () => {
      const expense: Expense = {
        id: 'expense-2',
        amount: 150.00,
        category: 'Custom Category',
        description: 'Custom expense',
        date: new Date()
      };

      expect(expense.category).toBe('Custom Category');
    });

    it('should accept expense with zero amount', () => {
      const expense: Expense = {
        id: 'expense-3',
        amount: 0,
        category: 'Other',
        description: 'Zero expense',
        date: new Date()
      };

      expect(expense.amount).toBe(0);
    });

    it('should accept expense with negative amount', () => {
      const expense: Expense = {
        id: 'expense-4',
        amount: -50.00,
        category: 'Other',
        description: 'Refund',
        date: new Date()
      };

      expect(expense.amount).toBe(-50.00);
    });

    it('should accept expense with very large amount', () => {
      const expense: Expense = {
        id: 'expense-5',
        amount: 999999.99,
        category: 'Housing',
        description: 'Home purchase',
        date: new Date()
      };

      expect(expense.amount).toBe(999999.99);
    });

    it('should accept expense with empty description', () => {
      const expense: Expense = {
        id: 'expense-6',
        amount: 25.00,
        category: 'Other',
        description: '',
        date: new Date()
      };

      expect(expense.description).toBe('');
    });

    it('should accept expense with long description', () => {
      const longDescription = 'A'.repeat(1000);
      const expense: Expense = {
        id: 'expense-7',
        amount: 10.00,
        category: 'Other',
        description: longDescription,
        date: new Date()
      };

      expect(expense.description).toHaveLength(1000);
    });

    it('should accept expense with past date', () => {
      const pastDate = new Date('2020-01-01');
      const expense: Expense = {
        id: 'expense-8',
        amount: 50.00,
        category: 'Food',
        description: 'Old expense',
        date: pastDate
      };

      expect(expense.date).toEqual(pastDate);
    });

    it('should accept expense with future date', () => {
      const futureDate = new Date('2030-12-31');
      const expense: Expense = {
        id: 'expense-9',
        amount: 75.00,
        category: 'Healthcare',
        description: 'Future appointment',
        date: futureDate
      };

      expect(expense.date).toEqual(futureDate);
    });
  });

  // ============================================
  // ExpenseFormData Type Tests
  // ============================================
  describe('ExpenseFormData type', () => {
    it('should accept valid ExpenseFormData object', () => {
      const formData: ExpenseFormData = {
        amount: 99.99,
        category: 'Food',
        description: 'Lunch',
        date: '2026-01-31'
      };

      expect(formData.amount).toBe(99.99);
      expect(formData.category).toBe('Food');
      expect(formData.description).toBe('Lunch');
      expect(formData.date).toBe('2026-01-31');
    });

    it('should not have id field', () => {
      const formData: ExpenseFormData = {
        amount: 50.00,
        category: 'Transportation',
        description: 'Bus fare',
        date: '2026-01-31'
      };

      // TypeScript compile-time check - id should not exist
      expect('id' in formData).toBe(false);
    });

    it('should have date as string instead of Date', () => {
      const formData: ExpenseFormData = {
        amount: 100.00,
        category: 'Utilities',
        description: 'Electric bill',
        date: '2026-01-15'
      };

      expect(typeof formData.date).toBe('string');
      expect(formData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should accept date in ISO format', () => {
      const formData: ExpenseFormData = {
        amount: 25.00,
        category: 'Entertainment',
        description: 'Movie ticket',
        date: '2026-01-31T10:30:00.000Z'
      };

      expect(formData.date).toContain('2026-01-31');
    });

    it('should accept date in various string formats', () => {
      const formData1: ExpenseFormData = {
        amount: 10.00,
        category: 'Food',
        description: 'Coffee',
        date: '01/31/2026'
      };

      const formData2: ExpenseFormData = {
        amount: 20.00,
        category: 'Food',
        description: 'Lunch',
        date: '2026-01-31'
      };

      expect(formData1.date).toBe('01/31/2026');
      expect(formData2.date).toBe('2026-01-31');
    });

    it('should omit id and convert date from Expense type', () => {
      const expense: Expense = {
        id: 'expense-1',
        amount: 75.00,
        category: 'Shopping',
        description: 'Clothes',
        date: new Date('2026-01-31')
      };

      const formData: ExpenseFormData = {
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        date: expense.date.toISOString().split('T')[0]
      };

      expect(formData).not.toHaveProperty('id');
      expect(typeof formData.date).toBe('string');
      expect(formData.date).toBe('2026-01-31');
    });

    it('should accept all EXPENSE_CATEGORIES values', () => {
      EXPENSE_CATEGORIES.forEach(category => {
        const formData: ExpenseFormData = {
          amount: 10.00,
          category: category,
          description: `Test ${category}`,
          date: '2026-01-31'
        };

        expect(formData.category).toBe(category);
      });
    });
  });

  // ============================================
  // DateRange Type Tests
  // ============================================
  describe('DateRange type', () => {
    it('should accept DateRange with both dates defined', () => {
      const dateRange: DateRange = {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31')
      };

      expect(dateRange.from).toBeInstanceOf(Date);
      expect(dateRange.to).toBeInstanceOf(Date);
    });

    it('should accept DateRange with from undefined', () => {
      const dateRange: DateRange = {
        from: undefined,
        to: new Date('2026-01-31')
      };

      expect(dateRange.from).toBeUndefined();
      expect(dateRange.to).toBeInstanceOf(Date);
    });

    it('should accept DateRange with to undefined', () => {
      const dateRange: DateRange = {
        from: new Date('2026-01-01'),
        to: undefined
      };

      expect(dateRange.from).toBeInstanceOf(Date);
      expect(dateRange.to).toBeUndefined();
    });

    it('should accept DateRange with both dates undefined', () => {
      const dateRange: DateRange = {
        from: undefined,
        to: undefined
      };

      expect(dateRange.from).toBeUndefined();
      expect(dateRange.to).toBeUndefined();
    });

    it('should accept DateRange where from is after to', () => {
      const dateRange: DateRange = {
        from: new Date('2026-01-31'),
        to: new Date('2026-01-01')
      };

      expect(dateRange.from).toBeInstanceOf(Date);
      expect(dateRange.to).toBeInstanceOf(Date);
      expect(dateRange.from! > dateRange.to!).toBe(true);
    });

    it('should accept DateRange with same date for from and to', () => {
      const date = new Date('2026-01-15');
      const dateRange: DateRange = {
        from: date,
        to: date
      };

      expect(dateRange.from).toEqual(dateRange.to);
    });

    it('should accept DateRange with past dates', () => {
      const dateRange: DateRange = {
        from: new Date('2020-01-01'),
        to: new Date('2020-12-31')
      };

      expect(dateRange.from).toBeInstanceOf(Date);
      expect(dateRange.to).toBeInstanceOf(Date);
    });

    it('should accept DateRange with future dates', () => {
      const dateRange: DateRange = {
        from: new Date('2030-01-01'),
        to: new Date('2030-12-31')
      };

      expect(dateRange.from).toBeInstanceOf(Date);
      expect(dateRange.to).toBeInstanceOf(Date);
    });

    it('should work with date range calculations', () => {
      const dateRange: DateRange = {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31')
      };

      if (dateRange.from && dateRange.to) {
        const diffMs = dateRange.to.getTime() - dateRange.from.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(30);
      }
    });
  });

  // ============================================
  // Type Compatibility Tests
  // ============================================
  describe('Type compatibility', () => {
    it('should convert ExpenseFormData to Expense by adding id and converting date', () => {
      const formData: ExpenseFormData = {
        amount: 50.00,
        category: 'Food',
        description: 'Dinner',
        date: '2026-01-31'
      };

      const expense: Expense = {
        id: 'new-id',
        amount: formData.amount,
        category: formData.category,
        description: formData.description,
        date: new Date(formData.date)
      };

      expect(expense.id).toBe('new-id');
      expect(expense.date).toBeInstanceOf(Date);
    });

    it('should filter expenses by DateRange', () => {
      const expenses: Expense[] = [
        { id: '1', amount: 10, category: 'Food', description: 'A', date: new Date('2026-01-15') },
        { id: '2', amount: 20, category: 'Food', description: 'B', date: new Date('2026-01-20') },
        { id: '3', amount: 30, category: 'Food', description: 'C', date: new Date('2026-01-25') },
      ];

      const dateRange: DateRange = {
        from: new Date('2026-01-18'),
        to: new Date('2026-01-22')
      };

      const filtered = expenses.filter(expense => {
        if (!dateRange.from || !dateRange.to) return true;
        return expense.date >= dateRange.from && expense.date <= dateRange.to;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should use EXPENSE_CATEGORIES to validate expense category', () => {
      const validateCategory = (category: string): boolean => {
        return EXPENSE_CATEGORIES.includes(category as any);
      };

      expect(validateCategory('Food')).toBe(true);
      expect(validateCategory('Invalid')).toBe(false);
    });

    it('should create expense with category from EXPENSE_CATEGORIES', () => {
      const randomIndex = Math.floor(Math.random() * EXPENSE_CATEGORIES.length);
      const randomCategory = EXPENSE_CATEGORIES[randomIndex];

      const expense: Expense = {
        id: 'random-1',
        amount: 100.00,
        category: randomCategory,
        description: 'Random expense',
        date: new Date()
      };

      expect(EXPENSE_CATEGORIES).toContain(expense.category);
    });
  });

  // ============================================
  // Edge Cases and Type Guards
  // ============================================
  describe('Type guards and edge cases', () => {
    it('should create type guard for Expense', () => {
      const isExpense = (obj: any): obj is Expense => {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          typeof obj.id === 'string' &&
          typeof obj.amount === 'number' &&
          typeof obj.category === 'string' &&
          typeof obj.description === 'string' &&
          obj.date instanceof Date
        );
      };

      const validExpense = {
        id: 'exp-1',
        amount: 100,
        category: 'Food',
        description: 'Test',
        date: new Date()
      };

      const invalidExpense = {
        id: 'exp-2',
        amount: '100', // string instead of number
        category: 'Food',
        description: 'Test',
        date: new Date()
      };

      expect(isExpense(validExpense)).toBe(true);
      expect(isExpense(invalidExpense)).toBe(false);
    });

    it('should create type guard for ExpenseFormData', () => {
      const isExpenseFormData = (obj: any): obj is ExpenseFormData => {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          typeof obj.amount === 'number' &&
          typeof obj.category === 'string' &&
          typeof obj.description === 'string' &&
          typeof obj.date === 'string' &&
          !('id' in obj)
        );
      };

      const validFormData = {
        amount: 100,
        category: 'Food',
        description: 'Test',
        date: '2026-01-31'
      };

      const invalidFormData = {
        id: 'should-not-exist',
        amount: 100,
        category: 'Food',
        description: 'Test',
        date: '2026-01-31'
      };

      expect(isExpenseFormData(validFormData)).toBe(true);
      expect(isExpenseFormData(invalidFormData)).toBe(false);
    });

    it('should create type guard for DateRange', () => {
      const isDateRange = (obj: any): obj is DateRange => {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          'from' in obj &&
          'to' in obj &&
          (obj.from === undefined || obj.from instanceof Date) &&
          (obj.to === undefined || obj.to instanceof Date)
        );
      };

      const validDateRange1 = { from: new Date(), to: new Date() };
      const validDateRange2 = { from: undefined, to: undefined };
      const invalidDateRange = { from: 'not-a-date', to: new Date() };

      expect(isDateRange(validDateRange1)).toBe(true);
      expect(isDateRange(validDateRange2)).toBe(true);
      expect(isDateRange(invalidDateRange)).toBe(false);
    });

    it('should handle null and undefined checks', () => {
      const isValidExpenseAmount = (amount: number | null | undefined): boolean => {
        return amount !== null && amount !== undefined && !isNaN(amount);
      };

      expect(isValidExpenseAmount(100)).toBe(true);
      expect(isValidExpenseAmount(0)).toBe(true);
      expect(isValidExpenseAmount(null)).toBe(false);
      expect(isValidExpenseAmount(undefined)).toBe(false);
      expect(isValidExpenseAmount(NaN)).toBe(false);
    });

    it('should validate expense with decimal precision', () => {
      const expense: Expense = {
        id: 'exp-1',
        amount: 99.999,
        category: 'Food',
        description: 'Test',
        date: new Date()
      };

      const roundedAmount = Math.round(expense.amount * 100) / 100;
      expect(roundedAmount).toBe(100.00);
    });
  });
});
