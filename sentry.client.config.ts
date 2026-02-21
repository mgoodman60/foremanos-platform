import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring sample rate (adjust for production traffic)
  tracesSampleRate: 1.0,

  // Session replay for debugging (only if DSN is set)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment tag
  environment: process.env.NODE_ENV,

  // Only send events when DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [
    Sentry.replayIntegration(),
  ],
});
