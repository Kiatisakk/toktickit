import { randomUUID } from "node:crypto";

import request from "supertest";
import { vi } from "vitest";

import { app } from "../../../src/app.js";
import { hashPassword } from "../../../src/auth/password.js";
import { clock } from "../../../src/dashboard/clock.js";
import { Prisma } from "../../../src/generated/prisma/client.js";
import { prisma } from "../../../src/prisma.js";
import type { SignedInUser } from "../../lab-03/support/signIn.js";
import { signInAs } from "../../lab-03/support/signIn.js";
import type { TicketStatusName } from "./actions.js";

/**
 * Fixtures and independent SQL shared by the Lab 4 dashboard and filter suites.
 *
 * Nothing here reads the wall clock for an assertion. `NOW` is injected into
 * the dashboard's clock, and every history row is placed relative to the Bangkok
 * midnight that follows from it.
 */

/** 10:20 in Bangkok on 5 October 2026. */
export const NOW = new Date("2026-10-05T03:20:00.000Z");

/** 00:00 on 5 October 2026 in Bangkok, the T0 of `NOW`. */
export const T0 = new Date("2026-10-04T17:00:00.000Z");

const PASSWORD = "Dashboard1!";
const MILLISECOND = 1;

export const justBefore = (instant: Date): Date =>
  new Date(instant.getTime() - MILLISECOND);

/** Fixes the dashboard's idea of "now" for one suite. Call from `beforeEach`. */
export const freezeClock = () => vi.spyOn(clock, "now").mockReturnValue(NOW);

export const as = (who: SignedInUser) => (r: request.Test) =>
  r.set("Cookie", who.cookie);

export const getJson = (who: SignedInUser, path: string) =>
  as(who)(request(app).get(path));

export interface Fixtures {
  prefix: string;
  /** A staff member, requester or administrator made for this suite. */
  makeUser: (
    role: "REQUESTER" | "IT_STAFF" | "ADMIN",
    label: string
  ) => Promise<SignedInUser>;
  makeTicket: (options: TicketOptions) => Promise<number>;
  makeAction: (options: ActionOptions) => Promise<number>;
  /** Removes this suite's Tickets (their Actions and history cascade). */
  cleanTickets: () => Promise<void>;
  /** Removes the Tickets, then the Users made by `makeUser`. */
  cleanUp: () => Promise<void>;
}

export interface TicketOptions {
  requesterId: number;
  status?: TicketStatusName;
  ownerId?: number | null;
  updatedAt?: Date;
  /** Rows for TicketStatusChange, oldest first. */
  history?: { from: TicketStatusName | null; to: TicketStatusName; at: Date }[];
}

export interface ActionOptions {
  ticketId: number;
  performedById: number;
  state?: "PLANNED" | "DONE" | "CANCELLED";
  followUpRequired?: boolean;
  followsUpId?: number | null;
}

