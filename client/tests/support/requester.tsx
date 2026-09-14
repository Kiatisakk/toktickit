import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import {
  RequesterContext,
  type RequesterContextValue,
} from "../../src/context/requesterContextValue";

/**
 * Fixtures every screen test needs, in one place.
 *
 * A screen that reads the current requester cannot be rendered without a
 * context around it, and a screen that fetches cannot be tested without a
 * stubbed response. Both were being written out by hand in each suite: the
 * same context value in four files, and the same fake `Response` in six. They
 * had already begun to drift — three files defaulted the status to 200 and
 * three took it as an argument — and nothing but habit kept the requester the
 * same person in all four.
 *
 * That mattered little while the shape was fixed. It stops being little in
 * Lab 3: the context gains a role, five more screens need one, and every copy
 * would have to learn about roles separately. Consolidating first means that
 * change edits this file.
 *
 * This lives outside `tests/lab-*` deliberately. The Vitest include glob only
 * collects files ending in `.test.ts` or `.test.tsx` beneath a `lab-` folder,
 * so nothing here is mistaken for a suite with no assertions in it.
 */

export const JENNIFER: NonNullable<RequesterContextValue["requester"]> = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.ac.th",
};

/**
 * A context value with a requester selected.
 *
 * Takes overrides because the states that are not "selected" are worth testing
 * too — the shell renders differently with nobody chosen, and the guard exists
 * entirely for that case.
 */
export const requesterContext = (
  overrides: Partial<RequesterContextValue> = {}
): RequesterContextValue => ({
  status: "selected",
  requester: JENNIFER,
  generation: 0,
  select: () => undefined,
  clear: () => undefined,
  ...overrides,
});

export const CONTEXT = requesterContext();

/**
 * A fake `Response`, enough of one for the client's fetch wrapper.
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

/**
 * Render a screen inside a router and a requester context — the wrapper every
 * screen test was writing out by hand.
 */
export const renderWithRequester = (
  ui: ReactNode,
  {
    context = CONTEXT,
    path = "/",
  }: {
    context?: RequesterContextValue;
    path?: string;
  } = {}
) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RequesterContext.Provider value={context}>
        {ui}
      </RequesterContext.Provider>
    </MemoryRouter>
  );
