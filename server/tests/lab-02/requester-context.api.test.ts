import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  REQUESTER_HEADER,
  requesterOf,
  requireRequesterContext,
} from "../../src/middleware/requesterContext.js";
import { prisma } from "../../src/prisma.js";

/**
 * API-03 — the Development Requester context is validated before anything else.
 *
 * The middleware is mounted on a probe route built here rather than on a real
 * endpoint, because the first requester-scoped endpoint arrives with ticket
 * creation. The probe is real Express and real HTTP; only the handler is
 * invented, and it does nothing but echo the context the middleware resolved.
 *
 * Every case below returns 400 rather than 401. Nothing here is authentication
 * (BR-03) — a rejected context means the request is unusable, not that the
 * caller failed to prove who they are.
 */

const probe = express();

probe.get("/probe", requireRequesterContext, (_req, res) => {
  res.status(200).json(requesterOf(res));
});

let activeId: number;
let inactiveId: number;

beforeAll(async () => {
  const active = await prisma.user.findFirstOrThrow({
    where: { role: "REQUESTER", isActive: true },
    select: { id: true },
  });
  const inactive = await prisma.user.findFirstOrThrow({
    where: { role: "REQUESTER", isActive: false },
    select: { id: true },
  });

  activeId = active.id;
  inactiveId = inactive.id;
});

describe("a usable context", () => {
  it("resolves the requester and reaches the handler", async () => {
    const response = await request(probe)
      .get("/probe")
      .set(REQUESTER_HEADER, String(activeId));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: activeId });
  });

  it("exposes name and email to the handler", async () => {
    const response = await request(probe)
      .get("/probe")
      .set(REQUESTER_HEADER, String(activeId));

    expect(response.body).toHaveProperty("name");
    expect(response.body).toHaveProperty("email");
  });
});

describe("a missing context", () => {
  it("is rejected when the header is absent", async () => {
    const response = await request(probe).get("/probe");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });

  it("is rejected when the header is blank", async () => {
    const response = await request(probe)
      .get("/probe")
      .set(REQUESTER_HEADER, "   ");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });
});

describe("a value that is digits but not a usable id", () => {
  // "0" and "007" satisfy a digits-only pattern, and anything past 2^53 stops
  // being represented exactly. The contract calls all of them INVALID, so they
  // have to be rejected before the lookup — otherwise they arrive as UNKNOWN,
  // which claims the id was well-formed but absent.
  it.each(["0", "000", "9007199254740993", "99999999999999999999"])(
    "rejects %j as invalid rather than unknown",
    async (value) => {
      const response = await request(probe)
        .get("/probe")
        .set(REQUESTER_HEADER, value);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
    }
  );
});

describe("a malformed context", () => {
  // Number() would accept the first four of these. Digits only, on purpose.
  //
  // No non-ASCII case here: HTTP headers are ISO-8859-1, so a value like "٣"
  // cannot reach the server at all — the client library rejects it first.
  it.each(["abc", "1.5", "1e3", "-1", "1; DROP TABLE users"])(
    "rejects %j as invalid",
    async (value) => {
      const response = await request(probe)
        .get("/probe")
        .set(REQUESTER_HEADER, value);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
    }
  );
});

describe("a context that cannot be used", () => {
  it("rejects an id that matches no user", async () => {
    const response = await request(probe)
      .get("/probe")
      .set(REQUESTER_HEADER, "999999");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_UNKNOWN");
  });

  // BR-07. Hiding the inactive requester from the dropdown is presentation;
  // this is the control. Supplying the id directly must still fail.
  it("rejects an inactive requester supplied directly", async () => {
    const response = await request(probe)
      .get("/probe")
      .set(REQUESTER_HEADER, String(inactiveId));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_INACTIVE");
  });
});

describe("a user who is not a requester", () => {
  let staffId: number;

  beforeAll(async () => {
    const staff = await prisma.user.create({
      data: {
        name: "IT Staff Fixture",
        email: "it-staff-fixture@example.ac.th",
        role: "IT_STAFF",
        isActive: true,
      },
      select: { id: true },
    });

    staffId = staff.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: staffId } });
  });

  // Lab 2 seeds only requesters, so this row has to be created to test at all.
  // Lab 3 seeds staff for real, and without the role in the lookup an active
  // staff id in the header would quietly become a valid requester context.
  it("cannot become a Development Requester context", async () => {
    const response = await request(probe)
      .get("/probe")
      .set(REQUESTER_HEADER, String(staffId));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_UNKNOWN");
  });
});

describe("error responses", () => {
  it("carry a human-readable message alongside the code", async () => {
    const response = await request(probe).get("/probe");

    expect(typeof response.body.error.message).toBe("string");
    expect(response.body.error.message.length).toBeGreaterThan(0);
  });

  // BR-20 — nothing that describes the implementation reaches the client.
  it("never leak a stack trace, a path or a database message", async () => {
    const response = await request(probe)
      .get("/probe")
      .set(REQUESTER_HEADER, "999999");
    const body = JSON.stringify(response.body);

    expect(body).not.toMatch(/at .+\(.+:\d+:\d+\)/u);
    expect(body).not.toMatch(/[A-Za-z]:\|\/home\/|node_modules/u);
    expect(body).not.toMatch(/prisma|postgres|relation .* does not exist/iu);
  });
});
