import { Router } from "express";

import { sendInternalError } from "../http/errors.js";
import { prisma } from "../prisma.js";

/**
 * The Development Requesters the selection screen offers.
 *
 * Deliberately not requester-scoped: this endpoint is what establishes the
 * context in the first place, so requiring one would be circular.
 *
 * Only active users are returned (BR-07). The inactive seeded requester exists
 * precisely to be absent here, and API-02 asserts it.
 */
export const requestersRouter = Router();

requestersRouter.get("/requesters", async (_req, res) => {
  try {
    const requesters = await prisma.user.findMany({
      where: { role: "REQUESTER", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });

    res.status(200).json(requesters);
  } catch (error) {
    sendInternalError(res, "Failed to load development requesters", error);
  }
});
