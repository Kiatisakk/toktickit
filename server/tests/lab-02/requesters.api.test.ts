import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { ACTIVE_REQUESTER } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { SessionCookie } from "../lab-03/support/signIn.js";
import { signIn } from "../lab-03/support/signIn.js";

/**
 * API-21 — GET /api/related-systems offers only active systems, in order.
 *
 * API-02 used to live here too, asserting that GET /api/requesters offered only
 * active Development Requesters. The endpoint and the selector it fed were
 * deleted in Lab 3 (BR-41); what it protected — that an inactive account can
 * never act — is now asserted by sign-in refusing one (auth.api.test.ts,
 * API-03). The file keeps its name so Lab 2's tests.md still resolves.
 *
 * Reference data is authenticated since Lab 3 (api-spec.md §5), so every
 * request carries a session. The assertions about the data are unchanged.
 */

interface Named {
  id: number;
  name: string;
}

let cookie: SessionCookie = [];

beforeAll(async () => {
  ({ cookie } = await signIn(
    ACTIVE_REQUESTER.email,
    ACTIVE_REQUESTER.password
  ));
});

const get = (path: string) => request(app).get(path).set("Cookie", cookie);

describe("GET /api/related-systems", () => {
  it("returns HTTP 200", async () => {
    const response = await get("/api/related-systems");

    expect(response.status).toBe(200);
  });

  it("returns at least the six systems §5.3 requires", async () => {
    const response = await get("/api/related-systems");

    expect((response.body as Named[]).length).toBeGreaterThanOrEqual(6);
  });

  // Ordering is by displayOrder, not by id and not alphabetically — the same
  // reasoning that governs categories.
  it("returns them in display order rather than alphabetically", async () => {
    const expected = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { name: true },
    });

    const response = await get("/api/related-systems");
    const names = (response.body as Named[]).map((system) => system.name);

    expect(names).toEqual(expected.map((system) => system.name));
  });

  it("returns id and name only", async () => {
    const response = await get("/api/related-systems");

    for (const system of response.body as Named[]) {
      expect(Object.keys(system).toSorted()).toEqual(["id", "name"]);
    }
  });
});

describe("GET /api/categories", () => {
  it("returns only active categories", async () => {
    const activeCount = await prisma.category.count({
      where: { isActive: true },
    });

    const response = await get("/api/categories");

    expect(response.body).toHaveLength(activeCount);
  });
});
