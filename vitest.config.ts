import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  // Match Next's JSX runtime so restored components need no unused React import.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
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
