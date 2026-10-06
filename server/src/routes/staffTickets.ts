import type { Response } from "express";
import { Router } from "express";

import {
  ATTACHMENT_SHAPE,
  toAttachmentResponse,
} from "../attachments/shape.js";
import type { ErrorCodeValue } from "../http/errors.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { identifier } from "../http/identifier.js";
import { requireRole } from "../middleware/role.js";
import { currentUser, requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";
import type { Priority, TicketStatus } from "../tickets/domain.js";
import {
  isPermittedTransition,
  isTicketStatus,
  PRIORITIES,
} from "../tickets/domain.js";
import { lockTicket } from "../tickets/lock.js";
import {
  evaluateResolutionGate,
  gateFactsOf,
  validateResolutionSummary,
} from "../tickets/resolutionGate.js";
import { recordStatusChange } from "../tickets/statusHistory.js";
import {
  QUEUE_SHAPE,
  readTicketPage,
  TICKET_SHAPE,
  ticketListWhere,
} from "../tickets/ticketList.js";
import { parseTicketQuery } from "../tickets/ticketQuery.js";
import { readVersion } from "../tickets/version.js";

/**
 * The staff Ticket Queue (api-spec.md §7).
 *
 * IT Staff and Administrators only; a Requester is refused `403` (AC-13). The
 * queue reads every ticket, so unlike My Tickets there is no ownership clause —
 * the role guard is the whole of the boundary, and it runs before the query
 * string is even parsed.
 */
export const staffTicketsRouter = Router();

const staffOnly = [...requireSignedIn, requireRole("IT_STAFF", "ADMIN")];

// oxlint-disable-next-line oxc/no-async-endpoint-handlers
staffTicketsRouter.get("/staff/tickets", ...staffOnly, async (req, res) => {
  const parsed = parseTicketQuery(
    req.query as Record<string, unknown>,
    "queue"
  );

  if (!parsed.ok) {
    sendError(
      res,
      400,
      ErrorCode.invalidQueryParameter,
      "One or more query parameters are not valid.",
      parsed.details
    );
    return;
  }

  try {
    // Every requester's tickets (AC-15): no scope fragment, only the filters.
    const query = parsed.value;
    const page = await readTicketPage(
      ticketListWhere(query),
      query,
      QUEUE_SHAPE
    );

    res.status(200).json(page);
  } catch (error) {
    sendInternalError(res, "Failed to list the ticket queue", error);
  }
});

/**
 * Who a ticket may be owned by: active IT Staff and Administrators (BR-21).
 *
 * The queue's Owner filter needs the names to offer, and assigning ownership
 * needs the same list. Id and name only — nothing a filter does not show.
 */
// oxlint-disable-next-line oxc/no-async-endpoint-handlers
staffTicketsRouter.get("/staff/owners", ...staffOnly, async (_req, res) => {
  try {
    const owners = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMIN"] } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });

    res.status(200).json(owners);
  } catch (error) {
    sendInternalError(res, "Failed to list ticket owners", error);
  }
});

/* --------------------------------------------- ticket operations (§7) -- */

/**
 * The body of a staff `PATCH`: one named field and the `version` the caller
 * read, and nothing else (api-spec.md §7).
 *
 * An unexpected field is refused rather than ignored. A client sending
 * `{ "status": … }` to the IT Priority endpoint has misunderstood something,
 * and quietly answering `200` having changed nothing would hide it. A missing
 * or malformed `version` is a body-shape error (`400`), kept apart from a
 * well-formed version that is out of date (`409`, BR-19, BR-20).
 */
const fieldWithVersion = <T>(
  body: unknown,
  field: string,
  read: (value: unknown) => { ok: true; value: T } | { ok: false; why: string },
  /** Further keys this endpoint accepts; the caller reads them from `body`. */
  alsoAccepted: readonly string[] = []
):
  | { ok: true; value: T; version: number }
  | { ok: false; details: Record<string, string> } => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      details: {
        [field]: `${field} is required.`,
        version: "version is required.",
      },
    };
  }

  const record = body as Record<string, unknown>;
  const details: Record<string, string> = {};

  for (const key of Object.keys(record)) {
    if (key !== field && key !== "version" && !alsoAccepted.includes(key)) {
      details[key] = `This endpoint accepts ${field} and version only.`;
    }
  }

  const value = Object.hasOwn(record, field)
    ? read(record[field])
    : ({ ok: false, why: `${field} is required.` } as const);
  const version = readVersion(record["version"]);

  if (!value.ok) {
    details[field] = value.why;
  }

  if (!version.ok) {
    details["version"] = version.why;
  }

  return value.ok && version.ok && Object.keys(details).length === 0
    ? { ok: true, value: value.value, version: version.value }
    : { ok: false, details };
};

