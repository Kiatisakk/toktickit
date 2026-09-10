import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type AuthenticatedUser,
  currentIdentity,
  type Identity,
  logout as endSession,
} from "../lib/auth";
import { AuthContext, type AuthStatus } from "./authContextValue";

/**
 * Holds who is signed in, for as long as the tab is open.
 *
 * **Nothing is stored in the browser** (D-13). The cookie is the whole of the
 * session, and this state is only a cache of what the server said on load. That
 * removes the entire class of defect where stored client state and server state
 * disagree — Lab 2 had to guard against a stored requester id naming a
 * since-deactivated account, and there is no equivalent hole here because there
 * is nothing stored to go stale.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("resolving");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const apply = useCallback((identity: Identity) => {
    setUser(identity.user);
    setMustChangePassword(identity.mustChangePassword);
    setStatus("authenticated");
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setMustChangePassword(false);
    setStatus("anonymous");
  }, []);

  // One read on mount. A 401 is the expected answer for a visitor who is not
  // signed in, so it resolves to "anonymous" rather than surfacing as an error.
  useEffect(() => {
    const controller = new AbortController();

    const resolve = async () => {
      try {
        apply(await currentIdentity(controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        clear();
      }
    };

    void resolve();

    return () => {
      controller.abort();
    };
  }, [apply, clear]);

  const refresh = useCallback(async () => {
    try {
      apply(await currentIdentity());
    } catch {
      clear();
    }
  }, [apply, clear]);

  const signOut = useCallback(async () => {
    try {
      await endSession();
    } finally {
      // Cleared whatever the server said. If the call failed because the
      // session was already gone, the user is signed out either way; leaving
      // the header showing their name would be worse than a redundant clear.
      clear();
    }
  }, [clear]);

  const value = useMemo(
    () => ({
      status,
      user,
      mustChangePassword,
      signedIn: apply,
      signOut,
      refresh,
    }),
    [status, user, mustChangePassword, apply, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
