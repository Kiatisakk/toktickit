import { useContext } from "react";

import {
  RequesterContext,
  type RequesterContextValue,
} from "./requesterContextValue";

/**
 * Reads the current Development Requester context.
 *
 * Separate module from the provider so that the provider file exports only a
 * component — a module exporting both breaks React Fast Refresh.
 *
 * Throws when used outside the provider rather than returning a null context:
 * a screen that silently renders with no requester would show one person's data
 * to whoever happened to open it, which is the one thing this sprint exists to
 * prevent.
 */
export const useRequester = (): RequesterContextValue => {
  const value = useContext(RequesterContext);

  if (!value) {
    throw new Error("useRequester must be used inside a RequesterProvider.");
  }

  return value;
};
