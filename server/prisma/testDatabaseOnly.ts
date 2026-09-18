/**
 * Refuses to go on unless the connection points at a test database.
 *
 * The end-to-end reset scripts delete rows wholesale — `reset-tickets-e2e.ts`
 * deletes every ticket there is. Their package scripts load `.env.test`, but
 * nothing stopped someone running the file directly, where it would pick up
 * `server/.env` and empty the development database instead. The check lives in
 * the script, not only in how the script is usually launched.
 *
 * "A test database" means one whose name ends in `_test`, which is how
 * `.env.test` names it (`toktickit_test`).
 */
export const assertTestDatabase = (): void => {
  const raw = process.env["DATABASE_URL"] ?? "";
  let name = "";

  try {
    name = new URL(raw).pathname.replace(/^\//u, "");
  } catch {
    // An unparsable URL is not a test database either.
  }

  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run: DATABASE_URL names "${name || "nothing"}", not a database ending in _test. Run this through its npm script, which loads .env.test.`
    );
  }
};
