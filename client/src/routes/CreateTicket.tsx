import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
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

type Reference =
  | { kind: "loading" }
  | { kind: "loaded"; categories: ReferenceItem[]; systems: ReferenceItem[] }
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
 * without a round trip, not so the server can trust the client (BR-09 in
 * spirit: frontend validation is a courtesy, backend validation is the rule).
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
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [reference, setReference] = useState<Reference>({ kind: "loading" });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTicket | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [categories, systems] = await Promise.all([
          fetchCategories(controller.signal),
          fetchRelatedSystems(controller.signal),
        ]);

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

  const set = (field: keyof Draft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!requester || reference.kind !== "loaded") {
      return;
    }

    const found = validate(draft);
    setErrors(found);
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
      <AppShell
        breadcrumbs={[
          { label: "My Tickets", to: "/my-tickets" },
          { label: "Create Ticket" },
        ]}
      >
        <div className="tkt-card">
          <StateBlock
            action={
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
                  onClick={() => void navigate("/my-tickets")}
                  variant="primary"
                >
                  Go to My Tickets
                </Button>
              </div>
            }
            description={`Your ticket number is ${created.ticketNumber}. Quote it when you follow this up.`}
            kind="empty"
            title="Ticket created"
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "My Tickets", to: "/my-tickets" },
        { label: "Create Ticket" },
      ]}
    >
      <h1 className="tkt-page-title">Create Ticket</h1>
      <p className="tkt-page-subtitle">
        Describe the problem and we will raise a ticket for you.
      </p>

      <form className="tkt-card" noValidate onSubmit={(e) => void onSubmit(e)}>
        {/* System-generated values, shown read-only so it is obvious they are
            not something to fill in (§8.2). */}
        <div className="tkt-grid tkt-grid--3">
          <TextInput
            label="Ticket No."
            readOnly
            value="Assigned when you submit"
          />
          <TextInput
            label="Ticket Date"
            readOnly
            value={new Date().toLocaleDateString()}
          />
          <TextInput label="Requester" readOnly value={requester?.name ?? ""} />
        </div>

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

        <div className="tkt-grid tkt-grid--3">
          <Select
            disabled={reference.kind !== "loaded"}
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
            placeholder={
              reference.kind === "loaded" ? "Choose a category" : "Loading…"
            }
            required
            value={draft.categoryId}
          />
          <Select
            disabled={reference.kind !== "loaded"}
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
            placeholder={
              reference.kind === "loaded"
                ? "Choose a related system"
                : "Loading…"
            }
            required
            value={draft.relatedSystemId}
          />
          <Select
            error={errors["requestedPriority"]}
            label="Requested Priority"
            onChange={(event) => set("requestedPriority")(event.target.value)}
            options={PRIORITIES}
            required
            value={draft.requestedPriority}
          />
        </div>

        <TextInput
          error={errors["summary"]}
          hint={`${LIMITS.summary.min}–${LIMITS.summary.max} characters.`}
          label="Summary"
          onChange={(event) => set("summary")(event.target.value)}
          required
          value={draft.summary}
        />

        <TextArea
          error={errors["description"]}
          hint={`${LIMITS.description.min}–${LIMITS.description.max} characters. Include what you were doing when it happened.`}
          label="Description"
          onChange={(event) => set("description")(event.target.value)}
          required
          value={draft.description}
        />

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
          <Button
            busy={submitting}
            busyLabel="Creating…"
            type="submit"
            variant="primary"
          >
            Create Ticket
          </Button>
        </div>
      </form>
    </AppShell>
  );
};
