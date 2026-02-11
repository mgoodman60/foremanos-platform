'use client';

import { AlertCircle, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldError, FieldErrors } from 'react-hook-form';

interface FormErrorProps {
  /** Error object from React Hook Form */
  error?: FieldError;
  /** Error message string (alternative to error object) */
  message?: string;
  /** Field name for accessibility */
  fieldName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FormError - Displays inline validation error for a single field
 *
 * Use this component to show validation errors below form inputs.
 * It automatically handles accessibility with appropriate ARIA attributes.
 *
 * @example
 * <FormError error={errors.email} fieldName="email" />
 */
export function FormError({ error, message, fieldName, className }: FormErrorProps) {
  const errorMessage = error?.message || message;

  if (!errorMessage) {
    return null;
  }

  return (
    <p
      id={fieldName ? `${fieldName}-error` : undefined}
      role="alert"
      aria-live="polite"
      className={cn(
        'mt-1.5 text-sm text-red-500 flex items-start gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200',
        className
      )}
    >
      <AlertCircle
        className="w-4 h-4 flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <span>{errorMessage}</span>
    </p>
  );
}

interface FormErrorSummaryProps {
  /** Errors object from React Hook Form */
  errors: FieldErrors;
  /** Map of field names to display labels */
  fieldLabels?: Record<string, string>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FormErrorSummary - Displays a summary of all form errors
 *
 * Use this at the top of a form to show all validation errors in one place.
 * Useful for long forms or to provide an overview of issues.
 *
 * @example
 * <FormErrorSummary
 *   errors={errors}
 *   fieldLabels={{ email: 'Email Address', password: 'Password' }}
 * />
 */
export function FormErrorSummary({
  errors,
  fieldLabels = {},
  className,
}: FormErrorSummaryProps) {
  const errorEntries = Object.entries(errors).filter(
    ([, error]) => error?.message
  );

  if (errorEntries.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'p-4 bg-red-50 border border-red-200 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-red-800">
            Please fix the following errors:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-red-700">
            {errorEntries.map(([field, error]) => (
              <li key={field}>
                <span className="font-medium">
                  {fieldLabels[field] || field}:
                </span>{' '}
                {error?.message as string}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface FormMessageProps {
  /** Message type */
  type: 'error' | 'success' | 'info';
  /** Message text */
  message: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FormMessage - Displays a form-level message (success, error, or info)
 *
 * Use this for form-level feedback like submission success or API errors.
 *
 * @example
 * <FormMessage type="success" message="Form submitted successfully!" />
 */
export function FormMessage({ type, message, className }: FormMessageProps) {
  const styles = {
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />,
    },
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />,
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: <Info className="w-5 h-5 text-blue-500" aria-hidden="true" />,
    },
  };

  const style = styles[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'p-4 border rounded-lg text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200',
        style.container,
        className
      )}
    >
      {style.icon}
      <span>{message}</span>
    </div>
  );
}

interface FormFieldWrapperProps {
  /** Label text */
  label: string;
  /** Field name for accessibility */
  name: string;
  /** Whether the field is required */
  required?: boolean;
  /** Help text shown below the input */
  helpText?: string;
  /** Error object from React Hook Form */
  error?: FieldError;
  /** Form input element */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FormFieldWrapper - Wraps a form field with label, help text, and error display
 *
 * Provides consistent structure for form fields with all necessary accessibility attributes.
 *
 * @example
 * <FormFieldWrapper
 *   label="Email Address"
 *   name="email"
 *   required
 *   helpText="We'll never share your email"
 *   error={errors.email}
 * >
 *   <input {...register('email')} aria-describedby="email-help email-error" />
 * </FormFieldWrapper>
 */
export function FormFieldWrapper({
  label,
  name,
  required,
  helpText,
  error,
  children,
  className,
}: FormFieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {children}

      {helpText && !error && (
        <p
          id={`${name}-help`}
          className="text-sm text-gray-400 dark:text-gray-300"
        >
          {helpText}
        </p>
      )}

      <FormError error={error} fieldName={name} />
    </div>
  );
}
