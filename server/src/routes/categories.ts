import { Router } from "express";

import { prisma } from "../prisma.js";

export const categoriesRouter = Router();

categoriesRouter.get("/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      // Ordering by id returns the categories in the order they were seeded,
      // which is the order the Lab 1 contract shows. Ordering by name would
      // put Network before Software.
      orderBy: { id: "asc" },
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
