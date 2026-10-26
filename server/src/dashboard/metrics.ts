import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import type { TicketStatus } from "../tickets/domain.js";
import {
  CLOSED_GROUP,
  hasOpenFollowUpBy,
  inOpenGroup,
} from "../tickets/listPredicates.js";
import { clock } from "./clock.js";
import { bangkokDayStart, DASHBOARD_TIME_ZONE } from "./time.js";

/**
 * Dashboard metrics, calculated from stored data (specification.md section 5.2,
 * BR-22 to BR-27, BR-34).
 *
 * The caller's id comes from the session and is the only identity involved: no
 * function here takes one from a request. Each response is read from one
 * snapshot, so a Ticket moving while the cards are being counted cannot make
 * one card contradict another.
 */

export interface DrillDown {
  path: string;
  query: Record<string, string>;
}

export interface Card {
  key: string;
  label: string;
  count: number;
  delta: number | null;
  drillDown: DrillDown;
}

export interface RecentTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: TicketStatus;
  updatedAt: Date;
}

export interface QuickAction {
  key: string;
  label: string;
  path: string;
  query?: Record<string, string>;
}

export interface Dashboard {
  generatedAt: string;
  timeZone: string;
  cards: Card[];
  recentTickets: RecentTicket[];
  quickActions: QuickAction[];
}

/** BR-26: at most five, last update first, then id, both descending. */
const RECENT_LIMIT = 5;

const RECENT_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  updatedAt: true,
} as const;

const RECENT_ORDER: Prisma.TicketOrderByWithRelationInput[] = [
  { updatedAt: "desc" },
  { id: "desc" },
];

/** The five status cards of the staff dashboard, in display order (D-10). */
const STATUS_CARDS: readonly {
  key: string;
  label: string;
  status: TicketStatus;
}[] = [
  { key: "new", label: "New", status: "NEW" },
  { key: "open", label: "Open", status: "OPEN" },
  { key: "in-progress", label: "In Progress", status: "IN_PROGRESS" },
  {
    key: "waiting",
    label: "Waiting for Requester",
    status: "WAITING_FOR_REQUESTER",
  },
  { key: "reopened", label: "Reopened", status: "REOPENED" },
];

type StatusCounts = Partial<Record<TicketStatus, number>>;

const countOf = (counts: StatusCounts, status: TicketStatus): number =>
  counts[status] ?? 0;

/** Tickets per current status, over the Tickets `where` selects. */
const currentCounts = (
  where: Prisma.TicketWhereInput
): Prisma.PrismaPromise<{ currentStatus: TicketStatus; _count: number }[]> =>
  prisma.ticket.groupBy({
    by: ["currentStatus"],
    where,
    _count: true,
  }) as unknown as Prisma.PrismaPromise<
    { currentStatus: TicketStatus; _count: number }[]
  >;

const toCounts = (
  rows: readonly { currentStatus: TicketStatus; _count: number }[]
): StatusCounts => {
  const counts: StatusCounts = {};

  for (const row of rows) {
    counts[row.currentStatus] = row._count;
  }

  return counts;
};

/**
 * Tickets per status as at `t0` (BR-23): a Ticket's status then is the
 * `toStatus` of its latest history row before T0, and one with no such row did
 * not exist yet. Ties on the instant are settled by id, the later row winning.
 */
const countsAsAt = (
  t0: Date
): Prisma.PrismaPromise<{ status: TicketStatus; n: bigint }[]> =>
  prisma.$queryRaw<{ status: TicketStatus; n: bigint }[]>`
    SELECT s."toStatus"::text AS status, count(*) AS n
    FROM (
      SELECT DISTINCT ON ("ticketId") "ticketId", "toStatus"
      FROM "TicketStatusChange"
      WHERE "changedAt" < ${t0}
      ORDER BY "ticketId", "changedAt" DESC, "id" DESC
    ) s
    GROUP BY s."toStatus"`;

const staffDrillDown = (query: Record<string, string>): DrillDown => ({
  path: "/staff/tickets",
  query,
});

