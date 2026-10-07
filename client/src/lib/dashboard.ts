import { useCallback, useEffect, useState } from "react";
import type { To } from "react-router";

import { useAuth } from "../context/useAuth";
import { ApiError, type Dashboard, type DashboardCard } from "./api";

/**
 * What a dashboard screen is showing (ui-spec.md sections 3 and 4).
 *
 * `forbidden` is its own state, not a kind of failure: a 403 cannot be retried
 * into success, so offering Try again would repeat a request that can only be
 * refused.
 */
export type DashboardState =
  | { kind: "loading" }
  | { kind: "loaded"; data: Dashboard }
  | { kind: "failed" }
  | { kind: "forbidden" };

const aborted = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

/**
 * Loads one dashboard, and reloads it on request.
 *
 * `refreshing` is true while a reload is in flight and the previous figures are
 * still on screen: the figures stay until the new ones arrive (ui-spec.md
 * section 3, "Refreshing"), rather than the whole screen blanking.
 */
export const useDashboard = (
  fetcher: (signal: AbortSignal) => Promise<Dashboard>
) => {
  const { refresh } = useAuth();
  const [state, setState] = useState<DashboardState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    // A refresh keeps what is on screen, which is why `state` is not reset
    // here: `retry` does that itself when the placeholders are wanted again.
    // oxlint-disable-next-line react/set-state-in-effect
    setRefreshing(true);

    fetcher(controller.signal)
      .then((data) => {
        setState({ kind: "loaded", data });
        setRefreshing(false);
      })
      .catch((error: unknown) => {
        if (aborted(error)) {
          return;
        }

        setRefreshing(false);

        if (error instanceof ApiError && error.status === 403) {
          setState({ kind: "forbidden" });
          return;
        }

        // An ended session is a failure here too, but the route guard has to
        // hear about it, so who is signed in is re-read.
        if (error instanceof ApiError && error.status === 401) {
          void refresh();
        }

        setState({ kind: "failed" });
      });

    return () => {
      controller.abort();
    };
  }, [fetcher, reloadToken, refresh]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  /** Try again after a failure goes back to the placeholders first. */
  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  return { state, refreshing, reload, retry };
};

/**
 * The words for a delta, shared by the visible line and the accessible name
 * (ui-spec.md section 3): an arrow and a sign for sighted users, and the same
 * meaning in words for everyone, so the figure survives without colour.
 */
export const deltaPhrase = (delta: number): string => {
  if (delta === 0) {
    return "no change from yesterday";
  }

  return `${delta > 0 ? "up" : "down"} ${Math.abs(delta)} from yesterday`;
};

/** The visible delta line: arrow, sign and words. */
export const deltaLine = (delta: number): string => {
  if (delta === 0) {
    return "No change from yesterday";
  }

  return delta > 0
    ? `▲ +${delta} from yesterday`
    : `▼ −${Math.abs(delta)} from yesterday`;
};

/** "New, 14 tickets, up 3 from yesterday" (ui-spec.md section 3). */
export const cardName = (card: DashboardCard): string => {
  const noun = card.count === 1 ? "ticket" : "tickets";
  const base = `${card.label}, ${card.count} ${noun}`;

  return card.delta === null ? base : `${base}, ${deltaPhrase(card.delta)}`;
};

/** The router location a drill-down names, with its query as the API gave it. */
export const drillDownTo = (drillDown: {
  path: string;
  query?: Record<string, string> | undefined;
}): To => {
  const search = new URLSearchParams(drillDown.query ?? {}).toString();

  return search === ""
    ? { pathname: drillDown.path }
    : { pathname: drillDown.path, search: `?${search}` };
};
