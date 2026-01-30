import { vi } from 'vitest';

// Set required environment variables
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

// ============================================
// NextAuth Mocks
// ============================================
export const mockSession = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    role: 'client',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export const getServerSessionMock = vi.fn().mockResolvedValue(mockSession);

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

// ============================================
// Prisma Mocks
// ============================================
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  role: 'client',
  subscriptionTier: 'pro',
  subscriptionStatus: 'active',
  stripeCustomerId: 'cus_test123',
  stripeSubscriptionId: 'sub_test123',
  stripePriceId: 'price_pro_monthly',
  queriesUsedThisMonth: 10,
  queriesResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  pagesProcessedThisMonth: 50,
  processingResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  approved: true,
  emailVerified: true,
};

export const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  slug: 'test-project',
  ownerId: 'user-1',
};

export const mockDocument = {
  id: 'doc-1',
  name: 'Test Document',
  fileName: 'test.pdf',
  fileType: 'pdf',
  projectId: 'project-1',
  processed: false,
  cloud_storage_path: 'projects/test-project/test.pdf',
};

export const prismaMock = {
  user: {
    findUnique: vi.fn().mockResolvedValue(mockUser),
    findFirst: vi.fn().mockResolvedValue(mockUser),
    update: vi.fn().mockResolvedValue(mockUser),
    create: vi.fn().mockResolvedValue(mockUser),
  },
  project: {
    findUnique: vi.fn().mockResolvedValue(mockProject),
    findFirst: vi.fn().mockResolvedValue(mockProject),
  },
  document: {
    findMany: vi.fn().mockResolvedValue([mockDocument]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(mockDocument),
    create: vi.fn().mockResolvedValue(mockDocument),
    update: vi.fn().mockResolvedValue(mockDocument),
  },
  paymentHistory: {
    create: vi.fn().mockResolvedValue({ id: 'payment-1' }),
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null), // No duplicate event by default
  },
  maintenanceMode: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// ============================================
// Stripe Mocks
// ============================================
export const mockStripeSubscription = {
  id: 'sub_test123',
  customer: 'cus_test123',
  status: 'active',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  cancel_at_period_end: false,
  metadata: { userId: 'user-1' },
  items: {
    data: [
      {
        price: {
          id: 'price_pro_monthly',
        },
      },
    ],
  },
};

export const mockStripeEvent = (type: string, data: any) => ({
  id: `evt_${Date.now()}`,
  type,
  data: { object: data },
  created: Math.floor(Date.now() / 1000),
});

export const constructEventMock = vi.fn();
export const subscriptionsRetrieveMock = vi.fn().mockResolvedValue(mockStripeSubscription);

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventMock,
    },
    subscriptions: {
      retrieve: subscriptionsRetrieveMock,
    },
  },
  SUBSCRIPTION_LIMITS: {
    free: { queriesPerMonth: 50, projects: 1, pagesPerMonth: 100 },
    starter: { queriesPerMonth: 200, projects: 3, pagesPerMonth: 500 },
    pro: { queriesPerMonth: 1000, projects: 10, pagesPerMonth: 2000 },
    team: { queriesPerMonth: 5000, projects: 25, pagesPerMonth: 10000 },
    business: { queriesPerMonth: -1, projects: -1, pagesPerMonth: -1 },
    enterprise: { queriesPerMonth: -1, projects: -1, pagesPerMonth: -1 },
  },
}));

// ============================================
// S3 Mocks
// ============================================
export const uploadFileMock = vi.fn().mockResolvedValue('projects/test-project/test.pdf');
export const getFileUrlMock = vi.fn().mockResolvedValue('https://s3.amazonaws.com/bucket/test.pdf');

vi.mock('@/lib/s3', () => ({
  uploadFile: uploadFileMock,
  getFileUrl: getFileUrlMock,
  downloadFile: vi.fn().mockResolvedValue(Buffer.from('test')),
}));

// ============================================
// Document Processing Mocks
// ============================================
export const processDocumentMock = vi.fn().mockResolvedValue(undefined);
export const calculateFileHashMock = vi.fn().mockReturnValue('hash123');
export const isDuplicateMock = vi.fn().mockResolvedValue(false);
export const classifyDocumentMock = vi.fn().mockResolvedValue({
  processorType: 'pdf',
  category: 'plans',
});

vi.mock('@/lib/document-processor', () => ({
  processDocument: processDocumentMock,
}));

vi.mock('@/lib/duplicate-detector', () => ({
  calculateFileHash: calculateFileHashMock,
  isDuplicate: isDuplicateMock,
}));

vi.mock('@/lib/document-classifier', () => ({
  classifyDocument: classifyDocumentMock,
}));

// ============================================
// Processing Limits Mocks
// ============================================
export const canProcessDocumentMock = vi.fn().mockResolvedValue({ allowed: true, reason: '' });
export const getRemainingPagesMock = vi.fn().mockReturnValue(1950);
export const shouldResetQuotaMock = vi.fn().mockResolvedValue(false);
export const getNextResetDateMock = vi.fn().mockReturnValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

vi.mock('@/lib/processing-limits', () => ({
  getProcessingLimits: vi.fn().mockReturnValue({ pagesPerMonth: 2000 }),
  canProcessDocument: canProcessDocumentMock,
  getRemainingPages: getRemainingPagesMock,
  shouldResetQuota: shouldResetQuotaMock,
  getNextResetDate: getNextResetDateMock,
}));

// ============================================
// Project Permissions Mocks
// ============================================
export const requireProjectPermissionMock = vi.fn().mockResolvedValue({
  allowed: true,
  access: { role: 'owner' },
});

vi.mock('@/lib/project-permissions', () => ({
  requireProjectPermission: requireProjectPermissionMock,
}));

// ============================================
// Email Service Mocks
// ============================================
vi.mock('@/lib/email-service', () => ({
  sendDocumentUploadNotification: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// ============================================
// Onboarding Tracker Mocks
// ============================================
vi.mock('@/lib/onboarding-tracker', () => ({
  markDocumentUploaded: vi.fn().mockResolvedValue(undefined),
  markFirstChatStarted: vi.fn().mockResolvedValue(undefined),
}));

// ============================================
// Retry Util Mock
// ============================================
vi.mock('@/lib/retry-util', () => ({
  withDatabaseRetry: vi.fn().mockImplementation(async (fn: () => Promise<any>) => fn()),
}));

// ============================================
// Rate Limiter Mock
// ============================================
export const checkRateLimitMock = vi.fn().mockResolvedValue({
  success: true,
  limit: 10,
  remaining: 9,
  reset: Math.floor(Date.now() / 1000) + 60,
});

export const getClientIpMock = vi.fn().mockReturnValue('127.0.0.1');

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  RATE_LIMITS: {
    CHAT: { maxRequests: 20, windowSeconds: 60 },
    UPLOAD: { maxRequests: 10, windowSeconds: 60 },
    API: { maxRequests: 60, windowSeconds: 60 },
    AUTH: { maxRequests: 5, windowSeconds: 300 },
  },
}));

// ============================================
// Next.js Headers Mock
// ============================================
export const headersMock = vi.fn().mockResolvedValue({
  get: vi.fn().mockImplementation((key: string) => {
    if (key === 'stripe-signature') return 'test_signature';
    return null;
  }),
});

vi.mock('next/headers', () => ({
  headers: headersMock,
}));
