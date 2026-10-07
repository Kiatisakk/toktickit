import { useRef, useState } from "react";

import { ApiError, type TicketAction } from "./api";

/**
 * What every Action write does with a refusal (ui-spec.md sections 6 and 8).
 *
 * One hook for the create, edit, complete and cancel forms, so the stale
 * wording, the busy guard and the mapping from `details` to a field are written
 * once. The forms own their text; this owns the request, which is why a refusal
 * can never clear what the person typed (FR-25, AC-42).
 */

/** ui-spec.md section 8: the one wording for a refused stale write. */
export const STALE_MESSAGE =
  "This record was changed by someone else since you opened it. We've loaded the latest version — check it and try again.";

/** ui-spec.md section 8: the stale write was refused and the reload failed too. */
export const STALE_RELOAD_FAILED_MESSAGE =
  "This record was changed by someone else since you opened it, but the latest version could not be loaded. What you see may be out of date — reload the page before trying again.";

export const REQUEST_ID_CONFLICT_MESSAGE =
  "An earlier attempt may already have been saved — check the list.";

export const TICKET_NOT_ACTIONABLE_MESSAGE =
  "Actions can't be added to a resolved, closed or cancelled ticket.";

const notEditableMessage = (action: TicketAction | undefined): string => {
  if (action?.state === "DONE") {
    return "This action has already been completed.";
  }

  if (action?.state === "CANCELLED") {
    return "This action has already been cancelled.";
  }

  return "This action can no longer be changed.";
};

/**
 * A form's controls are disabled while its write is in flight, which drops the
 * focus they held. When the form is still there afterwards (the write failed
 * with no field to point at), put focus back on its Save control so a keyboard
 * user is not left at the top of the page.
 */
export const keepFocusInForm = (form: HTMLFormElement | null) => {
  if (!form?.isConnected || form.contains(document.activeElement)) {
    return;
  }

  form.querySelector<HTMLElement>('button[type="submit"]')?.focus();
};

interface Options {
  /** The fields this form has a place for; any other detail goes in the alert. */
  fields: readonly string[];
  /** Silently re-read the Actions. `null` when that read failed. */
  reloadActions: () => Promise<TicketAction[] | null>;
  /** Re-read the Ticket, whose status may have moved. */
  reloadTicket: () => Promise<boolean>;
  /** The Action this form writes to, when it writes to one that exists. */
  actionId?: number;
  onSaved: (action: TicketAction) => void;
  /**
   * The write can never succeed as it stands (the Action is no longer Planned,
   * or the Ticket no longer takes Actions): the screen explains and closes the
   * form instead of leaving a control that can only fail.
   */
  onRefused: (message: string) => void;
  /** AC-48: the key was used for a different payload, so the next submit needs a new one. */
  onRequestIdConflict?: () => void;
}

export const useActionWrite = ({
  fields,
  reloadActions,
  reloadTicket,
  actionId,
  onSaved,
  onRefused,
  onRequestIdConflict,
}: Options) => {
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // State is not enough to stop a second click: two clicks in one tick both
  // read `busy` as false. A ref is written synchronously (AC-46, BR-35).
  const inFlight = useRef(false);

  const clearFieldError = (name: string) => {
    setFieldErrors((current) => {
      if (!(name in current)) {
        return current;
      }

      const { [name]: _removed, ...rest } = current;

      return rest;
    });
  };

  const refuse = (message: string) => {
    setAlert(null);
    onRefused(message);
  };

  const place = (details: Record<string, string>): string[] => {
    const placed: Record<string, string> = {};
    const unplaced: string[] = [];

    for (const [name, message] of Object.entries(details)) {
      if (fields.includes(name)) {
        placed[name] = message;
      } else {
        unplaced.push(message);
      }
    }

    setFieldErrors(placed);
    setAlert(unplaced.length > 0 ? unplaced.join(" ") : null);

    return Object.keys(placed);
  };

  const handleFailure = async (error: unknown): Promise<string[]> => {
    if (!(error instanceof ApiError)) {
      setAlert("The change could not be saved.");
      return [];
    }

    switch (error.code) {
      case "STALE_UPDATE": {
        // The message waits for the reload, so it never claims data it lacks.
        const latest = await reloadActions();

        setAlert(latest ? STALE_MESSAGE : STALE_RELOAD_FAILED_MESSAGE);
        return [];
      }
      case "ACTION_NOT_EDITABLE": {
        const latest = await reloadActions();

        refuse(notEditableMessage(latest?.find((one) => one.id === actionId)));
        return [];
      }
      case "TICKET_NOT_ACTIONABLE": {
        await Promise.all([reloadTicket(), reloadActions()]);
        refuse(TICKET_NOT_ACTIONABLE_MESSAGE);
        return [];
      }
      case "REQUEST_ID_CONFLICT": {
        await reloadActions();
        onRequestIdConflict?.();
        setAlert(REQUEST_ID_CONFLICT_MESSAGE);
        return [];
      }
      case "ACTION_ASSIGNEE_INELIGIBLE": {
        return place({ performedById: error.message });
      }
      default: {
        if (error.details && Object.keys(error.details).length > 0) {
          return place(error.details);
        }

        setAlert(error.message);
        return [];
      }
    }
  };

  /**
   * Runs one write. Resolves to the names of the fields the server refused, in
   * the server's order, so the form can focus the first (ui-spec.md section 6).
   */
  const submit = async (
    write: () => Promise<TicketAction>
  ): Promise<string[]> => {
    if (inFlight.current) {
      return [];
    }

    inFlight.current = true;
    setBusy(true);
    setAlert(null);
    setFieldErrors({});

    try {
      onSaved(await write());
      return [];
    } catch (error) {
      return await handleFailure(error);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return {
    busy,
    alert,
    fieldErrors,
    clearFieldError,
    setFieldErrors,
    setAlert,
    submit,
  };
};
