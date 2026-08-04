import { Router } from "express";

import { prisma } from "../prisma.js";

export const categoriesRouter = Router();

categoriesRouter.get("/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
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
    console.error("Failed to load categories", error);

    res.status(500).json({
      error: "Unable to load categories from the database",
    });
  }
});
