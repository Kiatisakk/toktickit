import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/prisma.js";

/**
 * API-01 — the reference seed is idempotent and produces what §5.3 requires.
 *
 * The seed is what every other test in this suite stands on: if it produced
 * five categories or hid the inactive requester, half the assertions elsewhere
 * would fail for a reason nowhere near where they broke.
 */

const CATEGORIES = ["Account and Access", "Hardware", "Software", "Network"];

const countAll = async () => {
  const [categories, systems, activeRequesters, inactiveRequesters] =
    await Promise.all([
      prisma.category.count({ where: { isActive: true } }),
      prisma.relatedSystem.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: "REQUESTER", isActive: true } }),
      prisma.user.count({ where: { role: "REQUESTER", isActive: false } }),
    ]);

  return { categories, systems, activeRequesters, inactiveRequesters };
};

const runSeed = () =>
  execSync("npm run db:test:setup", {
    cwd: fileURLToPath(new URL("../../..", import.meta.url)),
    stdio: "pipe",
  });

describe("retiring a row that is no longer listed", () => {
  const LEGACY = "Legacy Category Fixture";

  afterEach(async () => {
    await prisma.category.deleteMany({ where: { name: LEGACY } });
  });

  // displayOrder is unique. Leaving a retired row on a positive slot means the
  // slot stays occupied, and the transaction fails the moment a listed item
  // needs it back — as a constraint violation, several layers from the cause.
  it("moves it off its positive slot", async () => {
    const free = (await prisma.category.count()) + 50;

    await prisma.category.create({
      data: { name: LEGACY, displayOrder: free, isActive: true },
    });

    runSeed();

    const legacy = await prisma.category.findUniqueOrThrow({
      where: { name: LEGACY },
      select: { isActive: true, displayOrder: true },
    });

    expect(legacy.isActive).toBe(false);
    expect(legacy.displayOrder).toBeLessThan(0);
  }, 60_000);

  it("leaves the listed categories on their own positions", async () => {
    const free = (await prisma.category.count()) + 50;

    await prisma.category.create({
      data: { name: LEGACY, displayOrder: free, isActive: true },
    });

    runSeed();

    const active = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { displayOrder: true },
    });

    expect(active.map((row) => row.displayOrder)).toEqual([1, 2, 3, 4]);
  }, 60_000);
});

describe("reference seed", () => {
  it("contains exactly the four required categories, in order", async () => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { name: true },
    });

    expect(categories.map((category) => category.name)).toEqual(CATEGORIES);
  });

  it("contains at least six related systems", async () => {
    const { systems } = await countAll();

    expect(systems).toBeGreaterThanOrEqual(6);
  });

  it("contains at least four active development requesters", async () => {
    const { activeRequesters } = await countAll();

    expect(activeRequesters).toBeGreaterThanOrEqual(4);
  });

  // The inactive requester is not an accident of the fixture — §5.3 requires
  // one so that BR-07 has something to exclude.
  it("contains at least one inactive development requester", async () => {
    const { inactiveRequesters } = await countAll();

    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);
  });

  it("seeds every requester as REQUESTER, since Lab 2 has no other role", async () => {
    const others = await prisma.user.count({
      where: { role: { not: "REQUESTER" } },
    });

    expect(others).toBe(0);
  });

  it("gives every related system a distinct display order", async () => {
    const systems = await prisma.relatedSystem.findMany({
      select: { displayOrder: true },
    });
    const orders = systems.map((system) => system.displayOrder);

    expect(new Set(orders).size).toBe(orders.length);
  });

  // AC-04. Running the seed twice must not duplicate a row, retire a live one,
  // or renumber anything — otherwise "safe to run repeatedly" is a claim rather
  // than a property.
  it("changes nothing when run a second time", async () => {
    const before = await countAll();
    const categoriesBefore = await prisma.category.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, displayOrder: true },
    });

    runSeed();

    const after = await countAll();
    const categoriesAfter = await prisma.category.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, displayOrder: true },
    });

    expect(after).toEqual(before);
    // Ids included on purpose: an upsert keyed on the wrong column would
    // recreate rows with new ids while the counts stayed identical.
    expect(categoriesAfter).toEqual(categoriesBefore);
  }, 60_000);
});
