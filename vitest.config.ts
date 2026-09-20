import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Direct and watch-mode runs use one isolated worker. The full-suite wrapper
    // additionally gives every jsdom file a fresh process; see scripts/test-unit.cjs.
    threads: true,
    minThreads: 1,
    maxThreads: 1,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    testTimeout: 10_000,
  },
})
