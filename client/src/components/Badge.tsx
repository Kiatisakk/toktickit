export type BadgeKind = "priority" | "status" | "attachment";

interface BadgeProps {
  kind: BadgeKind;
  /** Enum value from the API, e.g. `HIGH` or `IN_PROGRESS`. */
  value: string | null;
  /** Shown when the value is null — an unset IT priority, for instance. */
  emptyLabel?: string;
}

/** `IN_PROGRESS` reads as "In Progress" on screen. */
const humanise = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * A priority, status or attachment state.
 *
 * The word is always rendered, never replaced by the colour. §8.8 asks for
 * badge consistency and ui-spec.md §8 forbids signalling a state by colour
 * alone — a red badge and an amber badge are the same badge to a reader who
 * cannot distinguish them.
 *
 * A null value renders as an em dash with an accessible label rather than as an
 * empty cell, so a column with nothing in it still says so. Lab 2 never sets IT
 * Priority, which makes this the common case rather than the edge.
 */
export const Badge = ({ kind, value, emptyLabel = "Not set" }: BadgeProps) => {
  if (value === null) {
    return (
      <span className="tkt-badge tkt-badge--unset">
        <span aria-hidden="true">—</span>
        <span className="tkt-visually-hidden">{emptyLabel}</span>
      </span>
    );
  }

  const modifier = value.toLowerCase().replaceAll("_", "-");

  return (
    <span className={`tkt-badge tkt-badge--${modifier}`} data-kind={kind}>
      {humanise(value)}
    </span>
  );
};