export const buildStaffDashboard = async (
  callerId: number
): Promise<Dashboard> => {
  const now = clock.now();
  const t0 = bangkokDayStart(now);
  const me = String(callerId);

  const [today, asAt, myAssigned, unassigned, myFollowUps, recent] =
    await prisma.$transaction(
      [
        currentCounts({}),
        countsAsAt(t0),
        prisma.ticket.count({
          where: { ticketOwnerId: callerId, ...inOpenGroup() },
        }),
        prisma.ticket.count({
          where: { ticketOwnerId: null, ...inOpenGroup() },
        }),
        prisma.ticket.count({ where: hasOpenFollowUpBy(callerId) }),
        prisma.ticket.findMany({
          where: { ticketOwnerId: callerId },
          orderBy: RECENT_ORDER,
          take: RECENT_LIMIT,
          select: RECENT_SELECT,
        }),
      ],
      { isolationLevel: "RepeatableRead" }
    );

  const todayCounts = toCounts(today);
  const asAtCounts: StatusCounts = {};

  for (const row of asAt) {
    asAtCounts[row.status] = Number(row.n);
  }

  const statusCards: Card[] = STATUS_CARDS.map(({ key, label, status }) => ({
    key,
    label,
    count: countOf(todayCounts, status),
    delta: countOf(todayCounts, status) - countOf(asAtCounts, status),
    drillDown: staffDrillDown({ status }),
  }));

  const ownershipCards: Card[] = [
    {
      key: "my-assigned",
      label: "My Assigned",
      count: myAssigned,
      delta: null,
      drillDown: staffDrillDown({ ownerId: me, statusGroup: "open" }),
    },
    {
      key: "unassigned",
      label: "Unassigned",
      count: unassigned,
      delta: null,
      drillDown: staffDrillDown({ unassigned: "true", statusGroup: "open" }),
    },
    {
      key: "my-follow-ups",
      label: "My open follow-ups",
      count: myFollowUps,
      delta: null,
      drillDown: staffDrillDown({ followUp: "mine" }),
    },
  ];

  return {
    generatedAt: now.toISOString(),
    timeZone: DASHBOARD_TIME_ZONE,
    cards: [...statusCards, ...ownershipCards],
    recentTickets: recent,
    quickActions: [
      { key: "create-ticket", label: "Create Ticket", path: "/tickets/new" },
      {
        key: "search-tickets",
        label: "Search Tickets",
        path: "/staff/tickets",
      },
      {
        key: "my-queue",
        label: "My Queue",
        path: "/staff/tickets",
        query: { ownerId: me, statusGroup: "open" },
      },
    ],
  };
};

const requesterDrillDown = (query: Record<string, string>): DrillDown => ({
  path: "/my-tickets",
  query,
});

export const buildRequesterDashboard = async (
  callerId: number
): Promise<Dashboard> => {
  const now = clock.now();
  const mine: Prisma.TicketWhereInput = { requesterId: callerId };

  const [counts, recent] = await prisma.$transaction(
    [
      currentCounts(mine),
      prisma.ticket.findMany({
        where: mine,
        orderBy: RECENT_ORDER,
        take: RECENT_LIMIT,
        select: RECENT_SELECT,
      }),
    ],
    { isolationLevel: "RepeatableRead" }
  );

  const byStatus = toCounts(counts);
  const open = (Object.keys(byStatus) as TicketStatus[])
    .filter((status) => !(CLOSED_GROUP as readonly string[]).includes(status))
    .reduce((sum, status) => sum + countOf(byStatus, status), 0);

  return {
    generatedAt: now.toISOString(),
    timeZone: DASHBOARD_TIME_ZONE,
    cards: [
      {
        key: "open",
        label: "Open",
        count: open,
        delta: null,
        drillDown: requesterDrillDown({ statusGroup: "open" }),
      },
      {
        key: "waiting-for-me",
        label: "Waiting for me",
        count: countOf(byStatus, "WAITING_FOR_REQUESTER"),
        delta: null,
        drillDown: requesterDrillDown({ status: "WAITING_FOR_REQUESTER" }),
      },
      {
        key: "resolved",
        label: "Resolved",
        count: countOf(byStatus, "RESOLVED"),
        delta: null,
        drillDown: requesterDrillDown({ status: "RESOLVED" }),
      },
      {
        key: "closed",
        label: "Closed",
        count: countOf(byStatus, "CLOSED"),
        delta: null,
        drillDown: requesterDrillDown({ status: "CLOSED" }),
      },
    ],
    recentTickets: recent,
    quickActions: [
      { key: "create-ticket", label: "Create Ticket", path: "/tickets/new" },
      { key: "my-tickets", label: "View My Tickets", path: "/my-tickets" },
    ],
  };
};
