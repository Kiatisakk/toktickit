import type { Router } from "express";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
  MUST_CHANGE_REQUESTER,
  SECOND_REQUESTER,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";
import {
  actionBody,
  as,
  createTicket,
  removeTickets,
  seedAction,
} from "./support/actions.js";

/**
 * Who may reach every Lab 4 endpoint, asked of the API directly (tests.md,
 * Security / authorization).
 *
 * Covers SEC-01 to SEC-07, and AC-44 for all endpoints at once. Nothing here
 * drives the interface: each call carries a real session of the wrong kind, or
 * none, because a control the interface hides is feedback, not a boundary.
 *
 * **The list of endpoints is read from the mounted router**, not from memory.
 * `MOUNTED` below walks the Express application, and the first suite asserts
 * that every route it finds is either in `LAB4_ENDPOINTS` (tested here) or in
 * `EARLIER_LABS` (guarded and tested by the Lab 1-3 suites). A route added
 * without a decision fails that assertion, so a new endpoint cannot be missed
 * by a table nobody remembered to extend.
 */

const PREFIX = "SEC4-TEST";
const EMAIL_PREFIX = "sec4-test-";
const PASSWORD = "Security4!";
const MISSING_ID = 99_999_999;
const INTERNAL_MARKER = "SEC4-INTERNAL-NOTE-MARKER";

type Role = "REQUESTER" | "IT_STAFF" | "ADMIN";
type Method = "get" | "post" | "patch";

const STAFF_ROLES: Role[] = ["IT_STAFF", "ADMIN"];
const EVERY_ROLE: Role[] = ["REQUESTER", "IT_STAFF", "ADMIN"];

interface Subject {
  ticket: number;
  action: number;
}

interface Endpoint {
  /** The Express path pattern, as mounted. */
  pattern: string;
  method: Method;
  /** Who may call it. */
  roles: Role[];
  /** The concrete path for this suite's fixtures. */
  path: (subject: Subject) => string;
  /** A body the endpoint would refuse as invalid, to show a guard ran first. */
  body: (subject: Subject) => object;
}

const NONSENSE = () => ({ nonsense: true });

/** Every endpoint Lab 4 added or changed (api-spec.md sections 4 to 8). */
const LAB4_ENDPOINTS: Endpoint[] = [
  {
    pattern: "/api/tickets/:id/actions",
    method: "get",
    roles: EVERY_ROLE,
    path: ({ ticket }) => `/api/tickets/${ticket}/actions`,
    body: NONSENSE,
  },
  {
    pattern: "/api/tickets/:id/actions",
    method: "post",
    roles: STAFF_ROLES,
    path: ({ ticket }) => `/api/tickets/${ticket}/actions`,
    body: NONSENSE,
  },
  {
    pattern: "/api/actions/:id",
    method: "patch",
    roles: STAFF_ROLES,
    path: ({ action }) => `/api/actions/${action}`,
    body: NONSENSE,
  },
  {
    pattern: "/api/actions/:id/complete",
    method: "post",
    roles: STAFF_ROLES,
    path: ({ action }) => `/api/actions/${action}/complete`,
    body: NONSENSE,
  },
  {
    pattern: "/api/actions/:id/cancel",
    method: "post",
    roles: STAFF_ROLES,
    path: ({ action }) => `/api/actions/${action}/cancel`,
    body: NONSENSE,
  },
  {
    pattern: "/api/staff/tickets/:id/status",
    method: "patch",
    roles: STAFF_ROLES,
    path: ({ ticket }) => `/api/staff/tickets/${ticket}/status`,
    // The resolve call: a status and a summary, which a Requester must be
    // refused before either is read.
    body: () => ({
      status: "RESOLVED",
      version: 1,
      resolutionSummary: "Resolved by someone who may not.",
    }),
  },
  {
    pattern: "/api/staff/tickets/:id/owner",
    method: "patch",
    roles: STAFF_ROLES,
    path: ({ ticket }) => `/api/staff/tickets/${ticket}/owner`,
    body: NONSENSE,
  },
  {
    pattern: "/api/staff/tickets/:id/it-priority",
    method: "patch",
    roles: STAFF_ROLES,
    path: ({ ticket }) => `/api/staff/tickets/${ticket}/it-priority`,
    body: NONSENSE,
  },
  {
    pattern: "/api/dashboard/staff",
    method: "get",
    roles: STAFF_ROLES,
    path: () => "/api/dashboard/staff",
    body: NONSENSE,
  },
  {
    pattern: "/api/dashboard/requester",
    method: "get",
    roles: ["REQUESTER"],
    path: () => "/api/dashboard/requester",
    body: NONSENSE,
  },
  {
    // The new list filters (statusGroup) ride on the two existing lists.
    pattern: "/api/tickets",
    method: "get",
    roles: EVERY_ROLE,
    path: () => "/api/tickets?statusGroup=open",
    body: NONSENSE,
  },
  {
    pattern: "/api/staff/tickets",
    method: "get",
    roles: STAFF_ROLES,
    path: () => "/api/staff/tickets?statusGroup=open&followUp=mine",
    body: NONSENSE,
  },
];

