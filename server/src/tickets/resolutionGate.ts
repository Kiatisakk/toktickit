import type { ActionState } from "../actions/domain.js";
import { followUpStateOf } from "../actions/domain.js";

/**
 * The resolution gate (BR-16, D-03) and the Resolution Summary's shape
 * (BR-17), as pure functions.
 *
 * Nothing here touches the database: the route reads the Ticket's Actions under
 * the Ticket row's lock and hands them over, so the rule can be tested over
 * every combination without one.
 */

/** The longest Resolution Summary, after trimming (BR-17). */
export const RESOLUTION_SUMMARY_MAX = 2000;

/** What the gate counts on a Ticket. */
export interface GateFacts {
  doneActions: number;
  openFollowUps: number;
  plannedActions: number;
}

/** The part of an Action the gate reads. */
export interface GateAction {
  id: number;
  state: ActionState;
  followUpRequired: boolean;
  followsUpId: number | null;
}

/**
 * Counts what the gate needs from a Ticket's Actions.
 *
 * An open follow-up is derived exactly as the Actions list derives it (D-22):
 * required, not cancelled, and without a Done Action following it up.
 */
export const gateFactsOf = (actions: readonly GateAction[]): GateFacts => {
  const followerStates = new Map<number, ActionState[]>();

  for (const action of actions) {
    if (action.followsUpId !== null) {
      const states = followerStates.get(action.followsUpId) ?? [];

      states.push(action.state);
      followerStates.set(action.followsUpId, states);
    }
  }

  let doneActions = 0;
  let openFollowUps = 0;
  let plannedActions = 0;

  for (const action of actions) {
    if (action.state === "DONE") {
      doneActions += 1;
    }

    if (action.state === "PLANNED") {
      plannedActions += 1;
    }

    if (
      followUpStateOf(action, followerStates.get(action.id) ?? []) === "OPEN"
    ) {
      openFollowUps += 1;
    }
  }

  return { doneActions, openFollowUps, plannedActions };
};

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${count} ${many}`;

/**
 * Every unmet condition, keyed as `RESOLUTION_GATE_FAILED`'s `details` is
 * (api-spec.md section 7). An empty object means the gate holds.
 *
 * All four are evaluated, never the first that fails: the person resolving
 * should see everything in one answer (AC-18). `summary` is the trimmed text,
 * or "" when none was sent.
 */
export const evaluateResolutionGate = (
  facts: GateFacts,
  summary: string
): Record<string, string> => {
  const unmet: Record<string, string> = {};

  if (facts.doneActions === 0) {
    unmet["doneAction"] =
      "Record at least one completed action before resolving.";
  }

  if (facts.openFollowUps > 0) {
    unmet["openFollowUp"] =
      `${plural(facts.openFollowUps, "follow-up is", "follow-ups are")} still open.`;
  }

  if (facts.plannedActions > 0) {
    unmet["plannedActions"] =
      `Complete or cancel the ${plural(facts.plannedActions, "planned action", "planned actions")} before resolving.`;
  }

  if (summary.trim() === "") {
    unmet["resolutionSummary"] = "Enter a resolution summary.";
  }

  return unmet;
};

export type SummaryResult =
  | { ok: true; value: string | undefined }
  | { ok: false; details: Record<string, string> };

/**
 * The Resolution Summary as sent with a status change (BR-17).
 *
 * Only a transition to Resolved may carry one. When resolving, a missing,
 * empty or whitespace-only summary is **not** a shape error: it comes through
 * as "" and the gate names it beside the other unmet conditions, so the person
 * sees them together. Too long, or not text, is a shape error.
 */
export const validateResolutionSummary = (
  target: string,
  raw: unknown
): SummaryResult => {
  if (target !== "RESOLVED") {
    return raw === undefined
      ? { ok: true, value: undefined }
      : {
          ok: false,
          details: {
            resolutionSummary:
              "Send a resolution summary only when resolving the ticket.",
          },
        };
  }

  if (raw === undefined) {
    return { ok: true, value: "" };
  }

  if (typeof raw !== "string") {
    return {
      ok: false,
      details: { resolutionSummary: "The resolution summary must be text." },
    };
  }

  const value = raw.trim();

  if (value.length > RESOLUTION_SUMMARY_MAX) {
    return {
      ok: false,
      details: {
        resolutionSummary: `The resolution summary must be at most ${RESOLUTION_SUMMARY_MAX} characters.`,
      },
    };
  }

  return { ok: true, value };
};
