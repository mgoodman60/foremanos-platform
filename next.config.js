const path = require('path');

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
  // Construction document images from PDF rasterization don't benefit from Next.js image optimization
  images: { unoptimized: true },
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
      // CSP: 'unsafe-inline' required by Next.js framework inline scripts (no nonce support without custom server)
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' unpkg.com developer.api.autodesk.com js.stripe.com apps.abacus.ai",
          "style-src 'self' 'unsafe-inline' unpkg.com developer.api.autodesk.com",
          "img-src 'self' data: blob: *.r2.cloudflarestorage.com",
          "connect-src 'self' *.amazonaws.com *.r2.cloudflarestorage.com developer.api.autodesk.com js.stripe.com apps.abacus.ai",
          "frame-src 'self' js.stripe.com",
          "font-src 'self'",
        ].join('; '),
      },
    ]
  }],
};

module.exports = nextConfig;
