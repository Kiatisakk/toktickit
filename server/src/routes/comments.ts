import { Router } from "express";

import { ownTicketsOf, readableTicketsOf } from "../auth/scope.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { identifier } from "../http/identifier.js";
import { requireRole } from "../middleware/role.js";
import { currentUser, requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";
import { validateMessageBody } from "../tickets/messages.js";

/**
 * Public Comments and the Requester's resolved indication (api-spec.md §8).
 *
 * Nothing in this file names the Internal Note model, and nothing ever should:
 * the requester-facing endpoints being unable to reach notes is the reason the
 * two are separate tables (D-09).
 *
 * There is no `PATCH` and no `DELETE` here. Comments are append-only (BR-28),
 * and a route that does not exist cannot be reached by a missing guard.
 */
export const commentsRouter = Router();

/** One comment, as every caller receives it. */
const COMMENT_SHAPE = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const;

const ticketNotFound = (res: Parameters<typeof sendError>[0]) => {
  sendError(
    res,
    404,
    ErrorCode.ticketNotFound,
    "That ticket could not be found."
  );
};

/**
 * The ticket id from the path, if it names a ticket the caller may read.
 *
 * Scoped inside the query like ticket detail (BR-19): a Requester asking about
 * someone else's ticket matches nothing, and is told exactly what they would be
 * told about a ticket that does not exist (BR-18).
 */
const readableTicketId = async (
  raw: unknown,
  user: Parameters<typeof readableTicketsOf>[0]
): Promise<number | null> => {
  const id = identifier(raw);

  if (id === null) {
    return null;
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, ...readableTicketsOf(user) },
    select: { id: true },
  });

  return ticket?.id ?? null;
};

commentsRouter.get(
  "/tickets/:id/comments",
  ...requireSignedIn,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    try {
      const ticketId = await readableTicketId(
        String(req.params.id),
        currentUser(res)
      );

      if (ticketId === null) {
        ticketNotFound(res);
        return;
      }

      const comments = await prisma.publicComment.findMany({
        where: { ticketId },
        select: COMMENT_SHAPE,
        // Oldest first, so a conversation reads downward (ui-spec.md §6). The
        // id settles two comments posted in the same millisecond, which would
        // otherwise come back in whatever order the plan happened to produce.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      res.status(200).json({ data: comments });
    } catch (error) {
      sendInternalError(res, "Failed to read comments", error);
    }
  }
);

commentsRouter.post(
  "/tickets/:id/comments",
  ...requireSignedIn,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const user = currentUser(res);

    try {
      // Scope before content: someone else's ticket answers 404 whatever the
      // body says, so the answer never depends on what was written to it.
      const ticketId = await readableTicketId(String(req.params.id), user);

      if (ticketId === null) {
        ticketNotFound(res);
        return;
      }

      const input = validateMessageBody(req.body);

      if (!input.ok) {
        sendError(
          res,
          400,
          ErrorCode.validationFailed,
          "The comment could not be posted.",
          input.details
        );
        return;
      }

      // The author is the session's user and the time is the database's
      // clock. Neither is read from the request (BR-29).
      const comment = await prisma.publicComment.create({
        data: { ticketId, authorId: user.id, body: input.body },
        select: COMMENT_SHAPE,
      });

      res.status(201).json(comment);
    } catch (error) {
      sendInternalError(res, "Failed to post comment", error);
    }
  }
);

/**
 * "The problem appears resolved" (FR-18, AC-22).
 *
 * Requester only — the indication is the word of the person who raised the
 * ticket, so staff and Administrators are refused `403` even on tickets they
 * raised themselves (specification.md §5). The status is never touched: BR-05
 * forbids a Requester setting Resolved, and this is not a way round it.
 */
commentsRouter.post(
  "/tickets/:id/resolved-indication",
  ...requireSignedIn,
  requireRole("REQUESTER"),
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const user = currentUser(res);
    const id = identifier(String(req.params.id));

    if (id === null) {
      ticketNotFound(res);
      return;
    }

    try {
      // One conditional write rather than read-then-write: two indications
      // racing each other cannot both see "not yet set" and the second
      // overwrite the first. BR-27 says set once, so the first time stands.
      const recorded = await prisma.ticket.updateMany({
        where: { id, ...ownTicketsOf(user), resolvedIndicatedAt: null },
        data: { resolvedIndicatedAt: new Date() },
      });

      if (recorded.count === 0) {
        // Either it was already indicated, which is success (idempotent), or
        // the ticket is not this Requester's to indicate, which is absence.
        const ticket = await prisma.ticket.findFirst({
          where: { id, ...ownTicketsOf(user) },
          select: { id: true },
        });

        if (!ticket) {
          ticketNotFound(res);
          return;
        }
      }

      res.status(204).end();
    } catch (error) {
      sendInternalError(res, "Failed to record resolved indication", error);
    }
  }
);
