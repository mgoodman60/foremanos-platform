const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, './'),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  headers: async () => [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' unpkg.com developer.api.autodesk.com js.stripe.com apps.abacus.ai",
          "style-src 'self' 'unsafe-inline' unpkg.com developer.api.autodesk.com",
          "img-src 'self' data: blob: *.amazonaws.com",
          "connect-src 'self' *.amazonaws.com *.r2.cloudflarestorage.com developer.api.autodesk.com js.stripe.com apps.abacus.ai",
          "frame-src 'self' js.stripe.com",
          "font-src 'self'",
        ].join('; '),
      },
    ]
  }],
};

module.exports = nextConfig;
