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

  it("returns exactly an id and a name for every category", async () => {
    const response = await request(app).get("/api/categories");

    for (const category of response.body) {
      // displayOrder decides the sort order but is not part of the contract,
      // so it must not leak into the response.
      expect(Object.keys(category).sort()).toEqual(["id", "name"]);
      expect(typeof category.id).toBe("number");
      expect(typeof category.name).toBe("string");
    }
  });

  it("orders by displayOrder rather than by id", async () => {
    // Give Network a position ahead of Hardware, leaving the ids untouched.
    // If the endpoint sorted by id, the order below would not change.
    const network = await prisma.category.findUniqueOrThrow({
      where: { name: "Network" },
    });
    const hardware = await prisma.category.findUniqueOrThrow({
      where: { name: "Hardware" },
    });

    try {
      await prisma.$transaction([
        prisma.category.update({
          where: { name: "Network" },
          data: { displayOrder: -1 },
        }),
        prisma.category.update({
          where: { name: "Hardware" },
          data: { displayOrder: -2 },
        }),
        prisma.category.update({
          where: { name: "Network" },
          data: { displayOrder: hardware.displayOrder },
        }),
        prisma.category.update({
          where: { name: "Hardware" },
          data: { displayOrder: network.displayOrder },
        }),
      ]);

      const response = await request(app).get("/api/categories");
      const names = response.body.map(
        (category: { name: string }) => category.name,
      );

      expect(names.indexOf("Network")).toBeLessThan(names.indexOf("Hardware"));
      expect(network.id).toBeGreaterThan(hardware.id);
    } finally {
      await prisma.$transaction([
        prisma.category.update({
          where: { name: "Network" },
          data: { displayOrder: -1 },
        }),
        prisma.category.update({
          where: { name: "Hardware" },
          data: { displayOrder: -2 },
        }),
        prisma.category.update({
          where: { name: "Network" },
          data: { displayOrder: network.displayOrder },
        }),
        prisma.category.update({
          where: { name: "Hardware" },
          data: { displayOrder: hardware.displayOrder },
        }),
      ]);
    }
  });
});
