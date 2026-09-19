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
import { requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";
import type { Priority, TicketStatus } from "../tickets/domain.js";
import {
  isPermittedTransition,
  isTicketStatus,
  PRIORITIES,
} from "../tickets/domain.js";
import {
  QUEUE_SHAPE,
  readTicketPage,
  TICKET_SHAPE,
  ticketListWhere,
} from "../tickets/ticketList.js";
import { parseTicketQuery } from "../tickets/ticketQuery.js";

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
 * The body of a staff `PATCH`: exactly one named field and nothing else.
 *
 * An unexpected field is refused rather than ignored (api-spec.md §7). A client
 * sending `{ "status": … }` to the IT Priority endpoint has misunderstood
 * something, and quietly answering `200` having changed nothing would hide it.
 */
const onlyField = <T>(
  body: unknown,
  field: string,
  read: (value: unknown) => { ok: true; value: T } | { ok: false; why: string }
): { ok: true; value: T } | { ok: false; details: Record<string, string> } => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, details: { [field]: `${field} is required.` } };
  }

  const keys = Object.keys(body);
  const unexpected = keys.filter((key) => key !== field);

  if (unexpected.length > 0) {
    return {
      ok: false,
      details: {
        [unexpected[0] as string]: `This endpoint accepts ${field} only.`,
      },
    };
  }

  if (!keys.includes(field)) {
    return { ok: false, details: { [field]: `${field} is required.` } };
  }

  const value = read((body as Record<string, unknown>)[field]);

  return value.ok ? value : { ok: false, details: { [field]: value.why } };
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

/** The ticket id from the path, if it names a ticket that exists. */
const existingTicketId = async (raw: unknown): Promise<number | null> => {
  const id = identifier(raw);

  if (id === null) {
    return null;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true },
  });

  return ticket?.id ?? null;
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
    const input = onlyField<number | null>(req.body, "ownerId", (value) => {
      if (value === null) {
        return { ok: true, value: null };
      }

      return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0
        ? { ok: true, value }
        : { ok: false, why: "Choose an owner, or null to release the ticket." };
    });

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
      const id = await existingTicketId(String(req.params.id));

      if (id === null) {
        ticketNotFound(res);
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

      await prisma.ticket.update({
        where: { id },
        data: { ticketOwnerId: input.value },
      });

      res.status(200).json(await updatedTicket(id));
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
    const input = onlyField<Priority | null>(
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
      const id = await existingTicketId(String(req.params.id));

      if (id === null) {
        ticketNotFound(res);
        return;
      }

      // `requestedPriority` is absent from this statement, not merely unchanged
      // by it: the column the Requester owns cannot be written here at all.
      await prisma.ticket.update({
        where: { id },
        data: { itPriority: input.value },
      });

      res.status(200).json(await updatedTicket(id));
    } catch (error) {
      sendInternalError(res, "Failed to change the IT priority", error);
    }
  }
);

/**
 * Move a ticket along its lifecycle (BR-25, AC-20, AC-21).
 *
 * The transition is checked against the matrix and then written conditionally
 * on the status it was checked against. Two staff acting at once therefore
 * cannot both pass the check and both write: the second update matches no row,
 * and is answered as the refusal it is rather than overwriting the first.
 */
staffTicketsRouter.patch(
  "/staff/tickets/:id/status",
  ...staffOnly,
  // oxlint-disable-next-line oxc/no-async-endpoint-handlers
  async (req, res) => {
    const input = onlyField<TicketStatus>(req.body, "status", (value) =>
      isTicketStatus(value)
        ? { ok: true, value }
        : { ok: false, why: "Choose a status from the list." }
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

    try {
      const id = identifier(String(req.params.id));
      const ticket =
        id === null
          ? null
          : await prisma.ticket.findUnique({
              where: { id },
              select: { id: true, currentStatus: true },
            });

      if (!ticket) {
        ticketNotFound(res);
        return;
      }

      if (!isPermittedTransition(ticket.currentStatus, input.value)) {
        badRequest(
          res,
          ErrorCode.invalidStatusTransition,
          ticket.currentStatus === "CANCELLED"
            ? "A cancelled ticket cannot be moved again."
            : "That is not a permitted status change for this ticket."
        );
        return;
      }

      const moved = await prisma.ticket.updateMany({
        where: { id: ticket.id, currentStatus: ticket.currentStatus },
        data: { currentStatus: input.value },
      });

      if (moved.count === 0) {
        // Somebody else moved it between the check and the write, so the
        // transition just approved was approved from a status the ticket no
        // longer holds.
        badRequest(
          res,
          ErrorCode.invalidStatusTransition,
          "The ticket moved while this change was being made. Open it again."
        );
        return;
      }

      res.status(200).json(await updatedTicket(ticket.id));
    } catch (error) {
      sendInternalError(res, "Failed to change the status", error);
    }
  }
);
