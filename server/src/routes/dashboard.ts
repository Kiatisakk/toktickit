import type { Request, Response } from "express";
import { Router } from "express";

import {
  buildRequesterDashboard,
  buildStaffDashboard,
} from "../dashboard/metrics.js";
import type { Dashboard } from "../dashboard/metrics.js";
import { ErrorCode, sendError, sendInternalError } from "../http/errors.js";
import { requireRole } from "../middleware/role.js";
import { currentUser, requireSignedIn } from "../middleware/session.js";

/**
 * The two dashboards (api-spec.md section 7).
 *
 * Each is for its own roles only and answers `403` to the others (BR-28). Both
 * take no query parameters at all: the caller is the session, and a parameter
 * that named anyone else would be an invitation to ask for their numbers
 * (BR-22), so any parameter is refused rather than ignored.
 */
export const dashboardRouter = Router();

const refuseParameters = (req: Request, res: Response): boolean => {
  const names = Object.keys(req.query);

  if (names.length === 0) {
    return false;
  }

  sendError(
    res,
    400,
    ErrorCode.invalidQueryParameter,
    "One or more query parameters are not valid.",
    Object.fromEntries(
      names.map((name) => [
        name,
        `${name} is not a recognised query parameter.`,
      ])
    )
  );

  return true;
};

const serve =
  (build: (callerId: number) => Promise<Dashboard>, context: string) =>
  async (req: Request, res: Response): Promise<void> => {
    if (refuseParameters(req, res)) {
      return;
    }

    try {
      res.status(200).json(await build(currentUser(res).id));
    } catch (error) {
      sendInternalError(res, context, error);
    }
  };

dashboardRouter.get(
  "/dashboard/staff",
  ...requireSignedIn,
  requireRole("IT_STAFF", "ADMIN"),
  serve(buildStaffDashboard, "Failed to build the staff dashboard")
);

dashboardRouter.get(
  "/dashboard/requester",
  ...requireSignedIn,
  requireRole("REQUESTER"),
  serve(buildRequesterDashboard, "Failed to build the Requester dashboard")
);
