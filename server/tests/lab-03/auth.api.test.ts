import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ACTIVE_REQUESTER,
  ADMINISTRATOR,
  INACTIVE_REQUESTER,
  MUST_CHANGE_REQUESTER,
  SECOND_REQUESTER,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { hashSessionToken, SESSION_COOKIE } from "../../src/auth/session.js";
import { prisma } from "../../src/prisma.js";
import { signIn } from "./support/signIn.js";

/**
 * API-01 to API-13 — the authentication endpoints.
 *
 * Every test signs in through `POST /api/auth/login` (D-15). Nothing here
 * fabricates a session row or sets a cookie by hand, because a test that
 * manufactures its own credential proves the credential works, not the
 * endpoint.
 *
 * The must-change and deactivated accounts are restored in `afterEach` rather
 * than left as the tests leave them: this suite consumes the very flag it
 * asserts (D-16), and a later run would otherwise find nothing to assert.
 */

const cookieValue = (setCookie: string[] | undefined): string | undefined =>
  setCookie?.find((line) => line.startsWith(`${SESSION_COOKIE}=`));

/**
 * Supertest types `set-cookie` as a string; Node sends a string array whenever
 * more than one cookie is set. Reading it through one helper keeps the
 * correction in a single place rather than at every call site.
 */
const cookiesOf = (response: request.Response): string[] =>
  response.headers["set-cookie"] as unknown as string[];

const tokenOf = (setCookie: string[] | undefined): string => {
  const line = cookieValue(setCookie);

  if (!line) {
    throw new Error("No session cookie in the response.");
  }

  return line.slice(`${SESSION_COOKIE}=`.length).split(";")[0] ?? "";
};

/** Restores an account to exactly what the seed guarantees. */
const restore = async (
  email: string,
  password: string,
  mustChange: boolean
) => {
  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: mustChange,
    },
  });
};

