import {
  type FormEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordRules } from "../components/PasswordRules";
import { Select } from "../components/Select";
import { StateBlock } from "../components/StateBlock";
import { TextInput } from "../components/TextInput";
import { AuthContext } from "../context/authContextValue";
import {
  createUser,
  fetchUsers,
  type ManagedUser,
  ROLES,
  type Role,
  setInitialPassword,
  updateUser,
  type UserFields,
} from "../lib/adminUsers";
import { ApiError } from "../lib/api";
import { meetsEveryRule } from "../lib/passwordRules";

/**
 * Administrator User Management (ui-spec.md §8).
 *
 * One screen, deliberately small: a list with search and a role filter, and a
 * form in a panel for creating and editing. No pagination, no sorting, no bulk
 * actions — §8.5 of the handout excludes them, and a screen that grows past
 * that list is out of scope rather than ahead of schedule.
 *
 * The refusals are the screen's most important states. Each has its own
 * message, and none leaves the form looking as though it worked: a refused
 * change puts the fields it concerned back, and the list only ever shows what
 * the server has confirmed.
 */

const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMIN: "Administrator",
};

const ROLE_OPTIONS = ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

type Listing =
  | { kind: "loading" }
  | { kind: "loaded"; users: ManagedUser[] }
  | { kind: "failed"; message: string };

type Panel = { mode: "create" } | { mode: "edit"; user: ManagedUser } | null;

const EMPTY_DRAFT: UserFields = {
  name: "",
  email: "",
  role: "REQUESTER",
  isActive: true,
};

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/* ------------------------------------------------------------- the form -- */

interface UserFormProps {
  panel: Exclude<Panel, null>;
  onSaved: (user: ManagedUser) => void;
  onCancel: () => void;
}

/**
 * Create and edit share one form, because they share every field but one: a
 * new account is given a starting password here, an existing one through the
 * separate action below the form (ui-spec.md §8).
 */
