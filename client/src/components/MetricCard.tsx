import { Link } from "react-router";

import type { DashboardCard } from "../lib/api";
import { cardName, deltaLine, drillDownTo } from "../lib/dashboard";

const directionOf = (delta: number | null): string | undefined => {
  if (delta === null) {
    return undefined;
  }

  if (delta === 0) {
    return "none";
  }

  return delta > 0 ? "up" : "down";
};

/**
 * One dashboard card: a single link to the list it counted (ui-spec.md
 * section 3, FR-18, AC-39).
 *
 * An anchor, not a div with a click handler, so it takes keyboard focus and
 * opens in a new tab like any link. Its accessible name states the label, the
 * value and the delta in words ("New, 14 tickets, up 3 from yesterday"), since
 * the arrow glyph alone is not something a screen reader should have to
 * interpret. The destination is the one the API returned (BR-34).
 *
 * A card without a delta keeps an empty line of the same height, so a row of
 * cards stays aligned whether or not each has one.
 */
export const MetricCard = ({
  card,
  viewAll = false,
}: {
  card: DashboardCard;
  /** The Requester cards carry a "View all" affordance in their text. */
  viewAll?: boolean;
}) => (
  <Link
    aria-label={viewAll ? `${cardName(card)}, view all` : cardName(card)}
    className="tkt-metric"
    data-card={card.key}
    to={drillDownTo(card.drillDown)}
  >
    <span aria-hidden="true" className="tkt-metric__label">
      {card.label}
    </span>
    <span aria-hidden="true" className="tkt-metric__value">
      {card.count}
    </span>
    <span
      aria-hidden="true"
      className="tkt-metric__delta"
      data-direction={directionOf(card.delta)}
    >
      {card.delta === null ? " " : deltaLine(card.delta)}
    </span>
    {viewAll ? (
      <span aria-hidden="true" className="tkt-metric__more">
        View all
      </span>
    ) : null}
  </Link>
);
