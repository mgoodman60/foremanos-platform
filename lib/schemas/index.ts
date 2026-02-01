/**
 * ForemanOS Form Validation Schemas
 *
 * Centralized Zod schemas for consistent form validation across the application.
 * These schemas provide type-safe validation for both client and server.
 *
 * @example
 * // Using with React Hook Form
 * import { zodResolver } from '@hookform/resolvers/zod';
 * import { loginSchema, type LoginFormData } from '@/lib/schemas';
 *
 * const form = useForm<LoginFormData>({
 *   resolver: zodResolver(loginSchema),
 * });
 */

// Auth schemas
export {
  loginSchema,
  guestLoginSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  type LoginFormData,
  type GuestLoginFormData,
  type SignUpFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
  type ChangePasswordFormData,
} from './auth';

// Project schemas
export {
  createProjectSchema,
  editProjectSchema,
  renameProjectSchema,
  inviteMemberSchema,
  guestCredentialsSchema,
  type CreateProjectFormData,
  type EditProjectFormData,
  type RenameProjectFormData,
  type InviteMemberFormData,
  type GuestCredentialsFormData,
} from './project';

// Budget schemas
export {
  budgetItemSchema,
  budgetSetupSchema,
  budgetCreateSchema,
  changeOrderSchema,
  invoiceSchema,
  type BudgetItemFormData,
  type BudgetSetupFormData,
  type BudgetCreateFormData,
  type ChangeOrderFormData,
  type InvoiceFormData,
} from './budget';

// Document schemas
export {
  fileUploadSchema,
  documentUploadSchema,
  documentSearchSchema,
  documentRenameSchema,
  documentCategorySchema,
  batchUploadSchema,
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
  DOCUMENT_CATEGORIES,
  type FileUploadData,
  type DocumentUploadFormData,
  type DocumentSearchFormData,
  type DocumentRenameFormData,
  type DocumentCategoryFormData,
  type BatchUploadFormData,
  type DocumentCategory,
} from './documents';

// Takeoff schemas
export {
  takeoffAddItemSchema,
  takeoffLineItemEditSchema,
  TAKEOFF_UNITS,
  type TakeoffAddItemFormData,
  type TakeoffLineItemEditFormData,
  type TakeoffUnit,
} from './takeoff';

// Crew schemas
export {
  crewPerformanceSchema,
  type CrewPerformanceFormData,
} from './crew';

// Settings schemas
export {
  weatherPreferencesSchema,
  finalizationSettingsSchema,
  COMMON_TIMEZONES,
  NOTIFICATION_METHODS,
  type WeatherPreferencesFormData,
  type FinalizationSettingsFormData,
  type CommonTimezone,
  type NotificationMethod,
} from './settings';

// Photo schemas
export {
  photoAnnotationSchema,
  quickCaptureSchema,
  documentMetadataSchema,
  TRADE_TYPES,
  COMMON_PHOTO_TAGS,
  type PhotoAnnotationFormData,
  type QuickCaptureFormData,
  type DocumentMetadataFormData,
  type TradeType,
  type PhotoTag,
} from './photos';
