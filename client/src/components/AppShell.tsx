import { type ReactNode, useContext, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { AuthContext } from "../context/authContextValue";
import { RequesterContext } from "../context/requesterContextValue";
import { Badge } from "./Badge";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { Icon, type IconName } from "./Icon";

/**
 * Which header the page gets (ui-spec.md §3, §4).
 *
 * - `application` — navigation and identity; every ordinary screen.
 * - `signed-out` — the header with no navigation and no user, because there is
 *   not one yet. The sign-in screen.
 * - `gated` — the user's name, role and Logout, and no navigation, because
 *   there is nowhere else they may go until a password change is saved (BR-02).
 */
export type ShellVariant = "application" | "signed-out" | "gated";

interface AppShellProps {
  variant?: ShellVariant;
  breadcrumbs?: Crumb[];
  /** Right-aligned on the breadcrumb row, as Figure 1 places it. */
  breadcrumbAction?: ReactNode;
  children: ReactNode;
}

const NAV_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: "/my-tickets", label: "My Tickets", icon: "ticket" },
  { to: "/tickets/new", label: "Create Ticket", icon: "create" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "tkt-nav-link tkt-nav-link--active" : "tkt-nav-link";

/**
 * The application shell.
 *
 * Identity comes from the contexts and nowhere else. An earlier version also
 * accepted the name as a prop, with the prop winning — which meant the header
 * could confidently display someone other than the person every API call was
 * actually being made as. One source, or the header is decoration.
 *
 * Both contexts are optional rather than required: the Lab 1 status page
 * renders outside them, and the sign-in screen renders before anyone exists.
 */
export const AppShell = ({
  variant = "application",
  breadcrumbs,
  breadcrumbAction,
  children,
}: AppShellProps) => {
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  const context = useContext(RequesterContext);
  const requester = context?.requester ?? null;

  const auth = useContext(AuthContext);
  const signedInUser = auth?.user ?? null;

  const showNavigation = variant === "application";
  const showIdentity = variant !== "signed-out";
  // The selector belongs to the application screens only. On the gated screen
  // it would be a way round the gate in the interface, even though the server
  // would still refuse whatever it led to.
  const showRequester = variant === "application";

  const changeRequester =
    showRequester && requester
      ? () => {
          context?.clear();
          void navigate("/select-requester");
        }
      : undefined;

  const signOut = () => {
    void auth?.signOut().then(() => navigate("/login", { replace: true }));
  };

  return (
    <div className="tkt-shell">
      <header className="tkt-header">
        <div className="tkt-header__inner">
          <Link className="tkt-brand" to="/">
            <Icon className="tkt-brand__mark" name="brand" />
            TokTickIT
          </Link>

          {showNavigation ? (
            <>
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
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </>
          ) : null}

          {/* Whose data is on screen stays visible even when the navigation
              is collapsed. On a phone this is the one thing the header must
              say. While both identity mechanisms coexist, the signed-in user
              is named first and the selected requester second — they can
              genuinely be two different people for one ticket, and hiding
              that would make the incoherence invisible rather than temporary. */}
          {showIdentity ? (
            <div className="tkt-identity">
              <Icon name="user" />

              {signedInUser ? (
                <>
                  <span className="tkt-identity__name">
                    {signedInUser.name}
                  </span>
                  <Badge kind="role" value={signedInUser.role} />
                </>
              ) : (
                <span className="tkt-identity__name">
                  {requester?.name ?? "No requester selected"}
                </span>
              )}

              {showRequester &&
              signedInUser &&
              requester &&
              requester.id !== signedInUser.id ? (
                <span className="tkt-identity__acting">
                  acting as {requester.name}
                </span>
              ) : null}

              {changeRequester ? (
                <button
                  className="tkt-btn tkt-btn--secondary"
                  onClick={changeRequester}
                  type="button"
                >
                  Change Requester
                </button>
              ) : null}

              {/* Offered only once the session check has answered. While it is
                  still resolving, a Sign In link would flash at everybody who
                  is already signed in. It is a link rather than a redirect
                  because the Lab 2 screens are still the working product. */}
              {auth?.status === "anonymous" && showRequester ? (
                <Link className="tkt-btn tkt-btn--secondary" to="/login">
                  Sign In
                </Link>
              ) : null}

              {signedInUser ? (
                <button
                  className="tkt-btn tkt-btn--secondary"
                  onClick={signOut}
                  type="button"
                >
                  <Icon name="logout" />
                  Logout
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb action={breadcrumbAction} items={breadcrumbs} />
      ) : null}

      <main className="tkt-main">{children}</main>
    </div>
  );
};
