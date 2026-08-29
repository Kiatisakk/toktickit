import { createBrowserRouter, Navigate } from "react-router";

import App from "../App";
import { CreateTicket } from "./CreateTicket";
import { NotFound } from "./NotFound";
import { Placeholder } from "./Placeholder";
import { RequesterGuard } from "./RequesterGuard";
import { RequesterSelection } from "./RequesterSelection";

/**
 * The Lab 2 route table.
 *
 * Three routes still render a placeholder naming the Issue that delivers them.
 * The foundation Issue owns routing and the shell; each screen then arrives on
 * its own against its own acceptance criteria without also having to touch the
 * router.
 *
 * Everything requester-scoped sits behind `RequesterGuard`, so BR-10 holds for
 * every screen at once rather than being re-implemented per screen.
 *
 * `/system-status` keeps the Lab 1 vertical slice reachable and renders `App`
 * directly rather than inside the shell — `App` brings its own `<main>`, and
 * nesting one inside another is invalid. Its three Lab 1 tests import that
 * component directly and are unaffected by any of this.
 */
const guarded = (element: React.ReactNode) => (
  <RequesterGuard>{element}</RequesterGuard>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate replace to="/my-tickets" />,
  },
  {
    path: "/select-requester",
    element: <RequesterSelection />,
  },
  {
    path: "/tickets/new",
    element: guarded(<CreateTicket />),
  },
  {
    path: "/my-tickets",
    element: guarded(
      <Placeholder
        breadcrumbs={[{ label: "My Tickets" }]}
        description="Searching, filtering, sorting and paging through your own tickets."
        issue={18}
        title="My Tickets"
      />
    ),
  },
  {
    path: "/tickets/:ticketId",
    element: guarded(
      <Placeholder
        breadcrumbs={[
          { label: "My Tickets", to: "/my-tickets" },
          { label: "Ticket Details" },
        ]}
        description="Reading one owned ticket and managing its attachments."
        issue={19}
        title="Ticket Details"
      />
    ),
  },
  {
    path: "/system-status",
    element: <App />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