const badRequest = (
  res: Response,
  code: ErrorCodeValue,
  message: string,
  details?: Record<string, string>
) => {
  sendError(res, 400, code, message, details);
};

const ticketNotFound = (res: Response) => {
  sendError(
    res,
    404,
    ErrorCode.ticketNotFound,
    "That ticket could not be found."
  );
};

/** The write named a version that is no longer the stored one (BR-19). */
const staleUpdate = (res: Response) => {
  sendError(
    res,
    409,
    ErrorCode.staleUpdate,
    "This ticket was changed by someone else since you opened it. Reload it and try again."
  );
};

/**
 * Reads the ticket back in the shape `GET /api/tickets/:id` returns, so the
 * client refreshes from the response rather than fetching again (api-spec.md
 * §7).
 */
const updatedTicket = async (id: number) => {
  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id },
    select: {
      ...TICKET_SHAPE,
      attachments: {
        select: ATTACHMENT_SHAPE,
        orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
      },
    },
  });

  return {
    ...ticket,
    attachments: ticket.attachments.map(toAttachmentResponse),
  };
};

/**
 * The ticket a write is aimed at, if it exists: its id, the version and the
 * status the write will be checked against.
 */
const ticketForWrite = async (raw: unknown) => {
  const id = identifier(raw);

  if (id === null) {
    return null;
  }

  return await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, version: true, currentStatus: true },
  });
};

/**
 * Claim, reassign or release a ticket (AC-17, AC-18).
 *
 * Anyone on the staff may reassign any ticket: BR-21 says a ticket has at most
 * one owner and who may be one, and nothing this sprint says the current owner
 * must consent to handing it on.
 */
staffTicketsRouter.patch(
  "/staff/tickets/:id/owner",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const input = fieldWithVersion<number | null>(
      req.body,
      "ownerId",
      (value) => {
        if (value === null) {
          return { ok: true, value: null };
        }

        return typeof value === "number" &&
          Number.isSafeInteger(value) &&
          value > 0
          ? { ok: true, value }
          : {
              ok: false,
              why: "Choose an owner, or null to release the ticket.",
            };
      }
    );

    if (!input.ok) {
      badRequest(
        res,
        ErrorCode.validationFailed,
        "The ticket owner could not be changed.",
        input.details
      );
      return;
    }

    try {
      const ticket = await ticketForWrite(String(req.params.id));

      if (!ticket) {
        ticketNotFound(res);
        return;
      }

      if (ticket.version !== input.version) {
        staleUpdate(res);
        return;
      }

      if (input.value !== null) {
        // Eligibility is read at the moment of assignment, not trusted from
        // whatever list the screen was showing: BR-21 admits only active IT
        // Staff and Administrators, and a list can be minutes old.
        const owner = await prisma.user.findFirst({
          where: {
            id: input.value,
            isActive: true,
            role: { in: ["IT_STAFF", "ADMIN"] },
          },
          select: { id: true },
        });

        if (!owner) {
          badRequest(
            res,
            ErrorCode.ticketOwnerIneligible,
            "Only active IT Staff and Administrators can own a ticket."
          );
          return;
        }
      }

      // The version is in the WHERE clause, so a write that lost a race
      // between the check above and this statement matches no row.
      const written = await prisma.ticket.updateMany({
        where: { id: ticket.id, version: input.version },
        data: { ticketOwnerId: input.value, version: { increment: 1 } },
      });

      if (written.count === 0) {
        staleUpdate(res);
        return;
      }

      res.status(200).json(await updatedTicket(ticket.id));
    } catch (error) {
      sendInternalError(res, "Failed to change the ticket owner", error);
    }
  }
);

/** Set IT's own view of urgency. Requested Priority is never touched (AC-19). */
staffTicketsRouter.patch(
  "/staff/tickets/:id/it-priority",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const input = fieldWithVersion<Priority | null>(
      req.body,
      "itPriority",
      (value) => {
        if (value === null) {
          return { ok: true, value: null };
        }

        return PRIORITIES.includes(value as Priority)
          ? { ok: true, value: value as Priority }
          : { ok: false, why: "Choose Low, Medium or High." };
      }
    );

    if (!input.ok) {
      badRequest(
        res,
        ErrorCode.validationFailed,
        "The IT priority could not be changed.",
        input.details
      );
      return;
    }

    try {
      const ticket = await ticketForWrite(String(req.params.id));

      if (!ticket) {
        ticketNotFound(res);
        return;
      }

      if (ticket.version !== input.version) {
        staleUpdate(res);
        return;
      }

      // `requestedPriority` is absent from this statement, not merely unchanged
      // by it: the column the Requester owns cannot be written here at all.
      const written = await prisma.ticket.updateMany({
        where: { id: ticket.id, version: input.version },
        data: { itPriority: input.value, version: { increment: 1 } },
      });

      if (written.count === 0) {
        staleUpdate(res);
        return;
      }

      res.status(200).json(await updatedTicket(ticket.id));
    } catch (error) {
      sendInternalError(res, "Failed to change the IT priority", error);
    }
  }
);

