import { createContext } from "react";

import type { Requester } from "../lib/api";

export type RequesterStatus = "resolving" | "none" | "selected";

export interface RequesterContextValue {
  status: RequesterStatus;
  requester: Requester | null;
  /**
   * Increments whenever the current requester changes. Requester-scoped screens
   * key their data off this, so switching identity discards what is on screen
   * before the replacement arrives (BR-08).
   */
  generation: number;
  select: (requester: Requester) => void;
  clear: () => void;
}

/**
 * Null outside a provider, which `useRequester` turns into a thrown error.
 *
 * The context object lives apart from the provider component because a module
 * that exports both a component and a non-component breaks React Fast Refresh.
 */
export const RequesterContext = createContext<RequesterContextValue | null>(
  null
);
