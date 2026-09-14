import { Router } from "express";

import { sendInternalError } from "../http/errors.js";
import { requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";

/**
 * Reference data for the Related System field on Create Ticket.
 *
 * Sorted by displayOrder rather than id or name, for the same reason categories
 * are: a serial id records insertion time, not intended position, and
 * alphabetical order is a different opinion rather than the one the product
 * holds.
 *
 * Not filtered by category — the two are independent (decision D-06).
 */
export const relatedSystemsRouter = Router();

// Authenticated since Lab 3, for the same reason as categories (api-spec.md §5).
relatedSystemsRouter.get(
  "/related-systems",
  ...requireSignedIn,
  async (_req, res) => {
    try {
      const systems = await prisma.relatedSystem.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      });

      res.status(200).json(systems);
    } catch (error) {
      sendInternalError(res, "Failed to load related systems", error);
    }
  }
);
