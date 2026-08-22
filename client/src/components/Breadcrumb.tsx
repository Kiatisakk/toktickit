import { Link } from "react-router";

export interface Crumb {
  label: string;
  /** Omitted for the final crumb, which is the current page. */
  to?: string;
}

interface BreadcrumbProps {
  items: Crumb[];
}

export const Breadcrumb = ({ items }: BreadcrumbProps) => (
  <nav aria-label="Breadcrumb" className="tkt-breadcrumb">
    <ol className="tkt-breadcrumb__list">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <li className="tkt-breadcrumb__item" key={item.label}>
            {item.to && !isLast ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
