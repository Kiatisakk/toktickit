import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";

/**
 * API-02 — GET /api/requesters offers only active Development Requesters.
 * API-21 — GET /api/related-systems offers only active systems, in order.
 *
 * Neither endpoint is requester-scoped. Requiring a context on the endpoint
 * that supplies the context would be circular, and related systems are the same
 * reference data for everyone.
 */

interface Named {
  id: number;
  name: string;
  email?: string;
}

describe("GET /api/requesters", () => {
  it("returns HTTP 200", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
  });

  it("returns id, name and email for every requester and nothing else", async () => {
    const response = await request(app).get("/api/requesters");

    for (const requester of response.body as Named[]) {
      expect(Object.keys(requester).toSorted()).toEqual([
        "email",
        "id",
        "name",
      ]);
    }
  });

  // BR-07 — the inactive seeded requester exists precisely to be absent here.
  it("omits inactive requesters", async () => {
    const inactive = await prisma.user.findFirst({
      where: { role: "REQUESTER", isActive: false },
      select: { id: true },
    });

    expect(inactive).not.toBeNull();

    const response = await request(app).get("/api/requesters");
    const ids = (response.body as Named[]).map((requester) => requester.id);

    expect(ids).not.toContain(inactive?.id);
  });

  it("returns every active requester", async () => {
    const activeCount = await prisma.user.count({
      where: { role: "REQUESTER", isActive: true },
    });

    const response = await request(app).get("/api/requesters");

    expect(response.body).toHaveLength(activeCount);
  });

  it("never exposes a role or an active flag, which the selector has no use for", async () => {
    const response = await request(app).get("/api/requesters");
    const [first] = response.body as Record<string, unknown>[];

    expect(first).not.toHaveProperty("role");
    expect(first).not.toHaveProperty("isActive");
  });
});

describe("GET /api/related-systems", () => {
  it("returns HTTP 200", async () => {
    const response = await request(app).get("/api/related-systems");

    expect(response.status).toBe(200);
  });

  it("returns at least the six systems §5.3 requires", async () => {
    const response = await request(app).get("/api/related-systems");

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

    const response = await request(app).get("/api/related-systems");
    const names = (response.body as Named[]).map((system) => system.name);

    expect(names).toEqual(expected.map((system) => system.name));
  });

  it("returns id and name only", async () => {
    const response = await request(app).get("/api/related-systems");

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

    const response = await request(app).get("/api/categories");

    expect(response.body).toHaveLength(activeCount);
  });
});
