import cors from "cors";
import express, { type Express } from "express";

import { healthRouter } from "./routes/health.js";

/**
 * Builds the Express application.
 *
 * The app is created separately from the HTTP server on purpose: Supertest
 * imports this app directly and never needs a listening port, while
 * `src/server.ts` is the only place that binds one.
 */
export function createApp(): Express {
  const app = express();

  // The Vite dev server runs on a different origin (5173) from the API (3000),
  // so the browser needs an explicit CORS allowance.
  app.use(
    cors({
      origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
    }),
  );

  app.use(express.json());

  app.use("/api", healthRouter);

  return app;
}

export const app = createApp();
