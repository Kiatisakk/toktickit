import { Router } from "express";

/**
 * Health check for the TokTickIT API.
 *
 * This route deliberately does NOT touch the database. The response body is
 * fixed by the Lab 1 contract to exactly `{ status, service }`, so probing
 * PostgreSQL here would either change that shape or make the endpoint fail for
 * a reason it does not report.
 *
 * Whether the *system* as a whole is usable is a separate question, answered by
 * the client combining this call with GET /api/categories. See the "System
 * Status" entry in CONTEXT.md.
 */
export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});
