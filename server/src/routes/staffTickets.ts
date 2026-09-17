import { Router } from "express";

import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { requireRole } from "../middleware/role.js";
import { requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";
import {
  QUEUE_SHAPE,
  readTicketPage,
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
