import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { prisma } from "../../src/prisma.js";
import type { SessionCookie } from "./support/signIn.js";
import { signIn } from "./support/signIn.js";

/**
 * Administrator user management (api-spec.md §9).
 *
 * API-32 to API-39, API-43, API-44, SEC-07 and SEC-12.
 *
 * Every account this suite creates carries `PREFIX` in its address and is
 * deleted afterwards. The seeded Administrator is restored after every test,
 * because several tests exist precisely to try to deactivate or demote them —
 * and a test that succeeded at it by mistake would otherwise lock every later
 * suite out of the Administrator endpoints.
 */

const PREFIX = "admin-suite";
const STARTING_PASSWORD = "Starting9!";

let admin: SessionCookie = [];

const asAdmin = (r: request.Test) => r.set("Cookie", admin);

const addressFor = (label: string) =>
  `${PREFIX}.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.ac.th`;

/** A user written straight to the table, with a password that can sign in. */
const makeUser = async (
  label: string,
  role: "REQUESTER" | "IT_STAFF" | "ADMIN" = "REQUESTER",
  password = STARTING_PASSWORD
) =>
  await prisma.user.create({
    data: {
      name: `${PREFIX} ${label}`,
      email: addressFor(label),
      role,
      isActive: true,
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
    },
    select: { id: true, email: true, name: true, role: true },
  });

const removeSuiteUsers = async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
};

const restoreAdministrator = async () => {
  await prisma.user.update({
    where: { email: ADMINISTRATOR.email },
    data: { role: "ADMIN", isActive: true },
  });
};

beforeAll(async () => {
  await removeSuiteUsers();
  await restoreAdministrator();
  ({ cookie: admin } = await signIn(
    ADMINISTRATOR.email,
    ADMINISTRATOR.password
  ));
});

afterEach(async () => {
  await restoreAdministrator();
});

afterAll(async () => {
  await removeSuiteUsers();
  await restoreAdministrator();
  await prisma.$disconnect();
});

const administratorId = async () => {
  const seeded = await prisma.user.findUniqueOrThrow({
    where: { email: ADMINISTRATOR.email },
    select: { id: true },
  });

  return seeded.id;
};

const newUserBody = (overrides: Record<string, unknown> = {}) => ({
  name: `${PREFIX} created`,
  email: addressFor("created"),
  role: "REQUESTER",
  isActive: true,
  initialPassword: STARTING_PASSWORD,
  ...overrides,
});

/**
 * Fails if any key, at any depth, names a credential.
 *
 * Keys rather than the serialised text: a user may legitimately be called
 * something with "hash" in it, and an earlier version of this check failed on
 * exactly that.
 */
const keysOf = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(keysOf);
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) => [
      key,
      ...keysOf(inner),
    ]);
  }

  return [];
};

const expectNoCredential = (body: unknown) => {
  expect(keysOf(body).length).toBeGreaterThan(0);
  expect(
    keysOf(body).filter((key) => /password|hash/iu.test(key))
  ).toStrictEqual([]);
};

describe("who may call it", () => {
  const routes = async (): Promise<
    { method: "get" | "post" | "patch"; path: string }[]
  > => {
    const id = await administratorId();

    return [
      { method: "get", path: "/api/admin/users" },
      { method: "post", path: "/api/admin/users" },
      { method: "patch", path: `/api/admin/users/${id}` },
      { method: "post", path: `/api/admin/users/${id}/password` },
    ];
  };

  it("SEC-07 answers 401 without a session", async () => {
    const list = await routes();
    const answers = await Promise.all(
      list.map(async ({ method, path }) => {
        const response = await request(app)[method](path).send({});

        return { path, method, status: response.status };
      })
    );

    expect(answers).toStrictEqual(
      list.map(({ method, path }) => ({ path, method, status: 401 }))
    );
  });

  it.each([
    ["a Requester", ACTIVE_REQUESTER],
    ["IT Staff", ACTIVE_STAFF],
  ])("SEC-07 answers 403 FORBIDDEN to %s", async (_label, account) => {
    const { cookie } = await signIn(account.email, account.password);
    const list = await routes();
    const answers = await Promise.all(
      list.map(async ({ method, path }) => {
        const call = request(app)[method](path);
        const response = await call
          .set("Cookie", cookie)
          .send({ isActive: false, initialPassword: "Changed99!" });

        return { path, method, status: response.status, body: response.body };
      })
    );

    expect(answers).toStrictEqual(
      list.map(({ method, path }) => ({
        path,
        method,
        status: 403,
        body: { error: expect.objectContaining({ code: "FORBIDDEN" }) },
      }))
    );

    // Refused, and nothing happened.
    const seeded = await prisma.user.findUniqueOrThrow({
      where: { email: ADMINISTRATOR.email },
      select: { isActive: true, mustChangePassword: true },
    });

    expect(seeded).toStrictEqual({ isActive: true, mustChangePassword: false });
  });
});

