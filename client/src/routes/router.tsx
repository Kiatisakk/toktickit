import { createBrowserRouter, Navigate } from "react-router";

import App from "../App";
import { AuthGuard } from "./AuthGuard";
import { ChangePassword } from "./ChangePassword";
import { CreateTicket } from "./CreateTicket";
import { Login } from "./Login";
import { MyTickets } from "./MyTickets";
import { NotFound } from "./NotFound";
import { TicketDetail } from "./TicketDetail";
import { UserManagement } from "./UserManagement";

/**
 * The route table.
 *
 * Every application screen sits behind `AuthGuard`, so a signed-out visitor is
 * sent to sign in and a gated user to the change-password screen, for every
 * screen at once rather than per screen. The Development Requester selection
 * screen and its route are gone (BR-41); nothing replaces them — sign-in sits in
 * front of the whole application rather than inside it (ui-spec.md §2).
 *
 * `/system-status` keeps the Lab 1 vertical slice reachable and renders `App`
 * directly rather than inside the shell — `App` brings its own `<main>`, and
 * nesting one inside another is invalid. It is guarded like every other screen:
 * its verdict needs the categories as well as the health endpoint (CONTEXT.md),
 * and the categories need a session. An earlier version left it unguarded on the
 * belief that it called only the public health endpoint, and a signed-out check
 * reported a healthy system as Offline.
 */
const guarded = (element: React.ReactNode) => <AuthGuard>{element}</AuthGuard>;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate replace to="/my-tickets" />,
  },
  // Neither screen renders the application shell: the sign-in screen has
  // nobody to show in the header, and the change-password screen must not offer
  // navigation the server would refuse (AC-02).
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/change-password",
    element: (
      <AuthGuard area="password-change">
        <ChangePassword />
      </AuthGuard>
    ),
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
  // Administrator only. The destination is absent from every other role's
  // navigation and the route redirects them (ui-spec.md §8).
  {
    path: "/admin/users",
    element: (
      <AuthGuard roles={["ADMIN"]}>
        <UserManagement />
      </AuthGuard>
    ),
  },
  {
    path: "/system-status",
    element: guarded(<App />),
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
