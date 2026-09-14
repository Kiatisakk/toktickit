import { vi } from "vitest";

/**
 * A fake `Response`, enough of one for the client's fetch wrapper.
 *
 * Lived beside the requester context fixture until the selector was deleted;
 * it was never about the requester, and every screen test still needs it.
 *
 * `ok` is derived from the status rather than passed, because a stub that can
 * claim `ok: true` alongside a 404 can make a test pass for a reason the real
 * server would never produce.
 */
export const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

/** The same, ready to hand to `vi.stubGlobal("fetch", …)`. */
export const respond = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(jsonResponse(body, status)));
