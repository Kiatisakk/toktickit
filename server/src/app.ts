import cors from "cors";
import type { Express } from "express";
import express from "express";

import { categoriesRouter } from "./routes/categories.js";
import { healthRouter } from "./routes/health.js";
import { relatedSystemsRouter } from "./routes/relatedSystems.js";
import { requestersRouter } from "./routes/requesters.js";

/**
 * Builds the Express application.
 *
 * The app is created separately from the HTTP server on purpose: Supertest
 * imports this app directly and never needs a listening port, while
 * `src/server.ts` is the only place that binds one.
 */
export const createApp = (): Express => {
  const app = express();

  // The Vite dev server runs on a different origin (5173) from the API (3000),
  // so the browser needs an explicit CORS allowance.
  app.use(
    cors({
      origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
    })
  );

  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api", categoriesRouter);
  app.use("/api", relatedSystemsRouter);
  app.use("/api", requestersRouter);

  return app;
};

export const app = createApp();
