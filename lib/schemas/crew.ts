import { z } from 'zod';

/**
 * Crew performance form schema
 */
export const crewPerformanceSchema = z.object({
  date: z
    .string()
    .min(1, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  crewSize: z
    .number({
      required_error: 'Crew size is required',
      invalid_type_error: 'Crew size must be a number',
    })
    .int('Crew size must be a whole number')
    .min(1, 'Crew size must be at least 1'),
  hoursWorked: z
    .number({
      required_error: 'Hours worked is required',
      invalid_type_error: 'Hours worked must be a number',
    })
    .min(0.5, 'Hours worked must be at least 0.5')
    .max(24, 'Hours worked cannot exceed 24'),
  tasksCompleted: z
    .number({
      invalid_type_error: 'Tasks completed must be a number',
    })
    .int('Tasks completed must be a whole number')
    .min(0, 'Tasks completed cannot be negative')
    .optional()
    .default(0),
  unitsProduced: z
    .number({
      invalid_type_error: 'Units produced must be a number',
    })
    .min(0, 'Units produced cannot be negative')
    .optional(),
  safetyIncidents: z
    .number({
      invalid_type_error: 'Safety incidents must be a number',
    })
    .int('Safety incidents must be a whole number')
    .min(0, 'Safety incidents cannot be negative')
    .optional()
    .default(0),
  qualityIssues: z
    .number({
      invalid_type_error: 'Quality issues must be a number',
    })
    .int('Quality issues must be a whole number')
    .min(0, 'Quality issues cannot be negative')
    .optional()
    .default(0),
  reworkRequired: z
    .boolean()
    .optional()
    .default(false),
  weatherDelay: z
    .boolean()
    .optional()
    .default(false),
  weatherNotes: z
    .string()
    .max(500, 'Weather notes must be less than 500 characters')
    .optional(),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

export type CrewPerformanceFormData = z.infer<typeof crewPerformanceSchema>;