const UserForm = ({ panel, onSaved, onCancel }: UserFormProps) => {
  const original = panel.mode === "edit" ? panel.user : null;
  const titleId = useId();
  const switchId = useId();

  const [draft, setDraft] = useState<UserFields>(
    original
      ? {
          name: original.name,
          email: original.email,
          role: original.role,
          isActive: original.isActive,
        }
      : EMPTY_DRAFT
  );
  const [initialPassword, setInitialPasswordDraft] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    <K extends keyof UserFields>(field: K) =>
    (value: UserFields[K]) => {
      setDraft((current) => ({ ...current, [field]: value }));
    };

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};

    if (draft.name.trim() === "") {
      found["name"] = "Enter a name.";
    }

    if (draft.email.trim() === "") {
      found["email"] = "Enter an email address.";
    }

    if (!original && !meetsEveryRule(initialPassword)) {
      found["initialPassword"] =
        "This password does not meet every requirement below.";
    }

    return found;
  };

  /** Only what changed, so an edit never re-sends a field it did not touch. */
  const changesFrom = (user: ManagedUser): Partial<UserFields> => {
    const changes: Partial<UserFields> = {};

    if (draft.name.trim() !== user.name) {
      changes.name = draft.name.trim();
    }

    if (draft.email.trim() !== user.email) {
      changes.email = draft.email.trim();
    }

    if (draft.role !== user.role) {
      changes.role = draft.role;
    }

    if (draft.isActive !== user.isActive) {
      changes.isActive = draft.isActive;
    }

    return changes;
  };

  /**
   * A refusal puts back exactly what it refused.
   *
   * ui-spec.md §8: "The toggle springs back." A form still showing Inactive
   * after the server said no reads as a change that was saved; the fields a
   * refusal is about return to what the account actually is.
   */
  const springBack = (fields: (keyof UserFields)[]) => {
    if (!original) {
      return;
    }

    setDraft((current) => {
      const next = { ...current };

      for (const field of fields) {
        Object.assign(next, { [field]: original[field] });
      }

      return next;
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRefusal(null);
    setPasswordVisible(false);

    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    setBusy(true);

    try {
      if (original) {
        const changes = changesFrom(original);

        onSaved(
          Object.keys(changes).length === 0
            ? original
            : await updateUser(original.id, changes)
        );
      } else {
        onSaved(
          await createUser({
            ...draft,
            name: draft.name.trim(),
            email: draft.email.trim(),
            initialPassword,
          })
        );
      }
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setRefusal(messageOf(error, "The user could not be saved."));
        return;
      }

      switch (error.code) {
        case "EMAIL_ALREADY_EXISTS": {
          setErrors({
            email: "Another account already uses this email address.",
          });
          break;
        }
        case "CANNOT_DEACTIVATE_SELF": {
          setRefusal(
            "You cannot deactivate your own account. Another Administrator has to do it."
          );
          springBack(["isActive"]);
          break;
        }
        case "LAST_ACTIVE_ADMIN": {
          setRefusal(
            "This is the only active Administrator. Make someone else an active Administrator before changing this account's role or status."
          );
          springBack(["role", "isActive"]);
          break;
        }
        default: {
          if (error.details) {
            setErrors(error.details);
          } else {
            setRefusal(error.message);
          }
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className="tkt-card tkt-user-panel">
      <h2 className="tkt-section-title" id={titleId}>
        {original ? `Edit ${original.name}` : "Create User"}
      </h2>

      {refusal ? (
        <p className="tkt-form-error" role="alert">
          {refusal}
        </p>
      ) : null}

      <form noValidate onSubmit={onSubmit}>
        <TextInput
          autoComplete="off"
          error={errors["name"]}
          label="Name"
          name="name"
          onChange={(event) => set("name")(event.target.value)}
          readOnly={busy}
          required
          value={draft.name}
        />

        <TextInput
          autoComplete="off"
          error={errors["email"]}
          label="Email"
          name="email"
          onChange={(event) => set("email")(event.target.value)}
          readOnly={busy}
          required
          type="email"
          value={draft.email}
        />

        {/* A select, never checkboxes: exactly one role (BR-16). */}
        <Select
          disabled={busy}
          error={errors["role"]}
          label="Role"
          name="role"
          onChange={(event) => set("role")(event.target.value as Role)}
          options={ROLE_OPTIONS}
          required
          value={draft.role}
        />

        <div className="tkt-switch-field">
          <input
            aria-checked={draft.isActive}
            checked={draft.isActive}
            className="tkt-switch"
            disabled={busy}
            id={switchId}
            onChange={(event) => set("isActive")(event.target.checked)}
            role="switch"
            type="checkbox"
          />
          <label htmlFor={switchId}>Active</label>
          {errors["isActive"] ? (
            <p className="tkt-field-error">{errors["isActive"]}</p>
          ) : null}
        </div>

        {original ? null : (
          <>
            <PasswordInput
              autoComplete="new-password"
              error={errors["initialPassword"]}
              label="Initial password"
              name="initialPassword"
              onChange={(event) => setInitialPasswordDraft(event.target.value)}
              onVisibleChange={setPasswordVisible}
              readOnly={busy}
              required
              value={initialPassword}
              visible={passwordVisible}
            />
            <PasswordRules password={initialPassword} />
          </>
        )}

        <div className="tkt-actions">
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button
            busy={busy}
            busyLabel="Saving…"
            type="submit"
            variant="primary"
          >
            {original ? "Save Changes" : "Create User"}
          </Button>
        </div>
      </form>

      {original ? <NewInitialPassword user={original} /> : null}
    </section>
  );
};

/* ---------------------------------------------- the new-password action -- */

/**
 * Setting a new starting password (BR-37).
 *
 * Its own action, confirmed before it fires, because it signs the user out
 * everywhere. It never shows the existing password: there is no such value to
 * show — only a hash, which nothing returns.
 */
const NewInitialPassword = ({ user }: { user: ManagedUser }) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVisible(false);

    if (!meetsEveryRule(password)) {
      setError("This password does not meet every requirement below.");
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      await setInitialPassword(user.id, password);
      setDone(true);
      setOpen(false);
      setPassword("");
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.details?.["initialPassword"]
          ? failure.details["initialPassword"]
          : messageOf(failure, "The password could not be set.")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tkt-user-panel__password">
      {done ? (
        <p className="tkt-form-success" role="status">
          A new starting password was set. {user.name} has been signed out and
          must choose their own at next sign-in.
        </p>
      ) : null}

      {open ? (
        <form noValidate onSubmit={onSubmit}>
          <p>
            {user.name} will be signed out everywhere and must change this
            password at next sign-in.
          </p>
          <PasswordInput
            autoComplete="new-password"
            error={error}
            label="New initial password"
            name="newInitialPassword"
            onChange={(event) => setPassword(event.target.value)}
            onVisibleChange={setVisible}
            readOnly={busy}
            required
            value={password}
            visible={visible}
          />
          <PasswordRules password={password} />
          <div className="tkt-actions">
            <Button
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(undefined);
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              busy={busy}
              busyLabel="Setting…"
              type="submit"
              variant="primary"
            >
              Set Password
            </Button>
          </div>
        </form>
      ) : (
        <Button
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          variant="secondary"
        >
          <Icon name="reload" />
          Set a New Initial Password
        </Button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------ the screen -- */

export const UserManagement = () => {
  const auth = useContext(AuthContext);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [listing, setListing] = useState<Listing>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);

  const load = useCallback(
    (signal: AbortSignal) => {
      setListing({ kind: "loading" });

      fetchUsers(
        { ...(search ? { search } : {}), ...(role ? { role } : {}) },
        signal
      )
        .then((users) => setListing({ kind: "loaded", users }))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setListing({
            kind: "failed",
            message: messageOf(error, "The user list could not be loaded."),
          });
        });
    },
    [search, role]
  );

  useEffect(() => {
    const controller = new AbortController();

    // oxlint-disable-next-line react/set-state-in-effect
    load(controller.signal);

    return () => {
      controller.abort();
    };
  }, [load, reloadToken]);

  /**
   * The row changes only with what the server returned — never optimistically
   * (ui-spec.md §8). A created user may not match the current filter, so the
   * list is re-read rather than guessed at.
   */
  const onSaved = (saved: ManagedUser) => {
    setPanel(null);

    if (listing.kind === "loaded" && panel?.mode === "edit") {
      setListing({
        kind: "loaded",
        users: listing.users.map((user) =>
          user.id === saved.id ? saved : user
        ),
      });
      return;
    }

    setReloadToken((token) => token + 1);
  };

  const filtering = search.trim() !== "" || role !== "";

  return (
    <AppShell breadcrumbs={[{ label: "User Management" }]}>
      <div className="tkt-list-header">
        <div>
          <h1 className="tkt-page-title">User Management</h1>
          <p className="tkt-page-subtitle">
            Create accounts, correct their details, and take access away.
          </p>
        </div>
        <div className="tkt-actions">
          <Button
            onClick={() => setPanel({ mode: "create" })}
            variant="primary"
          >
            <Icon name="create" />
            Create User
          </Button>
        </div>
      </div>

      {panel ? (
        <UserForm
          // A new key per account, so switching from one Edit to another
          // starts from that account's values rather than the last draft.
          key={panel.mode === "edit" ? panel.user.id : "create"}
          onCancel={() => setPanel(null)}
          onSaved={onSaved}
          panel={panel}
        />
      ) : null}

      <div className="tkt-filters">
        <TextInput
          icon="search"
          label="Search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          value={search}
        />
        <Select
          label="Role"
          onChange={(event) => setRole(event.target.value as Role | "")}
          options={[{ value: "", label: "All Roles" }, ...ROLE_OPTIONS]}
          value={role}
        />
      </div>

      {listing.kind === "loading" ? (
        <StateBlock kind="loading" title="Loading users…" />
      ) : null}

      {listing.kind === "failed" ? (
        <StateBlock
          action={
            <Button
              onClick={() => setReloadToken((token) => token + 1)}
              variant="primary"
            >
              Try again
            </Button>
          }
          description={listing.message}
          kind="error"
          title="Could not load users"
        />
      ) : null}

      {listing.kind === "loaded" && listing.users.length === 0 ? (
        <StateBlock
          description={
            filtering
              ? "No account matches this search or role."
              : "There are no accounts yet."
          }
          kind={filtering ? "no-results" : "empty"}
          title={filtering ? "No users match" : "No users"}
        />
      ) : null}

      {listing.kind === "loaded" && listing.users.length > 0 ? (
        <UserList
          currentUserId={auth?.user?.id ?? null}
          onEdit={(user) => setPanel({ mode: "edit", user })}
          users={listing.users}
        />
      ) : null}
    </AppShell>
  );
};

/* -------------------------------------------------------------- the list -- */

interface UserListProps {
  users: ManagedUser[];
  currentUserId: number | null;
  onEdit: (user: ManagedUser) => void;
}

const statusOf = (user: ManagedUser) => (user.isActive ? "ACTIVE" : "INACTIVE");

/**
 * A table from 768px up and cards below it, with the same five facts in both
 * (ui-spec.md §9). The classes are My Tickets', so the breakpoint is decided in
 * one place.
 */
const UserList = ({ users, currentUserId, onEdit }: UserListProps) => {
  const editLabel = (user: ManagedUser) =>
    user.id === currentUserId ? `Edit ${user.name} (you)` : `Edit ${user.name}`;

  return (
    <div className="tkt-list">
      <div
        aria-label="Users"
        className="tkt-table-scroll"
        role="region"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region
        // must be focusable to be scrollable by keyboard.
        tabIndex={0}
      >
        <table className="tkt-table">
          <caption className="tkt-visually-hidden">User accounts</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="tkt-visually-hidden">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <Badge kind="role" value={user.role} />
                </td>
                <td>
                  <Badge kind="status" value={statusOf(user)} />
                </td>
                <td>
                  <Button
                    aria-label={editLabel(user)}
                    onClick={() => onEdit(user)}
                    variant="secondary"
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="tkt-cards">
        {users.map((user) => (
          <li className="tkt-ticket-card" key={user.id}>
            <div className="tkt-ticket-card__head">
              <strong>{user.name}</strong>
              <Badge kind="status" value={statusOf(user)} />
            </div>
            <dl className="tkt-ticket-card__meta">
              <dt>Email</dt>
              <dd>{user.email}</dd>
              <dt>Role</dt>
              <dd>
                <Badge kind="role" value={user.role} />
              </dd>
            </dl>
            <div className="tkt-actions">
              <Button
                aria-label={editLabel(user)}
                onClick={() => onEdit(user)}
                variant="secondary"
              >
                Edit
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
