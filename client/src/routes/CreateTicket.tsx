import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import {
  CreateTicketAttachments,
  type QueuedAttachmentRow,
} from "../components/CreateTicketAttachments";
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
  uploadAttachment,
} from "../lib/api";
import { validateAttachment } from "../lib/attachments";

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
 * Attachments are picked here (Issue #40) but not sent here: `POST
 * /api/tickets` stays JSON-only per `api-spec.md` §3, so a chosen file is held
 * in memory until the ticket has an id, then uploaded through the same
 * `POST /api/tickets/:id/attachments` endpoint Ticket Detail uses. A file that
 * fails client-side validation is never sent at all — see D-17 for what
 * happens when the ticket is created but one of its attachments then fails.
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

  const [attachments, setAttachments] = useState<QueuedAttachmentRow[]>([]);
  /** Assigns each picker row an id of its own — see `QueuedAttachmentRow`. */
  const nextAttachmentId = useRef(0);

  /** Filenames the ticket was created without, and why (D-17). */
  const [failedAttachments, setFailedAttachments] = useState<
    { filename: string; reason: string }[]
  >([]);

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
    setAttachments([]);
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

  /**
   * Validates a chosen file on the spot, the client half of BR-21 to BR-23.
   *
   * A file that fails is turned into an `invalid` row and never touches
   * `attachments`' queued files — it is never sent, on this submit or any
   * later one, unless the person chooses a different file for that slot.
   */
  const addAttachment = (file: File) => {
    const id = `attachment-${nextAttachmentId.current}`;
    nextAttachmentId.current += 1;
    const validation = validateAttachment(file);

    if (!validation.ok) {
      setAttachments((current) => [
        ...current,
        {
          id,
          kind: "invalid",
          filename: file.name,
          sizeBytes: file.size,
          reason: validation.reason,
        },
      ]);
      return;
    }

    setAttachments((current) => [...current, { id, kind: "queued", file }]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((row) => row.id !== id));
  };

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

      /*
       * The ticket exists now, so the queued files can finally be sent —
       * `POST /api/tickets/:id/attachments`, the same endpoint and the same
       * `uploadAttachment` call Ticket Detail uses, one request per file.
       *
       * Sequential rather than parallel, on purpose. Each upload does its own
       * `FOR UPDATE`-locked count check against BR-23's five-attachment
       * limit, and this ticket starts at zero: five requests fired at once
       * would all race that lock over the same empty ticket, and which files
       * "win" would depend on network timing rather than the order the
       * person picked them in. The limit is still enforced server-side
       * either way — this is about a predictable outcome, not about
       * avoiding a failure that cannot otherwise happen.
       *
       * A failure here is not a rejected submission (BR-18 does not apply):
       * the ticket is real, and D-17 is the record of that decision. So a
       * failed file is reported rather than retried automatically or rolled
       * back — the person retries it from Ticket Detail, which is where
       * every other post-creation attachment already goes through.
       */
      const failed: { filename: string; reason: string }[] = [];

      for (const row of attachments) {
        if (row.kind !== "queued") {
          continue;
        }

        setAttachments((current) =>
          current.map((entry) =>
            entry.id === row.id
              ? {
                  id: row.id,
                  kind: "uploading",
                  filename: row.file.name,
                  sizeBytes: row.file.size,
                }
              : entry
          )
        );

        try {
          await uploadAttachment(ticket.id, row.file, requester.id);
        } catch (error) {
          failed.push({
            filename: row.file.name,
            reason:
              error instanceof ApiError
                ? error.message
                : "The file could not be attached.",
          });
        }
      }

      setFailedAttachments(failed);
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

          {/*
            D-17. The ticket is real and correct even when an attachment
            failed to join it — BR-18 describes a rejected submission, and
            this is not one — so the failure is named rather than hidden, and
            View Ticket below is where it gets retried rather than here.
          */}
          {failedAttachments.length > 0 ? (
            <p className="tkt-callout tkt-callout--warning" role="alert">
              {failedAttachments.length === 1
                ? "One file could not be attached:"
                : `${failedAttachments.length} files could not be attached:`}
              <br />
              {failedAttachments
                .map((file) => `${file.filename} — ${file.reason}`)
                .join("; ")}{" "}
              Open the ticket below to try attaching them again.
            </p>
          ) : null}

          <div className="tkt-actions">
            <Button
              onClick={() => {
                setCreated(null);
                setDraft(EMPTY);
                setErrors({});
                setAttachments([]);
                setFailedAttachments([]);
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

        {/* ui-spec.md §5.2: "Then Summary and Description at full width,
            then attachments, then the actions." */}
        <CreateTicketAttachments
          disabled={submitting}
          onAdd={addAttachment}
          onRemove={removeAttachment}
          rows={attachments}
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
