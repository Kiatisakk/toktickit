import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "../components/Button";
import { StateBlock } from "../components/StateBlock";
import { TextInput } from "../components/TextInput";
import { useAuth } from "../context/useAuth";
import { ApiError } from "../lib/api";
import { login } from "../lib/auth";

/**
 * The sign-in screen (§8.1).
 *
 * Two things here are security decisions rather than presentation ones.
 *
 * A refused sign-in shows **one message, above the form, naming neither field**
 * (BR-08, AC-05). Putting it under Password would say the address exists;
 * putting it under Email would say it does not. The server already answers both
 * cases identically, and a screen that split them apart would hand back the
 * account oracle the server refuses to be.
 *
 * A deactivated account gets its own message, because by then the password has
 * verified and the person reading it is the account's owner (BR-09, D-04).
 *
 * What the user typed survives every failure, including a failure to reach the
 * API at all (§8.3): making somebody retype an address because a server was
 * restarting is the failure mode the requirement exists to prevent.
 */

type Failure =
  | { kind: "none" }
  | { kind: "credentials" }
  | { kind: "inactive"; message: string }
  | { kind: "unreachable"; message: string };

const REFUSED =
  "That email address and password do not match an account. Check both and try again.";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>({ kind: "none" });

  const { signedIn } = useAuth();
  const navigate = useNavigate();

  const emailError =
    touched && email.trim() === "" ? "Enter your email address." : undefined;
  const passwordError =
    touched && password === "" ? "Enter your password." : undefined;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    // Refused here, so an empty form never reaches the API (UI-02). The server
    // validates the same thing — this is feedback, not the boundary (BR-17).
    if (email.trim() === "" || password === "") {
      return;
    }

    setBusy(true);
    setFailure({ kind: "none" });

    try {
      const identity = await login(email.trim(), password);

      signedIn(identity);

      // A gated account goes to the change-password screen and nowhere else.
      // The server enforces this on every endpoint (AC-02); this is what makes
      // it feel like a destination rather than a wall.
      void navigate(
        identity.mustChangePassword ? "/change-password" : "/my-tickets",
        { replace: true }
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "ACCOUNT_INACTIVE") {
        setFailure({ kind: "inactive", message: error.message });
      } else if (error instanceof ApiError && error.status === 401) {
        setFailure({ kind: "credentials" });
      } else {
        setFailure({
          kind: "unreachable",
          message:
            error instanceof Error
              ? error.message
              : "Unable to reach TokTickIT. Try again in a moment.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tkt-auth">
      <main className="tkt-auth__panel">
        <h1 className="tkt-auth__title">Sign in to TokTickIT</h1>
        <p className="tkt-auth__intro">
          Use the email address and password issued to you.
        </p>

        {failure.kind === "credentials" ? (
          <p className="tkt-form-error" role="alert">
            {REFUSED}
          </p>
        ) : null}

        {failure.kind === "inactive" ? (
          <p className="tkt-form-error" role="alert">
            {failure.message}
          </p>
        ) : null}

        {failure.kind === "unreachable" ? (
          <StateBlock
            description={failure.message}
            kind="error"
            title="Cannot reach TokTickIT"
          />
        ) : null}

        <form noValidate onSubmit={onSubmit}>
          <TextInput
            autoComplete="username"
            error={emailError}
            label="Email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <TextInput
            autoComplete="current-password"
            error={passwordError}
            label="Password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          <Button
            busy={busy}
            busyLabel="Signing in…"
            className="tkt-auth__submit"
            type="submit"
            variant="primary"
          >
            Sign In
          </Button>
        </form>
      </main>
    </div>
  );
};
