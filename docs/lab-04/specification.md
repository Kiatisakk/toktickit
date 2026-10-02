# Lab 4 Sprint Engineering Specification

TokTickIT — Actions Taken, Resolution Workflow, Role Dashboards and Final Regression · CPE 334, Semester 1/2026 · Kiatisak Markmeeshap (67070501005)

Companion documents: [ui-spec.md](ui-spec.md) · [api-spec.md](api-spec.md) · [tests.md](tests.md)

This contract extends [Lab 3](../lab-03/specification.md), which stays in force wherever this document is silent. It records what is **new or changed**, and states explicitly what Lab 3 behaviour is being altered (§3, D-16).

---

## 1. Sprint Goal

IT Staff can plan and record the real work done on a Ticket as Actions Taken, performed by any eligible staff member regardless of who owns the Ticket. A Ticket can only be resolved once that work is on record, no follow-up is left open, and a Resolution Summary says what happened. Concurrent edits can no longer overwrite each other unnoticed. Every role lands on a concise dashboard that links into the detailed screens, and the whole application — Labs 1 to 3 included — is hardened and regression-tested for the final demonstration.

## 2. Stakeholder Request Interpretation

**Record the work, not just the conversation.** Comments and notes say what people discussed. The stakeholder wants a line-by-line account of what was *done*: when, by whom, with what result, and whether anything is left to do. That account belongs to a Ticket, can be planned before it is done, and — once done — is evidence nobody edits afterwards.

**The Owner coordinates; anyone may act.** One person is responsible for a Ticket as a whole, but the person who replaced the cable may be a colleague. So "performed by" is its own field, separate from the Ticket Owner and from the person who typed the line in.

**"Resolved" must mean something.** A Requester saying the problem looks fixed is advice. IT Staff must formally resolve, and the system must refuse to do it while the work is unrecorded or a follow-up is still open. That refusal lives in the backend, because a client can bypass any screen.

**Dashboards summarise; they do not replace.** Each role gets a short page of counts that open the detailed list already built in Lab 3, plus a few recent Tickets. Numbers come from the backend, from stored data, with a defined meaning.

**And the constraint, again: it must all still work.** Every earlier feature continues under the Zen Green language, with consistent loading, empty, forbidden, conflict and failure feedback. Where this sprint changes a Lab 3 behaviour, the change is written down (D-16) rather than discovered.

## 3. Scope

### Included

