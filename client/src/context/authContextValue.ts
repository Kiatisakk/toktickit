import { createContext } from "react";

import type { AuthenticatedUser, Identity } from "../lib/auth";

/**
 * `resolving` is the state on first paint, before `GET /api/auth/me` answers.
 *
 * It is a distinct state rather than "signed out", because the two need
 * different screens: showing the sign-in form for the half-second it takes to
 * confirm an existing session would flash the login page at everybody who is
 * already signed in, and would send anyone who reloaded a page back to the
 * start.
 */
export type AuthStatus = "resolving" | "anonymous" | "authenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  /** BR-02: true while the account is gated to the change-password screen. */
  mustChangePassword: boolean;
  /** Records a completed sign-in. Does not perform one. */
  signedIn: (identity: Identity) => void;
  /** Ends the session on the server and clears it here. */
  signOut: () => Promise<void>;
  /** Re-reads the identity from the server, after a password change. */
  refresh: () => Promise<void>;
}

/**
 * Null outside a provider, which `useAuth` turns into a thrown error.
 *
 * Apart from the provider component because a module exporting both a component
 * and a non-component breaks React Fast Refresh — the same split as
 * `requesterContextValue.ts`.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