/**
 * Move a ticket along its lifecycle (BR-25, BR-16, AC-20, AC-21, AC-23).
 *
 * Checked in BR-20's order: body shape, existence, version, the matrix, then
 * the resolution gate. The version is compared twice: early, to refuse the
 * plain stale request without queueing, and again under the lock, which is the
 * comparison that counts. The gate is decided **inside the transaction, with the
 * Ticket row locked** (BR-16): every Action write takes the same lock first, so
 * a write racing a resolution either commits before it, and the gate sees it,
 * or waits and is refused `TICKET_NOT_ACTIONABLE` (AC-27). The change is
 * written conditionally on the version it was checked against, so a status
 * change that raced this one is answered `409` rather than overwritten.
 */
staffTicketsRouter.patch(
  "/staff/tickets/:id/status",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const input = fieldWithVersion<TicketStatus>(
      req.body,
      "status",
      (value) =>
        isTicketStatus(value)
          ? { ok: true, value }
          : { ok: false, why: "Choose a status from the list." },
      ["resolutionSummary"]
    );

    if (!input.ok) {
      badRequest(
        res,
        ErrorCode.validationFailed,
        "The status could not be changed.",
        input.details
      );
      return;
    }

    const target = input.value;
    const summary = validateResolutionSummary(
      target,
      (req.body as Record<string, unknown>)["resolutionSummary"]
    );

    if (!summary.ok) {
      badRequest(
        res,
        ErrorCode.validationFailed,
        "The status could not be changed.",
        summary.details
      );
      return;
    }

    try {
      const ticket = await ticketForWrite(String(req.params.id));

      if (!ticket) {
        ticketNotFound(res);
        return;
      }

      if (ticket.version !== input.version) {
        staleUpdate(res);
        return;
      }

      if (!isPermittedTransition(ticket.currentStatus, target)) {
        badRequest(
          res,
          ErrorCode.invalidStatusTransition,
          ticket.currentStatus === "CANCELLED"
            ? "A cancelled ticket cannot be moved again."
            : "That is not a permitted status change for this ticket."
        );
        return;
      }

      const actor = currentUser(res);

      const outcome = await prisma.$transaction(
        async (tx): Promise<StatusOutcome> => {
          // From here on no Action write can commit under this transaction.
          const locked = await lockTicket(tx, ticket.id);

          if (!locked) {
            return { kind: "missing" };
          }

          // The version is compared under the lock, before the gate: a status
          // change that committed while this one waited is a stale request,
          // not one to be judged against the newer Actions (BR-20).
          if (locked.version !== input.version) {
            return { kind: "stale" };
          }

          if (target === "RESOLVED") {
            const actions = await tx.actionTaken.findMany({
              where: { ticketId: ticket.id },
              select: {
                id: true,
                state: true,
                followUpRequired: true,
                followsUpId: true,
              },
            });
            const unmet = evaluateResolutionGate(
              gateFactsOf(actions),
              summary.value ?? ""
            );

            if (Object.keys(unmet).length > 0) {
              return { kind: "gate", details: unmet };
            }
          }

          const written = await tx.ticket.updateMany({
            where: { id: ticket.id, version: input.version },
            data: {
              currentStatus: target,
              version: { increment: 1 },
              ...(target === "RESOLVED"
                ? { resolutionSummary: summary.value ?? "" }
                : {}),
            },
          });

          if (written.count === 0) {
            // Somebody else wrote between the check and the lock, so the
            // transition just approved was approved from a picture that is no
            // longer true. Nothing is recorded.
            return { kind: "stale" };
          }

          await recordStatusChange(tx, {
            ticketId: ticket.id,
            from: ticket.currentStatus,
            to: target,
            changedById: actor.id,
          });

          return { kind: "moved" };
        },
        // Queued behind Action writes on the same Ticket.
        { maxWait: 10_000, timeout: 20_000 }
      );

      if (outcome.kind === "missing") {
        ticketNotFound(res);
        return;
      }

      if (outcome.kind === "stale") {
        staleUpdate(res);
        return;
      }

      if (outcome.kind === "gate") {
        badRequest(
          res,
          ErrorCode.resolutionGateFailed,
          "This ticket cannot be resolved yet.",
          outcome.details
        );
        return;
      }

      res.status(200).json(await updatedTicket(ticket.id));
    } catch (error) {
      sendInternalError(res, "Failed to change the status", error);
    }
  }
);

/** What the status transaction decided, answered after it ends. */
type StatusOutcome =
  | { kind: "moved" }
  | { kind: "missing" }
  | { kind: "stale" }
  | { kind: "gate"; details: Record<string, string> };
