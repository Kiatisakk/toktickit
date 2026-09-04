import { Router } from "express";

import { sendInternalError } from "../http/errors.js";
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

relatedSystemsRouter.get("/related-systems", async (_req, res) => {
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
});
