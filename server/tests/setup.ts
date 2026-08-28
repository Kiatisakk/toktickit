import { fileURLToPath } from "node:url";

import { config } from "dotenv";

/**
 * Points every test at the test database before anything imports Prisma.
 *
 * Vitest runs setup files before the test module graph is loaded, so this wins
 * over the `dotenv/config` inside src/prisma.ts — dotenv does not overwrite a
 * variable that is already set.
 *
 * Without this, a test run would read and write the development database, and
 * the demonstration tickets the submission screenshots depend on would not
 * survive it.
 */
// fileURLToPath rather than URL.pathname. On Windows the pathname is
// "/C:/Users/..." and slicing the leading slash happens to work; on any Unix
// host it turns "/home/..." into a relative "home/...", and neither form
// decodes percent-escapes in a path containing spaces.
config({ path: fileURLToPath(new URL("../.env.test", import.meta.url)) });

if (!process.env["DATABASE_URL"]?.includes("toktickit_test")) {
  throw new Error(
    "Tests must run against toktickit_test. Copy server/.env.test.example to server/.env.test, then run `npm run db:test:setup`."
  );
}
