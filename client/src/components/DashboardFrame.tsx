import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Dashboard } from "../lib/api";
import type { DashboardState } from "../lib/dashboard";
import { AppShell } from "./AppShell";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { StateBlock } from "./StateBlock";

/**
 * The parts the two dashboards share: the shell, the heading row with Refresh,
 * and the loading, failure and forbidden states (ui-spec.md sections 3 and 4).
 *
 * What differs between roles (which cards, which empty message) is passed in as
 * `children`, which is only rendered once the data has arrived. Keeping the
 * states here means the two screens cannot drift into handling a failure
 * differently.
 */
export const DashboardFrame = ({
  title,
  subtitle,
  state,
  refreshing,
  onRefresh,
  onRetry,
  placeholderCards,
  children,
}: {
  title: string;
  subtitle: string;
  state: DashboardState;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  /** How many card-shaped placeholders to show while loading. */
  placeholderCards: number;
  children: (data: Dashboard) => ReactNode;
}) => (
  <AppShell breadcrumbs={[{ label: "Dashboard" }]}>
    <div className="tkt-list-header">
      <div>
        <h1 className="tkt-page-title">{title}</h1>
        <p className="tkt-page-subtitle">{subtitle}</p>
      </div>
      <div className="tkt-actions">
        <Button
          busy={refreshing && state.kind !== "loading"}
          busyLabel="Refreshing…"
          disabled={state.kind === "loading"}
          onClick={onRefresh}
          variant="secondary"
        >
          <Icon name="reload" />
          Refresh
        </Button>
      </div>
    </div>

    {state.kind === "loading" ? (
      <div aria-live="polite" role="status">
        <span className="tkt-visually-hidden">Loading dashboard</span>
        <div
          aria-hidden="true"
          className={`tkt-dash-cards tkt-dash-cards--${placeholderCards}`}
        >
          {Array.from({ length: placeholderCards }, (_, index) => (
            <div
              className="tkt-metric tkt-metric--placeholder"
              // The placeholders are interchangeable and never reorder.
              key={`placeholder-${String(index)}`}
            />
          ))}
        </div>
      </div>
    ) : null}

    {state.kind === "failed" ? (
      <StateBlock
        action={
          <Button onClick={onRetry} variant="primary">
            Try again
          </Button>
        }
        description="The dashboard could not be loaded. Try again."
        kind="error"
        title="Could not load the dashboard"
      />
    ) : null}

    {state.kind === "forbidden" ? (
      <StateBlock
        action={
          <Link className="tkt-btn tkt-btn--secondary" to="/dashboard">
            Go to your dashboard
          </Link>
        }
        description="You do not have access to this dashboard."
        kind="error"
        title="Access denied"
      />
    ) : null}

    {state.kind === "loaded" ? children(state.data) : null}
  </AppShell>
);
