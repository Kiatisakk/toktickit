import { randomUUID } from "node:crypto";

import request from "supertest";

import { app } from "../../../src/app.js";
import type { Prisma } from "../../../src/generated/prisma/client.js";
import { prisma } from "../../../src/prisma.js";
import { lockTicket } from "../../../src/tickets/lock.js";
import type { SignedInUser } from "../../lab-03/support/signIn.js";

/**
 * Fixtures and calls shared by the Lab 4 Actions Taken suites.
 *
 * Each suite passes its own `prefix`, which becomes the start of every ticket
 * summary it creates, and removes only rows carrying it. Two suites — or the
 * other Lab 4 agent's — can therefore share one database without deleting each
 * other's rows (tests.md, Environment).
 */

export type TicketStatusName =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

let sequence = 0;

/** A ticket owned by nobody in particular, in the given status. */
export const createTicket = async (
  prefix: string,
  requesterId: number,
  options: { status?: TicketStatusName; ownerId?: number } = {}
): Promise<number> => {
  const [category, system] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  sequence += 1;

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-LAB4-${randomUUID().slice(0, 12)}`,
      requesterId,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${prefix} ticket ${sequence}`,
      description: "Created by an Actions Taken suite.",
      requestedPriority: "MEDIUM",
      currentStatus: options.status ?? "IN_PROGRESS",
      ticketOwnerId: options.ownerId ?? null,
    },
    select: { id: true },
  });

  return ticket.id;
};

/** Removes every ticket this suite made; Actions go with them (cascade). */
export const removeTickets = (prefix: string) =>
  prisma.ticket.deleteMany({ where: { summary: { startsWith: prefix } } });

export const as = (who: SignedInUser) => (r: request.Test) =>
  r.set("Cookie", who.cookie);

/** A valid create body with its own request key. */
export const actionBody = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  requestId: randomUUID(),
  description: "Replaced the faulty access point.",
  ...overrides,
});

export const createAction = (
  who: SignedInUser,
  ticketId: number,
  body: unknown = actionBody()
) =>
  as(who)(request(app).post(`/api/tickets/${ticketId}/actions`)).send(
    body as object
  );

export const listActions = (who: SignedInUser, ticketId: number) =>
  as(who)(request(app).get(`/api/tickets/${ticketId}/actions`));

export const editAction = (who: SignedInUser, id: number, body: unknown) =>
  as(who)(request(app).patch(`/api/actions/${id}`)).send(body as object);

export const completeAction = (who: SignedInUser, id: number, body: unknown) =>
  as(who)(request(app).post(`/api/actions/${id}/complete`)).send(
    body as object
  );

export const cancelAction = (who: SignedInUser, id: number, body: unknown) =>
  as(who)(request(app).post(`/api/actions/${id}/cancel`)).send(body as object);

/** Resolves after `ms`; the one place a test waits on the clock. */
export const sleep = (ms: number): Promise<void> =>
  // oxlint-disable-next-line promise/avoid-new
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Holds a Ticket's row lock in a transaction of its own until `release` is
 * called, then runs `onRelease` inside it and commits.
 *
 * Lets a test start a write while the lock is held and so prove that the write
 * waits for it, which no amount of simultaneous requests shows reliably.
 */
export const holdTicketLock = async (
  ticketId: number,
  onRelease?: (tx: Prisma.TransactionClient) => Promise<void>
): Promise<{ release: () => void; finished: Promise<void> }> => {
  let release!: () => void;
  let acquired!: () => void;

  // oxlint-disable-next-line promise/avoid-new
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  // oxlint-disable-next-line promise/avoid-new
  const holding = new Promise<void>((resolve) => {
    acquired = resolve;
  });

  const finished = prisma.$transaction(
    async (tx) => {
      await lockTicket(tx, ticketId);
      acquired();
      await released;
      await onRelease?.(tx);
    },
    { timeout: 20_000 }
  );

  await Promise.race([holding, finished]);

  return { release, finished };
};

/**
 * Deactivates a user inside a transaction that stays open until `release` is
 * called, then commits it.
 *
 * While it is open the user's row is locked by the pending update but still
 * reads as active to anyone who does not ask for the lock, which is the window
 * in which an Action naming that user as performer could commit unchecked
 * (BR-07).
 */
export const holdUserDeactivation = async (
  userId: number
): Promise<{ release: () => void; finished: Promise<void> }> => {
  let release!: () => void;
  let acquired!: () => void;

  // oxlint-disable-next-line promise/avoid-new
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  // oxlint-disable-next-line promise/avoid-new
  const holding = new Promise<void>((resolve) => {
    acquired = resolve;
  });

  const finished = prisma.$transaction(
    async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
      acquired();
      await released;
    },
    { timeout: 20_000 }
  );

  await Promise.race([holding, finished]);

  return { release, finished };
};

/** Creates an Action and returns its id, failing loudly if that did not work. */
export const seedAction = async (
  who: SignedInUser,
  ticketId: number,
  overrides: Record<string, unknown> = {}
): Promise<{ id: number; version: number }> => {
  const response = await createAction(who, ticketId, actionBody(overrides));

  if (response.status !== 201) {
    throw new Error(
      `Creating a fixture Action answered ${response.status}: ${JSON.stringify(response.body)}`
    );
  }

  return { id: response.body.id, version: response.body.version };
};
