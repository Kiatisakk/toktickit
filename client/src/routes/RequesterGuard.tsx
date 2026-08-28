import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { StateBlock } from "../components/StateBlock";
import { useRequester } from "../context/useRequester";

/**
 * Keeps requester-scoped screens unreachable without a current context (BR-10).
 *
 * The redirect waits for `resolving` to finish. Sending someone to the
 * selection screen while their stored identity is still being confirmed would
 * make every reload flash the selector, and would discard a perfectly valid
 * selection.
 */
export const RequesterGuard = ({ children }: { children: ReactNode }) => {
  const { status } = useRequester();

  if (status === "resolving") {
    return (
      <AppShell>
        <StateBlock
          description="Confirming which Development Requester this session is acting as."
          kind="loading"
          title="Loading…"
        />
      </AppShell>
    );
  }

  if (status === "none") {
    return <Navigate replace to="/select-requester" />;
  }

  return children;
};
