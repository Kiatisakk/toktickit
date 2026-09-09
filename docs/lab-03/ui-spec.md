# Lab 3 UI Specification — Zen Green, extended

Companion to [specification.md](specification.md). Screen structure, modes, controls, feedback, role behaviour, responsive rules and accessibility for the Lab 3 increment.

Lab 2's [ui-spec.md](../lab-02/ui-spec.md) remains in force. This document records only what is **new or changed**. Where it is silent, Lab 2 governs.

---

## 1. What carries over unchanged

Colour tokens, typography, spacing, the field/label/validation conventions, button hierarchy, card and table surfaces, the badge component, state blocks, breadcrumbs, the three responsive bands (desktop ≥ 992, tablet 768–991, mobile < 768) and every accessibility rule.

New screens must read as the same application. A screen that introduces its own spacing scale, its own button shape or its own green is a defect regardless of how it looks on its own.

**Badges extend rather than multiply.** Ticket status, Requested Priority, IT Priority and now Role all render through the one existing badge component. Role gets its own modifier set; the eight statuses reuse the existing status modifiers plus two new ones for `Reopened` and `Cancelled`, and `Pending` is relabelled `Waiting for Requester`.

---

## 2. Application shell

### Changed

The header's right-hand side no longer shows a Development Requester name and a **Change Requester** button. It shows the authenticated user's **name**, their **role** as a badge, and a **Logout** action.

Navigation renders only the destinations the current role may reach. An unauthorized destination is **absent**, not disabled — a disabled link advertises a screen the user cannot have.

| Role | Navigation |
| --- | --- |
| Requester | My Tickets · Create Ticket |
| IT Staff | Ticket Queue · My Tickets · Create Ticket |
| Administrator | Ticket Queue · User Management · My Tickets · Create Ticket |

Hiding a link is presentation, not protection. Every destination is independently enforced on the server (BR-17).

### Removed

The Development Requester Selection screen and its route. Nothing replaces it; the login screen is not its successor in the routing sense — it sits in front of the whole application rather than inside it.

---

## 3. Login

A single centred card on the page background, no application navigation — the shell's header is present but carries no navigation and no user, because there is not one yet.

**Fields.** Email address (`type="email"`, autocomplete `username`), Password (`type="password"`, autocomplete `current-password`, with a show/hide toggle that is a `button` with an accessible name that changes between *Show password* and *Hide password*).

**Modes**

| Mode | What the user sees |
| --- | --- |
| Initial | Both fields empty, Sign In enabled |
| Validating | Field-level messages beneath the offending field; the API is not called |
| Busy | Sign In disabled and labelled as working; both fields read-only |
| Invalid credentials | One message above the fields: *Invalid email or password. Please try again.* Both fields keep their values; the password is not cleared |
| Inactive account | One message above the fields naming the account as deactivated and directing the user to an Administrator |
| API failure | The safe failure block used elsewhere in the product; entered values preserved |

The invalid-credentials message is identical for an unknown address and a wrong password. The screen must not distinguish them by wording, by field focus, or by which field is marked invalid (BR-08).

**Show/hide password** defaults to hidden and returns to hidden on submit.

---

## 4. Change Password (mandatory)

Reached automatically after signing in with an initial password, and not otherwise reachable. The shell shows the user's name and role but **no navigation** — there is nowhere else they may go yet (BR-02).

**Fields.** Current (temporary) password, New password, Confirm new password — each with a show/hide toggle.

**The rules panel** lists the four requirements and marks each as satisfied or not **as the user types**: at least 8 characters; upper and lower case; a number; a special character. This is guidance, not validation — the field's own error message still appears on submit if a rule fails.

| Mode | What the user sees |
| --- | --- |
| Initial | Rules panel with nothing satisfied |
| Typing | Each rule ticks as it is met |
| Validating | Field-level messages; mismatch is reported against *Confirm*, not against *New* |
| Busy | Continue disabled and labelled as working |
| Wrong current password | Message against the *Current password* field |
| Success | The user proceeds into the application at their role's landing screen |

The user cannot navigate away, and cannot reach any other screen by URL, while the flag is set.

---

## 5. IT Staff Ticket Queue

The queue is the working screen of the sprint. It reuses the ticket list surface, the filter bar and the pagination control from My Tickets rather than introducing a second table idiom.

