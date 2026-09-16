import { Router } from "express";

import { sendInternalError } from "../http/errors.js";
import { requireSignedIn } from "../middleware/session.js";
import { prisma } from "../prisma.js";

export const categoriesRouter = Router();

// Authenticated since Lab 3. Lab 2 left it open because the selector needed it
// before any identity existed, and that reason went with the selector
// (api-spec.md §5).
categoriesRouter.get("/categories", ...requireSignedIn, async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      // Retired categories stop being offered but keep existing, so tickets
      // that already reference one are never orphaned (Lab 2 onwards).
      where: { isActive: true },
      // Sorted by displayOrder, not id. A serial id records when a row was
      // inserted, not where it belongs in a list — renaming a category
      // re-creates its row and silently moves it to the end. Ordering by name
      // would be stable but wrong: it puts Network before Software.
      orderBy: { displayOrder: "asc" },
      // displayOrder is how the list is sorted, not something a client needs.
      select: { id: true, name: true },
    });

    res.status(200).json(categories);
  } catch (error) {
    sendInternalError(res, "Failed to load categories", error);
  }
});
