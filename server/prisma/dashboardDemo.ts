import { bangkokDayStart } from "../src/dashboard/time.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
// Seeding is sequential by design: each Ticket is read, then created, then its
// history and Actions, so a rerun can tell what is already there.
/* oxlint-disable no-await-in-loop */
import type {
  ActionState,
  Priority,
  TicketStatus,
} from "../src/generated/prisma/enums.js";

/**
 * Lab 4 demonstration data: every status, Tickets with zero, one and several
 * Actions Taken, open and closed follow-ups, and history timed either side of
 * today's Bangkok midnight so the dashboards show zero and non-zero metrics and
 * deltas (specification.md section 7 "Seed", BR-33, AC-37).
 *
 * **Idempotent by fixed key, not by delete-and-recreate.** Each Ticket is found
 * by its `ticketNumber` and each Action by its `(ticketId, requestId)`; a row
 * that exists is left exactly as it is, so work someone has since done on a
 * demonstration Ticket survives a rerun. A history row is written only when no
 * row with the same Ticket and the same `from -> to` exists. Running it twice
 * therefore changes nothing, and deleting a Ticket (which cascades its Actions
 * and history) lets the next run put it back.
 *
 * **What a rerun does not do.** History is timed relative to the day the seed
 * first ran, because an append-only history cannot be moved. The "yesterday"
 * rows therefore show deltas on that day; on a later day they are older and the
 * deltas read zero. Delete the `TKT-DEMO-L4-*` Tickets and run the seed again
 * to refresh them.
 *
 * Tickets use a `TKT-DEMO-L4-nn` number, outside the application's own
 * `TKT-<year>-nnnnnn` counter, so they can never collide with a Ticket raised
 * through the application and are easy to recognise and remove.
 *
 * Takes `now` as a parameter so a test can fix it and assert exact figures.
 * The accounts (people) come from the reference seed and are only read.
 */

/** The prefix every demonstration Ticket's number carries. */
export const DEMO_TICKET_PREFIX = "TKT-DEMO-L4-";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type Person = "jennifer" | "somchai" | "michael" | "sarah" | "david" | "wanida";

const EMAILS: Record<Person, string> = {
  jennifer: "jennifer.anderson@example.ac.th",
  somchai: "somchai.wattana@example.ac.th",
  michael: "michael.brown@example.ac.th",
  sarah: "sarah.johnson@example.ac.th",
  david: "david.lee@example.ac.th",
  wanida: "wanida.thongchai@example.ac.th",
};

/** When a row happened: before today's Bangkok midnight, or after it. */
type Moment =
  | { beforeMidnightHours: number }
  | { afterMidnightMinutes: number };

interface HistorySpec {
  from: TicketStatus | null;
  to: TicketStatus;
  at: Moment;
}

interface ActionSpec {
  /** 1-based, unique within the Ticket; also the idempotency key's tail. */
  n: number;
  performedBy: Person;
  recordedBy: Person;
  state: ActionState;
  description: string;
  result?: string;
  followUpNote?: string;
  /** The `n` of an earlier Action on this Ticket that this one follows up. */
  followsUp?: number;
  cancelReason?: string;
  at: Moment;
}

interface TicketSpec {
  /** Two digits; the number is `TKT-DEMO-L4-<key>`. */
  key: string;
  requester: Person;
  owner: Person | null;
  status: TicketStatus;
  summary: string;
  requestedPriority: Priority;
  itPriority: Priority | null;
  resolutionSummary?: string;
  history: HistorySpec[];
  actions: ActionSpec[];
}

const before = (beforeMidnightHours: number): Moment => ({
  beforeMidnightHours,
});
const after = (afterMidnightMinutes: number): Moment => ({
  afterMidnightMinutes,
});

