import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Allow importing .mjs files from bin/
    alias: {
      '@bin': resolve(__dirname, 'bin'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.ts',
        // Note: bin/*.mjs scripts are tested via integration tests (child_process.spawn)
        // V8 coverage doesn't track code in spawned processes
      ],
      exclude: [
        '**/__tests__/**',
        '**/dist/**',
        '**/entries/**',
        '**/node_modules/**',
        '**/*.d.ts',
        'vitest.config.ts',
        'esbuild.config.mjs',
        'bin/**/*.mjs',  // Tested via integration, not unit coverage
      ],
      thresholds: {
        // Actual coverage: ~73% lines, ~75% functions, ~68% branches, ~72% statements
        // Target: 80%
        lines: 70,
        functions: 72,
        branches: 65,
        statements: 70,
      },
    },
  },
});
