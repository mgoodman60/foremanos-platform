const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, './'),
  },
  eslint: {
    // Kept true: 4,135 lint warnings would block Vercel builds if set to false.
    // Security-relevant rules (no-unescaped-entities) are set to error in .eslintrc.json.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ canvas: 'canvas' });
    }
    return config;
  },
  headers: async () => [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // CSP: 'unsafe-inline' is required by Next.js App Router for inline scripts/styles
      // (no nonce support without a custom server). This weakens XSS protection —
      // migrate to nonces if Next.js adds native support, or switch to a custom server.
      // unpkg.com is used for Swagger UI on /api/docs only (pinned version with SRI).
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://unpkg.com https://developer.api.autodesk.com https://js.stripe.com",
          "style-src 'self' 'unsafe-inline' https://unpkg.com https://developer.api.autodesk.com",
          "img-src 'self' data: blob: *.r2.cloudflarestorage.com",
          "connect-src 'self' *.amazonaws.com *.r2.cloudflarestorage.com https://developer.api.autodesk.com https://js.stripe.com *.ingest.sentry.io",
          "frame-src 'self' https://js.stripe.com",
          "font-src 'self'",
        ].join('; '),
      },
    ]
  }],
};

module.exports = withSentryConfig(nextConfig, {
  // Upload source maps for better stack traces
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Hide source maps from the client
  hideSourceMaps: true,
});
