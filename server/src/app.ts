import cookieParser from "cookie-parser";
import cors from "cors";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";

import { ErrorCode, sendError, sendInternalError } from "./http/errors.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { authRouter } from "./routes/auth.js";
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

  // Behind a proxy that terminates TLS, Express otherwise sees plain HTTP on
  // the socket and reports the proxy's address as the client's. Nothing here
  // derives a security decision from the request — the session cookie's Secure
  // flag comes from configuration (auth/cookie.ts) — but request.ip and
  // request.protocol are read in logs and would be wrong without this.
  app.set("trust proxy", 1);

  // The Vite dev server runs on a different origin (5173) from the API (3000),
  // so the browser needs an explicit CORS allowance.
  //
  // `credentials` is what lets the session cookie travel at all. Without it the
  // browser sends the request, the server answers, and the cookie is silently
  // dropped in both directions — which looks like a broken sign-in rather than
  // a missing header. A wildcard origin is not permitted alongside credentials,
  // which is why the origin is named exactly (api-spec.md §1).
  app.use(
    cors({
      origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
      credentials: true,
    })
  );

  // Parses the session cookie. Unsigned: the token is 256 bits of randomness
  // checked against a hash in the database, so a signature would authenticate
  // a value whose authenticity is already established by the lookup.
  app.use(cookieParser());

  // 100 KB is a stated decision, not body-parser's default landed on by
  // accident: the largest documented JSON body (a ticket description capped at
  // 5000 characters, §4) is a fraction of that, so the limit exists to give
  // callers a clear, deliberate boundary rather than to fit any real request.
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", healthRouter);
  app.use("/api", authRouter);
  app.use("/api", categoriesRouter);
  app.use("/api", relatedSystemsRouter);
  app.use("/api", requestersRouter);
  app.use("/api", ticketsRouter);
  app.use("/api", attachmentsRouter);

  // Anything under /api that matched no route is neither a missing ticket nor
  // anything else domain-specific, and saying TICKET_NOT_FOUND here would make
  // PUT /api/tickets/1 read as "no such ticket" instead of "no such route".
  // Without this handler at all, Express answers with its own HTML page and a
  // client parsing JSON gets a syntax error instead of a reason.
  app.use("/api", (_req, res) => {
    sendError(
      res,
      404,
      ErrorCode.routeNotFound,
      "The requested resource does not exist."
    );
  });

  // The terminal error handler. Two rejections reach it before any route runs:
  // express.json() throws a SyntaxError on malformed JSON, and body-parser's
  // underlying raw-body throws a plain Error — status 413, type
  // "entity.too.large", no `.body` property — when the 100 KB limit above is
  // exceeded. Left unhandled, either would fall through to sendInternalError
  // and answer 500 for a problem that is the caller's, not the server's.
  //
  // The four-argument signature is what marks this as an error handler to
  // Express; `next` is unused but cannot be dropped.
  // There is no async form of this: Express identifies an error handler by its
  // four-parameter signature, so rewriting it would stop it being one.
  app.use(
    // oxlint-disable-next-line promise/prefer-await-to-callbacks
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        error.type === "entity.too.large"
      ) {
        sendError(
          res,
          413,
          ErrorCode.requestTooLarge,
          "The request body is larger than the 100 KB limit."
        );
        return;
      }

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
