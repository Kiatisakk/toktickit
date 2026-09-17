/**
 * The ticket lifecycle, as the screens need it (BR-24, BR-25).
 *
 * Two things live here. The **labels** were previously written out twice, in My
 * Tickets and in the queue, which is how "Pending" would have survived in one
 * of them after the rename. The **transition matrix** is new, and it is here for
 * a sharper reason: the status control must offer exactly the targets the
 * server accepts (UI-16). Offering one it refuses is a control that can only
 * fail, and hiding one it accepts is work a staff member cannot do.
 *
 * This is a copy of `server/src/tickets/domain.ts`, which is a copy of
 * specification.md §5 — a duplication the client cannot avoid, because no
 * endpoint hands the matrix over. Both copies are asserted against the spec's
 * own table: UNIT-02 on the server, and the client suite here. If the two ever
 * disagree, the server is right — it is the boundary, and the control is only
 * feedback (BR-17).
 */

export const TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

/**
 * What each status is called on screen.
 *
 * Written out rather than derived from the enum: mechanical title-casing turns
 * `WAITING_FOR_REQUESTER` into "Waiting For Requester", with a capital F that
 * no sentence in the handout has.
 */
export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

/** The eight statuses as a filter's options, in lifecycle order. */
export const STATUS_OPTIONS = TICKET_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export const isTicketStatus = (value: unknown): value is TicketStatus =>
  TICKET_STATUSES.includes(value as TicketStatus);

/**
 * Where a ticket in this status may go next, in lifecycle order.
 *
 * `CANCELLED` yields none: it is terminal, and the screen shows the status
 * read-only rather than an empty dropdown, which reads as a failed load
 * (ui-spec.md §6, BR-26).
 */
export const permittedTargets = (from: unknown): TicketStatus[] =>
  isTicketStatus(from) ? [...TRANSITIONS[from]] : [];