describe("POST /api/auth/login", () => {
  it("API-01 answers 200 with the identity and role, and sets a session cookie", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: ACTIVE_REQUESTER.email,
      password: ACTIVE_REQUESTER.password,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      user: { email: ACTIVE_REQUESTER.email, role: "REQUESTER" },
      mustChangePassword: false,
    });
    expect(cookieValue(cookiesOf(response))).toBeDefined();
  });

  it("API-01 returns no credential of any kind in the body", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: ACTIVE_REQUESTER.email,
      password: ACTIVE_REQUESTER.password,
    });

    const serialised = JSON.stringify(response.body);

    expect(serialised).not.toContain(ACTIVE_REQUESTER.password);
    expect(serialised).not.toContain("passwordHash");
    expect(serialised).not.toContain("scrypt$");
    // The token lives in the cookie and nowhere else (api-spec.md §1).
    expect(serialised).not.toContain(SESSION_COOKIE);
  });

  it("API-01 issues an httpOnly, SameSite=Lax cookie scoped to the whole site", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: ACTIVE_REQUESTER.email,
      password: ACTIVE_REQUESTER.password,
    });

    const cookie = cookieValue(cookiesOf(response)) ?? "";

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("API-01 marks the cookie Secure unless it is explicitly turned off", async () => {
    // api-spec.md §1 requires Secure outside local development. It used to be
    // on only when NODE_ENV was "production", which left it off everywhere the
    // variable was unset — including this test run. The default is now on.
    const previous = process.env["COOKIE_SECURE"];

    delete process.env["COOKIE_SECURE"];

    try {
      const response = await request(app).post("/api/auth/login").send({
        email: ACTIVE_REQUESTER.email,
        password: ACTIVE_REQUESTER.password,
      });

      expect(cookieValue(cookiesOf(response)) ?? "").toContain("Secure");
    } finally {
      if (previous === undefined) {
        delete process.env["COOKIE_SECURE"];
      } else {
        process.env["COOKIE_SECURE"] = previous;
      }
    }
  });

  it("API-01 leaves Secure off only when COOKIE_SECURE is false", async () => {
    const previous = process.env["COOKIE_SECURE"];

    process.env["COOKIE_SECURE"] = "false";

    try {
      const response = await request(app).post("/api/auth/login").send({
        email: ACTIVE_REQUESTER.email,
        password: ACTIVE_REQUESTER.password,
      });

      expect(cookieValue(cookiesOf(response)) ?? "").not.toContain("Secure");
    } finally {
      if (previous === undefined) {
        delete process.env["COOKIE_SECURE"];
      } else {
        process.env["COOKIE_SECURE"] = previous;
      }
    }
  });

  it("refuses an account locked by the migration exactly like a wrong password", async () => {
    // Accounts that predate authentication hold "!" after the NOT NULL
    // migration. They must not be enumerable: same status, same body as a
    // wrong password against a real account.
    const email = "locked-by-migration@example.ac.th";

    await prisma.user.create({
      data: { name: "Locked Fixture", email, passwordHash: "!" },
    });

    try {
      const locked = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "Anything1!" });
      const wrong = await request(app)
        .post("/api/auth/login")
        .send({ email: ACTIVE_REQUESTER.email, password: "Wrong1!wrong" });

      expect(locked.status).toBe(401);
      expect(locked.body).toEqual(wrong.body);
    } finally {
      await prisma.user.delete({ where: { email } });
    }
  });

  it("API-01 stores the token hashed, never the token itself", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: ACTIVE_REQUESTER.email,
      password: ACTIVE_REQUESTER.password,
    });

    const token = tokenOf(cookiesOf(response));

    // BR-10. Looked up by hash — and the raw token must match nothing.
    const byHash = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });
    const byToken = await prisma.session.findUnique({
      where: { tokenHash: token },
    });

    expect(byHash).not.toBeNull();
    expect(byToken).toBeNull();
  });

  it("API-02 refuses an unknown address and a wrong password identically", async () => {
    const unknown = await request(app).post("/api/auth/login").send({
      email: "nobody@example.ac.th",
      password: ACTIVE_REQUESTER.password,
    });

    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: ACTIVE_REQUESTER.email, password: "Wrong1!wrong" });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    // BR-08, AC-05: byte for byte, or the form becomes an account oracle.
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body).toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(cookieValue(cookiesOf(unknown))).toBeUndefined();
  });

  it("API-03 answers 403 ACCOUNT_INACTIVE for a correct password on a deactivated account", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: INACTIVE_REQUESTER.email,
      password: INACTIVE_REQUESTER.password,
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: { code: "ACCOUNT_INACTIVE" },
    });
    expect(cookieValue(cookiesOf(response))).toBeUndefined();
  });

  it("API-04 answers INVALID_CREDENTIALS, not ACCOUNT_INACTIVE, for a wrong password on a deactivated account", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: INACTIVE_REQUESTER.email, password: "Wrong1!wrong" });

    // BR-09, D-04: someone who does not know the password learns nothing about
    // whether the account exists or is switched off.
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("refuses a blank email or password with field-level detail", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "  ", password: "" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: { email: expect.any(String), password: expect.any(String) },
      },
    });
  });

  it("matches the address without regard to case", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: ACTIVE_REQUESTER.email.toUpperCase(),
      password: ACTIVE_REQUESTER.password,
    });

    expect(response.status).toBe(200);
  });

  it("BR-12 leaves sessions already open undisturbed", async () => {
    const first = await signIn(
      ACTIVE_REQUESTER.email,
      ACTIVE_REQUESTER.password
    );
    await signIn(ACTIVE_REQUESTER.email, ACTIVE_REQUESTER.password);

    const stillLive = await request(app)
      .get("/api/auth/me")
      .set("Cookie", first.cookie);

    expect(stillLive.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("API-05 returns the identity, role and must-change flag", async () => {
    const { cookie } = await signIn(
      ACTIVE_REQUESTER.email,
      ACTIVE_REQUESTER.password
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      user: {
        email: ACTIVE_REQUESTER.email,
        name: ACTIVE_REQUESTER.name,
        role: "REQUESTER",
      },
      mustChangePassword: false,
    });
    expect(Object.keys(response.body.user as object).toSorted()).toEqual([
      "email",
      "id",
      "name",
      "role",
    ]);
  });

  it("answers 401 with no cookie at all", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("answers 401 for a token that never existed", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=not-a-real-token`);

    expect(response.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("API-08 answers 204 and the previous cookie then answers 401", async () => {
    const { cookie } = await signIn(
      ACTIVE_REQUESTER.email,
      ACTIVE_REQUESTER.password
    );

    const out = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie);

    expect(out.status).toBe(204);

    const reused = await request(app).get("/api/auth/me").set("Cookie", cookie);

    // AC-07, BR-13: indistinguishable from a token that never existed.
    expect(reused.status).toBe(401);
    expect(reused.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("API-08 deletes the row rather than only clearing the cookie", async () => {
    const signedIn = await request(app).post("/api/auth/login").send({
      email: ACTIVE_REQUESTER.email,
      password: ACTIVE_REQUESTER.password,
    });

    const token = tokenOf(cookiesOf(signedIn));

    await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookiesOf(signedIn));

    const row = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });

    expect(row).toBeNull();
  });

  it("API-13 answers 204 without a session, since refusing would disclose one", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(204);
  });
});

describe("session lifetime and account state", () => {
  it("API-09 refuses a session past its expiry", async () => {
    const signedIn = await request(app).post("/api/auth/login").send({
      email: ACTIVE_REQUESTER.email,
      password: ACTIVE_REQUESTER.password,
    });

    const cookie = cookiesOf(signedIn);
    const token = tokenOf(cookie);

    // Aged rather than waited for. The row is the whole of the expiry rule
    // (BR-11), so moving it back one second is the same event as eight hours
    // passing — and a test that slept for eight hours is not a test.
    await prisma.session.update({
      where: { tokenHash: hashSessionToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookie);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("API-10 refuses a live session whose user has since been deactivated", async () => {
    const { cookie } = await signIn(
      SECOND_REQUESTER.email,
      SECOND_REQUESTER.password
    );

    const before = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(before.status).toBe(200);

    await prisma.user.update({
      where: { email: SECOND_REQUESTER.email },
      data: { isActive: false },
    });

    try {
      const after = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookie);

      // AC-11, BR-15, D-02: the session caches nothing about the user, so this
      // takes effect on the next request rather than at the next sign-in.
      expect(after.status).toBe(401);
    } finally {
      await prisma.user.update({
        where: { email: SECOND_REQUESTER.email },
        data: { isActive: true },
      });
    }
  });
});

describe("the password-change gate", () => {
  afterEach(async () => {
    await restore(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password,
      true
    );
  });

  /**
   * Asserted against shipped endpoints. Until the selector was deleted this
   * used a probe route mounted in the test, because nothing shipped required a
   * session yet; now every ticket and reference-data route does. SEC-06 walks
   * the whole route table; these pick one of each kind.
   */
  const GATED = ["/api/tickets", "/api/categories"] as const;

  it("API-06 answers 403 PASSWORD_CHANGE_REQUIRED on a gated endpoint", async () => {
    const { cookie } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    const responses = await Promise.all(
      GATED.map((path) => request(app).get(path).set("Cookie", cookie))
    );

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: { code: "PASSWORD_CHANGE_REQUIRED" },
      });
    }
  });

  it("API-06 lets the same endpoint through once the flag is cleared", async () => {
    const { cookie } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    const refused = await request(app)
      .get("/api/tickets")
      .set("Cookie", cookie);

    expect(refused.status).toBe(403);

    const changed = await request(app)
      .post("/api/auth/password")
      .set("Cookie", cookie)
      .send({
        currentPassword: MUST_CHANGE_REQUESTER.password,
        newPassword: "Replaced1!",
      });

    const allowed = await request(app)
      .get("/api/tickets")
      .set("Cookie", cookiesOf(changed));

    expect(allowed.status).toBe(200);
  });

  it("the gate refuses before it asks who you are, when there is no session", async () => {
    const response = await request(app).get("/api/tickets");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("API-07 leaves me, password and logout reachable while the flag is set", async () => {
    const { cookie, body } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    expect(body).toMatchObject({ mustChangePassword: true });

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ mustChangePassword: true });

    const changed = await request(app)
      .post("/api/auth/password")
      .set("Cookie", cookie)
      .send({
        currentPassword: MUST_CHANGE_REQUESTER.password,
        newPassword: "Replaced1!",
      });

    expect(changed.status).toBe(204);

    const out = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookiesOf(changed));

    expect(out.status).toBe(204);
  });
});

describe("POST /api/auth/password", () => {
  const CHANGED = "Replaced1!";

  beforeEach(async () => {
    await restore(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password,
      true
    );
  });

  afterEach(async () => {
    await restore(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password,
      true
    );
  });

  it("AC-09 clears the flag and rotates the current session", async () => {
    const first = await request(app).post("/api/auth/login").send({
      email: MUST_CHANGE_REQUESTER.email,
      password: MUST_CHANGE_REQUESTER.password,
    });

    const oldCookie = cookiesOf(first);

    const changed = await request(app)
      .post("/api/auth/password")
      .set("Cookie", oldCookie)
      .send({
        currentPassword: MUST_CHANGE_REQUESTER.password,
        newPassword: CHANGED,
      });

    expect(changed.status).toBe(204);

    const newCookie = cookiesOf(changed);

    expect(tokenOf(newCookie)).not.toBe(tokenOf(oldCookie));

    const me = await request(app).get("/api/auth/me").set("Cookie", newCookie);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ mustChangePassword: false });
  });

  it("API-12 ends every other session and keeps the caller signed in", async () => {
    const elsewhere = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );
    const here = await request(app).post("/api/auth/login").send({
      email: MUST_CHANGE_REQUESTER.email,
      password: MUST_CHANGE_REQUESTER.password,
    });

    const changed = await request(app)
      .post("/api/auth/password")
      .set("Cookie", cookiesOf(here))
      .send({
        currentPassword: MUST_CHANGE_REQUESTER.password,
        newPassword: CHANGED,
      });

    expect(changed.status).toBe(204);

    const other = await request(app)
      .get("/api/auth/me")
      .set("Cookie", elsewhere.cookie);
    const current = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookiesOf(changed));

    // BR-14, AC-09.
    expect(other.status).toBe(401);
    expect(current.status).toBe(200);
  });

  it("signs in with the new password and refuses the old one", async () => {
    const { cookie } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    await request(app).post("/api/auth/password").set("Cookie", cookie).send({
      currentPassword: MUST_CHANGE_REQUESTER.password,
      newPassword: CHANGED,
    });

    const withNew = await request(app)
      .post("/api/auth/login")
      .send({ email: MUST_CHANGE_REQUESTER.email, password: CHANGED });
    const withOld = await request(app).post("/api/auth/login").send({
      email: MUST_CHANGE_REQUESTER.email,
      password: MUST_CHANGE_REQUESTER.password,
    });

    expect(withNew.status).toBe(200);
    expect(withOld.status).toBe(401);
  });

  it("API-11 refuses a wrong current password without changing anything", async () => {
    const { cookie } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    const response = await request(app)
      .post("/api/auth/password")
      .set("Cookie", cookie)
      .send({ currentPassword: "Wrong1!wrong", newPassword: CHANGED });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });

    const unchanged = await request(app).post("/api/auth/login").send({
      email: MUST_CHANGE_REQUESTER.email,
      password: MUST_CHANGE_REQUESTER.password,
    });

    expect(unchanged.status).toBe(200);
  });

  it.each([
    { what: "too short", newPassword: "Aa1!aaa" },
    { what: "no upper-case letter", newPassword: "replaced1!" },
    { what: "no lower-case letter", newPassword: "REPLACED1!" },
    { what: "no digit", newPassword: "Replaced!!" },
    { what: "no special character", newPassword: "Replaced11" },
  ])("API-11 refuses a new password that is $what", async ({ newPassword }) => {
    const { cookie } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    const response = await request(app)
      .post("/api/auth/password")
      .set("Cookie", cookie)
      .send({
        currentPassword: MUST_CHANGE_REQUESTER.password,
        newPassword,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: { newPassword: expect.any(String) },
      },
    });
    // BR-06: the rule is named, the password is never echoed.
    expect(JSON.stringify(response.body)).not.toContain(newPassword);
  });

  it("API-11 refuses a new password identical to the current one", async () => {
    const { cookie } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    const response = await request(app)
      .post("/api/auth/password")
      .set("Cookie", cookie)
      .send({
        currentPassword: MUST_CHANGE_REQUESTER.password,
        newPassword: MUST_CHANGE_REQUESTER.password,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: { newPassword: expect.any(String) },
      },
    });
  });

  it("answers 401 without a session", async () => {
    const response = await request(app)
      .post("/api/auth/password")
      .send({ currentPassword: "whatever", newPassword: CHANGED });

    expect(response.status).toBe(401);
  });

  it("stores the new password only as a hash", async () => {
    const { cookie } = await signIn(
      MUST_CHANGE_REQUESTER.email,
      MUST_CHANGE_REQUESTER.password
    );

    await request(app).post("/api/auth/password").set("Cookie", cookie).send({
      currentPassword: MUST_CHANGE_REQUESTER.password,
      newPassword: CHANGED,
    });

    const row = await prisma.user.findUniqueOrThrow({
      where: { email: MUST_CHANGE_REQUESTER.email },
      select: { passwordHash: true },
    });

    expect(row.passwordHash).not.toBe(CHANGED);
    expect(row.passwordHash).not.toContain(CHANGED);
    expect(row.passwordHash?.startsWith("scrypt$")).toBe(true);
  });
});

describe("BR-20 error bodies", () => {
  // What a leak looks like: a V8 stack frame, an ORM or database complaint,
  // a filesystem path, or a module filename with a line number.
  const leak =
    /stack|prisma|postgres|constraint|violates|ENOENT|node_modules|\.ts:|\.js:|at\s+\S+\s*\(/iu;

  const expectEnvelopeOnly = (response: request.Response) => {
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(Object.keys(response.body)).toStrictEqual(["error"]);
    expect(JSON.stringify(response.body)).not.toMatch(leak);
  };

  it("API-40 no failure path leaks a stack trace, path or database message", async () => {
    const { cookie } = await signIn(
      ACTIVE_REQUESTER.email,
      ACTIVE_REQUESTER.password
    );

    const answers = await Promise.all([
      request(app).post("/api/auth/login").send({
        email: "nobody@example.com",
        password: "Wrong1!x",
      }),
      request(app).get("/api/tickets/99999999").set("Cookie", cookie),
      request(app).post("/api/tickets").set("Cookie", cookie).send({}),
      request(app).get("/api/staff/tickets").set("Cookie", cookie),
      request(app).get("/api/does-not-exist").set("Cookie", cookie),
      request(app)
        .post("/api/tickets/99999999/attachments")
        .set("Cookie", cookie)
        .attach("file", Buffer.from("x"), {
          filename: "x.pdf",
          contentType: "application/pdf",
        }),
    ]);

    for (const response of answers) {
      expectEnvelopeOnly(response);
    }
  });

  it("API-40 conflict, oversize, wrong-type and internal failures keep the same envelope", async () => {
    const { cookie } = await signIn(
      ACTIVE_REQUESTER.email,
      ACTIVE_REQUESTER.password
    );
    const admin = await signIn(ADMINISTRATOR.email, ADMINISTRATOR.password);

    // 409: the address is taken. 413: past the 100 KB JSON limit.
    const [conflict, tooLarge] = await Promise.all([
      request(app).post("/api/admin/users").set("Cookie", admin.cookie).send({
        name: "Taken",
        email: ACTIVE_REQUESTER.email,
        role: "REQUESTER",
        isActive: true,
        initialPassword: "Starting9!",
      }),
      request(app)
        .post("/api/tickets")
        .set("Cookie", cookie)
        .send({ summary: "x".repeat(200 * 1024) }),
    ]);

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.error.code).toBe("REQUEST_TOO_LARGE");

    // 415 and 500 need the caller's own ticket: one uploaded file of the
    // wrong type, and one row whose bytes are gone from storage.
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    const me = await prisma.user.findUniqueOrThrow({
      where: { email: ACTIVE_REQUESTER.email },
      select: { id: true },
    });
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2990-${Date.now()}`,
        requesterId: me.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: "API-40 owns this ticket",
        description: "Created by the error-body suite.",
        requestedPriority: "LOW",
      },
      select: { id: true },
    });

    try {
      const wrongType = await request(app)
        .post(`/api/tickets/${ticket.id}/attachments`)
        .set("Cookie", cookie)
        .attach("file", Buffer.from("not a file type we take"), {
          filename: "notes.txt",
          contentType: "text/plain",
        });

      expect(wrongType.status).toBe(415);
      expect(wrongType.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");

      const missing = await prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          originalFilename: "gone.pdf",
          storedFilename: `api40-${Date.now()}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 8,
          uploadedById: me.id,
        },
        select: { id: true },
      });

      // The row promises bytes the disk does not have: our fault, so 500 —
      // still the envelope, never the missing-file error itself.
      const internal = await request(app)
        .get(`/api/attachments/${missing.id}/download`)
        .set("Cookie", cookie);

      expect(internal.status).toBe(500);
      expect(internal.body.error.code).toBe("INTERNAL_ERROR");

      for (const response of [conflict, tooLarge, wrongType, internal]) {
        expectEnvelopeOnly(response);
      }
    } finally {
      await prisma.ticket.deleteMany({ where: { id: ticket.id } });
    }
  });
});