/** Routes whose guards and tests belong to Labs 1-3, each named once. */
const EARLIER_LABS: string[] = [
  "get /api/health",
  "post /api/auth/login",
  "post /api/auth/logout",
  "get /api/auth/me",
  "post /api/auth/password",
  "get /api/categories",
  "get /api/related-systems",
  "post /api/tickets",
  "get /api/tickets/:id",
  "get /api/staff/owners",
  "get /api/tickets/:id/comments",
  "post /api/tickets/:id/comments",
  "post /api/tickets/:id/resolved-indication",
  "get /api/tickets/:id/notes",
  "post /api/tickets/:id/notes",
  "get /api/tickets/:id/attachments",
  "post /api/tickets/:id/attachments",
  "get /api/attachments/:id/download",
  "delete /api/attachments/:id",
  "get /api/admin/users",
  "post /api/admin/users",
  "patch /api/admin/users/:id",
  "post /api/admin/users/:id/password",
];

/* ---------------------------------------- the mounted route table -- */

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
}

const collect = (stack: Layer[], found: string[]): void => {
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        found.push(`${method} /api${layer.route.path}`);
      }
    } else if (layer.handle?.stack) {
      collect(layer.handle.stack, found);
    }
  }
};

/**
 * Every `method path` the application answers, read from the Express router.
 *
 * Every router is mounted at `/api` in `app.ts`, which is the prefix added
 * here; the sanity check below fails if that stops being true.
 */
const MOUNTED = ((): string[] => {
  const found: string[] = [];
  const root = (app as unknown as { router: Router }).router;

  collect(root.stack as unknown as Layer[], found);

  return found.toSorted();
})();

const key = (endpoint: Endpoint): string =>
  `${endpoint.method} ${endpoint.pattern}`;

const label = (endpoint: Endpoint): string =>
  `${endpoint.method.toUpperCase()} ${endpoint.pattern}`;

/* ------------------------------------------------------ fixtures -- */

let requesterA: SignedInUser;
let requesterB: SignedInUser;
let staff: SignedInUser;
let admin: SignedInUser;
let gatedRequester: SignedInUser;
let gatedStaff: SignedInUser;

let subject: Subject = { ticket: 0, action: 0 };

const SIGNED_IN = (): Record<Role, () => SignedInUser> => ({
  REQUESTER: () => requesterA,
  IT_STAFF: () => staff,
  ADMIN: () => admin,
});

const call = (endpoint: Endpoint, who: SignedInUser | null, body?: object) => {
  const pending = request(app)[endpoint.method](endpoint.path(subject));
  const authenticated = who ? as(who)(pending) : pending;

  return endpoint.method === "get"
    ? authenticated
    : authenticated.send(body ?? endpoint.body(subject));
};

