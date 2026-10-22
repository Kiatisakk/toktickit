import type { Dashboard, DashboardCard } from "../../src/lib/api";

/**
 * Dashboard bodies the Lab 4 client suites hand to the screens.
 *
 * Shaped as api-spec.md section 7 gives them, with the drill-downs the backend
 * would return for a staff member whose id is 11. Kept in `tests/support/` so
 * the Vitest glob does not collect it as a suite.
 */

const staffCard = (
  key: string,
  label: string,
  count: number,
  delta: number | null,
  query: Record<string, string>
): DashboardCard => ({
  key,
  label,
  count,
  delta,
  drillDown: { path: "/staff/tickets", query },
});

export const STAFF_CARDS: DashboardCard[] = [
  staffCard("new", "New", 14, 3, { status: "NEW" }),
  staffCard("open", "Open", 9, -1, { status: "OPEN" }),
  staffCard("in-progress", "In Progress", 6, 0, { status: "IN_PROGRESS" }),
  staffCard("waiting", "Waiting for Requester", 2, 0, {
    status: "WAITING_FOR_REQUESTER",
  }),
  staffCard("reopened", "Reopened", 1, 1, { status: "REOPENED" }),
  staffCard("my-assigned", "My Assigned", 5, null, {
    ownerId: "11",
    statusGroup: "open",
  }),
  staffCard("unassigned", "Unassigned", 4, null, {
    unassigned: "true",
    statusGroup: "open",
  }),
  staffCard("my-follow-ups", "My open follow-ups", 1, null, {
    followUp: "mine",
  }),
];

export const RECENT = [
  {
    id: 7,
    ticketNumber: "TKT-2026-000007",
    summary: "VPN drops every hour",
    currentStatus: "IN_PROGRESS",
    updatedAt: "2026-10-05T03:15:00.000Z",
  },
  {
    id: 6,
    ticketNumber: "TKT-2026-000006",
    summary: "Printer jams on tray 2",
    currentStatus: "WAITING_FOR_REQUESTER",
    updatedAt: "2026-10-04T09:00:00.000Z",
  },
];

export const STAFF_DASHBOARD: Dashboard = {
  generatedAt: "2026-10-05T03:20:00.000Z",
  timeZone: "Asia/Bangkok",
  cards: STAFF_CARDS,
  recentTickets: RECENT,
  quickActions: [
    { key: "create-ticket", label: "Create Ticket", path: "/tickets/new" },
    { key: "search-tickets", label: "Search Tickets", path: "/staff/tickets" },
    {
      key: "my-queue",
      label: "My Queue",
      path: "/staff/tickets",
      query: { ownerId: "11", statusGroup: "open" },
    },
  ],
};

const requesterCard = (
  key: string,
  label: string,
  count: number,
  query: Record<string, string>
): DashboardCard => ({
  key,
  label,
  count,
  delta: null,
  drillDown: { path: "/my-tickets", query },
});

export const REQUESTER_DASHBOARD: Dashboard = {
  generatedAt: "2026-10-05T03:20:00.000Z",
  timeZone: "Asia/Bangkok",
  cards: [
    requesterCard("open", "Open", 3, { statusGroup: "open" }),
    requesterCard("waiting-for-me", "Waiting for me", 1, {
      status: "WAITING_FOR_REQUESTER",
    }),
    requesterCard("resolved", "Resolved", 2, { status: "RESOLVED" }),
    requesterCard("closed", "Closed", 0, { status: "CLOSED" }),
  ],
  recentTickets: RECENT,
  quickActions: [
    { key: "create-ticket", label: "Create Ticket", path: "/tickets/new" },
    { key: "my-tickets", label: "View My Tickets", path: "/my-tickets" },
  ],
};

/** The same dashboards with every count at zero and nothing recent. */
export const zeroed = (dashboard: Dashboard): Dashboard => ({
  ...dashboard,
  cards: dashboard.cards.map((card) => ({
    ...card,
    count: 0,
    delta: card.delta === null ? null : 0,
  })),
  recentTickets: [],
});
