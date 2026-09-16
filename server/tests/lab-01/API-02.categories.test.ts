import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACTIVE_REQUESTER } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { SessionCookie } from "../lab-03/support/signIn.js";
import { signIn } from "../lab-03/support/signIn.js";

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

/**
 * Categories are authenticated since Lab 3 (api-spec.md §5). The request carries
 * a real session; what is asserted about the categories is unchanged.
 */
let cookie: SessionCookie = [];

beforeAll(async () => {
  ({ cookie } = await signIn(
    ACTIVE_REQUESTER.email,
    ACTIVE_REQUESTER.password
  ));
});

const getCategories = () =>
  request(app).get("/api/categories").set("Cookie", cookie);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/categories", () => {
  it("returns HTTP 200", async () => {
    const response = await getCategories();

    expect(response.status).toBe(200);
  });

  it("returns the four seeded categories", async () => {
    const response = await getCategories();

    expect(response.body).toHaveLength(4);
    expect(
      response.body.map((category: { name: string }) => category.name)
    ).toEqual(EXPECTED_CATEGORY_NAMES);
  });

  it("returns exactly an id and a name for every category", async () => {
    const response = await getCategories();

    for (const category of response.body) {
      // displayOrder decides the sort order but is not part of the contract,
      // so it must not leak into the response.
      expect(Object.keys(category).toSorted()).toEqual(["id", "name"]);
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

      const response = await getCategories();
      const names = response.body.map(
        (category: { name: string }) => category.name
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
