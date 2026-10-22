import { useAuth } from "../context/useAuth";
import { RequesterDashboard } from "./RequesterDashboard";
import { StaffDashboard } from "./StaffDashboard";

/**
 * `/dashboard`, the landing page for every role (FR-21, D-12).
 *
 * The role chooses the view and nothing else: a Requester gets their own
 * dashboard, IT Staff and Administrators the operational one. The server refuses
 * the other combination 403 whatever this screen does (BR-28), so this is a
 * convenience, not the boundary.
 */
export const Dashboard = () => {
  const { user } = useAuth();

  return user?.role === "REQUESTER" ? (
    <RequesterDashboard />
  ) : (
    <StaffDashboard />
  );
};