export const fixtures = (prefix: string): Fixtures => {
  let sequence = 0;

  const makeUser: Fixtures["makeUser"] = async (role, label) => {
    const email = `${prefix.toLowerCase()}-${label}@dashboard-test.example`;

    await prisma.user.create({
      data: {
        email,
        name: `${prefix} ${label}`,
        role,
        passwordHash: await hashPassword(PASSWORD),
      },
    });

    return signInAs({ email, password: PASSWORD });
  };

  const makeTicket: Fixtures["makeTicket"] = async (options) => {
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);

    sequence += 1;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-DASH-${randomUUID().slice(0, 12)}`,
        requesterId: options.requesterId,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: `${prefix} ticket ${sequence}`,
        description: "Created by a dashboard suite.",
        requestedPriority: "MEDIUM",
        currentStatus: options.status ?? "NEW",
        ticketOwnerId: options.ownerId ?? null,
        ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}),
        ...(options.history
          ? {
              statusHistory: {
                create: options.history.map((row) => ({
                  fromStatus: row.from,
                  toStatus: row.to,
                  changedAt: row.at,
                })),
              },
            }
          : {}),
      },
      select: { id: true },
    });

    return ticket.id;
  };

  const makeAction: Fixtures["makeAction"] = async (options) => {
    const action = await prisma.actionTaken.create({
      data: {
        ticketId: options.ticketId,
        recordedById: options.performedById,
        performedById: options.performedById,
        actionAt: new Date(NOW.getTime() - 60_000),
        description: "Dashboard fixture action.",
        state: options.state ?? "DONE",
        followUpRequired: options.followUpRequired ?? false,
        followUpNote: options.followUpRequired ? "Check again." : null,
        requestId: randomUUID(),
        followsUpId: options.followsUpId ?? null,
      },
      select: { id: true },
    });

    return action.id;
  };

  const cleanTickets: Fixtures["cleanTickets"] = async () => {
    await prisma.ticket.deleteMany({
      where: { summary: { startsWith: prefix } },
    });
  };

  const cleanUp: Fixtures["cleanUp"] = async () => {
    await cleanTickets();
    await prisma.user.deleteMany({
      where: {
        email: { startsWith: `${prefix.toLowerCase()}-` },
      },
    });
  };

  return { prefix, makeUser, makeTicket, makeAction, cleanTickets, cleanUp };
};

/* ------------------------------------------------ independent SQL -- */
/*
 * Each expectation below is written as SQL on purpose, in a different shape
 * from the Prisma filters the endpoint uses (a correlated subquery and NOT
 * EXISTS rather than a groupBy and a relation filter). The endpoint therefore
 * cannot define what it is checked against (tests.md, "Why dashboard parity
 * has its own rows").
 */

const one = async (rows: Promise<{ n: bigint }[]>): Promise<number> => {
  const found = await rows;

  return Number(found[0]?.n ?? 0);
};

export const sqlCountByStatus = (status: TicketStatusName) =>
  one(
    prisma.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM "Ticket" WHERE "currentStatus"::text = ${status}`
  );

export const sqlOpenOwnedBy = (ownerId: number) =>
  one(
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "Ticket"
      WHERE "ticketOwnerId" = ${ownerId}
        AND "currentStatus"::text NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')`
  );

export const sqlOpenUnassigned = () =>
  one(
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "Ticket"
      WHERE "ticketOwnerId" IS NULL
        AND "currentStatus"::text NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')`
  );

export const sqlOpenFollowUpTickets = (performerId: number) =>
  one(
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT a."ticketId") AS n FROM "ActionTaken" a
      WHERE a."performedById" = ${performerId}
        AND a."followUpRequired"
        AND a."state"::text <> 'CANCELLED'
        AND NOT EXISTS (
          SELECT 1 FROM "ActionTaken" f
          WHERE f."followsUpId" = a."id" AND f."state"::text = 'DONE')`
  );

/** Tickets whose latest history row strictly before `t0` says `status`. */
export const sqlCountAsAt = (status: TicketStatusName, t0: Date) =>
  one(
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "Ticket" t
      WHERE (
        SELECT h."toStatus"::text FROM "TicketStatusChange" h
        WHERE h."ticketId" = t."id" AND h."changedAt" < ${t0}
        ORDER BY h."changedAt" DESC, h."id" DESC
        LIMIT 1
      ) = ${status}`
  );

export const sqlRequesterCount = (
  requesterId: number,
  statuses: readonly TicketStatusName[]
) =>
  one(
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "Ticket"
      WHERE "requesterId" = ${requesterId}
        AND "currentStatus"::text IN (${Prisma.join([...statuses])})`
  );

/** The query string a card's drill-down names, as the screen would send it. */
export const drillDownUrl = (drillDown: {
  path: string;
  query: Record<string, string>;
}): string => {
  const params = new URLSearchParams(drillDown.query);
  // My Tickets is /my-tickets in the client and /api/tickets in the API; the
  // queue is /staff/tickets in the client and /api/staff/tickets.
  const api = drillDown.path === "/my-tickets" ? "/tickets" : drillDown.path;

  return `/api${api}?${params.toString()}`;
};
