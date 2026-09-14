import { createBrowserRouter, Navigate } from "react-router";

import App from "../App";
import { ChangePassword } from "./ChangePassword";
import { CreateTicket } from "./CreateTicket";
import { Login } from "./Login";
import { MyTickets } from "./MyTickets";
import { NotFound } from "./NotFound";
import { RequesterGuard } from "./RequesterGuard";
import { RequesterSelection } from "./RequesterSelection";
import { TicketDetail } from "./TicketDetail";

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
 * The ticket screens are deliberately *not* behind an authentication guard yet.
 * This is the expand half of the identity swap: sign-in exists, the selector
 * still works, and both run side by side for one ticket so that nothing is ever
 * broken between them. The guard arrives with the ticket that deletes the
 * selector.
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
  // Lab 3. Neither screen renders inside the shell: the sign-in screen has
  // nobody to show in the header, and the change-password screen must not offer
  // navigation the server would refuse (AC-02).
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/change-password",
    element: <ChangePassword />,
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
    element: guarded(<MyTickets />),
  },
  {
    path: "/tickets/:ticketId",
    element: guarded(<TicketDetail />),
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
