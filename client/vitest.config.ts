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
    // jsdom has to build a document for every render and userEvent types one
    // character at a time, so a form test that fills four fields genuinely
    // takes several seconds here. The default 5s was being hit by tests that
    // pass comfortably when run alone, which is a slow test rather than a
    // failing one.
    testTimeout: 20_000,
    // Issue 1 configures the runner before any test exists.
    passWithNoTests: true,
  },
});