const countsOf = (body: { cards: { count: number }[] }) =>
  body.cards.map((card) => card.count);

const errorOf = (response: { body: { error?: Record<string, unknown> } }) =>
  response.body.error ?? {};

const removeFixtures = async () => {
  await removeTickets(PREFIX);
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
};

beforeAll(async () => {
  await removeFixtures();

  [requesterA, requesterB, staff, admin, gatedRequester] = await Promise.all([
    signInAs(ACTIVE_REQUESTER),
    signInAs(SECOND_REQUESTER),
    signInAs(ACTIVE_STAFF),
    signInAs(ADMINISTRATOR),
    signInAs(MUST_CHANGE_REQUESTER),
  ]);

  // A staff member who has not changed their first password: the gate must
  // refuse them before the role check can say they would have been allowed.
  const email = `${EMAIL_PREFIX}gated-staff@example.test`;

  await prisma.user.create({
    data: {
      email,
      name: `${PREFIX} gated staff`,
      role: "IT_STAFF",
      passwordHash: await hashPassword(PASSWORD),
      mustChangePassword: true,
    },
  });

  gatedStaff = await signInAs({ email, password: PASSWORD });

  const ticket = await createTicket(PREFIX, requesterA.id);
  const action = await seedAction(staff, ticket);

  subject = { ticket, action: action.id };
});

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------ the enumeration -- */

