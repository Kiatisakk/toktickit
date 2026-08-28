import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // UI tests need a DOM; they never talk to a real backend (fetch is mocked).
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Tests are grouped per lab under tests/lab-NN/ (see docs/lab-01/tests.md).
    // The glob covers every lab so later labs need no config change.
    include: ["tests/lab-*/**/*.test.{ts,tsx}"],
    // Issue 1 configures the runner before any test exists.
    passWithNoTests: true,
  },
});
