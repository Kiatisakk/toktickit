import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

/**
 * API-19 — every failure leaves through the documented envelope.
 *
 * The three cases here never reach a route handler. An unmatched path, a body
 * express.json() refuses to parse, and a body over the 100 KB limit are all
 * handled by Express (or the body-parser it delegates to) rather than by
 * application code, and their defaults are an HTML page — which a client
 * parsing JSON receives as a syntax error rather than as a reason.
 */

describe("an unmatched API path", () => {
  it("returns 404 in the documented envelope", async () => {
    const response = await request(app).get("/api/no-such-endpoint");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("answers with JSON rather than Express's HTML default", async () => {
    const response = await request(app).get("/api/no-such-endpoint");

    expect(response.headers["content-type"]).toMatch(/application\/json/u);
  });
});

describe("a malformed JSON body", () => {
  it("returns 400 in the documented envelope", async () => {
    const response = await request(app)
      .post("/api/no-such-endpoint")
      .set("Content-Type", "application/json")
      .send("{ this is not json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  // BR-20. Express attaches the offending body and a stack trace to its own
  // error page in development, which is exactly what must not be sent.
  it("leaks neither the body it rejected nor a stack trace", async () => {
    const response = await request(app)
      .post("/api/no-such-endpoint")
      .set("Content-Type", "application/json")
      .send("{ secret: 'do not echo me'");
    const body = JSON.stringify(response.body);

    expect(body).not.toMatch(/do not echo me/u);
    expect(body).not.toMatch(/at .+\(.+:\d+:\d+\)/u);
  });
});

describe("a JSON body over the 100 KB limit", () => {
  it("returns 413 in the documented envelope, not 500", async () => {
    // One character short of valid JSON is irrelevant here — raw-body rejects
    // on size before body-parser ever tries to parse it, so the oversized
    // string does not need to be well-formed.
    const oversized = "a".repeat(200 * 1024);
    const response = await request(app)
      .post("/api/no-such-endpoint")
      .set("Content-Type", "application/json")
      .send(`"${oversized}"`);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("REQUEST_TOO_LARGE");
  });
});
