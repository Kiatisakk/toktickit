import { Router } from "express";

import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { identifier } from "../http/identifier.js";
import { requireRole } from "../middleware/role.js";
import { currentUser, requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";
import { validateMessageBody } from "../tickets/messages.js";

/**
 * Internal Notes (api-spec.md §8, D-09).
 *
 * A router of its own, kept apart from comments.ts on purpose: nothing in
 * that file names this model, and nothing in this file is reachable by a
 * Requester, so the structural separation D-09 asks for lives in the route
 * table rather than in a filter someone could forget.
 *
 * IT Staff and Administrator only. `requireRole` is mounted before any
 * handler runs, so a Requester is refused before the ticket is ever looked
 * up — the 403 is identical whether the ticket is theirs, someone else's, has
 * notes, or has none (BR-32, AC-04, AC-25, SEC-09).
 *
 * There is no `PATCH` and no `DELETE` here. Notes are append-only (BR-28),
 * and a route that does not exist cannot be reached by a missing guard.
 */
export const notesRouter = Router();

/** One note, as every staff caller receives it. */
const NOTE_SHAPE = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const;

const staffOnly = [...requireSignedIn, requireRole("IT_STAFF", "ADMIN")];

const ticketNotFound = (res: Parameters<typeof sendError>[0]) => {
  sendError(
    res,
    404,
    ErrorCode.ticketNotFound,
    "That ticket could not be found."
  );
};

/**
 * The ticket id from the path, if it names a ticket at all.
 *
 * Staff and Administrators read and create notes on any ticket (ui-spec.md
 * §6), so — unlike comments.ts's `readableTicketId` — there is no ownership
 * scope to apply here: `requireRole` above is the whole of the boundary for
 * who reaches this file at all.
 */
const anyTicketId = async (raw: unknown): Promise<number | null> => {
  const id = identifier(raw);

  if (id === null) {
    return null;
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id },
    select: { id: true },
  });

  return ticket?.id ?? null;
};

notesRouter.get(
  "/tickets/:id/notes",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    try {
      const ticketId = await anyTicketId(String(req.params.id));

      if (ticketId === null) {
        ticketNotFound(res);
        return;
      }

      const notes = await prisma.internalNote.findMany({
        where: { ticketId },
        select: NOTE_SHAPE,
        // Oldest first, so a conversation reads downward (ui-spec.md §6). The
        // id settles two notes posted in the same millisecond.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      res.status(200).json({ data: notes });
    } catch (error) {
      sendInternalError(res, "Failed to read notes", error);
    }
  }
);

notesRouter.post(
  "/tickets/:id/notes",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const user = currentUser(res);

    try {
      const ticketId = await anyTicketId(String(req.params.id));

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
          "The note could not be posted.",
          input.details
        );
        return;
      }

      // The author is the session's user and the time is the database's
      // clock. Neither is read from the request (BR-29).
      const note = await prisma.internalNote.create({
        data: { ticketId, authorId: user.id, body: input.body },
        select: NOTE_SHAPE,
      });

      res.status(201).json(note);
    } catch (error) {
      sendInternalError(res, "Failed to post note", error);
    }
  }
);
