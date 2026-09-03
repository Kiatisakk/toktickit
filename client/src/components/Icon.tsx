import "bootstrap-icons/font/bootstrap-icons.css";

/**
 * The small marks the illustrations draw beside their controls.
 *
 * Bootstrap Icons, because the project already carries Bootstrap and the set is
 * the one the figures were drawn from — a hand-cut path is recognisably not the
 * same icon, which is worse than none at all.
 *
 * §8.3: "Buttons include visible text; icons may support but must not replace
 * unclear text." Every icon here is decoration and marked `aria-hidden`; the
 * label beside it carries the meaning. The test that matters is not that an
 * icon renders, but that deleting every one of them would leave every control
 * still saying what it does.
 */

/** Our names, not Bootstrap's, so the set can be swapped in one place. */
const GLYPHS = {
  search: "search",
  create: "plus-circle",
  reload: "arrow-counterclockwise",
  ticket: "file-earmark-text",
  user: "person-circle",
  brand: "clock",
  home: "house",
  back: "arrow-left",
  // The four `StateBlock` kinds (ui-spec.md §3). `no-results` reuses `search`
  // rather than a name of its own: a magnifying glass is what "your search
  // found nothing" already means.
  loading: "hourglass-split",
  empty: "inbox",
  warning: "exclamation-triangle",
} as const;

export type IconName = keyof typeof GLYPHS;

interface IconProps {
  name: IconName;
  className?: string;
}

export const Icon = ({ name, className }: IconProps) => (
  <i
    aria-hidden="true"
    className={`tkt-icon bi bi-${GLYPHS[name]}${className ? ` ${className}` : ""}`}
  />
);
