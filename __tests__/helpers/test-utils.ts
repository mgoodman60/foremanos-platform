import { NextRequest } from 'next/server';

/**
 * Create a mock NextRequest with custom method, body, and headers
 */
export function createMockNextRequest(
  method: string = 'POST',
  body?: unknown,
  headers?: Record<string, string>,
  url: string = 'http://localhost/api/test'
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  // @ts-expect-error strictNullChecks migration
  return new NextRequest(url, init);
}

/**
 * Create a mock Request for text body (used for Stripe webhooks)
 */
export function createMockTextRequest(
  body: string,
  headers?: Record<string, string>,
  url: string = 'http://localhost/api/stripe/webhook'
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Create a mock FormData request for file uploads
 */
export function createMockFormDataRequest(
  formData: FormData,
  url: string = 'http://localhost/api/documents/upload'
): Request {
  // Create a basic Request with FormData
  return new Request(url, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Create a mock File object
 *
 * NOTE: File.size is a read-only getter. To test file size limits, use a Proxy
 * on the FormData.get() result as shown in upload.test.ts "should return 413 when file exceeds 200MB"
 */
export function createMockFile(
  content: string | Buffer = 'test content',
  name: string = 'test.pdf',
  type: string = 'application/pdf'
): File {
  const buffer = typeof content === 'string' ? Buffer.from(content) : content;
  return new File([buffer], name, { type });
}

/**
 * Create a mock Stripe event
 */
export function createMockStripeEvent(
  type: string,
  data: Record<string, any>,
  id?: string
) {
  return {
    id: id || `evt_${Date.now()}`,
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    api_version: '2023-10-16',
  };
}

/**
 * Create a mock Stripe checkout session
 */
export function createMockCheckoutSession(overrides?: Partial<{
  id: string;
  customer: string;
  subscription: string;
  metadata: Record<string, string>;
  client_reference_id: string;
  amount_total: number;
  currency: string;
}>) {
  return {
    id: 'cs_test123',
    customer: 'cus_test123',
    subscription: 'sub_test123',
    metadata: { userId: 'user-1' },
    client_reference_id: null,
    amount_total: 2900,
    currency: 'usd',
    mode: 'subscription',
    payment_status: 'paid',
    ...overrides,
  };
}

/**
 * Create a mock Stripe subscription
 */
export function createMockStripeSubscription(overrides?: Partial<{
  id: string;
  customer: string;
  status: string;
  metadata: Record<string, string>;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  priceId: string;
}>) {
  const now = Math.floor(Date.now() / 1000);
  const priceId = overrides?.priceId || 'price_pro_monthly';

  return {
    id: 'sub_test123',
    customer: 'cus_test123',
    status: 'active',
    metadata: { userId: 'user-1' },
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: {
            id: priceId,
          },
        },
      ],
    },
    ...overrides,
  };
}

/**
 * Create a mock Stripe invoice
 */
export function createMockStripeInvoice(overrides?: Partial<{
  id: string;
  customer: string;
  subscription: string;
  amount_paid: number;
  currency: string;
  status: string;
}>) {
  return {
    id: 'in_test123',
    customer: 'cus_test123',
    subscription: 'sub_test123',
    amount_paid: 2900,
    currency: 'usd',
    status: 'paid',
    ...overrides,
  };
}

/**
 * Create a mock Prisma user
 */
export function createMockPrismaUser(overrides?: Partial<{
  id: string;
  email: string;
  username: string;
  role: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  queriesUsedThisMonth: number;
  queriesResetAt: Date;
  pagesProcessedThisMonth: number;
  processingResetAt: Date;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  approved: boolean;
}>) {
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    role: 'client',
    subscriptionTier: 'pro',
    subscriptionStatus: 'active',
    queriesUsedThisMonth: 10,
    queriesResetAt: nextMonth,
    pagesProcessedThisMonth: 50,
    processingResetAt: nextMonth,
    stripeCustomerId: 'cus_test123',
    stripeSubscriptionId: 'sub_test123',
    stripePriceId: 'price_pro_monthly',
    approved: true,
    emailVerified: true,
    ...overrides,
  };
}

/**
 * Create a mock Prisma document
 */
export function createMockPrismaDocument(overrides?: Partial<{
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  projectId: string;
  processed: boolean;
  cloud_storage_path: string;
  fileSize: number;
  oneDriveHash: string;
}>) {
  return {
    id: 'doc-1',
    name: 'Test Document',
    fileName: 'test.pdf',
    fileType: 'pdf',
    projectId: 'project-1',
    processed: false,
    cloud_storage_path: 'projects/test-project/test.pdf',
    fileSize: 1024 * 100, // 100KB
    oneDriveHash: 'hash123',
    accessLevel: 'guest',
    category: 'other',
    ...overrides,
  };
}

/**
 * Extract response data for assertions
 */
export async function extractResponseData(response: Response) {
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    const data = await response.json();
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: data,
    };
  }

  const text = await response.text();
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: text,
  };
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
