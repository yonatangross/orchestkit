import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/__tests__/**',
        '**/dist/**',
        '**/entries/**',
        '**/node_modules/**',
        '**/*.d.ts',
        'vitest.config.ts',
        'esbuild.config.mjs',
      ],
      thresholds: {
        // Current baseline - incrementally increase as coverage improves
        // Target: 70% lines, 60% functions, 50% branches
        lines: 40,
        functions: 45,
        branches: 30,
        statements: 40,
      },
    },
  },
});
