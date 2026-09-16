import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { StateBlock } from "../components/StateBlock";
import { useAuth } from "../context/useAuth";
import type { Role } from "../lib/auth";

/**
 * Which screens a guard admits.
 *
 * - `application` — every ordinary screen: signed in, no password change
 *   outstanding.
 * - `password-change` — the change-password screen, and only while a change is
 *   outstanding. ui-spec.md §4: "not otherwise reachable".
 */
export type GuardedArea = "application" | "password-change";

/**
 * Keeps screens unreachable to anyone the server would refuse (BR-17, AC-02).
 *
 * This is navigation, not protection. The server refuses the same requests on
 * its own; what this adds is that a signed-out visitor lands on the sign-in
 * screen rather than on an error, and a gated user lands on the one screen they
 * may use rather than on a 403.
 *
 * The redirect waits for `resolving` to finish. Sending someone to the sign-in
 * screen while their session is still being confirmed would flash it at
 * everyone who reloads a page, and would drop the page they were on.
 */
export const AuthGuard = ({
  area = "application",
  roles,
  children,
}: {
  area?: GuardedArea;
  /**
   * The roles that may use this screen. Omitted means every signed-in role.
   *
   * A signed-in user outside the list is redirected to My Tickets rather than
   * shown an error: ui-spec.md §8 says the destination "is absent from
   * navigation and the route redirects". The server refuses the same user with
   * 403 on every call the screen would make (BR-17), so this is where they are
   * sent, not what protects the data.
   */
  roles?: readonly Role[];
  children: ReactNode;
}) => {
  const { status, mustChangePassword, user } = useAuth();

  if (status === "resolving") {
    return (
      <AppShell variant="signed-out">
        <StateBlock
          description="Confirming who is signed in."
          kind="loading"
          title="Loading…"
        />
      </AppShell>
    );
  }

  if (status === "anonymous") {
    return <Navigate replace to="/login" />;
  }

  if (area === "application" && mustChangePassword) {
    return <Navigate replace to="/change-password" />;
  }

  if (area === "password-change" && !mustChangePassword) {
    return <Navigate replace to="/my-tickets" />;
  }

  if (roles && !(user && roles.includes(user.role))) {
    return <Navigate replace to="/my-tickets" />;
  }

  return children;
};
