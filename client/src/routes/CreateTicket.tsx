import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Select } from "../components/Select";
import { StateBlock } from "../components/StateBlock";
import { TextArea } from "../components/TextArea";
import { TextInput } from "../components/TextInput";
import { useRequester } from "../context/useRequester";
import {
  ApiError,
  type CreatedTicket,
  createTicket,
  fetchCategories,
  fetchRelatedSystems,
  type ReferenceItem,
} from "../lib/api";

/** Mirrors the server's limits so the message appears before a round trip. */
const LIMITS = {
  summary: { min: 5, max: 150 },
  description: { min: 10, max: 5000 },
} as const;

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const BREADCRUMBS = [
  { label: "My Tickets", to: "/my-tickets" },
  { label: "Create Ticket" },
];

type Reference =
  | { kind: "loading" }
  | { kind: "loaded"; categories: ReferenceItem[]; systems: ReferenceItem[] }
  /** Loaded successfully but with nothing to offer — a seed that never ran. */
  | { kind: "empty" }
  | { kind: "failed" };

interface Draft {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  description: string;
  requestedPriority: string;
}

const EMPTY: Draft = {
  categoryId: "",
  relatedSystemId: "",
  summary: "",
  description: "",
  requestedPriority: "MEDIUM",
};

/**
 * Validates the draft the same way the server does.
 *
 * The server stays authoritative — this exists so an obvious mistake is caught
 * without a round trip, not so the server can trust the client.
 */
const validate = (draft: Draft): Record<string, string> => {
  const errors: Record<string, string> = {};
  const summary = draft.summary.trim();
  const description = draft.description.trim();

  if (draft.categoryId === "") {
    errors["categoryId"] = "Category is required.";
  }

  if (draft.relatedSystemId === "") {
    errors["relatedSystemId"] = "Related system is required.";
  }

  if (summary === "") {
    errors["summary"] = "Summary is required.";
  } else if (
    summary.length < LIMITS.summary.min ||
    summary.length > LIMITS.summary.max
  ) {
    errors["summary"] =
      `Summary must be between ${LIMITS.summary.min} and ${LIMITS.summary.max} characters.`;
  }

  if (description === "") {
    errors["description"] = "Description is required.";
  } else if (
    description.length < LIMITS.description.min ||
    description.length > LIMITS.description.max
  ) {
    errors["description"] =
      `Description must be between ${LIMITS.description.min} and ${LIMITS.description.max} characters.`;
  }

  return errors;
};

/**
 * The Create Ticket screen (§8.2).
 *
 * Attachments are not here. They arrive with the Ticket Detail Issue, where the
 * upload endpoint they need is built; this screen creates the ticket itself.
 */