**Controls.** A search field (ticket number or summary); filters for Category, Requested Priority, IT Priority, Status and Owner; and a pagination control. The Owner filter includes an **Unassigned** option, which is how staff find unclaimed work.

**Columns (desktop).** Ticket No. · Created Date · Summary · Category · Req. Priority · IT Priority · Status · Owner · Last Updated.

Nine columns is the ceiling. Anything further belongs on the detail screen. Owner renders as a name, or as an explicit *Unassigned* — never as an empty cell, which reads as missing data rather than as a fact.

**Sorting.** Ticket No., Created Date, Req. Priority, IT Priority, Status and Last Updated are sortable. Below 768 px the table becomes cards and sorting moves into the filter bar as a field-and-direction pair, exactly as My Tickets does — a sort control that lives only in a table header is unreachable once the table is gone.

**Modes**

| Mode | What the user sees |
| --- | --- |
| Loading | The list skeleton |
| Populated | Rows, with the result count and pagination |
| Empty | *No tickets yet* — the queue itself is empty |
| No results | *No tickets match these filters*, with a Clear Filters action |
| Forbidden | Not reachable: the destination is absent from a Requester's navigation, and the route redirects |
| Failure | The safe failure block with a retry |

Empty and no-results are different states with different remedies, and must not share a message.

---

## 6. IT Staff Ticket Detail

Extends the Requester Ticket Detail rather than replacing it. Ticket information stays grouped and read-only; only the operational fields are editable.

**Read-only.** Ticket No., Ticket Date, Requester, Category, Related System, Summary, Description, Requested Priority.

**Editable by staff.** Ticket Owner (claim / assign / release), IT Priority, Current Status.

**Claim** is a primary action when the ticket is unassigned. When it is assigned, ownership presents as a select of eligible users plus a Release action. Only active IT Staff and Administrators appear as options (BR-21).

**Status** presents only the transitions permitted from the current status (specification.md §5). A cancelled ticket shows the status as read-only with a note that it is terminal — not an empty dropdown, which reads as a loading failure.

**Requester indication.** When the Requester has flagged that the problem appears resolved, the detail shows it prominently with its timestamp. It is a fact about the ticket, not a status, and must not be styled as a status badge.

### Public Comments and Internal Notes

Both are append-only lists with a composer beneath. They are **visually unmistakable from one another** — this is the requirement the handout states most directly, and the cost of getting it wrong is a private note posted publicly.

| | Public Comments | Internal Notes |
| --- | --- | --- |
| Surface | The standard card surface | A distinctly tinted surface, not the page background |
| Label | *Public Comments* | *Internal Notes* with a lock icon |
| Standing note | *Visible to the Requester* | *Not visible to the Requester* |
| Composer button | Primary | Secondary, with the same standing note repeated at the composer |

Colour alone does not carry the distinction: the heading text, the icon and the standing note each state it independently, so the difference survives greyscale printing and colour-blindness.

Each entry shows its author, their role, and the creation time. Entries are ordered oldest first, so a conversation reads downward.

Composer modes: initial, validating (empty or whitespace-only refused), busy, success (the entry appears at the foot of the list and the composer clears), failure (the typed text is preserved).

---

## 7. Requester Ticket Detail — changed

Gains the **Public Comments** section described above, with the same composer.

Gains a **Problem appears resolved** action. It is a secondary button, confirmed before it fires, and once used it is replaced by a statement of when it was indicated. The Requester never sees a status control and never sees the Internal Notes section — not disabled, not empty, absent (BR-04, BR-05).

---

## 8. Administrator User Management

One screen. The handout is emphatic that it stays minimal, and a screen that grows beyond this list is out of scope rather than ahead of schedule.

**List columns.** Name · Email · Role · Status · Edit.

**Controls.** A search field (name or email) and an optional Role filter. **No pagination**, no multi-column sort, no simultaneous filters — all excluded by §8.5.

**Status** renders as a badge: *Active* or *Inactive*. Inactive rows are not hidden; deactivation is a state, not a deletion (BR-36).

### Create and edit

A form in a panel, not a separate route.