/**
 * The demonstration set. Twelve Tickets, all eight statuses:
 *
 * - zero Actions: 01 02 03 04 08 11 12
 * - one Action: 06 09 10
 * - several Actions: 05 (three, with a Planned and a Cancelled) and 07 (two)
 * - open follow-ups: 06 (Michael) and 09 (Sarah); 05's Planned Action is not a
 *   follow-up. Closed follow-up: 07.
 * - Wanida (Administrator) owns nothing and has no follow-up, and Pimchanok (the
 *   third Requester) has no Ticket: the zero-metric cases.
 */
const TICKETS: TicketSpec[] = [
  {
    key: "01",
    requester: "jennifer",
    owner: null,
    status: "NEW",
    summary: "Demo: cannot sign in to the LEB2 app",
    requestedPriority: "HIGH",
    itPriority: null,
    history: [{ from: null, to: "NEW", at: after(5) }],
    actions: [],
  },
  {
    key: "02",
    requester: "somchai",
    owner: null,
    status: "NEW",
    summary: "Demo: projector in room 204 has no signal",
    requestedPriority: "MEDIUM",
    itPriority: null,
    history: [{ from: null, to: "NEW", at: before(5) }],
    actions: [],
  },
  {
    key: "03",
    requester: "jennifer",
    owner: "michael",
    status: "OPEN",
    summary: "Demo: request access to the grade submission app",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    history: [
      { from: null, to: "NEW", at: before(30) },
      { from: "NEW", to: "OPEN", at: before(26) },
    ],
    actions: [],
  },
  {
    key: "04",
    requester: "somchai",
    owner: "sarah",
    status: "OPEN",
    summary: "Demo: printer on floor 3 keeps jamming",
    requestedPriority: "LOW",
    itPriority: "LOW",
    history: [
      { from: null, to: "NEW", at: before(8) },
      { from: "NEW", to: "OPEN", at: after(20) },
    ],
    actions: [],
  },
  {
    key: "05",
    requester: "jennifer",
    owner: "michael",
    status: "IN_PROGRESS",
    summary: "Demo: campus Wi-Fi drops in the library",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    history: [
      { from: null, to: "NEW", at: before(52) },
      { from: "NEW", to: "OPEN", at: before(50) },
      { from: "OPEN", to: "IN_PROGRESS", at: before(30) },
    ],
    actions: [
      {
        n: 1,
        performedBy: "sarah",
        recordedBy: "michael",
        state: "DONE",
        description: "Replaced the faulty access point in the reading room.",
        result: "Signal stable on the second floor.",
        at: before(28),
      },
      {
        n: 2,
        performedBy: "michael",
        recordedBy: "michael",
        state: "PLANNED",
        description: "Re-survey coverage on the first floor after hours.",
        at: after(30),
      },
      {
        n: 3,
        performedBy: "michael",
        recordedBy: "michael",
        state: "CANCELLED",
        description: "Swap the switch in the comms cupboard.",
        cancelReason: "The fault was the access point, not the switch.",
        at: before(27),
      },
    ],
  },
  {
    key: "06",
    requester: "somchai",
    owner: "michael",
    status: "IN_PROGRESS",
    summary: "Demo: VPN disconnects every ten minutes",
    requestedPriority: "MEDIUM",
    itPriority: "HIGH",
    history: [
      { from: null, to: "NEW", at: before(40) },
      { from: "NEW", to: "OPEN", at: before(38) },
      { from: "OPEN", to: "IN_PROGRESS", at: after(10) },
    ],
    actions: [
      {
        n: 1,
        performedBy: "michael",
        recordedBy: "michael",
        state: "DONE",
        description: "Raised the idle timeout on the VPN gateway.",
        result: "Dropped connections fell, but one user still reports it.",
        followUpNote: "Check the gateway logs again on Friday.",
        at: after(15),
      },
    ],
  },
  {
    key: "07",
    requester: "jennifer",
    owner: "sarah",
    status: "IN_PROGRESS",
    summary: "Demo: email not syncing on mobile",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    history: [
      { from: null, to: "NEW", at: before(60) },
      { from: "NEW", to: "OPEN", at: before(58) },
      { from: "OPEN", to: "IN_PROGRESS", at: before(56) },
    ],
    actions: [
      {
        n: 1,
        performedBy: "sarah",
        recordedBy: "sarah",
        state: "DONE",
        description: "Rebuilt the mail profile on the handset.",
        result: "Sync restored; watching for a repeat.",
        followUpNote: "Confirm with the requester after two days.",
        at: before(50),
      },
      {
        n: 2,
        performedBy: "sarah",
        recordedBy: "sarah",
        state: "DONE",
        description: "Confirmed with the requester that sync stayed healthy.",
        followsUp: 1,
        at: before(6),
      },
    ],
  },
  {
    key: "08",
    requester: "somchai",
    owner: "michael",
    status: "WAITING_FOR_REQUESTER",
    summary: "Demo: new employee laptop setup",
    requestedPriority: "LOW",
    itPriority: "LOW",
    history: [
      { from: null, to: "NEW", at: before(70) },
      { from: "NEW", to: "OPEN", at: before(68) },
      { from: "OPEN", to: "WAITING_FOR_REQUESTER", at: before(20) },
    ],
    actions: [],
  },
  {
    key: "09",
    requester: "somchai",
    owner: "sarah",
    status: "REOPENED",
    summary: "Demo: shared drive missing after restart",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    history: [
      { from: null, to: "NEW", at: before(90) },
      { from: "NEW", to: "OPEN", at: before(88) },
      { from: "OPEN", to: "RESOLVED", at: before(40) },
      { from: "RESOLVED", to: "REOPENED", at: after(25) },
    ],
    actions: [
      {
        n: 1,
        performedBy: "sarah",
        recordedBy: "sarah",
        state: "DONE",
        description: "Remapped the shared drive through group policy.",
        result: "Drive reappeared; may return after the next restart.",
        followUpNote: "Test again after the weekend restart.",
        at: after(30),
      },
    ],
  },
  {
    key: "10",
    requester: "jennifer",
    owner: "michael",
    status: "RESOLVED",
    summary: "Demo: laptop battery drains quickly",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    resolutionSummary:
      "Replaced the battery under warranty and verified a full charge cycle.",
    history: [
      { from: null, to: "NEW", at: before(120) },
      { from: "NEW", to: "OPEN", at: before(118) },
      { from: "OPEN", to: "RESOLVED", at: before(30) },
    ],
    actions: [
      {
        n: 1,
        performedBy: "michael",
        recordedBy: "michael",
        state: "DONE",
        description: "Replaced the battery under warranty.",
        result: "Full charge cycle verified with the requester.",
        at: before(32),
      },
    ],
  },
  {
    key: "11",
    requester: "somchai",
    owner: "sarah",
    status: "CLOSED",
    summary: "Demo: password reset for the LEB2 app",
    requestedPriority: "LOW",
    itPriority: "LOW",
    history: [
      { from: null, to: "NEW", at: before(200) },
      { from: "NEW", to: "OPEN", at: before(195) },
      { from: "OPEN", to: "RESOLVED", at: before(190) },
      { from: "RESOLVED", to: "CLOSED", at: before(100) },
    ],
    actions: [],
  },
  {
    key: "12",
    requester: "jennifer",
    owner: null,
    status: "CANCELLED",
    summary: "Demo: duplicate request for a second monitor",
    requestedPriority: "LOW",
    itPriority: null,
    history: [
      { from: null, to: "NEW", at: before(150) },
      { from: "NEW", to: "CANCELLED", at: before(140) },
    ],
    actions: [],
  },
];

