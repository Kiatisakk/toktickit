/**
 * The four conditions of the resolution gate, as the resolve dialog shows them
 * (BR-16, ui-spec.md section 7).
 *
 * The client can only work these out from the Actions it has loaded and the
 * text in the box, which is feedback and nothing more: the server decides, and
 * its `RESOLUTION_GATE_FAILED` `details` replace whatever this computed
 * (AC-41). The keys are the server's, so a refusal maps straight onto them.
 */

export const GATE_KEYS = [
  "doneAction",
  "openFollowUp",
  "plannedActions",
  "resolutionSummary",
] as const;

export type GateKey = (typeof GATE_KEYS)[number];

/** The longest Resolution Summary, after trimming (BR-17). */
export const RESOLUTION_SUMMARY_MAX = 2000;

/** What the dialog needs of an Action. */
export interface GateAction {
  id: number;
  state: "PLANNED" | "DONE" | "CANCELLED";
  followUpState: "NOT_REQUIRED" | "VOID" | "OPEN" | "CLOSED";
}

export interface GateCondition {
  key: GateKey;
  label: string;
  met: boolean;
  /** "2 open", "1 planned": what makes it unmet, when that is a count. */
  count: number;
  /** The first Action a person should go to, for the two that name one. */
  firstActionId: number | null;
}

export const GATE_LABELS: Record<GateKey, string> = {
  doneAction: "At least one completed action",
  openFollowUp: "No open follow-ups",
  plannedActions: "No planned actions pending",
  resolutionSummary: "Resolution summary entered",
};

/**
 * Evaluates the four conditions from the loaded Actions and the summary text.
 * `actions` is null while they have not loaded: the three that depend on them
 * are then unknown, and are reported as not met rather than guessed met.
 */
export const evaluateGate = (
  actions: readonly GateAction[] | null,
  summary: string
): GateCondition[] => {
  const known = actions ?? [];
  const open = known.filter((one) => one.followUpState === "OPEN");
  const planned = known.filter((one) => one.state === "PLANNED");
  const done = known.filter((one) => one.state === "DONE");

  return [
    {
      key: "doneAction",
      label: GATE_LABELS.doneAction,
      met: done.length > 0,
      count: done.length,
      firstActionId: null,
    },
    {
      key: "openFollowUp",
      label: GATE_LABELS.openFollowUp,
      met: actions !== null && open.length === 0,
      count: open.length,
      firstActionId: open[0]?.id ?? null,
    },
    {
      key: "plannedActions",
      label: GATE_LABELS.plannedActions,
      met: actions !== null && planned.length === 0,
      count: planned.length,
      firstActionId: planned[0]?.id ?? null,
    },
    {
      key: "resolutionSummary",
      label: GATE_LABELS.resolutionSummary,
      met: summary.trim() !== "",
      count: 0,
      firstActionId: null,
    },
  ];
};

/**
 * Lets a server refusal replace the computed state (AC-41): a condition is
 * unmet exactly when the server named it. The summary stays the local reading,
 * because the person may have typed one since the refusal.
 */
export const applyRefusal = (
  computed: readonly GateCondition[],
  details: Readonly<Record<string, string>>
): GateCondition[] =>
  computed.map((condition) =>
    condition.key === "resolutionSummary"
      ? condition
      : { ...condition, met: !Object.hasOwn(details, condition.key) }
  );
