import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

/**
 * API-01 — Health endpoint returns 200 and expected JSON.
 *
 * Supertest drives the exported Express app directly, so no port is bound and
 * no database is involved.
 */
describe("GET /api/health", () => {
  it("returns HTTP 200", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
  });

  it("reports status ok for the TokTickIT API service", async () => {
    const response = await request(app).get("/api/health");

    expect(response.body).toEqual({
      status: "ok",
      service: "TokTickIT API",
    });
  });
});
