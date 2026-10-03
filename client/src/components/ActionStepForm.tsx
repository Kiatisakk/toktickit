import { type FormEvent, useId, useRef, useState } from "react";

import { cancelAction, completeAction, type TicketAction } from "../lib/api";
import { useActionWrite } from "../lib/useActionWrite";
import { Button } from "./Button";
import { TextArea } from "./TextArea";

/**
 * The two short forms that end a Planned Action: Complete (a Result) and
 * Cancel action (a Reason) — ui-spec.md section 6.
 *
 * They are one component because they are one shape: a single required text
 * field, a Confirm and a way back, with the same refusals to handle.
 */

const RESULT_LIMIT = 2000;
const REASON_LIMIT = 500;

type Step = "complete" | "cancel";

const COPY = {
  complete: {
    heading: "Complete action",
    field: "result",
    label: "Result",
    missing: "Enter the result before completing.",
    limit: RESULT_LIMIT,
    busy: "Completing…",
    confirm: "Confirm",
  },
  cancel: {
    heading: "Cancel action",
    field: "cancelReason",
    label: "Reason",
    missing: "Enter a reason for cancelling.",
    limit: REASON_LIMIT,
    busy: "Cancelling…",
    confirm: "Confirm",
  },
} as const;

interface ActionStepFormProps {
  step: Step;
  action: TicketAction;
  reloadActions: () => Promise<TicketAction[] | null>;
  reloadTicket: () => Promise<boolean>;
  onSaved: (action: TicketAction) => void;
  onRefused: (message: string) => void;
  onBack: () => void;
}

export const ActionStepForm = ({
  step,
  action,
  reloadActions,
  reloadTicket,
  onSaved,
  onRefused,
  onBack,
}: ActionStepFormProps) => {
  const copy = COPY[step];
  const alertId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  // Completing prefills the stored Result; cancelling starts empty.
  const [text, setText] = useState(
    step === "complete" ? (action.result ?? "") : ""
  );
  const [clientError, setClientError] = useState<string | undefined>();

  const write = useActionWrite({
    fields: [copy.field],
    reloadActions,
    reloadTicket,
    actionId: action.id,
    onSaved,
    onRefused,
  });

  const focusText = () => {
    formRef.current?.querySelector<HTMLElement>("textarea")?.focus();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const value = text.trim();
    let problem: string | undefined;

    if (value === "") {
      problem = copy.missing;
    } else if (value.length > copy.limit) {
      problem = `Keep it to ${copy.limit} characters or fewer.`;
    }

    setClientError(problem);

    if (problem) {
      focusText();
      return;
    }

    const refused = await write.submit(() => {
      // `action` is the list's own copy: after a stale refusal and a reload it
      // carries the version now stored, so the retry names that one.
      const version = action.version;

      return step === "complete"
        ? completeAction(action.id, version, value)
        : cancelAction(action.id, version, value);
    });

    if (refused.length > 0) {
      focusText();
    }
  };

  const error = clientError ?? write.fieldErrors[copy.field];

  return (
    <form
      aria-describedby={write.alert ? alertId : undefined}
      aria-label={`${copy.heading} #${action.id}`}
      className="tkt-action-form"
      noValidate
      onSubmit={onSubmit}
      ref={formRef}
    >
      <h3 className="tkt-action-form__title">
        {copy.heading} #{action.id}
      </h3>
      <p className="tkt-field-hint">{action.description}</p>

      <TextArea
        error={error}
        label={copy.label}
        name={copy.field}
        onChange={(event) => {
          setText(event.target.value);
          setClientError(undefined);
          write.clearFieldError(copy.field);
        }}
        required
        rows={3}
        value={text}
      />

      {write.alert ? (
        <p className="tkt-callout tkt-callout--error" id={alertId} role="alert">
          {write.alert}
        </p>
      ) : null}

      <div className="tkt-actions">
        <Button disabled={write.busy} onClick={onBack}>
          Back
        </Button>
        <Button
          busy={write.busy}
          busyLabel={copy.busy}
          type="submit"
          variant={step === "cancel" ? "danger" : "primary"}
        >
          {copy.confirm}
        </Button>
      </div>
    </form>
  );
};
