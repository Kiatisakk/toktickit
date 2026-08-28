import cors from "cors";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";

import { ErrorCode, sendError, sendInternalError } from "./http/errors.js";
import { categoriesRouter } from "./routes/categories.js";
import { healthRouter } from "./routes/health.js";
import { relatedSystemsRouter } from "./routes/relatedSystems.js";
import { requestersRouter } from "./routes/requesters.js";
import { ticketsRouter } from "./routes/tickets.js";

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
  app.use("/api", ticketsRouter);

  // Anything under /api that matched no route is a missing resource, and it has
  // to say so in the documented envelope. Without this, Express answers with its
  // own HTML page and a client parsing JSON gets a syntax error instead of a
  // reason.
  app.use("/api", (_req, res) => {
    sendError(
      res,
      404,
      ErrorCode.ticketNotFound,
      "The requested resource does not exist."
    );
  });

  // The terminal error handler. express.json() rejects a malformed body before
  // any route runs, and that rejection would otherwise reach the client as
  // Express's default HTML error with a stack trace attached in development.
  //
  // The four-argument signature is what marks this as an error handler to
  // Express; `next` is unused but cannot be dropped.
  // There is no async form of this: Express identifies an error handler by its
  // four-parameter signature, so rewriting it would stop it being one.
  app.use(
    // oxlint-disable-next-line promise/prefer-await-to-callbacks
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (
        error instanceof SyntaxError &&
        "body" in error &&
        "status" in error
      ) {
        sendError(
          res,
          400,
          ErrorCode.validationFailed,
          "The request body is not valid JSON."
        );
        return;
      }

      sendInternalError(res, "Unhandled error", error);
    }
  );

  return app;
};

export const app = createApp();
