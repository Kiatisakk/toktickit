import { useContext } from "react";

import { AuthContext, type AuthContextValue } from "./authContextValue";

/**
 * Reads who is signed in.
 *
 * Throws outside the provider rather than returning a null context. A screen
 * that silently rendered with no identity would either show nothing or show one
 * person's data to whoever opened it, and both are worse than a stack trace in
 * development.
 */
export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return value;
};
