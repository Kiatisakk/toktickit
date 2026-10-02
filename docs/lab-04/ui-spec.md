# Lab 4 UI Specification — Zen Green, completed

Companion to [specification.md](specification.md). Screen structure, modes, controls, feedback, role behaviour, responsive rules and accessibility for the Lab 4 increment.

[Lab 2](../lab-02/ui-spec.md) and [Lab 3](../lab-03/ui-spec.md) remain in force. This document records only what is **new or changed**; where it is silent, they govern.

---

## 1. What carries over unchanged

Colour tokens, typography, spacing, field/label/validation conventions, button hierarchy, card and table surfaces, the single badge component (status, both priorities, role), state blocks, breadcrumbs, and the three responsive bands. The two dashboards and the Actions Taken area must read as parts of the same application: a screen with its own spacing scale, button shape or green is a defect.

**Badges extend rather than multiply.** Action state (Planned, Done, Cancelled) and follow-up state (Open, Closed, Not required, Void) render through the same badge component, each with a text label; colour is never the only cue.

---

## 2. Application shell and landing

`/dashboard` is the landing page for every role (FR-21, D-12). Sign-in, `/`, and a role refusal (a Requester reaching `/staff/tickets`, a non-Administrator reaching `/admin/users`) all arrive there; the Lab 3 destination `/my-tickets` is no longer the default. A user who must change their password still goes to `/change-password` first (Lab 3 BR-02).

| Role | Navigation |
| --- | --- |
| Requester | **Dashboard** · My Tickets · Create Ticket |
| IT Staff | **Dashboard** · Ticket Queue · My Tickets · Create Ticket |
| Administrator | **Dashboard** · Ticket Queue · User Management · My Tickets · Create Ticket |

Dashboard is first for every role. The active destination is marked by more than colour (Lab 3 §10). The brand link goes to `/`, which redirects to `/dashboard`. An unauthorised destination is still absent, not disabled.

---

## 3. Staff Dashboard

For IT Staff and Administrators, at `/dashboard`. A concise operational starting point connected to the detailed screens (handout §8.1).

### Structure

1. **Heading row** — "Welcome back, *name*" with a one-line subtitle, and a **Refresh** button at the right.
2. **Metric cards** — eight, in this order: New · Open · In Progress · Waiting for Requester · Reopened · My Assigned · Unassigned · My open follow-ups. Each shows its label, its count as the dominant figure, and either a delta line or nothing (below).
3. **My Recent Tickets** — up to five rows: ticket number, summary, status badge, last-updated time; a **View all** link in the card header.
4. **Quick Actions** — Create Ticket, Search Tickets, My Queue, as large link tiles with an icon and a label.

### Cards

Each card is **one link** (an anchor, not a div with a click handler) whose destination is the `drillDown` the API returned (specification.md §5.2). Its accessible name states the label, the value and the delta in words, for example "New, 14 tickets, up 3 from yesterday". It has a visible focus ring and a hover state.

Delta line: an arrow glyph plus text — "▲ +3 from yesterday", "▼ −1 from yesterday", "No change from yesterday". The arrow and the sign are present in text, so the meaning survives without colour. **Cards without a delta** (My Assigned, Unassigned, My open follow-ups) show no delta line, and the card keeps its height, so a row of cards stays aligned.

### Arrangement

| Band | Cards | Lower section |
| --- | --- | --- |
| Desktop ≥ 992 px | Four per row (two rows of four) | Recent Tickets beside Quick Actions, about two-thirds and one-third |
| Tablet 768–991 px | Three per row | Recent Tickets above Quick Actions, full width |
| Mobile < 768 px | One per row, full width | Recent Tickets as cards, then Quick Actions stacked |

### States

| State | What the user sees |
| --- | --- |
| Loading | Card-shaped placeholders in the same grid, a visible "Loading dashboard" for assistive technology; no layout jump when data arrives |
| Success | As above |
| Zero | Every card present with `0` and still a link (BR-27); no delta line on cards without one, "No change from yesterday" where the delta is `0`; Recent Tickets shows "No tickets assigned to you yet." with the Quick Actions beside it |
| Forbidden | A page-level message "You do not have access to this dashboard." with a link to the user's own dashboard route; no numbers |
| Failure | A page-level alert with a safe message ("The dashboard could not be loaded. Try again.") and a **Try again** button; no internal detail; the Refresh button remains |
| Refreshing | Refresh is disabled with a busy label while a request is in flight; existing figures stay until the new ones arrive |

---

## 4. Requester Dashboard

For Requesters, at `/dashboard`. Summarises only the signed-in Requester's Tickets and does not duplicate My Tickets (handout §8.2).

### Structure