describe("the endpoints these tests enumerate are the endpoints that are mounted", () => {
  it("SEC-01 every mounted route is either tested here or named as an earlier lab's", () => {
    const decided = [...LAB4_ENDPOINTS.map(key), ...EARLIER_LABS];

    expect(MOUNTED.length).toBeGreaterThan(20);
    expect(MOUNTED.every((route) => route.includes(" /api/"))).toBe(true);

    const undecided = MOUNTED.filter((route) => !decided.includes(route));
    const phantom = decided.filter((route) => !MOUNTED.includes(route));

    // An undecided route is a new endpoint nobody classified; a phantom is a
    // table entry for a route that is not there, which would test nothing.
    expect({ undecided, phantom }).toStrictEqual({
      undecided: [],
      phantom: [],
    });
  });

  it("SEC-01 the Lab 4 table has no duplicate and states a role for each", () => {
    const keys = LAB4_ENDPOINTS.map(key);

    expect(new Set(keys).size).toBe(keys.length);

    for (const endpoint of LAB4_ENDPOINTS) {
      expect(endpoint.roles.length).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------- no session -- */

describe("SEC-01 without a session", () => {
  for (const endpoint of LAB4_ENDPOINTS) {
    it(`${endpoint.method.toUpperCase()} ${endpoint.pattern} is 401 UNAUTHENTICATED`, async () => {
      const answer = await call(endpoint, null);

      expect(answer.status).toBe(401);
      expect(errorOf(answer)["code"]).toBe("UNAUTHENTICATED");
    });
  }
});

/* ------------------------------------------------------ wrong role -- */

describe("SEC-02 with the wrong role", () => {
  const signedIn = SIGNED_IN();

  for (const endpoint of LAB4_ENDPOINTS) {
    const refused = EVERY_ROLE.filter((role) => !endpoint.roles.includes(role));
    const allowed = endpoint.roles;

    for (const role of refused) {
      it(`${endpoint.method.toUpperCase()} ${endpoint.pattern} is 403 FORBIDDEN for ${role}, before the body is read`, async () => {
        const answer = await call(endpoint, signedIn[role]());

        expect(answer.status).toBe(403);
        expect(errorOf(answer)["code"]).toBe("FORBIDDEN");
      });
    }

    for (const role of allowed) {
      // The control: a guard that refused everyone would pass every test above.
      it(`${endpoint.method.toUpperCase()} ${endpoint.pattern} lets ${role} through the guards`, async () => {
        const answer = await call(endpoint, signedIn[role](), {});

        expect(answer.status).not.toBe(401);
        expect(answer.status).not.toBe(403);
      });
    }
  }

  it("a Requester is refused the resolve call, and the Ticket is untouched", async () => {
    const resolve = LAB4_ENDPOINTS.find(
      (endpoint) => endpoint.pattern === "/api/staff/tickets/:id/status"
    ) as Endpoint;

    const answer = await call(resolve, requesterA);
    const after = await prisma.ticket.findUniqueOrThrow({
      where: { id: subject.ticket },
      select: { currentStatus: true, version: true, resolutionSummary: true },
    });

    expect(answer.status).toBe(403);
    expect(after).toStrictEqual({
      currentStatus: "IN_PROGRESS",
      version: 1,
      resolutionSummary: null,
    });
  });
});

/* --------------------------------------------------- gated user -- */

describe("SEC-03 while a password change is outstanding", () => {
  it.each(
    LAB4_ENDPOINTS.map((endpoint) => [label(endpoint), endpoint] as const)
  )(
    "%s is 403 PASSWORD_CHANGE_REQUIRED for a gated Requester and a gated staff member",
    async (_name, endpoint) => {
      const answers = await Promise.all([
        call(endpoint, gatedRequester),
        call(endpoint, gatedStaff),
      ]);

      for (const answer of answers) {
        expect(answer.status).toBe(403);
        expect(errorOf(answer)["code"]).toBe("PASSWORD_CHANGE_REQUIRED");
      }
    }
  );
});

/* ------------------------------------------- another's Ticket -- */

describe("SEC-04 a Requester reading another Requester's Actions", () => {
  it("is 404 TICKET_NOT_FOUND, byte-identical to a Ticket that does not exist", async () => {
    const other = await as(requesterB)(
      request(app).get(`/api/tickets/${subject.ticket}/actions`)
    );
    const absent = await as(requesterB)(
      request(app).get(`/api/tickets/${MISSING_ID}/actions`)
    );

    expect(other.status).toBe(404);
    expect(errorOf(other)["code"]).toBe("TICKET_NOT_FOUND");
    expect(other.status).toBe(absent.status);
    expect(other.text).toBe(absent.text);
  });

  it("is still answered to the Ticket's own Requester, who sees the Action", async () => {
    const own = await as(requesterA)(
      request(app).get(`/api/tickets/${subject.ticket}/actions`)
    );

    expect(own.status).toBe(200);
    expect(own.body.data.map((row: { id: number }) => row.id)).toContain(
      subject.action
    );
  });
});

/* ---------------------------------------------- identity from session -- */

describe("SEC-05 identity comes from the session only", () => {
  it("refuses a forged recordedById on create and stores the session user as recorder", async () => {
    const forged = await as(staff)(
      request(app).post(`/api/tickets/${subject.ticket}/actions`)
    ).send(actionBody({ recordedById: admin.id }));

    expect(forged.status).toBe(400);
    expect(errorOf(forged)["code"]).toBe("VALIDATION_FAILED");
    expect(Object.keys((errorOf(forged)["details"] ?? {}) as object)).toContain(
      "recordedById"
    );
    expect(
      await prisma.actionTaken.count({ where: { ticketId: subject.ticket } })
    ).toBe(1);

    const honest = await as(staff)(
      request(app).post(`/api/tickets/${subject.ticket}/actions`)
    ).send(actionBody({ performedById: admin.id }));

    expect(honest.status).toBe(201);
    expect(honest.body.recordedBy.id).toBe(staff.id);

    const stored = await prisma.actionTaken.findUniqueOrThrow({
      where: { id: honest.body.id },
      select: { recordedById: true, performedById: true },
    });

    expect(stored).toStrictEqual({
      recordedById: staff.id,
      performedById: admin.id,
    });
  });

  it("refuses a forged recordedById or state on edit, and the stored Action is unchanged", async () => {
    const before = await prisma.actionTaken.findUniqueOrThrow({
      where: { id: subject.action },
    });

    for (const forged of [{ recordedById: admin.id }, { state: "DONE" }]) {
      // oxlint-disable-next-line no-await-in-loop
      const answer = await as(staff)(
        request(app).patch(`/api/actions/${subject.action}`)
      ).send({ version: before.version, description: "Forged", ...forged });

      expect(answer.status).toBe(400);
      expect(errorOf(answer)["code"]).toBe("VALIDATION_FAILED");
    }

    const after = await prisma.actionTaken.findUniqueOrThrow({
      where: { id: subject.action },
    });

    expect(after).toStrictEqual(before);
  });

  it("reads no identity from the caller on either dashboard: any parameter is refused", async () => {
    const asked = await Promise.all([
      as(staff)(request(app).get("/api/dashboard/staff?ownerId=1")),
      as(staff)(request(app).get("/api/dashboard/staff?userId=1")),
      as(requesterA)(request(app).get("/api/dashboard/requester?userId=1")),
      as(requesterA)(
        request(app).get("/api/dashboard/requester?requesterId=1")
      ),
    ]);

    for (const answer of asked) {
      expect(answer.status).toBe(400);
      expect(errorOf(answer)["code"]).toBe("INVALID_QUERY_PARAMETER");
    }
  });

  it("scopes the Requester dashboard to the session: the same call gives each Requester their own counts", async () => {
    const [a, b] = await Promise.all([
      as(requesterA)(request(app).get("/api/dashboard/requester")),
      as(requesterB)(request(app).get("/api/dashboard/requester")),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    // Requester A owns this suite's Ticket (open), so A's open count is at
    // least one; B's is whatever B has and is not A's.
    expect(countsOf(a.body)[0]).toBeGreaterThanOrEqual(1);

    const own = await prisma.ticket.count({
      where: {
        requesterId: requesterB.id,
        currentStatus: {
          in: [
            "NEW",
            "OPEN",
            "IN_PROGRESS",
            "WAITING_FOR_REQUESTER",
            "REOPENED",
          ],
        },
      },
    });

    expect(countsOf(b.body)[0]).toBeGreaterThanOrEqual(own);
  });
});

/* -------------------------------------------------- error bodies -- */

describe("SEC-06 the new error bodies leak nothing", () => {
  // What a leak looks like: a V8 stack frame, an ORM or database complaint, a
  // filesystem path, a connection string, or a module filename with a line.
  const leak =
    /stack|prisma|postgres|constraint|violates|ENOENT|ECONNREFUSED|10\.0\.0\.5|node_modules|SELECT|\.ts:|\.js:|at\s+\S+\s*\(/iu;

  const expectEnvelopeOnly = (answer: request.Response, status: number) => {
    expect(answer.status).toBe(status);
    expect(Object.keys(answer.body)).toStrictEqual(["error"]);

    for (const name of Object.keys(errorOf(answer))) {
      expect(["code", "message", "details"]).toContain(name);
    }

    expect(JSON.stringify(answer.body)).not.toMatch(leak);
  };

  it("400, 404 and 409 on the new endpoints carry only the envelope", async () => {
    const badCreate = await as(staff)(
      request(app).post(`/api/tickets/${subject.ticket}/actions`)
    ).send(actionBody({ description: "" }));
    const noTicket = await as(staff)(
      request(app).post(`/api/tickets/${MISSING_ID}/actions`)
    ).send(actionBody());
    const noAction = await as(staff)(
      request(app).post(`/api/actions/${MISSING_ID}/complete`)
    ).send({ version: 1, result: "x" });
    const stale = await as(staff)(
      request(app).patch(`/api/actions/${subject.action}`)
    ).send({ version: 999, description: "x" });
    const badQuery = await as(staff)(
      request(app).get("/api/staff/tickets?followUp=everyone")
    );
    const gateRefusal = await as(staff)(
      request(app).patch(`/api/staff/tickets/${subject.ticket}/status`)
    ).send({ status: "RESOLVED", version: 1, resolutionSummary: "x" });

    expectEnvelopeOnly(badCreate, 400);
    expectEnvelopeOnly(noTicket, 404);
    expectEnvelopeOnly(noAction, 404);
    expectEnvelopeOnly(stale, 409);
    expectEnvelopeOnly(badQuery, 400);
    expect(gateRefusal.status).toBe(400);
    expect(errorOf(gateRefusal)["code"]).toBe("RESOLUTION_GATE_FAILED");
    expect(JSON.stringify(gateRefusal.body)).not.toMatch(leak);
  });

  it("a forced 500 on every new write and both dashboards carries only the generic envelope", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.spyOn(prisma, "$transaction");

    const routes = [
      () =>
        as(staff)(
          request(app).post(`/api/tickets/${subject.ticket}/actions`)
        ).send(actionBody()),
      () =>
        as(staff)(request(app).patch(`/api/actions/${subject.action}`)).send({
          version: 1,
          description: "x",
        }),
      () =>
        as(staff)(
          request(app).post(`/api/actions/${subject.action}/complete`)
        ).send({ version: 1, result: "x" }),
      () =>
        as(staff)(
          request(app).post(`/api/actions/${subject.action}/cancel`)
        ).send({ version: 1, cancelReason: "x" }),
      () =>
        as(staff)(
          request(app).patch(`/api/staff/tickets/${subject.ticket}/status`)
        ).send({ status: "WAITING_FOR_REQUESTER", version: 1 }),
      () => as(staff)(request(app).get("/api/dashboard/staff")),
      () => as(requesterA)(request(app).get("/api/dashboard/requester")),
    ];

    for (const send of routes) {
      failing.mockRejectedValueOnce(
        new Error(
          "connect ECONNREFUSED 10.0.0.5:5432 postgres://u:pw@db/toktickit at /srv/app/node_modules/pg/lib/client.js:1:1"
        )
      );

      // oxlint-disable-next-line no-await-in-loop
      const answer = await send();

      expectEnvelopeOnly(answer, 500);
      expect(errorOf(answer)["code"]).toBe("INTERNAL_ERROR");
    }

    expect(quiet).toHaveBeenCalledTimes(routes.length);
  });
});

/* ------------------------------------------------- internal notes -- */

describe("SEC-07 a Requester never reaches notes through Actions", () => {
  it("their Action list holds no Internal Note content, and the note endpoints stay 403", async () => {
    const note = await as(staff)(
      request(app).post(`/api/tickets/${subject.ticket}/notes`)
    ).send({ body: INTERNAL_MARKER });

    expect(note.status).toBe(201);

    // A note's text appearing in staff's own Action list would prove nothing;
    // the marker is also written into an Action's description so the Requester
    // is shown something to compare against.
    const listed = await as(requesterA)(
      request(app).get(`/api/tickets/${subject.ticket}/actions`)
    );

    expect(listed.status).toBe(200);
    expect(listed.body.data.length).toBeGreaterThan(0);
    expect(listed.text).not.toContain(INTERNAL_MARKER);
    expect(listed.text.toLowerCase()).not.toContain("internal");

    const [read, post] = await Promise.all([
      as(requesterA)(request(app).get(`/api/tickets/${subject.ticket}/notes`)),
      as(requesterA)(
        request(app).post(`/api/tickets/${subject.ticket}/notes`)
      ).send({ body: "I should not be able to write this." }),
    ]);

    for (const answer of [read, post]) {
      expect(answer.status).toBe(403);
      expect(errorOf(answer)["code"]).toBe("FORBIDDEN");
      expect(answer.text).not.toContain(INTERNAL_MARKER);
    }
  });
});
