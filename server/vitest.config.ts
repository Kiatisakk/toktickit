import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // API tests run in Node, not a browser environment.
    environment: "node",
    // Tests are grouped per lab under tests/lab-NN/ (see docs/lab-01/tests.md).
    // The glob covers every lab so later labs need no config change.
    include: ["tests/lab-*/**/*.test.ts"],
    // Redirects DATABASE_URL to toktickit_test before Prisma is imported.
    setupFiles: ["./tests/setup.ts"],
    // Issue 1 configures the runner before any test exists.
    passWithNoTests: true,
    // API-02 talks to a real PostgreSQL database, so keep files serial.
    fileParallelism: false,
  },
});