1. **Heading row** — "Welcome, *name*" with the subtitle "Here's the latest on your requests." and Refresh.
2. **Metric cards** — four: **Open** · **Waiting for me** · **Resolved** · **Closed**, each a link with a **View all** affordance in its text, to My Tickets pre-filtered (`statusGroup=open`, `status=WAITING_FOR_REQUESTER`, `status=RESOLVED`, `status=CLOSED`). No deltas.
3. **My Recent Tickets** — up to five, ordered by last update, with a status badge; **View all** goes to `/my-tickets`.
4. **Quick Actions** — Create Ticket ("Submit a new request") and View My Tickets ("Track existing requests").

A Ticket in Waiting for Requester is the one that needs the Requester's attention, so the **Waiting for me** card and the status badge in the recent list carry text as well as colour.

### Arrangement

Four cards per row at desktop, two per row at tablet, one per row at mobile; the lower section follows the staff dashboard's bands.

### States

As §3: loading placeholders; **zero** shows `0` on each card and, instead of the list, "You haven't raised any tickets yet." with **Create Ticket** prominent; forbidden and failure as §3. A staff user never sees this screen (their `/dashboard` is §3).

---

## 5. Drill-down destinations

My Tickets and the Ticket Queue **read their initial filters from the URL** (FR-22), so a card opens already filtered and the filter controls show the active filter. `status`, `statusGroup`, `ownerId`, `unassigned` and `followUp` are honoured; changing a filter updates the URL, so the Back button and a shared link behave. A filter the screen has no control for (`statusGroup`, `followUp`) appears as a removable chip ("Open tickets", "My open follow-ups") so the user can see why the list is short and clear it. An empty drill-down shows the screen's own no-results state.

---

## 6. Actions Taken on Ticket Detail

The same Ticket Detail screen serves both roles; the Actions Taken area is a section of it, below the Ticket summary and above Public Comments.

### List

Actions are listed in their stable order (date/time, then id). On desktop a table; below 768 px each row becomes a card carrying every value the table has. Columns: **Date/time** · **Description** (with Result beneath once there is one) · **Performed by** · **State** (badge) · **Follow-up** (badge: Open / Closed / Not required / Void, and "Follows up #n" when linked) · a row action **View**. An empty Ticket shows "No actions have been recorded for this ticket."

### Modes (IT Staff and Administrator)

