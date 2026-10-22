import { DashboardFrame } from "../components/DashboardFrame";
import { QuickActions, RecentTickets } from "../components/DashboardPanels";
import { MetricCard } from "../components/MetricCard";
import { useAuth } from "../context/useAuth";
import { fetchStaffDashboard } from "../lib/api";
import { drillDownTo, useDashboard } from "../lib/dashboard";

/**
 * The IT Staff and Administrator dashboard at `/dashboard` (ui-spec.md
 * section 3, FR-18).
 *
 * Every number on it was calculated by the backend, and every card links to the
 * destination the backend returned (BR-22, BR-34). The screen holds no counting
 * rule of its own.
 */
export const StaffDashboard = () => {
  const { user } = useAuth();
  const { state, refreshing, reload, retry } =
    useDashboard(fetchStaffDashboard);

  return (
    <DashboardFrame
      onRefresh={reload}
      onRetry={retry}
      placeholderCards={8}
      refreshing={refreshing}
      state={state}
      subtitle="Here is what needs attention across the queue."
      title={`Welcome back, ${user?.name ?? ""}`}
    >
      {(data) => (
        <>
          <div className="tkt-dash-cards tkt-dash-cards--8">
            {data.cards.map((card) => (
              <MetricCard card={card} key={card.key} />
            ))}
          </div>

          <div className="tkt-dash-lower">
            <RecentTickets
              emptyMessage="No tickets assigned to you yet."
              tickets={data.recentTickets}
              viewAll={{
                label: "View all",
                to: drillDownTo({
                  path: "/staff/tickets",
                  query: { ownerId: String(user?.id ?? "") },
                }),
              }}
            />
            <QuickActions actions={data.quickActions} />
          </div>
        </>
      )}
    </DashboardFrame>
  );
};
