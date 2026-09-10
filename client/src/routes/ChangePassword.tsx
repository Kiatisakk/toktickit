import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { StateBlock } from "../components/StateBlock";
import { TextInput } from "../components/TextInput";
import { useAuth } from "../context/useAuth";
import { ApiError } from "../lib/api";
import { changePassword } from "../lib/auth";
import { meetsEveryRule, PASSWORD_RULES } from "../lib/passwordRules";

/**
 * Choosing a new password (§8.2).
 *
 * The screen renders **without the application shell** while a change is
 * outstanding (AC-02, UI-09). Navigation the server would refuse is not
 * disabled or greyed out — it is absent, because a disabled link still tells
 * the user the destination exists and invites them to try. The one action left
 * is Logout, so a person who cannot complete the change is not trapped.
 *
 * The rules panel ticks as the user types (AC-10). It exists because BR-07 is
 * four separate requirements, and a form that reveals them one refusal at a
 * time makes a person guess at rules the product already knows.
 *
 * A confirmation mismatch is reported against Confirm, never against New
 * (UI-08). Reporting it against New says the new password is wrong when it is
 * the repetition that differs.
 */
export const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldFailure, setFieldFailure] = useState<Record<string, string>>({});

  const { user, mustChangePassword, refresh, signOut } = useAuth();
  const navigate = useNavigate();

  const satisfied = meetsEveryRule(newPassword);
  const mismatch = confirmation !== "" && confirmation !== newPassword;

  const currentError =
    fieldFailure["currentPassword"] ??
    (touched && currentPassword === ""
      ? "Enter your current password."
      : undefined);

  const newError =
    fieldFailure["newPassword"] ??
    (touched && !satisfied
      ? "This password does not meet every requirement below."
      : undefined);

  const confirmationError =
    (touched && confirmation === "" ? "Repeat the new password." : undefined) ??
    (mismatch ? "This does not match the new password." : undefined);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setFieldFailure({});

    if (currentPassword === "" || !satisfied || confirmation !== newPassword) {
      return;
    }

    setBusy(true);
    setFailure(null);

    try {
      await changePassword(currentPassword, newPassword);

      // The server rotated the session and cleared the flag; this re-reads both
      // rather than assuming (D-13 — the server is the only identity source).
      await refresh();

      void navigate("/my-tickets", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFieldFailure({
          currentPassword: "Your current password is not correct.",
        });
      } else if (error instanceof ApiError && error.details) {
        setFieldFailure(error.details);
      } else {
        setFailure(
          error instanceof Error
            ? error.message
            : "Unable to reach TokTickIT. Try again in a moment."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tkt-auth">
      <main className="tkt-auth__panel">
        <h1 className="tkt-auth__title">Choose a new password</h1>

        <p className="tkt-auth__intro">
          {mustChangePassword
            ? "Your account was issued a starting password. Choose your own before continuing."
            : "Update the password for your account."}
          {user ? ` Signed in as ${user.name}.` : ""}
        </p>

        {failure ? (
          <StateBlock
            description={failure}
            kind="error"
            title="Cannot reach TokTickIT"
          />
        ) : null}

        <form noValidate onSubmit={onSubmit}>
          <TextInput
            autoComplete="current-password"
            error={currentError}
            label="Current password"
            name="currentPassword"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />

          <TextInput
            autoComplete="new-password"
            error={newError}
            label="New password"
            name="newPassword"
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />

          <ul aria-label="Password requirements" className="tkt-password-rules">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.satisfiedBy(newPassword);

              return (
                <li
                  className={
                    met
                      ? "tkt-password-rule tkt-password-rule--met"
                      : "tkt-password-rule"
                  }
                  key={rule.id}
                >
                  <Icon name={met ? "check" : "pending"} />
                  {/* The state is in the text as well as the icon: a colour
                      and a tick are not available to a screen reader. */}
                  <span>{rule.label}</span>
                  <span className="tkt-visually-hidden">
                    {met ? " — met" : " — not yet met"}
                  </span>
                </li>
              );
            })}
          </ul>

          <TextInput
            autoComplete="new-password"
            error={confirmationError}
            label="Confirm new password"
            name="confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            required
            type="password"
            value={confirmation}
          />

          <div className="tkt-auth__actions">
            <Button
              busy={busy}
              busyLabel="Saving…"
              type="submit"
              variant="primary"
            >
              Save Password
            </Button>

            {/* Present so that somebody who cannot complete the change is not
                trapped on a screen with no way out. */}
            <Button
              onClick={() => {
                void signOut().then(() =>
                  navigate("/login", { replace: true })
                );
              }}
              type="button"
            >
              Logout
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};
