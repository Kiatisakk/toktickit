import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: core.ignorePatterns,
  rules: {
    // Ultracite's preset sorts object keys alphabetically. Two contracts in this
    // repository fix key order deliberately, and the rule would rewrite both:
    //
    //   §10.1 of the Lab 1 brief fixes the health response to
    //   `{"status":"ok","service":"TokTickIT API"}` — sorted, that becomes
    //   `{service, status}`, which no longer matches the specification we were given.
    //
    //   Prisma call sites read as `{ where, data }` and `{ where, update, create }`,
    //   which mirrors how the query is understood. Sorted, `data` precedes `where`
    //   and the operation reads backwards.
    //
    // Alphabetical order is not more correct than either of those; it is just
    // different, so the rule is off rather than suppressed case by case.
    "sort-keys": "off",

    // The Lab 1 test files are named API-01.health.test.ts and UI-02.*.test.tsx,
    // and docs/lab-01/tests.md cites those names as submitted evidence. Renaming
    // them to kebab-case would break the link between the report and the repository.
    // Lab 2 test files follow kebab-case by choice; this rule is off so that the
    // Lab 1 names can stay accurate.
    "unicorn/filename-case": "off",
  },
});