export interface DashboardDemoResult {
  ticketsCreated: number;
  actionsCreated: number;
  historyCreated: number;
}

const instantOf = (moment: Moment, now: Date, midnight: Date): Date => {
  if ("beforeMidnightHours" in moment) {
    return new Date(midnight.getTime() - moment.beforeMidnightHours * HOUR_MS);
  }

  // Never in the future: a run shortly after midnight would otherwise stamp a
  // row later than the moment it was written.
  return new Date(
    Math.min(
      midnight.getTime() + moment.afterMidnightMinutes * MINUTE_MS,
      now.getTime()
    )
  );
};

/** A UUID-shaped key, so these Actions look like any other. Fixed per Action. */
const requestIdOf = (ticketKey: string, n: number): string =>
  `00000000-0000-4000-8000-${ticketKey.padStart(6, "0")}${String(n).padStart(6, "0")}`;

export const seedDashboardDemo = async (
  client: PrismaClient,
  now: Date
): Promise<DashboardDemoResult> => {
  const midnight = bangkokDayStart(now);

  const users = await client.user.findMany({
    where: { email: { in: Object.values(EMAILS) } },
    select: { id: true, email: true },
  });
  const idOf = (person: Person): number => {
    const found = users.find((user) => user.email === EMAILS[person]);

    if (!found) {
      throw new Error(
        `Missing account ${EMAILS[person]}. Run npm run db:seed first.`
      );
    }

    return found.id;
  };

  const [category, system] = await Promise.all([
    client.category.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    client.relatedSystem.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const result: DashboardDemoResult = {
    ticketsCreated: 0,
    actionsCreated: 0,
    historyCreated: 0,
  };

  for (const spec of TICKETS) {
    const ticketNumber = `${DEMO_TICKET_PREFIX}${spec.key}`;
    const times = spec.history.map((row) => instantOf(row.at, now, midnight));
    const raisedAt = times[0] ?? now;
    const touchedAt = times.at(-1) ?? raisedAt;

    const existing = await client.ticket.findUnique({
      where: { ticketNumber },
      select: { id: true },
    });

    // Create only. An existing Ticket is left exactly as it is, so work done on
    // it since is not overwritten.
    const ticket =
      existing ??
      (await client.ticket.create({
        data: {
          ticketNumber,
          requesterId: idOf(spec.requester),
          categoryId: category.id,
          relatedSystemId: system.id,
          summary: spec.summary,
          description:
            "Raised by the Lab 4 demonstration seed so the dashboards have something realistic to show.",
          requestedPriority: spec.requestedPriority,
          itPriority: spec.itPriority,
          currentStatus: spec.status,
          ticketOwnerId: spec.owner ? idOf(spec.owner) : null,
          resolutionSummary: spec.resolutionSummary ?? null,
          createdAt: raisedAt,
          updatedAt: touchedAt,
        },
        select: { id: true },
      }));

    if (!existing) {
      result.ticketsCreated += 1;
    }

    for (const [index, row] of spec.history.entries()) {
      const present = await client.ticketStatusChange.findFirst({
        where: {
          ticketId: ticket.id,
          fromStatus: row.from,
          toStatus: row.to,
        },
        select: { id: true },
      });

      if (!present) {
        await client.ticketStatusChange.create({
          data: {
            ticketId: ticket.id,
            fromStatus: row.from,
            toStatus: row.to,
            changedAt: times[index] ?? now,
          },
        });
        result.historyCreated += 1;
      }
    }

    const actionIds = new Map<number, number>();

    for (const action of spec.actions) {
      const requestId = requestIdOf(spec.key, action.n);
      const found = await client.actionTaken.findUnique({
        where: { ticketId_requestId: { ticketId: ticket.id, requestId } },
        select: { id: true },
      });
      const stored =
        found ??
        (await client.actionTaken.create({
          data: {
            ticketId: ticket.id,
            recordedById: idOf(action.recordedBy),
            performedById: idOf(action.performedBy),
            actionAt: instantOf(action.at, now, midnight),
            description: action.description,
            result: action.result ?? null,
            state: action.state,
            followUpRequired: action.followUpNote !== undefined,
            followUpNote: action.followUpNote ?? null,
            requestId,
            followsUpId: action.followsUp
              ? (actionIds.get(action.followsUp) ?? null)
              : null,
            cancelReason: action.cancelReason ?? null,
          },
          select: { id: true },
        }));

      actionIds.set(action.n, stored.id);

      if (!found) {
        result.actionsCreated += 1;
      }
    }
  }

  return result;
};