| Field | Create | Edit |
| --- | --- | --- |
| Name | Required | Required |
| Email | Required, unique | Required, unique |
| Role | Required, exactly one — a select, never checkboxes | Required, exactly one |
| Active | Toggle | Toggle |
| Initial password | Required, with the rules panel from §4 | Absent — a separate action |

**Set a new initial password** is a distinct action on an existing user, confirmed before it fires, with the same rules panel. It never displays the user's existing password, because no such value exists to display (BR-37).

### Refusals

These are the screen's most important states, and each has its own message rather than a generic failure:

| Condition | What the user sees |
| --- | --- |
| Duplicate email | Message against the Email field naming the conflict |
| Deactivating yourself | Refused with an explanation; the toggle returns to Active |
| Removing the last active Administrator | Refused with an explanation naming why |
| Not an Administrator | The destination is absent from navigation and the route redirects |

A refusal must never leave the form in a state that suggests it succeeded. The toggle springs back; the row does not update optimistically.

---

## 9. Responsive rules

Unchanged from Lab 2 and applied to every new screen.

- **Desktop ≥ 992 px** — full tables, filters in a row
- **Tablet 768–991 px** — tables remain, scrolling horizontally inside their own container, never scrolling the page
- **Mobile < 768 px** — tables become cards; every value the desktop table carries is present on the card; sorting moves into the filter bar

Login, Change Password and the User Management form are single-column at every width; they simply narrow.

At no width does the page scroll horizontally, does any text clip, or do controls overlap.

---

## 10. Accessibility

Unchanged from Lab 2, and specifically for the new screens:

- Every field has a real `<label>` bound to a real control. A read-only value that is not a form control is not given a `<label>`
- Validation messages are associated with their field and announced
- The password show/hide toggle is a button with a name that changes with its state
- The rules panel is a list, and each rule's satisfied state is conveyed by text or an accessible name, not by colour alone
- Sortable column headers carry `aria-sort`, including `none` on sortable columns that are not currently active
- Active navigation is marked by more than colour
- The Internal Notes section's restriction is conveyed in text, not only by tint
- Interactive targets are at least 44 px in the mobile band, achieved through the shared control-height tokens rather than per-rule exceptions

---

## 11. Screenshot inventory

Captured by the end-to-end suite into `artifacts/lab-03/screenshots/`, at all three viewports unless noted.

**`authentication/`** — `initial` · `validation-failure` · `invalid-credentials` · `inactive-account` · `busy` · `api-failure` · `change-password-initial` · `change-password-rules-unmet` · `change-password-success` · `signed-in-shell` · `after-logout`

**`staff-queue/`** — `initial` · `search` · `filters` · `sorting` · `pagination` · `unassigned-filter` · `empty` · `no-results` · `failure`

**`staff-ticket-detail/`** — `initial` · `claim` · `assigned` · `it-priority` · `status-change` · `invalid-transition` · `public-comment` · `internal-note` · `attachments` · `requester-resolved-indication`

**`user-management/`** — `list` · `search` · `role-filter` · `create` · `duplicate-email` · `edit` · `new-initial-password` · `self-deactivation-refused` · `last-admin-refused` · `forbidden-for-non-admin`

Filenames are stable and overwritten on each run, so the committed set always reflects the latest passing run rather than accumulating stale evidence.

---

## 12. Visual inspection checklist

Asserted by the automated suite rather than looked at, because a person reviewing screenshots cannot see a two-pixel clip.

| Check | Where asserted |
| --- | --- |
| Header, primary buttons and active navigation use the §7 greens, read from the live browser | Browser |
| New screens sit on the page background; cards and tables are surfaces | Browser |
| Role, status and both priorities render through the one badge component | Component |
| Editable, read-only, invalid, disabled and busy controls each remain distinct | Component |
| Validation messages sit beneath the field they concern | Component |
| Public Comments and Internal Notes are distinguishable without colour | Component |
| Navigation contains only the current role's destinations | Component |
| Password rules panel state is conveyed by text, not colour alone | Component |
| No clipped text at any viewport, screen-reader-only text excepted | Browser |
| No overlapping messages or hidden actions | Browser |
| No horizontal page scrolling at any viewport | Browser |
| Queue table becomes cards below 768 px, losing no column | Browser |
| Sorting remains reachable below 768 px | Browser |