export const CreateTicket = () => {
  const { requester, generation } = useRequester();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [reference, setReference] = useState<Reference>({ kind: "loading" });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTicket | null>(null);

  /*
   * BR-09: a draft written as one Requester is never submitted as another.
   *
   * Today the rule also holds by accident — Change Requester navigates away and
   * the component unmounts, taking the draft with it. That is the routing doing
   * it, not the rule being enforced, and it stops being true the moment
   * anything switches identity without leaving the page. The guard puts the
   * rule where the rule lives.
   *
   * `generation` rather than `requester.id`, because it also bumps when the
   * same person is re-selected, which is still a new context.
   */
  const seen = useRef(generation);

  useEffect(() => {
    if (seen.current === generation) {
      return;
    }

    seen.current = generation;
    setDraft(EMPTY);
    setErrors({});
    void navigate("/my-tickets");
  }, [generation, navigate]);

  /** Bumped on every rejected submit so repeated failures re-focus. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [categories, systems] = await Promise.all([
          fetchCategories(controller.signal),
          fetchRelatedSystems(controller.signal),
        ]);

        // An empty list is a successful response, but there is nothing to
        // choose from — rendering a blank dropdown would leave the user with a
        // form that cannot be completed and no reason why.
        if (categories.length === 0 || systems.length === 0) {
          setReference({ kind: "empty" });
          return;
        }

        setReference({ kind: "loaded", categories, systems });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setReference({ kind: "failed" });
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, []);

  // ui-spec.md §8: "the first invalid control receives focus on a failed
  // submit". Done by querying rather than by holding a ref per field, because
  // the field components own their ids and the first invalid one is whichever
  // appears first in the document — which is the reading order a keyboard user
  // is following.
  useEffect(() => {
    if (Object.keys(errors).length === 0) {
      return;
    }

    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]'
    );

    firstInvalid?.focus();
  }, [errors, attempt]);

  const set = (field: keyof Draft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const usable = reference.kind === "loaded";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!requester || !usable) {
      return;
    }

    const found = validate(draft);
    setErrors(found);
    setAttempt((current) => current + 1);
    setFailure(null);

    if (Object.keys(found).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const ticket = await createTicket(
        {
          categoryId: Number(draft.categoryId),
          relatedSystemId: Number(draft.relatedSystemId),
          summary: draft.summary.trim(),
          description: draft.description.trim(),
          requestedPriority: draft.requestedPriority,
        },
        requester.id
      );

      setCreated(ticket);
    } catch (error) {
      // BR-19: whatever went wrong, the draft stays on screen. `draft` is
      // untouched here on purpose — retyping a five-hundred-word description
      // because a connection dropped is the failure people actually remember.
      if (error instanceof ApiError && error.details) {
        setErrors(error.details);
      }

      setFailure(
        error instanceof Error
          ? error.message
          : "The ticket could not be created."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <AppShell breadcrumbs={BREADCRUMBS}>
        <h1 className="tkt-page-title">Ticket created</h1>
        <p className="tkt-page-subtitle">
          Your request has been raised and is waiting to be picked up.
        </p>

        <div className="tkt-card">
          <p className="tkt-callout tkt-callout--success" role="status">
            <span aria-hidden="true">✓</span> Ticket{" "}
            <strong>{created.ticketNumber}</strong> was created. Quote that
            number when you follow this up.
          </p>

          <dl className="tkt-summary">
            <dt>Ticket No.</dt>
            <dd>{created.ticketNumber}</dd>
            <dt>Summary</dt>
            <dd>{created.summary}</dd>
            <dt>Current Status</dt>
            <dd>{created.currentStatus}</dd>
          </dl>

          <div className="tkt-actions">
            <Button
              onClick={() => {
                setCreated(null);
                setDraft(EMPTY);
                setErrors({});
              }}
              variant="secondary"
            >
              Create another
            </Button>
            <Button
              onClick={() => void navigate(`/tickets/${created.id}`)}
              variant="primary"
            >
              View Ticket
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  /**
   * Why the control cannot be used, rather than a single word for three
   * different situations. "Loading…" on a list that failed to load is a promise
   * the screen is not keeping.
   */
  const choosePlaceholder = (noun: string) => {
    if (usable) {
      return `Choose a ${noun}`;
    }

    if (reference.kind === "loading") {
      return "Loading…";
    }

    return "Unavailable";
  };

  return (
    <AppShell breadcrumbs={BREADCRUMBS}>
      <h1 className="tkt-page-title">Create Ticket</h1>
      <p className="tkt-page-subtitle">
        Describe the problem and we will raise a ticket for you.
      </p>

      <form
        className="tkt-card"
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        ref={formRef}
      >
        {reference.kind === "failed" ? (
          <StateBlock
            action={
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Try again
              </Button>
            }
            description="Categories and related systems could not be loaded, so the form cannot be filled in yet."
            kind="error"
            title="Could not load the form"
          />
        ) : null}

        {reference.kind === "empty" ? (
          <StateBlock
            action={
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Check again
              </Button>
            }
            description="No categories or related systems have been set up yet. Run npm run db:seed to create the reference data, then check again."
            kind="empty"
            title="Nothing to file a ticket against"
          />
        ) : null}

        {/*
          One grid, in Figure 1's order: identification and classification
          across the first two rows, then the owner beside a wide Summary, then
          Description and Resolution Summary at full width.

          It is rendered whatever the reference data is doing. An earlier
          version hid the classification controls until they had loaded, which
          made the form change shape twice on the way in and put Category on a
          different row from the one it belongs on. The controls are disabled
          instead, which says the same thing without moving anything.

          Every read-only field here is one the act of creating settles:
          the number and date are assigned on save, the requester is who is
          signed in, and BR-02 fixes the status at New.

          Figure 1 also carries IT Priority, Ticket Owner and Resolution
          Summary. They are not here, because nothing on a create form can ever
          fill them: all three are set by work §4.2 excludes from Lab 2, so on
          this screen they would be three permanently empty boxes on a form
          whose job is to collect input. They belong to Ticket Detail (§8.5),
          which is where Figure 1 is a picture of, and to Issue #19.
        */}
        <div className="tkt-grid tkt-grid--4">
          <TextInput
            label="Ticket No."
            readOnly
            value="Assigned when you submit"
          />
          <TextInput label="Ticket Date" readOnly value="Set when you submit" />
          <Select
            disabled={!usable}
            error={errors["categoryId"]}
            label="Category"
            onChange={(event) => set("categoryId")(event.target.value)}
            options={
              reference.kind === "loaded"
                ? reference.categories.map((item) => ({
                    value: String(item.id),
                    label: item.name,
                  }))
                : []
            }
            placeholder={choosePlaceholder("category")}
            required
            value={draft.categoryId}
          />
          <Select
            disabled={!usable}
            error={errors["relatedSystemId"]}
            label="Related System"
            onChange={(event) => set("relatedSystemId")(event.target.value)}
            options={
              reference.kind === "loaded"
                ? reference.systems.map((item) => ({
                    value: String(item.id),
                    label: item.name,
                  }))
                : []
            }
            placeholder={choosePlaceholder("related system")}
            required
            value={draft.relatedSystemId}
          />

          <TextInput label="Requester" readOnly value={requester?.name ?? ""} />
          <Select
            disabled={!usable}
            error={errors["requestedPriority"]}
            label="Requested Priority"
            onChange={(event) => set("requestedPriority")(event.target.value)}
            options={PRIORITIES}
            required
            value={draft.requestedPriority}
          />
          <TextInput label="Current Status" readOnly value="New" />

          {/* Full width. A one-line summary of the problem is the field a
              reader scans the list by, and giving it the width of a name would
              encourage the wrong length. */}
          <div className="tkt-span-4">
            <TextInput
              disabled={!usable}
              error={errors["summary"]}
              hint={`${LIMITS.summary.min}–${LIMITS.summary.max} characters.`}
              label="Summary"
              onChange={(event) => set("summary")(event.target.value)}
              required
              value={draft.summary}
            />
          </div>

          <div className="tkt-span-4">
            <TextArea
              disabled={!usable}
              error={errors["description"]}
              hint={`${LIMITS.description.min}–${LIMITS.description.max} characters. Include what you were doing when it happened.`}
              label="Description"
              onChange={(event) => set("description")(event.target.value)}
              required
              value={draft.description}
            />
          </div>
        </div>

        {failure ? (
          <p className="tkt-callout tkt-callout--error" role="alert">
            {failure} Nothing you typed has been lost — try again when you are
            ready.
          </p>
        ) : null}

        <div className="tkt-actions">
          <Button
            disabled={submitting}
            onClick={() => void navigate("/my-tickets")}
            variant="secondary"
          >
            Cancel
          </Button>
          {/* Disabled until the form can actually be completed. Leaving it
              enabled while the reference data is missing gives a control that
              looks live and silently does nothing, which is worse than one that
              is visibly unavailable. */}
          <Button
            busy={submitting}
            busyLabel="Creating…"
            disabled={!usable}
            type="submit"
            variant="primary"
          >
            <Icon name="create" />
            Create Ticket
          </Button>
        </div>
      </form>
    </AppShell>
  );
};
