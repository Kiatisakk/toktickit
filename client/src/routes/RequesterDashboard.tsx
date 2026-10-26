import { Link } from "react-router";

import { DashboardFrame } from "../components/DashboardFrame";
import { QuickActions, RecentTickets } from "../components/DashboardPanels";
import { MetricCard } from "../components/MetricCard";
import { useAuth } from "../context/useAuth";
import { fetchRequesterDashboard } from "../lib/api";
import { useDashboard } from "../lib/dashboard";

/**
 * The Requester dashboard at `/dashboard` (ui-spec.md section 4, FR-17).
 *
 * Summarises only the signed-in Requester's own Tickets and does not duplicate
 * My Tickets: four counts and a short recent list, each leading into the full
 * list. No deltas.
 */
export const RequesterDashboard = () => {
  const { user } = useAuth();
  const { state, refreshing, reload, retry } = useDashboard(
    fetchRequesterDashboard
  );

  return (
    <DashboardFrame
      onRefresh={reload}
      onRetry={retry}
      placeholderCards={4}
      refreshing={refreshing}
      state={state}
      subtitle="Here's the latest on your requests."
      title={`Welcome, ${user?.name ?? ""}`}
    >
      {(data) => (
        <>
          <div className="tkt-dash-cards tkt-dash-cards--4">
            {data.cards.map((card) => (
              <MetricCard card={card} key={card.key} viewAll />
            ))}
          </div>

          <div className="tkt-dash-lower">
            <RecentTickets
              emptyAction={
                <Link className="tkt-btn tkt-btn--primary" to="/tickets/new">
                  Create Ticket
                </Link>
              }
              emptyMessage="You haven't raised any tickets yet."
              tickets={data.recentTickets}
              viewAll={{ label: "View all", to: { pathname: "/my-tickets" } }}
            />
            <QuickActions actions={data.quickActions} />
          </div>
        </>
      )}
    </DashboardFrame>
  );
};