| Mode | Shown when | Contents |
| --- | --- | --- |
| **Create** | An **Add action** button above the list, while the Ticket accepts Actions | A form: Date/time (default now) · Description · Result (optional) · Performed by (default *me*) · Follow-up required (checkbox) · Follow-up note (appears and is required when ticked) · Follows up (select of this Ticket's non-cancelled Actions that require follow-up, optional) · Attachment notes |
| **View** | **View** on a row | The Action's fields as read-only values with the recorder, performer, state and times |
| **Edit** | **Edit** on a Planned Action | The create form, filled; Save and Cancel |
| **Complete** | **Complete** on a Planned Action | A short form for Result (prefilled if stored, required), Confirm |
| **Cancel action** | **Cancel action** on a Planned Action | A short form for Reason (required), Confirm |

Done and Cancelled Actions show **View** only: no Edit, Complete or Cancel control exists for them, and the view says "This action can no longer be changed." The controls shown by state are courtesy; the backend enforces (BR-04, BR-31). The area is replaced by "Actions can't be added to a resolved, closed or cancelled ticket." plus the list when the Ticket is not actionable (BR-13).

**Performed by** is a select of active IT Staff and Administrators from the existing owners list, defaulting to the signed-in user. If a stale list lets an ineligible person through, the server's `ACTION_ASSIGNEE_INELIGIBLE` is shown beside that field (AC-04).

**Validation** sits beneath the field it concerns, from `details`, with the field focused on submit and the error associated with it (Lab 3 §10). The submit control is disabled and labelled busy while a request is in flight (AC-46, BR-35).

**Request key.** The form generates one `requestId` (a UUID) when it opens for a new Action and sends it with every submit of that Action. A retry after a failure or a lost response, and any resubmit after editing the fields, resends the same key; the key changes only when a new Action is begun (after a successful save, or when **Add action** is opened afresh). A `200` replay is treated as success. On `409 REQUEST_ID_CONFLICT` the screen reloads the Actions, says "An earlier attempt may already have been saved — check the list", keeps the user's entries, and uses a new key for the next submit (AC-48, D-24).

### Requester

The list is the same, read-only, with every Action and every field visible and **no** Add, Edit, Complete or Cancel control present — absent, not disabled. The section heading carries a one-line note: "Work IT has recorded on your ticket." Private content stays in Internal Notes, which the Requester screen still does not show.

---

## 7. Status control and the resolve flow

The status control offers only the transitions the matrix permits from the current status (FR-15, the same module the endpoint reads). A successful change refreshes the Ticket summary status and version from the response.

Choosing **Resolved** opens a **resolve dialog** instead of changing at once:

- A heading "Resolve ticket TKT-…", a **Resolution Summary** textarea (required, 2000 characters, with a counter), and a **checklist** of the four conditions, each shown with an icon *and* text:
  - "At least one completed action" — met / not met
  - "No open follow-ups" — met / not met, with "2 open" when unmet and a link to the first
  - "No planned actions pending" — met / not met, with "1 planned" when unmet and a link to the first; the user completes or cancels it first
  - "Resolution summary entered" — met when the textarea is non-empty
- **Confirm resolution** and **Cancel**. Confirm is enabled when the summary is non-empty; unmet action, follow-up and planned-action conditions are shown before the user submits, from the loaded Actions. The server remains the authority: its `RESOLUTION_GATE_FAILED` `details` replace the checklist's state, with each message beside the condition it names (AC-41).
- The dialog is a real modal: focus moves into it, is trapped, returns to the control that opened it on close, and `Escape` closes it. Closing keeps nothing half-applied.

Every other transition is a single control with a confirmation only for Cancelled, as in Lab 3.

---

## 8. Stale update message

When any Ticket or Action write returns `409 STALE_UPDATE` the screen shows an alert beside the form: "This record was changed by someone else since you opened it. We've loaded the latest version — check it and try again." The latest data is fetched and shown, the **user's entered text stays in the form** (FR-25, AC-42), and the control is re-enabled. The alert is associated with the form and announced. No internal detail is shown. A write refused as `ACTION_NOT_EDITABLE` or `TICKET_NOT_ACTIONABLE` reloads the record and says why in plain words ("This action has already been completed.").

---

## 9. Responsive rules

Same as Labs 2 and 3, applied to every new screen and dialog.

- **Desktop ≥ 992 px** — as described per screen
- **Tablet 768–991 px** — tables remain, scrolling horizontally inside their own container, never the page
- **Mobile < 768 px** — tables become cards; modals and dialogs fit the viewport and scroll inside themselves

At no width does the page scroll horizontally, does any text clip, or do controls overlap. Cards and quick-action tiles wrap rather than shrink their text.

## 10. Accessibility

Same as Labs 2 and 3, and specifically:

- Each metric card is one focusable link with a descriptive accessible name; focus is visible; the whole card is the target
- Delta, state and follow-up status are conveyed in text and glyph, not colour alone
- Every form field has a real `<label>`; validation messages are associated with their field and announced; the first invalid field takes focus on submit
- The resolve dialog and the Complete and Cancel forms manage focus as modals do (§7)
- Loading, error and stale-update messages are announced politely or assertively as appropriate
- Interactive targets are at least 44 px in the mobile band through the shared control-height tokens
- Each page has one `h1`, with headings in order; tables have headers; the Actions list is a table, not a div grid

---

## 11. Screenshot inventory

Captured by the end-to-end suite into `artifacts/lab-04/screenshots/`, at desktop, tablet and mobile unless noted. Filenames are stable and overwritten on each run.

**`staff-dashboard/`** — `loaded` · `loading` · `zero-metrics` · `cards-focused` · `drill-down-new` · `drill-down-my-follow-ups` · `empty-recent` · `failure` · `forbidden`

**`requester-dashboard/`** — `loaded` · `loading` · `zero-metrics` · `waiting-for-me` · `drill-down-open` · `failure` · `forbidden-for-staff`

**`actions-taken/`** — `list-several` · `empty` · `create-form` · `create-validation` · `inactive-performer-refused` · `view` · `edit` · `complete` · `cancel-reason` · `follow-up-open` · `follow-up-linked` · `done-readonly` · `requester-readonly` · `resolve-dialog-unmet` · `resolve-dialog-met` · `resolved` · `stale-update` · `not-actionable`

---

## 12. Visual inspection checklist

Asserted by the automated suite rather than looked at.

| Check | Where asserted |
| --- | --- |
| Dashboards, Actions Taken and the resolve dialog use the Zen Green tokens read from the live browser | Browser |
| Cards and tables are surfaces on the page background | Browser |
| Action state, follow-up state and Ticket status render through the one badge component | Component |
| Each metric card is a single link with a name containing label and value | Component |
| Delta, state and follow-up are distinguishable without colour | Component |
| Editable, read-only (Done, Cancelled, Requester), invalid, disabled and busy controls each stay distinct | Component |
| Validation messages sit beneath the field they concern | Component |
| The Requester sees no Add, Edit, Complete or Cancel control | Component |
| Navigation lists Dashboard first for each role | Component |
| Resolve dialog traps focus and returns it | Component |
| No clipped text at any viewport | Browser |
| No overlapping controls or hidden actions | Browser |
| No horizontal page scrolling at any viewport | Browser |
| Actions table becomes cards below 768 px, losing no column | Browser |
| Visible keyboard focus on cards, rows and dialog controls | Browser |
| No console errors on any Lab 4 screen | Browser |
