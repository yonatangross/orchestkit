import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    // tests/scan-time.test.ts calls gc() before each timed run, so garbage
    // from earlier runs is not collected inside the one being measured.
    execArgv: ["--expose-gc"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
    },
  },
});
