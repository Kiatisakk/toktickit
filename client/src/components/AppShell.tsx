import { type ReactNode, useContext, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { RequesterContext } from "../context/requesterContextValue";
import { Breadcrumb, type Crumb } from "./Breadcrumb";

interface AppShellProps {
  /**
   * Name of the current Development Requester. Undefined before one has been
   * chosen — the selection screen renders inside this shell too, and it has to
   * be honest that nobody is selected yet.
   *
   * The context that supplies this arrives with the Development Requester
   * Issue; the shell only displays what it is given.
   */
  requesterName?: string;
  onChangeRequester?: () => void;
  breadcrumbs?: Crumb[];
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: "/my-tickets", label: "My Tickets" },
  { to: "/tickets/new", label: "Create Ticket" },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "tkt-nav-link tkt-nav-link--active" : "tkt-nav-link";

export const AppShell = ({
  requesterName,
  onChangeRequester,
  breadcrumbs,
  children,
}: AppShellProps) => {
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  // Read the context when there is one, but do not require it. The selection
  // screen renders inside this shell before any requester exists, and the
  // component tests render the shell on its own with explicit props.
  const context = useContext(RequesterContext);

  const displayName = requesterName ?? context?.requester?.name;

  const changeRequester =
    onChangeRequester ??
    (context?.requester
      ? () => {
          context.clear();
          void navigate("/select-requester");
        }
      : undefined);

  return (
    <div className="tkt-shell">
      <header className="tkt-header">
        <div className="tkt-header__inner">
          <Link className="tkt-brand" to="/">
            <span aria-hidden="true">🕐</span>
            TokTickIT
          </Link>

          <button
            aria-controls="tkt-primary-nav"
            aria-expanded={navOpen}
            className="tkt-nav-toggle"
            onClick={() => setNavOpen((open) => !open)}
            type="button"
          >
            Menu
          </button>

          <nav
            aria-label="Primary"
            className={navOpen ? "tkt-nav tkt-nav--open" : "tkt-nav"}
            id="tkt-primary-nav"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                className={navLinkClass}
                key={item.to}
                onClick={() => setNavOpen(false)}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Whose data is on screen stays visible even when the navigation is
              collapsed. On a phone this is the one thing the header must say. */}
          <div className="tkt-identity">
            <span aria-hidden="true">👤</span>
            <span className="tkt-identity__name">
              {displayName ?? "No requester selected"}
            </span>
            {changeRequester ? (
              <button
                className="tkt-btn tkt-btn--secondary"
                onClick={changeRequester}
                type="button"
              >
                Change Requester
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb items={breadcrumbs} />
      ) : null}

      <main className="tkt-main">{children}</main>
    </div>
  );
};
