import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";

/**
 * API-02 — Categories endpoint returns the four seeded categories.
 *
 * This is an integration test on purpose: it runs against the real PostgreSQL
 * database through Prisma, because the point of Lab 1 is proving the layers
 * work together. It therefore requires `npm run db:up`, `npm run db:migrate`
 * and `npm run db:seed` to have been run first.
 */
const EXPECTED_CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/categories", () => {
  it("returns HTTP 200", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
  });

  it("returns the four seeded categories", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.body).toHaveLength(4);
    expect(response.body.map((category: { name: string }) => category.name)).toEqual(
      EXPECTED_CATEGORY_NAMES,
    );
  });

  it("returns an id and a name for every category, in ascending id order", async () => {
    const response = await request(app).get("/api/categories");

    const ids = response.body.map((category: { id: number }) => category.id);
    expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));

    for (const category of response.body) {
      expect(Object.keys(category).sort()).toEqual(["id", "name"]);
      expect(typeof category.id).toBe("number");
      expect(typeof category.name).toBe("string");
    }
  });
});
