import { z } from 'zod';

/**
 * Budget item schema
 */
export const budgetItemSchema = z.object({
  costCode: z
    .string()
    .min(1, 'Cost code is required')
    .max(20, 'Cost code must be less than 20 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(200, 'Description must be less than 200 characters'),
  originalBudget: z
    .number({
      required_error: 'Original budget is required',
      invalid_type_error: 'Original budget must be a number',
    })
    .min(0, 'Original budget cannot be negative'),
  approvedChanges: z
    .number({
      invalid_type_error: 'Approved changes must be a number',
    })
    .optional()
    .default(0),
  category: z
    .string()
    .max(50, 'Category must be less than 50 characters')
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
});

export type BudgetItemFormData = z.infer<typeof budgetItemSchema>;

/**
 * Budget setup schema
 */
export const budgetSetupSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  contractAmount: z
    .number({
      required_error: 'Contract amount is required',
      invalid_type_error: 'Contract amount must be a number',
    })
    .min(0, 'Contract amount cannot be negative'),
  contingencyPercent: z
    .number({
      invalid_type_error: 'Contingency must be a number',
    })
    .min(0, 'Contingency cannot be negative')
    .max(100, 'Contingency cannot exceed 100%')
    .optional()
    .default(10),
  startDate: z
    .string()
    .min(1, 'Start date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z
    .string()
    .min(1, 'End date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  items: z.array(budgetItemSchema).min(1, 'At least one budget item is required'),
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export type BudgetSetupFormData = z.infer<typeof budgetSetupSchema>;

/**
 * Change order schema
 */
export const changeOrderSchema = z.object({
  number: z
    .string()
    .min(1, 'Change order number is required')
    .max(20, 'Change order number must be less than 20 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    }),
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: 'Please select a valid status' }),
  }),
  dateSubmitted: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  dateApproved: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  affectedCostCodes: z
    .array(z.string())
    .optional(),
  reason: z
    .string()
    .max(1000, 'Reason must be less than 1000 characters')
    .optional(),
});

export type ChangeOrderFormData = z.infer<typeof changeOrderSchema>;

/**
 * Invoice schema
 */
export const invoiceSchema = z.object({
  invoiceNumber: z
    .string()
    .min(1, 'Invoice number is required')
    .max(50, 'Invoice number must be less than 50 characters'),
  vendor: z
    .string()
    .min(1, 'Vendor name is required')
    .max(100, 'Vendor name must be less than 100 characters'),
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    })
    .min(0.01, 'Amount must be greater than 0'),
  costCode: z
    .string()
    .min(1, 'Cost code is required'),
  dateReceived: z
    .string()
    .min(1, 'Date received is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  dateDue: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  status: z.enum(['pending', 'approved', 'paid', 'disputed']).optional().default('pending'),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

/**
 * Simple budget creation schema (for budget setup modal)
 */
export const budgetCreateSchema = z.object({
  totalBudget: z
    .number({
      required_error: 'Total budget is required',
      invalid_type_error: 'Total budget must be a number',
    })
    .min(0.01, 'Total budget must be greater than 0'),
  contingency: z
    .number({
      invalid_type_error: 'Contingency must be a number',
    })
    .min(0, 'Contingency cannot be negative')
    .optional()
    .default(0),
  currency: z
    .string()
    .default('USD'),
  baselineDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export type BudgetCreateFormData = z.infer<typeof budgetCreateSchema>;
