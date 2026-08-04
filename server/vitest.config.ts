import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // API tests run in Node, not a browser environment.
    environment: "node",
    // Lab 1 tests all live under tests/lab-01/ (see docs/lab-01/tests.md).
    include: ["tests/lab-01/**/*.test.ts"],
    // Issue 1 configures the runner before any test exists.
    passWithNoTests: true,
    // API-02 talks to a real PostgreSQL database, so keep files serial.
    fileParallelism: false,
  },
});