- Actions Taken under a Ticket: create, list, edit while planned, complete, cancel with a reason, and link a follow-up to an earlier action
- Performed-by assignment to any active IT Staff or Administrator, independent of Ticket Owner (BR-02)
- Requester read-only view of every Action on their own Tickets
- Resolution gate on every transition to Resolved, enforced by the backend, with a Resolution Summary carried by the transition
- A `version` field on Ticket and Action Taken; every write sends it; a stale write is refused `409 STALE_UPDATE` (replaces Lab 3's status-only conditional write)
- An append-only Ticket status history, written by every transition, backfilled for existing Tickets
- A Requester dashboard and an IT Staff / Administrator dashboard, with backend-calculated metrics, day-over-day deltas on status cards, recent Tickets, quick actions and drill-downs into My Tickets and the Ticket Queue
- Two additive list filters to support drill-down: `statusGroup=open` (My Tickets and queue) and `followUp=mine` (queue)
- `/dashboard` as the landing page after sign-in for every role, and first item in navigation
- Prisma migration with backfill, a documented rollback, idempotent seed data
- Final hardening and regression of Labs 1–3, accessibility and responsive checks, README currency

### Excluded

Excluded by the handout (§4.2), and not built:

- Automatic SLA clocks, escalation engines, on-call scheduling, breach notifications
- Email, SMS, LINE, push or any external notification service
- Inventory, spare parts, purchasing, cost accounting for services
- Time-sheet billing, payroll, labour-cost calculation
- Multi-level approval workflows and electronic signatures
- Business-intelligence tools, custom report builders, export warehouses
- Multi-tenant organisations and production-scale cloud operations
- New product features not in this contract

Excluded by this specification, though not forbidden by the handout:

- Editing or deleting a Done or Cancelled Action, and deleting any Action (D-06)
- Re-assigning, re-timing or otherwise altering history rows; no endpoint exposes the status history (it feeds dashboard deltas and is read directly by tests)
- Day-over-day deltas for the ownership-based cards (My Assigned, Unassigned, My open follow-ups): ownership has no history to compare against (D-09)
- A Requester-facing delta of any kind
- Pagination of the Actions list (a Ticket has a handful; see A-03)
- File upload on an Action: Attachment Notes is free text saying what file to look for, as the handout words it
- A separate Administrator dashboard: the Administrator reuses the staff dashboard (handout §4.6)

## 4. Functional Requirements

### Actions Taken

- **FR-01** IT Staff and Administrators create an Action Taken under any Ticket that accepts Actions, with an action date/time, description, optional result, follow-up flag and note, and attachment notes.
- **FR-02** An Action records who created it (from the session) and who performed it (chosen on the form, default the creator). The performer may differ from the Ticket Owner.
- **FR-03** Actions on a Ticket are listed in a stable order: action date/time ascending, then id.
- **FR-04** Any IT Staff or Administrator edits an Action while it is Planned.
- **FR-05** Any IT Staff or Administrator completes a Planned Action, which requires a result.
- **FR-06** Any IT Staff or Administrator cancels a Planned Action, which requires a reason.
- **FR-07** An Action that requires follow-up carries a follow-up note, and a later Action may declare that it follows up an earlier one.
- **FR-08** A follow-up is shown as open until a Done Action follows it up, and as closed afterwards.
- **FR-09** A Requester views every Action on their own Tickets, every field, read-only.

### Ticket workflow

- **FR-10** The backend refuses any transition to Resolved unless the resolution gate holds (BR-16), and says which conditions failed.
- **FR-11** The transition to Resolved carries the Resolution Summary, which is stored on the Ticket.
- **FR-12** Every status transition, and every Ticket's creation, appends a row to the status history in the same transaction.
- **FR-13** Every Ticket write (owner, IT Priority, status) sends the version it read; a stale write is refused and nothing changes.
- **FR-14** Every Action write (edit, complete, cancel) sends the version it read, with the same refusal.
- **FR-15** The status control offers only permitted transitions, and a successful change refreshes the Ticket summary.
- **FR-16** A Requester's "problem appears resolved" indication stays advisory.

### Dashboards

- **FR-17** A Requester retrieves a dashboard of metrics and recent Tickets that covers only their own Tickets.
- **FR-18** IT Staff and Administrators retrieve a dashboard of operational metrics, My Recent Tickets and quick actions.
- **FR-19** Each card carries its own drill-down destination and query, defined by the backend.
- **FR-20** Status-based staff cards show the change since the start of today (Asia/Bangkok).
- **FR-21** Sign-in, `/`, and a role refusal all land on `/dashboard`, which is the first navigation item for every role.
- **FR-22** My Tickets and the Ticket Queue read their initial filters from the URL, so a drill-down arrives already filtered.
- **FR-23** The Ticket Queue accepts `statusGroup=open` and `followUp=mine`; My Tickets accepts `statusGroup=open`.

### Hardening

- **FR-24** Loading, validation, success, empty, no-results, forbidden, conflict, not-found and safe API-failure feedback is consistent across every screen.
- **FR-25** Forms keep the user's entered data after a recoverable failure, including a stale-update refusal.
- **FR-26** Repeated clicking, or a retry after a lost response, does not create a duplicate Action or repeat a transition.
- **FR-27** The seed is idempotent and demonstrates zero and non-zero metrics; the README setup, migration, seed, test and demonstration instructions are current.
- **FR-28** No console errors, broken links, placeholder text or unfinished controls remain; temporary and obsolete elements from earlier labs are removed.
- **FR-29** Every Lab 1–3 function continues to work for the roles that were permitted it.
- **FR-30** Every new write endpoint is refused without a session (`401`), with the wrong role (`403`), and while a password change is outstanding (`403`).

## 5. Business Rules

`BR-01` and `BR-02` are fixed by §4.4 of the handout and reproduced as given.

### Actions Taken

- **BR-01** Action Taken belongs to exactly one Ticket.
- **BR-02** The Ticket Owner coordinates the Ticket, but an Action Taken may be by a different IT Staff member.
- **BR-03** An Action's state is Planned, Done or Cancelled. Planned moves to Done or to Cancelled and nowhere else. Done and Cancelled are terminal.
- **BR-04** Done and Cancelled Actions are read-only evidence: no endpoint edits or deletes them, and none deletes any Action.
- **BR-05** Cancelling requires a reason of 1 to 500 characters after trimming.
- **BR-06** Completing requires a non-empty Result (1 to 2000 characters), either already stored or supplied with the completion. Result may be empty while the Action is Planned.
- **BR-07** `recordedBy` is the authenticated user and is never read from the request. `performedBy` is an IT Staff or Administrator who is active at the moment of the write, defaulting to the creator; anything else is refused `400 ACTION_ASSIGNEE_INELIGIBLE`.
- **BR-08** Follow-up Note is required (1 to 1000 characters) when Follow-Up Required is true, and must be absent when it is false.
- **BR-09** A follow-up is **open** when its Action has Follow-Up Required, is not Cancelled, and no Done Action follows it up. When a Done Action follows it up it is **closed**. Openness is derived on read, never stored. Only a Done Action closes a follow-up, and a Done Action is terminal (BR-03), so a closed follow-up stays closed; cancelling a Planned follower has no effect on it, since a Planned Action never closed it.
- **BR-10** An Action may follow up one earlier Action on the **same Ticket**, which must require follow-up and must not be Cancelled. The link is set at creation and never changed: `PATCH` refuses `followsUpId`, and the edit form shows it read-only. Clearing Follow-Up Required on an Action that is already followed up is refused.
- **BR-11** Any IT Staff or Administrator may edit, complete or cancel a Planned Action, not only its creator, performer or the Ticket Owner. A Requester may do none of these.
- **BR-12** A Requester sees every Action on their own Ticket with every field. Content that must stay private belongs in an Internal Note, which a Requester still cannot read (Lab 3 BR-04).
- **BR-13** Actions may be created, edited, completed or cancelled only while the Ticket is New, Open, In Progress, Waiting for Requester or Reopened. On a Resolved, Closed or Cancelled Ticket every Action write is refused `409 TICKET_NOT_ACTIONABLE`. This keeps "a Resolved Ticket has no open follow-up" true.
- **BR-14** Field bounds: Description 1 to 2000 characters after trimming; Attachment Notes at most 1000; Action date/time is an ISO 8601 instant that is not more than one minute in the future and defaults to the server clock.

### Ticket status and resolution

- **BR-15** The eight statuses and the Lab 3 transition matrix are unchanged; §5.1 restates it with the gate.
- **BR-16** **Resolution gate.** A transition to Resolved, from any status, is permitted only when all four hold: (a) the Ticket has at least one Done Action; (b) the Ticket has no open follow-up (BR-09); (c) the Ticket has no Action in the Planned state, so remaining planned work must be completed or cancelled first; (d) the request carries a non-empty Resolution Summary. The gate is evaluated inside the transition's transaction with the Ticket row locked, and **every Action write — create, edit, complete and cancel — locks the same row first**, re-checking that the Ticket still accepts Actions (BR-13) under that lock. A write racing a resolution therefore either commits before it, and the gate sees its effect, or waits and is refused `409 TICKET_NOT_ACTIONABLE`; it cannot commit onto a Resolved Ticket. (Raised in review: the lock was first stated for creation only, and an edit can also set Follow-Up Required.) Every unmet condition is reported together. Condition (c) was added after review (D-03).
- **BR-17** Resolution Summary is 1 to 2000 characters after trimming, required when the target is Resolved and refused otherwise. It is stored in `Ticket.resolutionSummary`, kept when the Ticket is later reopened, and overwritten by the next resolution.
- **BR-18** A Requester's indication that the problem appears resolved (Lab 3 BR-27) is advisory. It does not change the status and does not satisfy any condition of the gate.

### Versioning and history

- **BR-19** Ticket and Action Taken each carry an integer `version`, starting at 1. A write names the version it read and is applied only if that is still the stored version, atomically (`WHERE id AND version`); success increments it by one. A mismatch is `409 STALE_UPDATE` and changes nothing. A missing or non-integer version is `400 VALIDATION_FAILED`. The Requester's resolved indication increments the Ticket version but, being set-once and bodiless, sends none.
- **BR-20** A write is checked in this order: body shape (`400`), existence and scope (`404`), version (`409 STALE_UPDATE`), Ticket or Action state (`409 TICKET_NOT_ACTIONABLE`, `409 ACTION_NOT_EDITABLE`, `400 INVALID_STATUS_TRANSITION`), then the gate (`400 RESOLUTION_GATE_FAILED`). Checking the version first means a caller holding an outdated picture is told so before being told something derived from it.
- **BR-21** The status history is append-only. A new Ticket gets a `null → New` row; every successful transition gets one `from → to` row with the actor and the server time, written in the same transaction as the change. A refused transition writes nothing. No row is updated or deleted.

### Dashboards

- **BR-22** Dashboard metrics are calculated by the backend from stored data, scoped by the session identity. The client sends no identity and no count.
- **BR-23** The day boundary is midnight **Asia/Bangkok** (UTC+7, no daylight saving). "Yesterday" means the instant at 00:00 today in that zone, call it T0. A delta is today's count minus the count as at T0, where a Ticket's status as at T0 is the `toStatus` of its latest history row before T0, and a Ticket with no row before T0 did not exist.
- **BR-24** The **open group** is every status except Resolved, Closed and Cancelled, so Reopened counts as open. Metric definitions are in §5.2.
- **BR-25** Only the status-based cards carry a delta. Ownership-based cards (My Assigned, Unassigned, My open follow-ups) have `delta: null` and show none; the Requester dashboard shows no deltas.
- **BR-26** "My Recent Tickets" is at most five Tickets ordered by last update, newest first, then id descending: for staff those owned by the current user, for a Requester those they raised.
- **BR-27** A card with a count of zero is shown as `0` and still links to the filtered list, which then shows its own empty state. A card is never hidden because it is zero.
- **BR-28** The Requester dashboard endpoint is for Requesters only and the staff dashboard endpoint for IT Staff and Administrators only; the other roles are refused `403`. The `/dashboard` screen chooses by role.
- **BR-29** `statusGroup` accepts only `open` and cannot be combined with `status`. `followUp` accepts only `mine`, exists only on the queue, and resolves to the signed-in user, so no identity travels in the query. A blank value means no filter, as Lab 3 BR-34 does for filters.

### Migration, continuity and delivery

- **BR-30** The migration preserves every existing row. Existing Tickets have version 1 and no Actions. Each Ticket receives backfilled history (§7). The gate applies only to new transitions, so a Ticket already Resolved is untouched.
- **BR-31** Authorization is enforced by the backend on every write (Lab 3 BR-17). A role failure is `403`; an ownership failure is `404`, identical to absence (Lab 3 BR-18).
- **BR-32** Error responses use the Lab 3 envelope and never disclose a stack trace, path, database message, or the existence of a resource the caller cannot see (Lab 3 BR-20).
- **BR-33** The seed is safe to run repeatedly: it never duplicates a Ticket, Action or history row.
- **BR-34** Dashboard drill-down destinations are returned by the backend with the card, so the screen and the rule that defines the count cannot drift apart.
- **BR-35** Action creation is idempotent on a client-generated key. The client sends a UUID `requestId` with each *intentional* create and resends the same value when it retries. `(ticketId, requestId)` is unique. A create whose key already exists on that Ticket returns the existing Action (`200`, not `201`) and writes nothing; the same key with different field values is refused `409 REQUEST_ID_CONFLICT`; a new intentional Action uses a new key. The interface also disables the submit control while a request is pending. Repeating a completion or cancellation is harmless because the second attempt carries a stale version.

### 5.1 Ticket status transition matrix

The Lab 3 matrix, restated, with the new condition. Every transition belongs to IT Staff or an Administrator; a Requester sets no status.

| From | Permitted transitions | Extra condition |
| --- | --- | --- |
| New | Open, Cancelled | — |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled | → Resolved needs the gate |
| In Progress | Waiting for Requester, Resolved, Cancelled | → Resolved needs the gate |
| Waiting for Requester | In Progress, Resolved, Cancelled | → Resolved needs the gate |
| Resolved | Closed, Reopened | — |
| Closed | Reopened | — |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled | → Resolved needs the gate |
| Cancelled | *(terminal)* | — |

Every write to a Ticket additionally needs the current `version`.

### 5.2 Dashboard metrics

T0 is defined in BR-23. "Open group" is BR-24. `me` is the signed-in user. Counts are of Tickets unless stated.

**IT Staff and Administrator dashboard** — `GET /api/dashboard/staff`, drilling into the Ticket Queue (`/staff/tickets`).

| Card | Exact calculation | Delta | Empty behaviour | Drill-down |
| --- | --- | --- | --- | --- |
| New | Tickets with `currentStatus = NEW` | Today's count minus the count of Tickets whose status as at T0 was New | `0`; delta `0` reads "No change" | `status=NEW` |
| Open | `currentStatus = OPEN` | Same, for Open | as above | `status=OPEN` |
| In Progress | `currentStatus = IN_PROGRESS` | Same, for In Progress | as above | `status=IN_PROGRESS` |
| Waiting for Requester | `currentStatus = WAITING_FOR_REQUESTER` | Same, for Waiting | as above | `status=WAITING_FOR_REQUESTER` |
| Reopened | `currentStatus = REOPENED` | Same, for Reopened | as above | `status=REOPENED` |
| My Assigned | `ticketOwnerId = me` and status in the open group | none (`null`) | `0`, no delta | `ownerId=<me>&statusGroup=open` |
| Unassigned | `ticketOwnerId IS NULL` and status in the open group | none (`null`) | `0`, no delta | `unassigned=true&statusGroup=open` |
| My open follow-ups | Distinct Tickets with at least one open follow-up (BR-09) whose Action has `performedById = me` | none (`null`) | `0`, no delta | `followUp=mine` |

Plus **My Recent Tickets** (BR-26: owned by me, at most five, each with number, summary, status and last-updated time, "View all" → `ownerId=<me>`) and **Quick Actions**: Create Ticket (`/tickets/new`), Search Tickets (`/staff/tickets`), My Queue (`/staff/tickets?ownerId=<me>&statusGroup=open`).

**Requester dashboard** — `GET /api/dashboard/requester`, drilling into My Tickets (`/my-tickets`). All counts are of Tickets with `requesterId = me`. No deltas.

| Card | Exact calculation | Empty behaviour | Drill-down |
| --- | --- | --- | --- |
| Open | Status in the open group | `0`, still linked | `statusGroup=open` |
| Waiting for me | `currentStatus = WAITING_FOR_REQUESTER` | `0`, still linked | `status=WAITING_FOR_REQUESTER` |
| Resolved | `currentStatus = RESOLVED` | `0`, still linked | `status=RESOLVED` |
| Closed | `currentStatus = CLOSED` | `0`, still linked | `status=CLOSED` |

Plus **My Recent Tickets** (BR-26, "View all" → `/my-tickets`) and **Quick Actions**: Create Ticket, View My Tickets.

Cancelled Tickets have no card; they stay reachable through My Tickets' status filter.

## 6. UI Specification Summary

Full detail is in [ui-spec.md](ui-spec.md). In summary:

**New screens.** The Staff Dashboard and the Requester Dashboard, both at `/dashboard`.

**Changed screens.** Ticket Detail gains an **Actions Taken** area — list, create form, view/edit while Planned, complete, cancel, follow-up linking for staff; the same list read-only for the Requester. The status control gains a **resolve dialog** that collects the Resolution Summary and shows which gate conditions are met. Every Ticket and Action write handles `409 STALE_UPDATE` with a refresh-and-retry message that keeps the user's input. My Tickets and the Ticket Queue read their initial filters from the URL. Navigation gains **Dashboard** as the first item for every role; sign-in and role refusals land on it.

**Consistency.** Zen Green tokens, cards, badges, buttons, forms, state blocks and the three responsive bands are reused. Responsive and accessibility requirements are the same as Labs 2 and 3. Metric cards are links with visible focus and a text label; status and delta carry text and an arrow as well as colour.

**Feedback.** Loading, validation, success, empty, no-results, forbidden, not-found, conflict and safe failure, wherever reachable.

**Evidence.** Screenshots at three viewports under `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/`.

## 7. Data Changes

### New models

**ActionTaken** — `id`, `ticketId` (cascade on delete of the Ticket), `recordedById` and `performedById` (both Users), `actionAt`, `description`, `result` (nullable), `state` (enum `ActionState`: `PLANNED`, `DONE`, `CANCELLED`), `followUpRequired` (boolean), `followUpNote` (nullable; required iff `followUpRequired`), `attachmentNotes` (nullable), `requestId` (UUID text, the client's idempotency key, BR-35), `followsUpId` (nullable self-relation to another ActionTaken), `cancelReason` (nullable), `version` (integer, default 1), `createdAt`, `updatedAt`. Indexes: `(ticketId, actionAt, id)` for the Ticket's list order, `(performedById, state)` for "my open follow-ups", and a **unique** `(ticketId, requestId)` that makes a repeated create find its first result. `updatedAt` of a Done or Cancelled Action is the moment it reached that state, because it is never written again.

**TicketStatusChange** — `id`, `ticketId` (cascade), `fromStatus` (nullable `TicketStatus`; null on creation), `toStatus`, `changedById` (nullable User; null means *migrated*), `changedAt` (default now). Indexes: `(ticketId, changedAt)` for "status as at T0" and `(changedAt)` for range scans.

### Changed models

**Ticket** gains `version Int @default(1)`. Nothing else changes: `resolutionSummary` already exists and is reused (D-16). **User** gains the back-relations for the three new foreign keys and nothing else.

### Relationships

- One Ticket has many Actions Taken; each Action has exactly one Ticket (BR-01).
- Each Action has one recorder and one performer, both Users; neither need be the Ticket Owner (BR-02).
- An Action may follow up one other Action (`followsUpId`); an Action may be followed up by many.
- One Ticket has many status-history rows; each is optionally attributed to a User.
- Users, Tickets, Attachments, Public Comments, Internal Notes, Sessions and reference data are unchanged and remain valid.

### Migration and backfill

One Prisma migration, with the backfill as plain SQL inside it — not a separate script someone must remember to run, which is what Lab 3's review found had to change. In one transaction it: creates the `ActionState` enum and the two tables with their indexes; adds `Ticket.version` with default 1 (existing rows therefore read 1); and backfills history:

- every existing Ticket gets a row `null → NEW` at its `createdAt`;
- every existing Ticket whose `currentStatus` is not `NEW` also gets a row `NEW → <currentStatus>` at its `updatedAt`;
- `changedById` is null on all of them, meaning *migrated*.

This is an approximation and is documented as one: a legacy Ticket's real journey is unknown, and `updatedAt` is when it was last touched, not necessarily when it reached its status. **Dashboard deltas for legacy Tickets are exact only from the migration forward.** Legacy Tickets have zero Actions; none is invented. The gate applies only to new transitions into Resolved, so a Ticket already Resolved stays Resolved.

**Rollback.** Prisma has no down-migration, so the repository carries a hand-written `down` script beside the migration that drops `TicketStatusChange`, `ActionTaken`, the `ActionState` enum and `Ticket.version`. Data in those objects is lost by design; every earlier table is untouched. Recovery from a failed forward run is the transaction itself (nothing is half-applied), and from a bad forward run the documented `pg_dump` taken before migrating. Both are tested (MIG-03, MIG-04) on a throwaway database built in the Lab 3 shape.

### Seed

The demonstration seed (development database only, as in Lab 3) is idempotent: each seeded Ticket and Action has a fixed key and is upserted, and its history rows are written only if absent. It provides Tickets in every status and priority, assigned and unassigned; Tickets with zero, one and several Actions; Planned, Done and Cancelled Actions; performers who are not the Ticket Owner; an open follow-up and a closed one; a Resolved Ticket that satisfied the gate; and a Requester with no Tickets and a staff member with none assigned, so zero and non-zero metrics both appear. Some history rows are timed yesterday (Bangkok) so deltas are non-zero on the day it is run. The reference seed (users, categories, related systems) is unchanged.

## 8. API Contract

Full detail is in [api-spec.md](api-spec.md). In summary:

| Endpoint | Roles | Purpose |
| --- | --- | --- |
| `GET /api/tickets/:id/actions` | Requester (own), IT Staff, Admin | List a Ticket's Actions |
| `POST /api/tickets/:id/actions` | IT Staff, Admin | Create an Action |
| `PATCH /api/actions/:id` | IT Staff, Admin | Edit a Planned Action |
| `POST /api/actions/:id/complete` | IT Staff, Admin | Planned → Done |
| `POST /api/actions/:id/cancel` | IT Staff, Admin | Planned → Cancelled, with reason |
| `GET /api/dashboard/requester` | Requester | Requester metrics and recent Tickets |
| `GET /api/dashboard/staff` | IT Staff, Admin | Staff metrics and recent Tickets |

**Changed from Lab 3.** The three staff Ticket writes (`/owner`, `/it-priority`, `/status`) now accept their one named field **plus `version`**, and the status endpoint also accepts `resolutionSummary`, required only when the target is Resolved. Lab 3's race refusal `400 INVALID_STATUS_TRANSITION` ("the ticket moved while this change was being made") becomes `409 STALE_UPDATE`. Ticket responses carry `version`. The queue gains `statusGroup` and `followUp`; My Tickets gains `statusGroup`.

**Create is idempotent** (`requestId`; a replay answers `200` with the existing Action).

**New error codes.** `STALE_UPDATE` (409), `RESOLUTION_GATE_FAILED` (400), `ACTION_ASSIGNEE_INELIGIBLE` (400), `ACTION_NOT_EDITABLE` (409), `ACTION_NOT_FOUND` (404), `TICKET_NOT_ACTIONABLE` (409), `REQUEST_ID_CONFLICT` (409).

**Unchanged.** Authentication, password change, reference data, Ticket creation and listing and detail, attachments, Public Comments, Internal Notes, the resolved indication, Administrator user management, health.

## 9. Acceptance Criteria

`AC-01` and `AC-02` are given by §9.1 of the handout and reproduced in meaning.

### Actions Taken

- **AC-01** Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator as `recordedBy` and the approved assignee as `performedBy`.
- **AC-02** Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned.
- **AC-03** Given an Action created with no `performedById`, when it is saved, then `performedBy` is the creator; and given a `recordedById` or `state` in the body, then it is refused `400 VALIDATION_FAILED` and the recorder is still the session user.
- **AC-04** Given a `performedById` naming an inactive user, a Requester, or an unknown id, when an Action is created or edited, then it is refused `400 ACTION_ASSIGNEE_INELIGIBLE` and nothing is stored.
- **AC-05** Given an Action with a missing description, a Follow-Up Required with no note, a note without Follow-Up Required, or a field over its limit, when it is submitted, then it is refused `400 VALIDATION_FAILED` with the field named in `details`.
- **AC-06** Given a Ticket with several Actions, when they are listed, then all are returned in action date/time then id order, each with its performer, recorder, state and follow-up state.
- **AC-07** Given a Requester who owns a Ticket, when they list its Actions, then every Action and every field is returned; and when they try to create, edit, complete or cancel one, then it is refused `403`; and given another Requester's Ticket, then the response is `404`.
- **AC-08** Given a Planned Action created by one staff member, when a different staff member who is not its performer or the Ticket Owner edits it, then the edit is saved and `recordedBy` is unchanged.
- **AC-09** Given a Planned Action, when it is completed with a result, then it becomes Done; and given one with no result stored or supplied, then completion is refused `400`.
- **AC-10** Given a Planned Action, when it is cancelled with a reason, then it becomes Cancelled and keeps the reason; and given no reason, then it is refused `400`.
- **AC-11** Given a Done or Cancelled Action, when an edit, completion or cancellation is requested, then it is refused `409 ACTION_NOT_EDITABLE` and the Action is unchanged.
- **AC-12** Given an Action requiring follow-up, when a Done Action following it up exists then its follow-up is closed, and when that Action is Planned or Cancelled it stays open.
- **AC-13** Given a `followsUpId` naming an Action on another Ticket, an Action not requiring follow-up, or a Cancelled Action, when an Action is created, then it is refused `400 VALIDATION_FAILED`.
- **AC-14** Given a Ticket that is Resolved, Closed or Cancelled, when any Action write is requested, then it is refused `409 TICKET_NOT_ACTIONABLE`.

### Resolution workflow

- **AC-15** Given a Ticket with no Done Action, when a transition to Resolved is requested with a summary, then it is refused `400 RESOLUTION_GATE_FAILED` naming the missing Done Action, and the status is unchanged.
- **AC-16** Given a Ticket with an open follow-up, when a transition to Resolved is requested, then it is refused `400 RESOLUTION_GATE_FAILED` naming the open follow-up, and the status is unchanged.
- **AC-17** Given a missing, empty or whitespace-only Resolution Summary, when a transition to Resolved is requested, then it is refused `400 RESOLUTION_GATE_FAILED` naming the summary.
- **AC-18** Given a Ticket failing several conditions, when a transition to Resolved is requested, then every unmet condition is named in one response.
- **AC-19** Given a Ticket with a Done Action, no open follow-up, no Planned Action and a summary, when it is moved to Resolved, then the status, the Resolution Summary and a history row are saved, and the response carries the new Ticket.
- **AC-20** Given a Ticket in each of Open, In Progress, Waiting for Requester and Reopened, when a client calls the API directly to resolve it without meeting the gate, then it is refused; and given a transition to any other status, then no gate condition is evaluated.
- **AC-21** Given a Requester who has indicated the problem appears resolved, when the Ticket fails the gate, then it is still refused and its status is unchanged.
- **AC-22** Given the Lab 3 status matrix, when each permitted and each non-permitted transition is requested, then only permitted ones succeed, and Cancelled stays terminal.
- **AC-23** Given any successful transition, when it completes, then exactly one history row `from → to` with the actor and server time is saved in the same transaction; given a refused transition, then none; and given a new Ticket, then a `null → New` row exists.

### Concurrency

- **AC-24** Given two staff who loaded the same Ticket, when the second sends an owner, IT Priority or status change with the old `version`, then it is refused `409 STALE_UPDATE`, nothing changes, and a change with the current version succeeds and increments it.
- **AC-25** Given two staff who loaded the same Action, when both complete or cancel it at once, then exactly one succeeds and the other is `409 STALE_UPDATE`.
- **AC-26** Given a write with a missing or non-integer `version`, when it is submitted, then it is refused `400 VALIDATION_FAILED` naming `version`.
- **AC-27** Given a resolution and an Action write that creates an open follow-up — a new Action, or an edit turning Follow-Up Required on — submitted at the same moment, when both are processed, then a Ticket is never left Resolved with an open follow-up.

### Dashboards

- **AC-28** Given known data, when the staff dashboard is retrieved, then each card's count equals the direct database count defined in §5.2, and each status card's delta equals today's count minus the count at midnight Asia/Bangkok.
- **AC-29** Given history rows timed either side of midnight Bangkok, when deltas are calculated, then Tickets changed before the boundary count as at T0 and Tickets changed after it do not.
- **AC-30** Given a card, when its drill-down is followed, then the destination list filters exactly as the card counts, and its total equals the card's count.
- **AC-31** Given a Requester with no Tickets, or a staff member with nothing assigned, when the dashboard is retrieved, then counts are `0`, cards remain present and linked, deltas are `0` or `null` as defined, and the recent list is empty.
- **AC-32** Given a Requester, when they request the staff dashboard, or staff request the Requester dashboard, then the request is refused `403`; and given an Administrator, then the staff dashboard is returned.
- **AC-33** Given a Requester with Tickets in every status, when the Requester dashboard is retrieved, then Open, Waiting for me, Resolved and Closed match §5.2, Reopened counts as Open, and at most five own Tickets are listed newest-updated first.
- **AC-34** Given the queue with `statusGroup=open`, `followUp=mine` or both, and My Tickets with `statusGroup=open`, when requested, then results match the definitions; and given an invalid or conflicting value, then `400 INVALID_QUERY_PARAMETER`.

### Migration and seed

- **AC-35** Given a Lab 3 database with data, when the migration runs, then every User, Ticket, Attachment, Public Comment and Internal Note is preserved, every Ticket has version 1 and no Actions, and history is backfilled as §7 states.
- **AC-36** Given the migration applied, when the rollback script runs and the migration is applied again, then earlier data is intact throughout.
- **AC-37** Given the seed run twice, when counts are compared, then nothing is duplicated, and the data shows zero and non-zero metrics, all statuses, and Tickets with zero, one and several Actions.

### Interface

- **AC-38** Given a signed-in user of any role, when they sign in, open `/`, or are refused a staff or admin route, then they arrive at `/dashboard`, and Dashboard is the first navigation item.
- **AC-39** Given each dashboard, when it loads, fails, is empty or is refused, then it shows loading, safe-failure with retry, empty, or forbidden feedback, and each card is a keyboard-focusable link whose name states the label and value.
- **AC-40** Given IT Staff on Ticket Detail, when they list, create, edit, complete, cancel and link follow-ups, then each works from the screen with validation beside the field; and given a Requester, then the same list is read-only with no controls.
- **AC-41** Given the resolve dialog, when the gate is unmet, then each unmet condition is listed in text, and a server refusal updates that list; and given a met gate, then resolving refreshes the Ticket summary.
- **AC-42** Given a `409 STALE_UPDATE` on any Ticket or Action form, when it is shown, then the message says someone else changed the record, the latest data is loaded, and the user's entered text is kept.
- **AC-43** Given the dashboards, Actions Taken and the resolve dialog, when rendered at desktop, tablet and mobile widths, then nothing is clipped, nothing overlaps, there is no horizontal scrolling, and keyboard focus is visible and modal focus is managed.

### Hardening and regression

- **AC-44** Given every new write endpoint, when called without a session, with the wrong role, or while a password change is outstanding, then it is refused `401`, `403` and `403`; and no error body discloses internal detail.
- **AC-45** Given the Lab 1–3 suites, when run after this sprint with the changes recorded in D-16 applied to them, then they all pass, and authentication, ownership, comments, notes, attachments, user management and the staff queue behave as before.
- **AC-46** Given repeated clicking of submit on the Action form, when requests are in flight, then exactly one Action is created.
- **AC-47** Given the full journeys (record an Action, resolve a Ticket, view the dashboards), when run end to end in a real browser, then they pass with no console errors and no broken links.

### Added after review

- **AC-48** Given an Action create carrying a `requestId`, when the same request is sent a second time (a retry after a lost response), then the second returns the existing Action with `200`, only one Action exists, and nothing else is written; and given the same `requestId` with a changed field, then it is refused `409 REQUEST_ID_CONFLICT` and nothing is stored; and given a missing or non-UUID `requestId`, then `400 VALIDATION_FAILED`; and given a different `requestId`, then a second Action is created.
- **AC-49** Given a Ticket with an Action in the Planned state, when a transition to Resolved is requested, then it is refused `400 RESOLUTION_GATE_FAILED` naming the pending Planned Actions and the status is unchanged; and given those Actions are then completed or cancelled, then the transition succeeds.

## 10. Definition of Done

The sprint is complete when every item below holds on `main`.

**Product**

- [ ] IT Staff create, list, edit while Planned, complete and cancel Actions Taken on a Ticket, with performer separate from Ticket Owner and creator
- [ ] An inactive or non-staff performer is refused; Done and Cancelled Actions cannot change
- [ ] A follow-up shows as open until a Done Action follows it up
- [ ] A Requester sees every Action on their own Tickets, read-only, and no one else's
- [ ] A Ticket cannot be Resolved without a Done Action, with an open follow-up, with a Planned Action still pending, or without a Resolution Summary — even when the API is called directly — and every unmet condition is reported
- [ ] A repeated Action create with the same `requestId` yields one Action; a changed payload under that key is refused
- [ ] A stale Ticket or Action write is refused `409` and overwrites nothing
- [ ] Every status transition is in the history; dashboard deltas use midnight Asia/Bangkok
- [ ] Both dashboards show the defined cards with correct counts, recent Tickets and quick actions, and every card drills into a correctly filtered list
- [ ] Sign-in lands on `/dashboard` for every role, and Dashboard is the first navigation item
- [ ] Loading, empty, forbidden, conflict and failure states exist on every new screen
- [ ] Every screen is usable at desktop, tablet and mobile in Zen Green, with visible focus, no clipping, overlap or horizontal scrolling
- [ ] Every Lab 1–3 function still works for its permitted roles

**Engineering**

- [ ] Every acceptance criterion maps to at least one passing test
- [ ] Unit, API/integration, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke and end-to-end suites pass on `main`
- [ ] Dashboard metrics are shown to match direct SQL counts
- [ ] No test is skipped, disabled or commented out; the formatter and linter report no errors
- [ ] The migration preserves data, is backfilled, and its rollback has been run
- [ ] The seed is idempotent and demonstrates zero and non-zero metrics
- [ ] No console errors, broken links, placeholder text or unfinished controls remain; the README is current
- [ ] The Lab 3 tests changed by D-16 are updated, not deleted
- [ ] `specification.md`, `api-spec.md`, `ui-spec.md` and `tests.md` describe what the code does

**Process**

- [ ] Every Issue is labelled `lab-04`, linked from its Pull Request, and on the board in Done
- [ ] Every Pull Request was reviewed and merged by the peer reviewer
- [ ] This contract merged before any implementation Pull Request
- [ ] `reviewer.md` and `ai-use.md` are current; the reflection is written by the author
- [ ] Screenshots exist for each state in the ui-spec inventory

## 11. Assumptions and Decisions

The first thirteen decisions were settled with the author before this document was written; they are recorded as made.

- **D-01 Performed-by is separate from the assignee.** `recordedBy` is the session, automatically, never from the client. `performedBy` is an IT Staff or Administrator chosen on the form, default the creator, active at the moment of the write; otherwise `400 ACTION_ASSIGNEE_INELIGIBLE`. It may differ from the Ticket Owner (BR-02). *Rejected:* one "assignee" column, which cannot say both who logged an action and who did it, and which would force the Owner to be the actor, against BR-02.

- **D-02 Action state is Planned → Done or Cancelled.** Done and Cancelled are terminal and read-only; Cancel requires a reason. *Why:* the stakeholder wants work planned *and* tracked, and a terminal state is what makes the record evidence.

- **D-03 The resolution gate has four conditions, all enforced by the backend:** at least one Done Action, no open follow-up, no Action still in the Planned state, and a non-empty Resolution Summary sent with the transition. Refusal is `400 RESOLUTION_GATE_FAILED` with `details` naming each unmet condition. *Why:* the handout requires the rule to hold when a client bypasses the screen; naming every unmet condition at once saves the user a refusal per condition. *Added after review:* the three conditions settled in the grill left a gap, because with D-17 freezing Actions on resolved Tickets a Planned Action left at resolution would stay Planned forever and show the Requester planned work on a resolved Ticket; the author added the fourth condition so remaining work is completed or cancelled first.

- **D-04 A Requester sees every Action, every field, read-only.** Private content stays in Internal Notes. *Rejected:* a per-Action visibility flag, which makes a leak a matter of remembering a filter — the same reasoning that gave Lab 3 two message tables (Lab 3 D-09).

- **D-05 A follow-up is closed by a new Action that follows it up.** When that Action is Done, the earlier follow-up counts as closed. *Rejected:* a manual "closed" checkbox, which can disagree with the work actually recorded.

- **D-06 Any IT Staff or Administrator edits an Action while it is Planned.** Done and Cancelled are permanent, append-only evidence for the sprint's grading of append-only behaviour. *Rejected:* creator-only or performer-only editing, which strands a Planned Action when its author is away.

- **D-07 Stale updates use a `version` integer on Ticket and ActionTaken.** Every write sends the version it read; a mismatch is `409 STALE_UPDATE`. It covers every Ticket write (owner, IT Priority, status) and every Action write, replacing Lab 3's status-only conditional write.

- **D-08 Status history is a new append-only `TicketStatusChange` table** (from, to, by, at). Every transition writes one row in the same transaction.

- **D-09 Dashboard deltas are built from status history,** with the day boundary at midnight Asia/Bangkok, and legacy Tickets are given backfilled history (§7). *Consequence recorded:* only status-based cards have deltas, because ownership has no history (BR-25).

- **D-10 Staff dashboard cards:** New, Open, In Progress, Waiting for Requester, Reopened, My Assigned, Unassigned and My open follow-ups; plus My Recent Tickets and Quick Actions. Each drills into the Ticket Queue with the matching filter. *Reopened was added after the grill, see D-14.*

- **D-11 Requester dashboard cards:** Open (not Resolved, Closed or Cancelled), Waiting for me, Resolved, Closed; plus My Recent Tickets and Quick Actions. Each drills into My Tickets.

- **D-12 `/dashboard` is the landing page after sign-in for every role** and the first navigation item. My Tickets and the Queue are unchanged.

- **D-13 Branch strategy: parallel first.** Implementation Issues run in parallel where independent; a branch is stacked on another only when every unblocked Issue depends on one in review, and one deep at most; never on this contract Pull Request. Recorded in `CLAUDE.md`.

The next decisions fill gaps the grill left, approved afterwards.

- **D-14 Reopened is a staff card.** *Why:* a Reopened Ticket is one the Requester came back about, so it must not be invisible on the dashboard; counting it inside Open or In Progress would hide exactly the signal the card exists to give. It drills into `status=REOPENED`, an existing filter.

- **D-15 Two additive list filters support drill-down.** `followUp=mine` (queue only) and `statusGroup=open` (My Tickets and queue). *Why:* the Lab 3 parser takes one `status` and rejects repeats, so "not Resolved, Closed or Cancelled" cannot be asked for as a list of statuses, and no filter existed for open follow-ups. *Rejected:* a multi-valued `status`, which would change an existing parameter's contract; and returning ticket id lists from the dashboard, which §6.2 of the handout forbids.

- **D-16 Lab 3 behaviour that this sprint changes, stated rather than discovered.** (1) The three staff Ticket PATCH endpoints accept the named field **plus `version`**, and `/status` also accepts `resolutionSummary`, required only when the target is Resolved. (2) Lab 3's race refusal `400 INVALID_STATUS_TRANSITION` becomes `409 STALE_UPDATE`. (3) `Ticket.resolutionSummary` is reused; no new column. (4) `/` and sign-in land on `/dashboard`, not `/my-tickets`, and `AuthGuard`'s role-refusal redirect also goes to `/dashboard`. Lab 3 tests and end-to-end specs that expect the old behaviour are updated, and tests.md lists them (MIG-07, MIG-08).

- **D-17 Actions are writable only on a Ticket that is not Resolved, Closed or Cancelled.** `409 TICKET_NOT_ACTIONABLE` otherwise. *Why:* without it a Ticket could be Resolved and then acquire an open follow-up, contradicting the gate. *Cost:* none stranded: the fourth gate condition (D-03) means no Action is Planned when a Ticket is Resolved, so nothing is left frozen half-done.

- **D-18 Result is optional while Planned and required to complete.** A Planned Action describes intent; its result does not exist yet. *Rejected:* requiring Result at creation, which forces planned work to carry an invented outcome.

- **D-19 Drill-downs are returned by the backend with each card (BR-34).** *Rejected:* building them in the screen, which would duplicate the card's definition in two places and let them drift.

**Database-design decisions** (handout §5.1 asks for at least two, justified):

- **D-20 An integer `version` column, not `updatedAt`, as the concurrency token.** *Why:* `updatedAt` is a timestamp with finite precision and is rewritten by writes that are not user edits; two writes inside one tick can share a value, so a stale write can pass. An integer incremented in the same statement as the write is exact and cheap to compare. *Rejected:* `updatedAt` as a token; row-level locks held across a user's editing session, which a closed browser tab would never release.

- **D-21 A separate `TicketStatusChange` table, not a history reconstructed from `updatedAt` or a JSON log.** *Why:* dashboard deltas need "status as at midnight" for every Ticket, which is one indexed lookup per Ticket on `(ticketId, changedAt)`; `updatedAt` holds only the last touch and a JSON column cannot be indexed that way. Append-only rows also give the audit trail for free. *Cost:* one insert per transition, in the same transaction.

- **D-22 Follow-up as a nullable self-relation (`followsUpId`), with closure derived rather than stored.** *Why:* a stored "closed" flag is a second fact that must be kept equal to the Actions that justify it; deriving openness from the relation cannot disagree with the data. *Cost:* the open-follow-up query is an anti-join, which at this scale needs no index beyond the two stated, and the performance-smoke test is the trigger for adding one.

- **D-23 The backfill is SQL inside the migration.** *Why:* it needs no application code (unlike Lab 3's scrypt step), so it can run in the same transaction as the schema change and cannot be skipped by someone who forgot a script — the defect Lab 3's review forced a rewrite to remove.

- **D-24 Action creation is idempotent on a client-generated `requestId`.** The client generates one UUID per intentional create and resends it on retry; `(ticketId, requestId)` is unique; a repeat returns the existing Action with `200` and writes nothing; the same key with different fields is `409 REQUEST_ID_CONFLICT`. *Why:* handout §8.5 requires duplicates caused by repeated clicking *or network retry* to be prevented or safely handled, and a lost response is the case the interface cannot see: the Action was saved, the user never learned it, and a retry would otherwise save it again. *Rejected:* UI-only prevention (disabling the button), which covers a second click but not a retry after a lost response, and which no other client of the API would inherit; and de-duplicating on content (same description within a few seconds), which refuses legitimate repeated work and guesses at intent.

**Assumptions**

- **A-01** A Planned Action blocks resolution (the fourth condition of D-03, added after review), so no Planned Action can be left on a Resolved Ticket. Legacy Tickets have no Actions, so the gate never retroactively blocks one. (The earlier reading, that a Planned Action without a follow-up did not block, no longer holds.)
- **A-02** The clock is injected in the server so that tests can fix "now" and place history either side of midnight Bangkok.
- **A-03** The Actions list is not paginated; a Ticket has a handful of Actions, and the contract states the assumption rather than hiding it.
- **A-04** "Open" for the Requester card includes Reopened and New, since the Requester has not been told the work is finished in either.
- **A-05** The Administrator uses the staff dashboard unchanged; "my" means the signed-in Administrator.
- **A-06** Performance is checked as a smoke test (dashboards answer within a stated bound on a seeded database of a few thousand Tickets), not as a benchmark.
