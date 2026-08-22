import { createBrowserRouter, Navigate } from "react-router";

import App from "../App";
import { NotFound } from "./NotFound";
import { Placeholder } from "./Placeholder";

/**
 * The Lab 2 route table.
 *
 * Four of these render a placeholder today. The foundation Issue owns routing,
 * the shell and the shared components; each screen then arrives in its own
 * Issue against its own acceptance criteria, without also having to touch the
 * router.
 *
 * `/system-status` keeps the Lab 1 vertical slice reachable and renders `App`
 * directly rather than inside the shell — `App` brings its own `<main>`, and
 * nesting one inside another is invalid. Its three Lab 1 tests import that
 * component directly and are unaffected by any of this.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate replace to="/my-tickets" />,
  },
  {
    path: "/select-requester",
    element: (
      <Placeholder
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Development Requester Selection" },
        ]}
        description="Choosing which seeded Development Requester the application acts as."
        issue={16}
        title="Select Development Requester"
      />
    ),
  },
  {
    path: "/tickets/new",
    element: (
      <Placeholder
        breadcrumbs={[
          { label: "My Tickets", to: "/my-tickets" },
          { label: "Create Ticket" },
        ]}
        description="Describing a problem, attaching evidence and receiving a ticket number."
        issue={17}
        title="Create Ticket"
      />
    ),
  },
  {
    path: "/my-tickets",
    element: (
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
    element: (
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
