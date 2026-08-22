import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { fetchRequesters, type Requester } from "../lib/api";
import {
  RequesterContext,
  type RequesterContextValue,
  type RequesterStatus,
} from "./requesterContextValue";
import {
  clearStoredRequesterId,
  readStoredRequesterId,
  writeStoredRequesterId,
} from "./requesterStorage";

/**
 * Holds which Development Requester the application is acting as.
 *
 * On mount it re-resolves the stored id against `/api/requesters` rather than
 * trusting what is in storage. That extra request is what makes BR-07 hold
 * across a reload — an id that has since been deactivated is no longer in the
 * active list, so it resolves to nothing and the selection screen returns.
 *
 * This is not a session and not a login. See BR-03.
 */
export const RequesterProvider = ({ children }: { children: ReactNode }) => {
  // Read storage during the first render rather than in an effect. With nothing
  // stored there is nothing to resolve, and starting at "resolving" only to
  // correct it immediately would render the loading state for one frame and
  // trigger a second render for no reason.
  const [storedId] = useState<number | null>(readStoredRequesterId);
  const [status, setStatus] = useState<RequesterStatus>(
    storedId === null ? "none" : "resolving"
  );
  const [requester, setRequester] = useState<Requester | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (storedId === null) {
      return;
    }

    const controller = new AbortController();

    const resolve = async () => {
      try {
        const requesters = await fetchRequesters(controller.signal);
        const match = requesters.find((candidate) => candidate.id === storedId);

        if (match) {
          setRequester(match);
          setStatus("selected");
          return;
        }

        // Deactivated, deleted, or carried over from another machine.
        clearStoredRequesterId();
        setStatus("none");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        // The API is unreachable, so the stored identity cannot be confirmed.
        // Acting as an unverified one is exactly what BR-07 forbids.
        setStatus("none");
      }
    };

    void resolve();

    return () => {
      controller.abort();
    };
  }, [storedId]);

  const select = useCallback((next: Requester) => {
    writeStoredRequesterId(next.id);
    setRequester(next);
    setStatus("selected");
    setGeneration((current) => current + 1);
  }, []);

  const clear = useCallback(() => {
    clearStoredRequesterId();
    setRequester(null);
    setStatus("none");
    setGeneration((current) => current + 1);
  }, []);

  const value = useMemo<RequesterContextValue>(
    () => ({ status, requester, generation, select, clear }),
    [status, requester, generation, select, clear]
  );

  return (
    <RequesterContext.Provider value={value}>
      {children}
    </RequesterContext.Provider>
  );
};