describe("GET /api/admin/users", () => {
  it("API-32 returns name, email, role and state for every user, and no credential", async () => {
    const response = await asAdmin(request(app).get("/api/admin/users"));

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(await prisma.user.count());

    for (const user of response.body as Record<string, unknown>[]) {
      expect(Object.keys(user).toSorted()).toStrictEqual([
        "email",
        "id",
        "isActive",
        "name",
        "role",
      ]);
    }

    expectNoCredential(response.body);
  });

  it("API-32 lists inactive users rather than hiding them", async () => {
    const response = await asAdmin(request(app).get("/api/admin/users"));
    const states = (response.body as { isActive: boolean }[]).map(
      (user) => user.isActive
    );

    expect(states).toContain(false);
  });

  it("API-32 searches by name and by email, without regard to case", async () => {
    const byName = await asAdmin(
      request(app).get("/api/admin/users?search=JENNIFER")
    );
    const byEmail = await asAdmin(
      request(app).get("/api/admin/users?search=somchai.wattana@")
    );

    expect(
      (byName.body as { email: string }[]).map((user) => user.email)
    ).toStrictEqual([ACTIVE_REQUESTER.email]);
    expect(byEmail.body).toHaveLength(1);
  });

  it("API-32 narrows by role", async () => {
    const response = await asAdmin(
      request(app).get("/api/admin/users?role=IT_STAFF")
    );
    const roles = new Set(
      (response.body as { role: string }[]).map((user) => user.role)
    );

    expect(response.body.length).toBeGreaterThan(0);
    expect([...roles]).toStrictEqual(["IT_STAFF"]);
  });

  it("refuses a role that does not exist rather than ignoring it", async () => {
    const response = await asAdmin(
      request(app).get("/api/admin/users?role=SUPERUSER")
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY_PARAMETER");
  });
});

describe("POST /api/admin/users", () => {
  it("API-33 creates the user, who can sign in and must change the password", async () => {
    const body = newUserBody({ role: "IT_STAFF" });
    const response = await asAdmin(request(app).post("/api/admin/users")).send(
      body
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: body.name,
      email: body.email,
      role: "IT_STAFF",
      isActive: true,
    });
    expectNoCredential(response.body);

    const signedIn = await signIn(body.email, STARTING_PASSWORD);

    expect(signedIn.body).toMatchObject({
      user: { role: "IT_STAFF" },
      mustChangePassword: true,
    });
  });

  it("stores the address lower-case, so sign-in and uniqueness agree (D-18)", async () => {
    const response = await asAdmin(request(app).post("/api/admin/users")).send(
      newUserBody({ email: `${PREFIX}.MixedCase.${Date.now()}@Example.AC.TH` })
    );

    expect(response.status).toBe(201);
    expect(response.body.email).toBe(response.body.email.toLowerCase());
  });

  it("API-34 refuses an address another account holds, whatever its case", async () => {
    const response = await asAdmin(request(app).post("/api/admin/users")).send(
      newUserBody({ email: ACTIVE_REQUESTER.email.toUpperCase() })
    );

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
      details: { email: expect.any(String) },
    });
  });

  it.each([
    ["no role", { role: undefined }, "role"],
    ["an invalid role", { role: "SUPERUSER" }, "role"],
    ["two roles", { role: ["REQUESTER", "ADMIN"] }, "role"],
    [
      "a password that breaks the rules",
      { initialPassword: "short" },
      "initialPassword",
    ],
    ["a malformed email", { email: "not-an-address" }, "email"],
    ["a blank name", { name: "   " }, "name"],
  ])("refuses %s with the field named", async (_label, overrides, field) => {
    const response = await asAdmin(request(app).post("/api/admin/users")).send(
      newUserBody(overrides)
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details).toHaveProperty(field);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("API-35 edits name, email, role and state, and each persists", async () => {
    const user = await makeUser("editable");
    const email = addressFor("renamed");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}`)
    ).send({
      name: "Renamed Person",
      email,
      role: "IT_STAFF",
      isActive: false,
    });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      id: user.id,
      name: "Renamed Person",
      email,
      role: "IT_STAFF",
      isActive: false,
    });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, email: true, role: true, isActive: true },
    });

    expect(stored).toStrictEqual({
      name: "Renamed Person",
      email,
      role: "IT_STAFF",
      isActive: false,
    });
  });

  it("API-35 changes only what was sent", async () => {
    const user = await makeUser("partial");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}`)
    ).send({ role: "ADMIN" });

    expect(response.body).toMatchObject({
      name: user.name,
      email: user.email,
      role: "ADMIN",
    });
  });

  it("API-34 refuses editing into an address another account holds", async () => {
    const user = await makeUser("duplicate");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}`)
    ).send({ email: ACTIVE_STAFF.email });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("keeping one's own address is not a conflict with oneself", async () => {
    const user = await makeUser("same-address");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}`)
    ).send({ email: user.email });

    expect(response.status).toBe(200);
  });

  it.each([
    ["an empty name", { name: "" }, "name"],
    ["a malformed email", { email: "nobody@nowhere" }, "email"],
    ["an invalid role", { role: "OWNER" }, "role"],
    ["a non-boolean active", { isActive: "false" }, "isActive"],
    ["a field outside the four", { passwordHash: "x" }, "passwordHash"],
  ])("API-43 refuses %s with the field named", async (_label, body, field) => {
    const user = await makeUser("invalid-edit");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}`)
    ).send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details).toHaveProperty(field);
  });

  it("API-43 refuses an empty body", async () => {
    const user = await makeUser("empty-edit");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}`)
    ).send({});

    expect(response.status).toBe(400);
  });

  it("answers 404 USER_NOT_FOUND for a user who does not exist", async () => {
    const response = await asAdmin(
      request(app).patch("/api/admin/users/99999999")
    ).send({ name: "Nobody" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("a deactivation reaches the user on their very next request (BR-15)", async () => {
    const user = await makeUser("deactivated");
    const { cookie } = await signIn(user.email, STARTING_PASSWORD);

    const before = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(before.status).toBe(200);

    await asAdmin(request(app).patch(`/api/admin/users/${user.id}`)).send({
      isActive: false,
    });

    const after = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(after.status).toBe(401);
  });

  it("SEC-12 returns no credential from an edit", async () => {
    const user = await makeUser("no-credential");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}`)
    ).send({ name: "Still No Hash" });

    expectNoCredential(response.body);
  });
});

describe("the Administrator safety rules", () => {
  it("API-36 refuses an Administrator deactivating their own account", async () => {
    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${await administratorId()}`)
    ).send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CANNOT_DEACTIVATE_SELF");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: ADMINISTRATOR.email },
      select: { isActive: true },
    });

    expect(stored.isActive).toBe(true);
  });

  it("API-36 refuses it even when another Administrator exists", async () => {
    await makeUser("spare-admin", "ADMIN");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${await administratorId()}`)
    ).send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CANNOT_DEACTIVATE_SELF");
  });

  it("API-37 refuses the sole active Administrator demoting themselves", async () => {
    await removeSuiteUsers();

    const activeAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });

    // The precondition the whole assertion rests on.
    expect(activeAdmins).toBe(1);

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${await administratorId()}`)
    ).send({ role: "IT_STAFF" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_ACTIVE_ADMIN");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: ADMINISTRATOR.email },
      select: { role: true },
    });

    expect(stored.role).toBe("ADMIN");
  });

  it("API-37 allows the demotion once another active Administrator exists", async () => {
    await makeUser("successor", "ADMIN");

    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${await administratorId()}`)
    ).send({ role: "IT_STAFF" });

    expect(response.status).toBe(200);
  });

  it("API-37 refuses demoting the last other active Administrator", async () => {
    await removeSuiteUsers();

    const other = await makeUser("other-admin", "ADMIN");

    // Two active Administrators; deactivate the seeded one directly, leaving
    // `other` as the only one. The seeded admin's session is now refused, so
    // the request is made as `other`.
    await prisma.user.update({
      where: { email: ADMINISTRATOR.email },
      data: { isActive: false },
    });

    const { cookie } = await signIn(other.email, STARTING_PASSWORD);

    const response = await request(app)
      .patch(`/api/admin/users/${other.id}`)
      .set("Cookie", cookie)
      .send({ role: "REQUESTER" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_ACTIVE_ADMIN");
  });

  /**
   * AC-33. Repeated, because a race that happens to serialise once proves
   * nothing; the lock has to hold every time.
   *
   * Removing `FOR UPDATE` from the handler makes this fail on the first round —
   * both deactivations succeed — which is how it is known to test the lock and
   * not merely the happy path.
   *
   * The rounds await inside the loop on purpose: each resets the Administrators
   * the previous one changed, so running them in parallel would race the rounds
   * against each other instead of the two requests within one.
   */
  /* oxlint-disable no-await-in-loop */
  it("API-38 two Administrators deactivating each other at once cannot both succeed", async () => {
    const seededId = await administratorId();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await removeSuiteUsers();
      await restoreAdministrator();

      const other = await makeUser(`rival-${attempt}`, "ADMIN");
      const [{ cookie: seededCookie }, { cookie: otherCookie }] =
        await Promise.all([
          signIn(ADMINISTRATOR.email, ADMINISTRATOR.password),
          signIn(other.email, STARTING_PASSWORD),
        ]);

      const [first, second] = await Promise.all([
        request(app)
          .patch(`/api/admin/users/${other.id}`)
          .set("Cookie", seededCookie)
          .send({ isActive: false }),
        request(app)
          .patch(`/api/admin/users/${seededId}`)
          .set("Cookie", otherCookie)
          .send({ isActive: false }),
      ]);

      const succeeded = [first.status, second.status].filter(
        (status) => status === 200
      );

      // AC-33 as written: at least one refused, and an active Administrator
      // remains. `attempt` is in the message so a failure says which round.
      expect(succeeded.length, `attempt ${attempt}`).toBeLessThanOrEqual(1);

      const remaining = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });

      expect(remaining, `attempt ${attempt}`).toBeGreaterThanOrEqual(1);
    }

    await removeSuiteUsers();
  });
  /* oxlint-enable no-await-in-loop */
});

describe("POST /api/admin/users/:id/password", () => {
  it("API-39 sets a new starting password, flags it, and ends the user's sessions", async () => {
    const user = await makeUser("reset");
    const { cookie: old } = await signIn(user.email, STARTING_PASSWORD);

    const response = await asAdmin(
      request(app).post(`/api/admin/users/${user.id}/password`)
    ).send({ initialPassword: "Replaced7!" });

    expect(response.status).toBe(204);

    const stale = await request(app).get("/api/auth/me").set("Cookie", old);

    expect(stale.status).toBe(401);

    const refused = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: STARTING_PASSWORD });

    expect(refused.status).toBe(401);

    const signedIn = await signIn(user.email, "Replaced7!");

    expect(signedIn.body).toMatchObject({ mustChangePassword: true });
  });

  it("API-44 refuses a starting password that breaks the rules, and changes nothing", async () => {
    const user = await makeUser("bad-reset");

    const response = await asAdmin(
      request(app).post(`/api/admin/users/${user.id}/password`)
    ).send({ initialPassword: "alllowercase1!" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      details: { initialPassword: expect.any(String) },
    });

    // The existing credential still works, unflagged.
    const signedIn = await signIn(user.email, STARTING_PASSWORD);

    expect(signedIn.body).toMatchObject({ mustChangePassword: false });
  });

  it("API-44 refuses a missing starting password", async () => {
    const user = await makeUser("missing-reset");

    const response = await asAdmin(
      request(app).post(`/api/admin/users/${user.id}/password`)
    ).send({});

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty("initialPassword");
  });

  it("answers 404 USER_NOT_FOUND for a user who does not exist", async () => {
    const response = await asAdmin(
      request(app).post("/api/admin/users/99999999/password")
    ).send({ initialPassword: "Replaced7!" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });
});
