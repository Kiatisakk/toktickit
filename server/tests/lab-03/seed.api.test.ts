import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { MUST_CHANGE_REQUESTER } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import { signIn } from "./support/signIn.js";

const runSeed = promisify(execFile);

/**
 * MIG-05 — the seed restores credentials (BR-43, D-16).
 *
 * The seed is a script, not a module, so it runs in a child process exactly
 * as `prisma db seed` runs it. `DATABASE_URL` is inherited, and the setup
 * file guarantees it points at the test database.
 */
describe("MIG-05 the seed restores credentials", () => {
  const run = async () => {
    const server = fileURLToPath(new URL("../../", import.meta.url));

    try {
      await runSeed(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
        cwd: server,
        env: process.env,
        timeout: 90_000,
      });
    } catch (error) {
      const stderr =
        error instanceof Error ? (error as { stderr?: string }).stderr : "";

      throw new Error(`The seed failed inside the test:\n${stderr ?? error}`, {
        cause: error,
      });
    }
  };

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("MIG-05 running it twice returns a consumed must-change flag to its seeded state", async () => {
    const usersBefore = await prisma.user.count();

    await run();

    const first = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    expect(first.body).toMatchObject({ mustChangePassword: true });

    const changed = await request(app)
      .post("/api/auth/password")
      .set("Cookie", first.cookie)
      .send({
        currentPassword: MUST_CHANGE_REQUESTER.password,
        newPassword: "Restored1!",
      });

    expect(changed.status).toBe(204);

    const consumed = await prisma.user.findUniqueOrThrow({
      where: { email: MUST_CHANGE_REQUESTER.email },
      select: { mustChangePassword: true },
    });

    expect(consumed.mustChangePassword).toBe(false);

    await run();

    const usersAfter = await prisma.user.count();

    expect(usersAfter).toBe(usersBefore);

    const again = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    // The seeded password works again, and the flag is back: a
    // create-if-absent seed would have left the consumed state in place.
    expect(again.body).toMatchObject({ mustChangePassword: true });
  }, 120_000);
});
