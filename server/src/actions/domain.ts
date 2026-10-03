/**
 * The Action Taken rules that need no database (BR-03, BR-09).
 *
 * Mirrors the Prisma `ActionState` enum for the same reason
 * `tickets/domain.ts` mirrors the ticket enums: a pure rule should not import
 * the database client to borrow a union.
 */

export const ACTION_STATES = ["PLANNED", "DONE", "CANCELLED"] as const;

export type ActionState = (typeof ACTION_STATES)[number];

/**
 * Planned moves to Done or to Cancelled and nowhere else; both are terminal
 * (BR-03, D-02). An empty list is a stated fact, not a missing key.
 */
const TRANSITIONS: Record<ActionState, readonly ActionState[]> = {
  PLANNED: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export const isPermittedActionTransition = (
  from: ActionState,
  to: ActionState
): boolean => TRANSITIONS[from].includes(to);

/**
 * Whether a Ticket in `status` still accepts Action writes (BR-13, D-17).
 *
 * Resolved, Closed and Cancelled do not: without that a Ticket could be
 * Resolved and then acquire an open follow-up, contradicting the gate.
 */
export const isActionableStatus = (status: string): boolean =>
  status !== "RESOLVED" && status !== "CLOSED" && status !== "CANCELLED";

/** Whether a follow-up is wanted, owed, finished or withdrawn (BR-09). */
export type FollowUpState = "NOT_REQUIRED" | "VOID" | "OPEN" | "CLOSED";

/**
 * Derives the follow-up state on every read; it is never stored (D-22).
 *
 * `followerStates` are the states of the Actions that name this one as
 * `followsUpId`. Only a Done follower closes a follow-up, and a Done Action is
 * terminal, so a closed follow-up stays closed.
 */
export const followUpStateOf = (
  action: { followUpRequired: boolean; state: ActionState },
  followerStates: readonly ActionState[]
): FollowUpState => {
  if (!action.followUpRequired) {
    return "NOT_REQUIRED";
  }

  if (action.state === "CANCELLED") {
    return "VOID";
  }

  return followerStates.includes("DONE") ? "CLOSED" : "OPEN";
};
