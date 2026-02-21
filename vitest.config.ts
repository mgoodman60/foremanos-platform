import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    testTimeout: 30000,
    setupFiles: ['__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 10,
        functions: 10,
        branches: 10,
        statements: 10,
      },
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '**/*.config.*',
        '**/*.d.ts',
        'prisma/',
        'scripts/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
