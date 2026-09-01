import type { ReactNode } from "react";
import { Link } from "react-router";

import { Icon, type IconName } from "./Icon";

export interface Crumb {
  label: string;
  /** Omitted for the final crumb, which is the current page. */
  to?: string;
  /**
   * Drawn in place of the label, with the label kept as the accessible name.
   *
   * The Requester Selection illustration draws its first crumb as a house and
   * no word at all. An icon that replaces text needs the text somewhere, which
   * §8.3 is explicit about, so the label survives for anyone who cannot see the
   * glyph.
   */
  icon?: IconName;
}

interface BreadcrumbProps {
  items: Crumb[];
  /**
   * A control on the breadcrumb's own row, right-aligned.
   *
   * Figure 1 puts "Back to My Tickets" there rather than above the card, and
   * the row is otherwise mostly empty — which is presumably why. Passing it in
   * rather than letting each screen build its own row keeps the two halves on
   * one baseline.
   */
  action?: ReactNode;
}

export const Breadcrumb = ({ items, action }: BreadcrumbProps) => (
  <nav aria-label="Breadcrumb" className="tkt-breadcrumb">
    <ol className="tkt-breadcrumb__list">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        const content = item.icon ? (
          <>
            <Icon name={item.icon} />
            <span className="tkt-visually-hidden">{item.label}</span>
          </>
        ) : (
          item.label
        );

        return (
          <li className="tkt-breadcrumb__item" key={item.label}>
            {item.to && !isLast ? (
              <Link to={item.to}>{content}</Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>

    {action ? <div className="tkt-breadcrumb__action">{action}</div> : null}
  </nav>
);
