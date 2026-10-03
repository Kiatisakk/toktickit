import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { useAuth } from "../context/useAuth";
import {
  type ActionFields,
  createAction,
  fetchStaffOwners,
  type ReferenceItem,
  type TicketAction,
  updateAction,
} from "../lib/api";
import { useActionWrite } from "../lib/useActionWrite";
import { Button } from "./Button";
import { Select } from "./Select";
import { TextArea } from "./TextArea";
import { TextInput } from "./TextInput";

/**
 * The Create and Edit form for an Action (ui-spec.md section 6).
 *
 * One form for both, because section 6 describes Edit as "the create form,
 * filled". The two differences are the ones the contract fixes: a new Action
 * carries a request key and may name the Action it follows up; an edit sends
 * the version it read and shows that link read-only (BR-10).
 */

const DESCRIPTION_LIMIT = 2000;
const RESULT_LIMIT = 2000;
const NOTE_LIMIT = 1000;
const ATTACHMENT_NOTES_LIMIT = 1000;
const MS_PER_MINUTE = 60_000;

const FORM_FIELDS = [
  "actionAt",
  "description",
  "result",
  "performedById",
  "followUpRequired",
  "followUpNote",
  "followsUpId",
  "attachmentNotes",
] as const;

/** `YYYY-MM-DDTHH:mm`, local time: what a datetime-local control reads and writes. */
const toLocalInput = (value: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

type Errors = Partial<Record<(typeof FORM_FIELDS)[number], string>>;

interface Draft {
  actionAt: string;
  description: string;
  result: string;
  performedById: string;
  followUpRequired: boolean;
  followUpNote: string;
  followsUpId: string;
  attachmentNotes: string;
}

const emptyToNull = (text: string): string | null => {
  const trimmed = text.trim();

  return trimmed === "" ? null : trimmed;
};

/** What is wrong with the draft before a request is worth making. */
const problems = (draft: Draft, initialActionAt: string): Errors => {
  const found: Errors = {};

  if (Number.isNaN(new Date(draft.actionAt).getTime())) {
    found.actionAt = "Enter a valid date and time.";
  } else if (
    draft.actionAt !== initialActionAt &&
    new Date(draft.actionAt).getTime() > Date.now() + MS_PER_MINUTE
  ) {
    // Only a date the person changed: an Action already stored is not theirs to
    // refuse again, and the server holds the real rule (api-spec.md section 4).
    found.actionAt = "The date and time cannot be in the future.";
  }

  const description = draft.description.trim();

  if (description === "") {
    found.description = "Enter a description.";
  } else if (description.length > DESCRIPTION_LIMIT) {
    found.description = `Keep the description to ${DESCRIPTION_LIMIT} characters or fewer.`;
  }

  if (draft.result.trim().length > RESULT_LIMIT) {
    found.result = `Keep the result to ${RESULT_LIMIT} characters or fewer.`;
  }

  const note = draft.followUpNote.trim();

  if (draft.followUpRequired && note === "") {
    found.followUpNote = "Say what the follow-up is.";
  } else if (draft.followUpRequired && note.length > NOTE_LIMIT) {
    found.followUpNote = `Keep the note to ${NOTE_LIMIT} characters or fewer.`;
  }

  if (draft.attachmentNotes.trim().length > ATTACHMENT_NOTES_LIMIT) {
    found.attachmentNotes = `Keep the attachment notes to ${ATTACHMENT_NOTES_LIMIT} characters or fewer.`;
  }

  return found;
};

const draftFor = (action: TicketAction | null, userId: number): Draft => ({
  actionAt: toLocalInput(action ? new Date(action.actionAt) : new Date()),
  description: action?.description ?? "",
  result: action?.result ?? "",
  performedById: String(action?.performedBy.id ?? userId),
  followUpRequired: action?.followUpRequired ?? false,
  followUpNote: action?.followUpNote ?? "",
  followsUpId: action?.followsUpId ? String(action.followsUpId) : "",
  attachmentNotes: action?.attachmentNotes ?? "",
});

const newRequestId = () => crypto.randomUUID();

interface ActionFormProps {
  ticketId: number;
  /** The Action being edited, or `null` for a new one. */
  editing: TicketAction | null;
  /** The Ticket's Actions, for the "Follows up" choices and the read-only link. */
  actions: TicketAction[];
  /** The latest copy of the Action being edited, so a retry names the newest version. */
  latestOf: (id: number) => TicketAction | undefined;
  reloadActions: () => Promise<TicketAction[] | null>;
  reloadTicket: () => Promise<boolean>;
  onSaved: (action: TicketAction) => void;
  onRefused: (message: string) => void;
  onCancel: () => void;
}

export const ActionForm = ({
  ticketId,
  editing,
  actions,
  latestOf,
  reloadActions,
  reloadTicket,
  onSaved,
  onRefused,
  onCancel,
}: ActionFormProps) => {
  const { user } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const alertId = useId();
  const userId = user?.id ?? 0;

  const [draft, setDraft] = useState<Draft>(() => draftFor(editing, userId));
  // The prefilled date is compared with at submit time: an edit that did not
  // touch the date must not rewrite it from a value that lost its seconds.
  const [initialActionAt] = useState(draft.actionAt);
  const [clientErrors, setClientErrors] = useState<Errors>({});
  const [owners, setOwners] = useState<ReferenceItem[]>([]);

  // One key for this Action, kept across every retry (AC-48, BR-35). The form
  // is mounted fresh for each new Action, which is what "opened afresh" means;
  // only a key the server has used for something else is replaced.
  const requestId = useRef(newRequestId());

  useEffect(() => {
    const controller = new AbortController();

    fetchStaffOwners(controller.signal)
      .then(setOwners)
      .catch(() => {
        // The select still holds the current performer; a failed list only
        // narrows the choices, and the server refuses an ineligible one.
      });

    return () => {
      controller.abort();
    };
  }, []);

  const write = useActionWrite({
    fields: FORM_FIELDS,
    reloadActions,
    reloadTicket,
    onSaved,
    onRefused,
    ...(editing ? { actionId: editing.id } : {}),
    onRequestIdConflict: () => {
      requestId.current = newRequestId();
    },
  });

  const set = <K extends keyof Draft>(name: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setClientErrors((current) => ({ ...current, [name]: undefined }));
    write.clearFieldError(name);
  };

  const focusField = (name: string) => {
    formRef.current
      ?.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`)
      ?.focus();
  };

  const errors: Errors = { ...write.fieldErrors, ...clientErrors };

  const fields = (): ActionFields => {
    const base: ActionFields = {
      description: draft.description.trim(),
      result: emptyToNull(draft.result),
      performedById: Number(draft.performedById),
      followUpRequired: draft.followUpRequired,
      followUpNote: draft.followUpRequired
        ? emptyToNull(draft.followUpNote)
        : null,
      attachmentNotes: emptyToNull(draft.attachmentNotes),
    };

    if (!editing || draft.actionAt !== initialActionAt) {
      base.actionAt = new Date(draft.actionAt).toISOString();
    }

    return base;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const found = problems(draft, initialActionAt);

    setClientErrors(found);

    const invalid = FORM_FIELDS.find((name) => found[name]);

    if (invalid) {
      focusField(invalid);
      return;
    }

    const body = fields();
    const followsUpId =
      draft.followsUpId === "" ? null : Number(draft.followsUpId);

    const refused = await write.submit(() => {
      if (editing) {
        // The newest copy, not the one the form opened with: after a stale
        // refusal and a reload, the retry must name the version now stored.
        const version = latestOf(editing.id)?.version ?? editing.version;

        return updateAction(editing.id, version, body);
      }

      return createAction(ticketId, requestId.current, body, followsUpId);
    });

    if (refused.length > 0) {
      focusField(refused[0] ?? "");
    }
  };

  const followUpTargets = actions.filter(
    (one) => one.followUpRequired && one.state !== "CANCELLED"
  );
  const linked = editing?.followsUpId
    ? actions.find((one) => one.id === editing.followsUpId)
    : undefined;

  const performers = [...owners];

  for (const known of [
    user ? { id: user.id, name: user.name } : null,
    editing?.performedBy ?? null,
  ]) {
    if (known && !performers.some((one) => one.id === known.id)) {
      performers.push(known);
    }
  }

  const heading = editing ? `Edit action #${editing.id}` : "Add action";

  return (
    <form
      aria-describedby={write.alert ? alertId : undefined}
      aria-label={heading}
      className="tkt-action-form"
      noValidate
      onSubmit={onSubmit}
      ref={formRef}
    >
      <h3 className="tkt-action-form__title">{heading}</h3>

      <div className="tkt-action-form__grid">
        <TextInput
          error={errors.actionAt}
          label="Date/time"
          name="actionAt"
          onChange={(event) => set("actionAt", event.target.value)}
          required
          type="datetime-local"
          value={draft.actionAt}
        />

        <Select
          error={errors.performedById}
          label="Performed by"
          name="performedById"
          onChange={(event) => set("performedById", event.target.value)}
          options={performers.map((one) => ({
            value: String(one.id),
            label: one.name,
          }))}
          required
          value={draft.performedById}
        />

        <div className="tkt-action-form__wide">
          <TextArea
            error={errors.description}
            hint={`Up to ${DESCRIPTION_LIMIT} characters.`}
            label="Description"
            name="description"
            onChange={(event) => set("description", event.target.value)}
            required
            rows={3}
            value={draft.description}
          />
        </div>

        <div className="tkt-action-form__wide">
          <TextArea
            error={errors.result}
            label="Result"
            name="result"
            onChange={(event) => set("result", event.target.value)}
            rows={3}
            value={draft.result}
          />
        </div>

        <div className="tkt-action-form__wide tkt-checkbox-field">
          <input
            checked={draft.followUpRequired}
            id={`${alertId}-follow-up`}
            name="followUpRequired"
            onChange={(event) => set("followUpRequired", event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={`${alertId}-follow-up`}>Follow-up required</label>
          {errors.followUpRequired ? (
            <p className="tkt-field-error" role="alert">
              {errors.followUpRequired}
            </p>
          ) : null}
        </div>

        {draft.followUpRequired ? (
          <div className="tkt-action-form__wide">
            <TextArea
              error={errors.followUpNote}
              label="Follow-up note"
              name="followUpNote"
              onChange={(event) => set("followUpNote", event.target.value)}
              required
              rows={2}
              value={draft.followUpNote}
            />
          </div>
        ) : null}

        {editing ? (
          <div className="tkt-action-form__wide">
            <span className="tkt-field-label">Follows up</span>
            <p className="tkt-readonly-block">
              {editing.followsUpId
                ? `Action #${editing.followsUpId}${linked ? `: ${linked.description}` : ""}`
                : "Not linked to another action"}
            </p>
            <p className="tkt-field-hint">
              The link is fixed when an action is created.
            </p>
          </div>
        ) : (
          <div className="tkt-action-form__wide">
            <Select
              error={errors.followsUpId}
              label="Follows up"
              name="followsUpId"
              onChange={(event) => set("followsUpId", event.target.value)}
              options={[
                { value: "", label: "None" },
                ...followUpTargets.map((one) => ({
                  value: String(one.id),
                  label: `#${one.id}: ${one.description}`,
                })),
              ]}
              value={draft.followsUpId}
            />
          </div>
        )}

        <div className="tkt-action-form__wide">
          <TextArea
            error={errors.attachmentNotes}
            hint="Where a photo or file for this action is kept."
            label="Attachment notes"
            name="attachmentNotes"
            onChange={(event) => set("attachmentNotes", event.target.value)}
            rows={2}
            value={draft.attachmentNotes}
          />
        </div>
      </div>

      {write.alert ? (
        <p className="tkt-callout tkt-callout--error" id={alertId} role="alert">
          {write.alert}
        </p>
      ) : null}

      <div className="tkt-actions">
        <Button disabled={write.busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          busy={write.busy}
          busyLabel="Saving…"
          type="submit"
          variant="primary"
        >
          Save
        </Button>
      </div>
    </form>
  );
};
