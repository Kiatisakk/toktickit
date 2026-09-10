import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

import {
  AuthContext,
  type AuthContextValue,
} from "../../src/context/authContextValue";
import type { AuthenticatedUser } from "../../src/lib/auth";

/**
 * Fixtures for the authenticated screens, beside the requester ones and for
 * the same reason: a screen that reads who is signed in cannot render without a
 * context around it.
 *
 * Kept in `tests/support/` rather than in a `lab-` folder, so the Vitest glob
 * does not collect it as a suite with no assertions.
 */

export const JENNIFER_USER: AuthenticatedUser = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.ac.th",
  role: "REQUESTER",
};

export const STAFF_USER: AuthenticatedUser = {
  id: 11,
  name: "Michael Brown",
  email: "michael.brown@example.ac.th",
  role: "IT_STAFF",
};

/**
 * A context value with somebody signed in.
 *
 * Overridable, because the states that are not "authenticated" carry most of
 * the behaviour: `resolving` is what the first paint shows, `anonymous` is what
 * the sign-in screen is for, and `mustChangePassword` is the whole of AC-02.
 */
export const authContext = (
  overrides: Partial<AuthContextValue> = {}
): AuthContextValue => ({
  status: "authenticated",
  user: JENNIFER_USER,
  mustChangePassword: false,
  signedIn: () => undefined,
  signOut: () => Promise.resolve(),
  refresh: () => Promise.resolve(),
  ...overrides,
});

export const renderWithAuth = (
  ui: ReactNode,
  {
    context = authContext(),
    path = "/",
  }: {
    context?: AuthContextValue;
    path?: string;
  } = {}
) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={context}>{ui}</AuthContext.Provider>
    </MemoryRouter>
  );
