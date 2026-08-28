import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { StateBlock } from "../components/StateBlock";
import { useRequester } from "../context/useRequester";
import { fetchRequesters, type Requester } from "../lib/api";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; requesters: Requester[] }
  | { kind: "failed"; message: string };

/**
 * The Development Requester Selection screen (§8.1).
 *
 * This is **not a login screen** and the copy below says so twice, because the
 * one way this feature can mislead is by looking like authentication. §4.2 is
 * explicit that the selector is a testing mechanism, and BR-03 records it.
 *
 * Only active requesters appear, and they come from PostgreSQL rather than from
 * a constant — AC-01.
 */
export const RequesterSelection = () => {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState("");
  const { select, requester: current } = useRequester();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setState({ kind: "loading" });

      try {
        const requesters = await fetchRequesters(controller.signal);
        setState({ kind: "loaded", requesters });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          kind: "failed",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load Development Requesters.",
        });
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, []);

  const onContinue = () => {
    if (state.kind !== "loaded") {
      return;
    }

    const chosen = state.requesters.find(
      (candidate) => String(candidate.id) === selectedId
    );

    if (!chosen) {
      return;
    }

    select(chosen);
    void navigate("/my-tickets");
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "Home", to: "/" },
        { label: "Development Requester Selection" },
      ]}
    >
      <div className="tkt-card tkt-select-card">
        <h1 className="tkt-page-title">Select Development Requester</h1>

        <p className="tkt-page-subtitle">
          Choose a Development Requester to test requester-specific ticket
          behaviour for Lab&nbsp;2. <strong>This is not a login screen.</strong>
        </p>

        {state.kind === "loading" ? (
          <>
            <StateBlock
              description="Reading active Development Requesters from the database."
              kind="loading"
              title="Loading requesters…"
            />
            {/*
              §8.1 lists Continue among the screen's required elements, so it is
              present from the first render rather than appearing once the fetch
              resolves. Disabled, because there is nothing to continue with yet.
            */}
            <div className="tkt-actions">
              <Button disabled variant="primary">
                Continue
              </Button>
            </div>
          </>
        ) : null}

        {state.kind === "failed" ? (
          <StateBlock
            action={
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Try again
              </Button>
            }
            description={state.message}
            kind="error"
            title="Could not load Development Requesters"
          />
        ) : null}

        {state.kind === "loaded" && state.requesters.length === 0 ? (
          <StateBlock
            action={
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Check again
              </Button>
            }
            description="No active Development Requester exists yet. Run npm run db:seed to create the seeded identities, then check again."
            kind="empty"
            title="No requesters available"
          />
        ) : null}

        {state.kind === "loaded" && state.requesters.length > 0 ? (
          <>
            <Select
              hint="Only active Development Requesters are shown."
              label="Development Requester"
              onChange={(event) => setSelectedId(event.target.value)}
              options={state.requesters.map((candidate) => ({
                value: String(candidate.id),
                label: candidate.name,
              }))}
              placeholder="Choose a Development Requester"
              required
              value={selectedId}
            />

            <p className="tkt-notice">
              <strong>Authentication arrives in Lab 3.</strong> This selection
              will be replaced by secure sign-in, so you access the system with
              your own account. Nothing chosen here is authenticated, and the
              identity is not protected.
            </p>

            <div className="tkt-actions">
              {/*
                Cancel appears only when a requester is already selected, which
                is the "change my mind" case. With none selected there is
                nowhere to cancel to: every other screen is guarded, so "/"
                would redirect to My Tickets, which would redirect straight back
                here. A button that cannot go anywhere is worse than no button,
                and §8.1 does not list Cancel among the required elements.
              */}
              {current ? (
                <Button
                  onClick={() => void navigate("/my-tickets")}
                  variant="secondary"
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                disabled={selectedId === ""}
                onClick={onContinue}
                variant="primary"
              >
                Continue
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
};
