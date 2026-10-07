# Lab 4 Test Plan and Results

Companion to [specification.md](specification.md). Written before implementation, not reconstructed from whatever the coding agent produced.

Every row's **Result** reads `Planned` until the Pull Request implementing it lands, at which point it is updated in that same Pull Request. **No row may read `Planned` at submission.** A row may read `Partial` only while an increment is deliberately half-finished, saying what passes, what does not, and which Issue finishes it; `Partial` at submission is as much a defect as `Planned`.

---

## 1. Test Strategy

Ten levels, each answering a question the others cannot.

| Level | Question it answers | Where it runs |
| --- | --- | --- |
| Unit | Is this decision table or calculation correct in every cell? | Vitest, no I/O |
| API / integration | Does the endpoint behave as the contract says, against a real database? | Vitest + Supertest + PostgreSQL |
| Workflow | Do the gate, the matrix, the history and the version checks hold together on a Ticket? | Vitest + Supertest, real database |
| Dashboard | Do the metrics equal what the database says, and do drill-downs agree with them? | Vitest + Supertest, real database, injected clock |
| UI component | Does the screen render and react correctly? | Vitest + Testing Library, jsdom |
| UI style | Are the markers, classes and accessibility attributes right? | Vitest + Testing Library, jsdom |
| Responsive | Does it hold together at each viewport? | Playwright, real browser |
| Security / authorization | Is the boundary enforced by the server, not the interface? | Vitest + Supertest, calling the API directly |
| Migration / regression | Is Labs 1–3 data preserved, and do Labs 1–3 still behave? | Vitest + Supertest on throwaway databases, plus the earlier suites |
| Performance-smoke | Do the dashboards stay fast on a seeded database of a few thousand Tickets? | Vitest + Supertest |
| End-to-end | Does the whole journey join up in a browser? | Playwright, three viewports |

**Why concurrency has its own rows.** A race is only demonstrated by two requests actually in flight. The concurrency tests issue real simultaneous requests, repeat the round several times, and are checked by removing the protection (the row lock, the version predicate) and watching them fail.

**Why dashboard parity has its own rows.** The handout (§14 Part 5) asks for evidence that selected metrics match database queries. DASH-01 and DASH-09 compute each card's expected value with a separately written SQL query over a controlled dataset and compare it to the API, so the endpoint cannot define what it is checked against.

**The clock is injected** (A-02). Delta tests place history rows 16:59:59 and 17:00:00 UTC either side of midnight Asia/Bangkok.

**Authentication in tests is real authentication**, through `POST /api/auth/login`, as in Lab 3 (Lab 3 D-15). There is no test-only bypass.

**Why style tests assert no colours.** jsdom resolves no stylesheet and has no layout engine. Colour, geometry, clipping and overflow are asserted in a real browser; the component level asserts class names, ARIA attributes and accessible names (inherited from Lab 2).

---

## 2. Planned Tests

### Unit

| ID | AC / Rule | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | AC-11, BR-03 | Action state machine, every cell | Planned → Done and Planned → Cancelled allowed; every other move, including out of Done and Cancelled, refused | `server/tests/lab-04/actions-domain.test.ts` | Pass — every one of the nine from/to cells asserted; only Planned moves, to Done or Cancelled |
| UNIT-02 | AC-12, BR-09 | Follow-up state derivation | Not required / Void / Open / Closed for every combination of required flag, own state and followers' states; a Planned or Cancelled follower never closes | `server/tests/lab-04/actions-domain.test.ts` | Pass — thirteen combinations of flag, own state and followers; only a Done follower closes; mutations never-closed and Planned-follower-closes both fail |
| UNIT-03 | AC-15, AC-16, AC-18, BR-16 | Resolution gate evaluator | All sixteen combinations of the four conditions; Resolved only when all hold; every unmet condition named | `server/tests/lab-04/actions-domain.test.ts` | Pass — all sixteen combinations of the four conditions name exactly the unmet ones (and none when all hold); counts and wording asserted; the facts are counted from Actions the way the Actions list derives follow-ups (only a Done follower closes one, a Cancelled one is void); mutation: planned-action condition disabled fails the planned cases |
| UNIT-04 | AC-05, BR-08, BR-14 | Action input validation | Boundary lengths accepted and one over refused for description, result, note, attachment notes; note required iff follow-up required; future `actionAt` over one minute refused | `server/tests/lab-04/actions-domain.test.ts` | Pass — boundary and one-over for description, result, note, attachment notes; note iff flag; action time at +60 s accepted, +60.001 s refused; non-ISO and wrong types refused; fixed fields refused on edit; follow-up merge rules; impossible calendar dates (30 February, 29 February in a common year, 31 April, hour 24, minute or second 60, offset of 24 hours) refused on create and edit while a leap day is accepted; `__proto__`, `constructor`, `toString` and `hasOwnProperty` as body keys are refused by name on create, edit, complete and cancel |
| UNIT-05 | AC-17, BR-17 | Resolution Summary validation | Empty, whitespace-only and over 2000 refused; trimmed value kept; refused for a non-Resolved target | `server/tests/lab-04/actions-domain.test.ts` | Pass — trimmed value kept; 2000 characters accepted (also 2000 once trimmed), 2001 refused; absent, empty and whitespace-only pass through as "" for the gate to name; a non-string is refused; a summary sent with any target but Resolved is refused |
| UNIT-06 | AC-29, BR-23 | Bangkok day boundary | T0 for instants either side of 17:00 UTC is the right Bangkok midnight; no daylight-saving shift across a year | `server/tests/lab-04/dashboard-time.test.ts` | Planned |
| UNIT-07 | AC-26, BR-19 | Version parsing | Positive integer accepted; missing, zero, negative, fractional, string and boolean refused with `details.version` | `server/tests/lab-04/actions-domain.test.ts` | Pass — positive integer accepted; undefined, null, 0, -1, 1.5, "1", true, [], {}, NaN and 2^53 refused with `details.version` |
| UNIT-08 | AC-34, BR-29 | `statusGroup` and `followUp` parsing | Only `open` and `mine` accepted; blank is absent; conflicting with `status`, or `followUp` in My Tickets scope, refused | `server/tests/lab-04/list-filters.test.ts` | Planned |
| UNIT-09 | AC-48, BR-35 | `requestId` validation | A UUID accepted; missing, empty, non-UUID and non-string refused with `details.requestId` | `server/tests/lab-04/actions-domain.test.ts` | Pass — a UUID accepted (lower-cased); undefined, null, empty, blank, non-UUID, over-long, number, object and boolean refused with `details.requestId` |

### API / integration — Actions Taken

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| API-01 | AC-01 | Create a valid Action | 201; saved under the path's Ticket; `recordedBy` the caller, `performedBy` the named staff, state Planned, version 1 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — 201 with the full resource; saved under the path Ticket; recordedBy the caller, performedBy the named staff, PLANNED, version 1; no `requestId` in the body; an Administrator may create |
| API-02 | AC-03 | Defaults, and fields the client may not set | No `performedById` → creator; `recordedById`, `state`, `ticketId`, `version` in the body → 400 `VALIDATION_FAILED`; nothing stored | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — no performer gives the creator; recordedById, state, ticketId, version, id and createdAt each 400 naming the field; zero rows stored; the recorder stays the session user |
| API-03 | AC-04 | Ineligible performer on create | An inactive staff member, a Requester and an unknown id each 400 `ACTION_ASSIGNEE_INELIGIBLE`; nothing stored | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — inactive staff, a Requester and an unknown id each 400 `ACTION_ASSIGNEE_INELIGIBLE` on create; zero rows |
| API-04 | AC-04 | Ineligible performer on edit | The same three refused on `PATCH`; the Action unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — the same three refused on PATCH; the stored row is deep-equal to before |
| API-05 | AC-05 | Create validation | Missing description, note without flag, flag without note, over-limit fields, wrong types, unknown field each 400 with the field named in `details` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — sixteen malformed bodies each 400 `VALIDATION_FAILED` with the field in `details`; the limits themselves accepted; a raw JSON body carrying `__proto__`, `constructor` or `toString` is 400 `VALIDATION_FAILED` naming the key on all four writes (it was a 500), and 30 February is 400 `details.actionAt` |
| API-06 | AC-06 | List order and several Actions | Actions on one Ticket returned by `actionAt` then `id`; ties settled by id; each carries recorder, performer, state, follow-up state; an empty Ticket answers `[]` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — four Actions come back by actionAt then id with a tie settled by id; every row carries recorder, performer, state, follow-up state; an empty Ticket answers `[]` |
| API-07 | AC-08 | Any staff may edit a Planned Action | A staff member who is neither recorder, performer nor Ticket Owner edits; saved; `recordedBy` unchanged; version +1 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — a staff member who is neither recorder, performer nor Owner edits; recordedBy unchanged; version +1; clearing the flag clears the note; fixed fields refused |
| API-08 | AC-09 | Complete | With a result: Done, version +1; with none stored or supplied: 400 `details.result`; a supplied result replaces the stored one | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — complete with a result gives DONE and version +1; none stored or supplied gives 400 `details.result`; a stored result suffices; a supplied one replaces it |
| API-09 | AC-10 | Cancel | With a reason: Cancelled, reason kept; blank or missing reason 400 `details.cancelReason` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — cancel keeps the trimmed reason; missing, blank and 501 characters give 400 `details.cancelReason`; 500 accepted |
| API-10 | AC-11 | Done and Cancelled are read-only | `PATCH`, complete and cancel on each 409 `ACTION_NOT_EDITABLE`; Action unchanged; no delete route exists (404/405 `ROUTE_NOT_FOUND`) | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — edit, complete and cancel on Done and on Cancelled each 409 `ACTION_NOT_EDITABLE`, row unchanged; DELETE and a reopen route answer 404 `ROUTE_NOT_FOUND` |
| API-11 | AC-12 | Follow-up closure | Open until a Done Action follows it; a Planned or Cancelled follower leaves it Open; cancelling a Done closer is not possible (terminal) but cancelling the Planned follower keeps it Open | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — Open, then still Open with a Planned follower and with a Cancelled follower, then Closed once a follower is Done; a Cancelled requiring Action is Void |
| API-12 | AC-13 | `followsUpId` validation | Another Ticket's Action, one not requiring follow-up, a Cancelled one, an unknown id each 400 `details.followsUpId` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — another Ticket's Action, one not requiring follow-up, a Cancelled one and an unknown id each 400 `details.followsUpId`; a valid link is saved; a follow-up dated before its target is refused on `details.followsUpId`, one at the same instant is created, and an omitted time (the server clock) before a target dated ahead is refused |
| API-13 | AC-14 | Ticket not actionable | Create, edit, complete and cancel on a Resolved, Closed or Cancelled Ticket each 409 `TICKET_NOT_ACTIONABLE`; allowed on New, Open, In Progress, Waiting, Reopened | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — all four writes 409 `TICKET_NOT_ACTIONABLE` on Resolved, Closed and Cancelled; all four succeed on New, Open, In Progress, Waiting, Reopened; a Requester still reads |
| API-14 | AC-26 | Version required on Action writes | `PATCH`, complete and cancel without `version`, or with a non-integer, 400 `details.version` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — PATCH, complete and cancel without a version, or with null, string, fraction, 0, -1 or boolean, each 400 with `details.version` |
| API-15 | AC-25 | Stale Action write | A write with an old version 409 `STALE_UPDATE`, Action unchanged; the current version succeeds and increments | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — an old version on edit, complete and cancel 409 `STALE_UPDATE`, row unchanged; the current one succeeds and increments; stale is reported before Action state |
| API-16 | AC-07 | Requester reads their Ticket's Actions | Every Action and every field returned; no Internal Note content anywhere in the body | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — a Requester reads every field of their Ticket's Actions, identical to staff, with no Internal Note text; another Requester's Ticket answers byte-identically to a missing one; a Requester gets 403 on all four writes |
| API-17 | BR-10 | Clearing the follow-up flag on a followed Action | 400 `details.followUpRequired`; the Action unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — clearing the flag on a followed Action 400 `details.followUpRequired`; row and version unchanged; an edit that moves a follow-up before its target, or a target after its follow-up, is refused on `details.actionAt` with the row unchanged, and the same instant is accepted |
| API-18 | BR-02 | Performer differs from Ticket Owner | Action performed by staff B on a Ticket owned by staff A is saved and listed with both identities intact | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — an Action by staff B on staff A's Ticket lists both identities intact; the Ticket Owner is unchanged |
| API-19 | AC-48 | Replay of a create | The same request sent twice: 201 then 200 with the same Action; exactly one row; nothing else written; a replay after the Ticket was Resolved still answers 200 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — 201 then 200 with a deep-equal body; one row, version 1, row unchanged by the replay; a replay after the Ticket was Resolved still 200; a retry across a clock change is still a replay |
| API-20 | AC-48 | Same key, changed payload | Any changed field under the same `requestId` 409 `REQUEST_ID_CONFLICT`; nothing stored; a new `requestId` creates a second Action | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — ten changed-field variants each 409 `REQUEST_ID_CONFLICT`; a new key creates a second Action; the same key on another Ticket creates a new one |
| API-21 | AC-48 | Key validation and simultaneous replays | A missing or non-UUID `requestId` 400 `details.requestId`; ten simultaneous requests with one key leave exactly one Action, one 201 and nine 200 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass — five bad keys each 400 `details.requestId`; ten simultaneous requests with one key give one 201, nine 200 and one row |

### Workflow

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| WF-01 | AC-15 | Resolve with no Done Action | 400 `RESOLUTION_GATE_FAILED`, `details.doneAction`; status unchanged; a Planned or Cancelled Action does not count | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — 400 `RESOLUTION_GATE_FAILED` with only `details.doneAction`; status, version and summary unchanged and no history row; a Cancelled Action alone does not count |
| WF-02 | AC-16 | Resolve with an open follow-up | 400, `details.openFollowUp`; status unchanged; succeeds once a Done Action follows it up | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — a follow-up with no Done follower is refused with only `details.openFollowUp`; resolves once a Done Action follows it up |
| WF-03 | AC-17 | Resolve with no summary | Missing, empty and whitespace-only summary 400, `details.resolutionSummary` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — a missing, empty or whitespace-only (spaces, newline, tab) summary is 400 `RESOLUTION_GATE_FAILED` naming only `resolutionSummary`; over 2000 characters or not text is `400 VALIDATION_FAILED` naming it |
| WF-04 | AC-18 | Every unmet condition at once | A bare Ticket with no summary answers one 400 whose `details` holds all four keys; with two unmet, exactly those two | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — no Done Action and no summary gives exactly those two keys; a Ticket failing all four gives all four keys with the documented wording; a planned action with a blank summary gives exactly those two |
| WF-05 | AC-19 | Resolve when the gate holds | 200; status Resolved; trimmed summary stored in `resolutionSummary`; version +1; response is the whole Ticket | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — 200; status Resolved; the summary stored trimmed; version +1; one history row (from In Progress, to Resolved, by the caller); the response is the whole Ticket; a refused resolve writes no history row; a stale version is 409 before the gate, and New to Resolved is `INVALID_STATUS_TRANSITION` before it |
| WF-06 | AC-20 | Gate by direct API from every source, and only into Resolved | From Open, In Progress, Waiting and Reopened an ungated resolve is refused; Closed, Reopened, In Progress and Cancelled targets evaluate no gate condition | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — Open, In Progress, Waiting for Requester and Reopened each refused without the gate and resolved with it; six moves to In Progress, Waiting, Cancelled, Closed and Reopened succeed on a Ticket that fails every condition; a summary sent with a non-Resolved target is `400 VALIDATION_FAILED` |
| WF-07 | AC-21 | Requester indication is advisory | With `resolvedIndicatedAt` set, a failing Ticket is still refused and its status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — with `resolvedIndicatedAt` set, a Ticket with no Done Action is still refused and stays Open |
| WF-08 | AC-22 | Status matrix through the endpoint | All 64 from/to cells, on a Ticket that satisfies the gate: only the permitted ones succeed; Cancelled permits none | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — all 64 from/to cells on a Ticket that satisfies the gate: exactly the permitted cells answer 200, every other is `INVALID_STATUS_TRANSITION`; a Cancelled Ticket stays terminal |
| WF-09 | AC-23 | History row per transition | One row `from → to` with actor and server time per success; none for a refusal; row and change commit together (a forced failure rolls back both) | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — one row per success with the actor and a server-side time, none for a refused transition or an owner or priority change, and a forced failure of the history write rolls the status change back; mutation-checked (status write moved outside the transaction fails the rollback test; row removed fails the one-row test) |
| WF-10 | AC-23 | History on creation | A new Ticket has exactly one row `null → NEW` by the Requester | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — POST /api/tickets answers version 1 and leaves exactly one null to NEW row by the Requester; mutation-checked (row removed) |
| WF-11 | AC-24 | Stale Ticket writes | Owner, IT Priority and status with an old version each 409 `STALE_UPDATE`, Ticket unchanged, and no history row; with the current version each succeeds and increments | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — all three endpoints with a stale version 409, Ticket unchanged and no history row; with the current version 200 and the version incremented; the same request twice succeeds once; a stale version is reported before an invalid transition; mutation-checked (check removed, predicate removed) |
| WF-12 | AC-26 | Version required on Ticket writes | The three PATCH endpoints without `version`, or non-integer, 400 `details.version` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — undefined, null, "1", 1.5, 0, -1, true, an array and an object each 400 with details.version on all three endpoints, Lab 3 style bodies included, and an unexpected field is still named; mutation-checked (zero accepted) |
| WF-13 | BR-17 | Summary lifecycle | Summary with a non-Resolved target 400; stored on Resolved; kept after Reopened; overwritten by the next resolution | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| WF-14 | BR-19 | Resolved indication bumps the version | The indication increments the Ticket version and sends none; a staff write carrying the earlier version then 409 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — the resolved indication moves version 1 to 2, writes no history row, and a staff write carrying version 1 then 409; mutation-checked (increment removed) |
| WF-15 | AC-24 | Two staff move one Ticket at once | One 200, the other 409 `STALE_UPDATE` (no longer 400 `INVALID_STATUS_TRANSITION`); exactly one history row | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — five rounds each of two staff moving, two claiming and two re-prioritising one Ticket from the same version: one 200 and one 409 STALE_UPDATE, one history row for the status race; mutation-checked (version removed from the WHERE clause fails the status and the owner/priority races) |
| WF-16 | AC-49 | Resolve with a Planned Action pending | 400 `RESOLUTION_GATE_FAILED`, `details.plannedActions`; status unchanged; succeeds after the Action is completed, and after it is cancelled instead; a Planned Action blocks even with a Done Action, no follow-up and a summary | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass — a Planned Action blocks with only `details.plannedActions` even with a Done Action, no follow-up and a summary; resolves after it is completed, and after it is cancelled instead; mutation: planned-action condition disabled fails |
| CONC-01 | AC-27 | Resolve against a new open follow-up, concurrently | Over repeated rounds of real simultaneous requests, no Ticket ends Resolved with an open follow-up; either the resolve or the creation is refused | `server/tests/lab-04/concurrency.api.test.ts` | Pass — twelve rounds of a resolve and a follow-up-creating Action sent together: either 200 and 409 `TICKET_NOT_ACTIONABLE`, or 400 `RESOLUTION_GATE_FAILED` and 201, and never a Resolved Ticket with an open follow-up; plus a deterministic case where the lock is held while a follow-up commits and the queued resolve is refused. Mutation: the Ticket lock removed from the resolve fails both |
| CONC-02 | AC-25 | Two completions of one Action at once | Exactly one 200 and one 409 `STALE_UPDATE`; one state change | `server/tests/lab-04/concurrency.api.test.ts` | Pass — twelve rounds of two simultaneous completions and twelve of complete against cancel each give one 200 and one 409 `STALE_UPDATE`; two simultaneous edits likewise |
| CONC-03 | AC-27 | Resolve against an edit that sets Follow-Up Required, concurrently | Over repeated rounds, a `PATCH` turning Follow-Up Required on and a resolve sent together never leave a Resolved Ticket with an open follow-up: either the edit commits first and the resolve is refused, or the resolve commits first and the edit is refused `409 TICKET_NOT_ACTIONABLE` | `server/tests/lab-04/concurrency.api.test.ts` | Pass — twelve rounds of an edit turning Follow-Up Required on sent with a resolve, and a deterministic held-lock case. Honest limit: the Planned Action being edited already blocks the resolve (BR-16 (c)), so removing the lock alone does not fail these; removing the lock and condition (c) together fails all four. The lock itself is what CONC-01 proves |
| CONC-04 | BR-16, AC-14 | Action writes wait for the Ticket lock | With another transaction holding the Ticket row lock and then committing it Resolved, a create, an edit setting Follow-Up Required, a completion and a cancellation started during the hold are each refused 409 `TICKET_NOT_ACTIONABLE` and store nothing; a write to another Ticket is not held up | `server/tests/lab-04/concurrency.api.test.ts` | Pass — all five asserted; replacing the routes' locked read with a plain one fails the four refusals |
| CONC-05 | BR-07 | Performer deactivated while an Action write is in flight | With a deactivation of the performer pending (uncommitted) when a create naming them, or an edit setting them, is started, the write waits for the performer's row and, once the deactivation commits, is refused 400 `ACTION_ASSIGNEE_INELIGIBLE` and stores nothing | `server/tests/lab-04/concurrency.api.test.ts` | Pass — both asserted; removing `FOR SHARE` from the eligibility read lets both writes commit during the pending deactivation (201 and 200) and fails both |
| CONC-06 | BR-19, BR-20 | A status change commits while a resolution waits for the lock | The queued resolve, which passed the early version check, is answered `409 STALE_UPDATE` and not the gate's `400`, although the Ticket has no Done Action; status unchanged | `server/tests/lab-04/concurrency.api.test.ts` | Pass — the lock is held while the version is bumped and committed; the queued resolve was `400 RESOLUTION_GATE_FAILED` before the fix and is `409 STALE_UPDATE` after it |

### Dashboard and list filters

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| DASH-01 | AC-28 | Staff metrics equal direct SQL | On a controlled dataset, each of the eight cards' `count` equals a separately written SQL count (§5) | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-02 | AC-28, AC-29 | Deltas around midnight Bangkok | With the clock fixed and history at 16:59:59Z and 17:00:00Z, status cards' deltas equal today's count minus the as-at-T0 count; a Ticket created after T0 counts as new | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-03 | AC-31 | Staff zero state | A staff member with nothing assigned and an empty system: eight cards present, counts 0, ownership cards `delta: null`, `recentTickets: []` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-04 | AC-32 | Roles for the staff endpoint | IT Staff and Administrator 200, each calculated for themselves; Requester 403 | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-05 | BR-26 | Staff recent Tickets | Only Tickets owned by the caller, at most five, `updatedAt` then `id` descending | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-06 | AC-30 | Staff drill-downs agree with counts | For each card, calling the queue with the returned `drillDown.query` yields `meta.totalItems` equal to the card's count | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-07 | BR-25 | Card contract | Exactly eight cards, fixed keys and order; Reopened present with its own count; ownership cards `delta: null`; "my" cards carry the caller's id | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-08 | handout §6.2 | Metrics, not collections | The body holds only cards, at most five recent rows, quick actions and metadata; no Ticket descriptions or collections beyond the bounded list | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DASH-09 | AC-02 | Requester sees only their own | With two Requesters holding Tickets, each dashboard counts and lists only its owner's; counts equal direct SQL | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-10 | AC-33 | Requester card definitions | Open (including New and Reopened), Waiting for me, Resolved and Closed correct across Tickets in every status; Cancelled in none | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-11 | AC-31 | Requester zero state | A Requester with no Tickets: four cards at 0 with drill-downs, empty recent list | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-12 | AC-33 | Requester recent Tickets | Their own only, at most five, newest-updated first | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-13 | AC-30 | Requester drill-downs agree with counts | My Tickets with each returned `drillDown.query` has `meta.totalItems` equal to the card's count | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-14 | AC-32 | Roles for the Requester endpoint | IT Staff and Administrator 403; no session 401 | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| DASH-15 | BR-22 | No identity from the caller | A `requesterId`, `userId` or any query parameter on either dashboard 400 `INVALID_QUERY_PARAMETER` | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| FLT-01 | AC-34 | `statusGroup=open` | On the queue and My Tickets returns exactly the non-Resolved, non-Closed, non-Cancelled Tickets in scope, Reopened included | `server/tests/lab-04/list-filters.api.test.ts` | Planned |
| FLT-02 | AC-34 | `statusGroup` refusals | With `status`, with `closed`, repeated: 400 `INVALID_QUERY_PARAMETER`; blank is absent | `server/tests/lab-04/list-filters.api.test.ts` | Planned |
| FLT-03 | AC-34 | `followUp=mine` | Only Tickets with an open follow-up on an Action performed by the caller; another staff member's, closed and Cancelled follow-ups excluded | `server/tests/lab-04/list-filters.api.test.ts` | Planned |
| FLT-04 | AC-34 | `followUp` refusals | On My Tickets, with another value, or an id: 400 `INVALID_QUERY_PARAMETER` | `server/tests/lab-04/list-filters.api.test.ts` | Planned |
| FLT-05 | AC-34 | Composition and paging | The new filters combine with `ownerId`, `unassigned`, search and sorting; paging repeats and skips no Ticket | `server/tests/lab-04/list-filters.api.test.ts` | Planned |

### Security / authorization

Every test here calls the API directly with a session of the wrong kind. None drives the interface.

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | AC-44 | Every new endpoint without a session | 401 `UNAUTHENTICATED`, enumerated across the Action, dashboard and changed PATCH routes | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-02 | AC-44 | Every new endpoint with the wrong role | A Requester 403 on every Action write and the staff dashboard; staff and Administrator 403 on the Requester dashboard | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-03 | AC-44 | Gated user | 403 `PASSWORD_CHANGE_REQUIRED` on every new endpoint | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-04 | AC-07 | Requester reading another's Actions | 404 `TICKET_NOT_FOUND`, byte-identical to a Ticket that does not exist | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-05 | AC-03 | Identity from the session only | A forged `recordedById` is refused and the stored recorder is the session user; no endpoint reads an identity from the caller | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-06 | AC-44 | New error bodies leak nothing | 400, 404, 409 and a forced 500 on the new endpoints carry only the envelope, matching no stack, path or database-message pattern | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| SEC-07 | BR-12 | Requester never reaches notes through Actions | A Requester's Action list holds no Internal Note content and Internal Note endpoints stay 403 | `server/tests/lab-04/authorization.api.test.ts` | Planned |

### UI component

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UI-01 | AC-28 | Staff dashboard cards | Eight cards in order with their labels and values from the API | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-02 | AC-39 | Card is one link | Each card is a single anchor to its `drillDown`; its accessible name states label, value and delta | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-03 | AC-28 | Delta text | "up 3", "down 1" and "No change" shown as arrow plus words; a `null` delta shows no delta line | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-04 | AC-39 | Staff loading state | Placeholders and an announced "Loading dashboard"; no figures | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-05 | AC-31 | Staff zero state | Zero cards remain linked; recent list shows its empty message | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-06 | AC-39 | Staff failure | A failed request shows a safe message and **Try again**, which retries; no internal detail | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-07 | AC-39 | Staff forbidden | A 403 shows the access message and no numbers | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-08 | FR-18 | Refresh and quick actions | Refresh disabled while busy and refetches; Create Ticket, Search Tickets and My Queue links go where specified; recent rows link to their Tickets | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-09 | BR-26 | Staff recent list | Up to five rows with number, summary, status badge and time; View all goes to the owner filter | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-10 | AC-33 | Requester cards | Four cards with the specified links and no delta line | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-11 | AC-33 | Requester recent list and quick actions | Own recent Tickets with status badges; Create Ticket and View My Tickets | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-12 | AC-31 | Requester zero state | Zero cards linked; "You haven't raised any tickets yet." with a prominent Create Ticket | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-13 | AC-39 | Requester loading, failure, forbidden | Each state as specified; retry works | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-14 | AC-38 | Role chooses the dashboard | `/dashboard` renders the staff view for IT Staff and Administrator and the Requester view for a Requester | `client/tests/lab-04/Navigation.test.tsx` | Planned |
| UI-15 | AC-38 | Dashboard first in navigation | Dashboard is the first item for each role; the others as in ui-spec §2 | `client/tests/lab-04/Navigation.test.tsx` | Planned |
| UI-16 | AC-38 | Landing | Sign-in, `/`, and a role refusal (Requester at `/staff/tickets`, non-Administrator at `/admin/users`) all end at `/dashboard`; a gated user still goes to `/change-password` | `client/tests/lab-04/Navigation.test.tsx` | Planned |
| UI-17 | AC-34 | My Tickets reads URL filters | `?statusGroup=open` and `?status=RESOLVED` initialise the list request and the visible filter, with a removable chip for the group | `client/tests/lab-04/DrillDownFilters.test.tsx` | Planned |
| UI-18 | AC-34 | Queue reads URL filters | `status`, `statusGroup`, `ownerId`, `unassigned` and `followUp` all reach the request; removing a chip updates the URL and the list | `client/tests/lab-04/DrillDownFilters.test.tsx` | Planned |
| UI-19 | AC-40 | Actions list | Columns, several Actions in order, empty message, state and follow-up badges, "Follows up #n" | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — two Actions render in order under the six column headers; the Result sits beneath its description; Done, Cancelled, Open, Void and "Not required" appear as words in badges; "Follows up #1" appears on the linked row only; an empty Ticket reads "No actions have been recorded for this ticket." and draws no table |
| UI-20 | AC-05, AC-40 | Create form validation | Server `details` appear beneath their fields; the first invalid field takes focus; the form keeps its input | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — an empty description is refused beside the field with focus on it and `aria-describedby` pointing at the message, and no request is sent; server `details` for two fields appear beneath their own fields, the first takes focus and every typed value stays; a ticked follow-up with no note is refused beside the note field. Mutation-checked (follow-up note rule removed, server-refusal focus removed: each broke its own test) |
| UI-21 | AC-40 | Create form behaviour | Performed by defaults to the signed-in user and offers active staff; the follow-up note appears and is required when the box is ticked; the Follows-up select lists eligible Actions | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — Performed by defaults to the signed-in user (value 11) and lists the three owners; the note field appears and is required only while the box is ticked; Follows up lists "None" and only the Action that requires follow-up and is not Cancelled; Save sends the trimmed description, the performer, `followsUpId` and a null note, and the new row appears |
| UI-22 | AC-04 | Ineligible performer shown | `ACTION_ASSIGNEE_INELIGIBLE` appears beside Performed by; nothing is added to the list | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — `ACTION_ASSIGNEE_INELIGIBLE` shows the server message beside Performed by (the select's accessible description), the select takes focus, no row is added. Mutation-checked with UI-20 (refusal focus removed) |
| UI-23 | AC-40 | View mode | An Action's fields shown read-only with recorder, performer, state and times | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — View shows description, result, follow-up note, attachment notes, performer, recorder, state, follow-up status, Recorded and Last updated as text with no form control, and "This action can no longer be changed." for a Done Action; a Cancelled Action also shows its reason |
| UI-24 | AC-11, AC-40 | Edit rules by state | A Planned Action offers Edit, Complete and Cancel; Done and Cancelled offer View only; Edit sends the version it read | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — Planned row: View, Edit, Complete, Cancel action; Done and Cancelled rows: View only; Edit sends the version it read (4), the edited description, no `followsUpId` and no `actionAt` when the date was untouched, and shows Follows up as a read-only value. Mutation-checked (edit body carrying `followsUpId`; controls drawn for every state; a fixed version: each failed its test) |
| UI-25 | AC-09 | Complete form | Result required; the stored result is prefilled; Confirm completes and the row becomes Done | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — the stored Result is prefilled; an emptied Result is refused beside the field with no request; Confirm posts `{version: 3, result}` to `/complete` and the row becomes Done with the Result beneath and no Complete control. Mutation-checked (fixed version sent: failed) |
| UI-26 | AC-10 | Cancel form | Reason required; Confirm cancels and the row becomes Cancelled with the reason visible | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — an empty Reason is refused with no request; Confirm posts `{version: 2, cancelReason}` to `/cancel`, the row becomes Cancelled and View shows the reason. Mutation-checked with UI-25 (fixed version) |
| UI-27 | AC-07, AC-40 | Requester read-only | A Requester sees the list and every field and none of Add, Edit, Complete or Cancel (absent, not disabled) | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — a Requester sees both rows, the note "Work IT has recorded on your ticket.", only View buttons and no Add, Edit, Complete or Cancel control in the document (absent, not disabled); View shows a field the table does not (attachment notes); the staff owners list is never requested. Mutation-checked (write controls granted to every role: failed) |
| UI-28 | AC-14 | Not actionable | On a Resolved, Closed or Cancelled Ticket the area shows the message and the list, no Add control; a `TICKET_NOT_ACTIONABLE` response reloads and explains | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — on Resolved, Closed and Cancelled Tickets the area shows "Actions can't be added to a resolved, closed or cancelled ticket." with the list, View only and no Add; a `TICKET_NOT_ACTIONABLE` answer re-reads the Ticket, closes the form and leaves the same message; a refused edit of an Action completed elsewhere re-reads the list and says "This action has already been completed." Mutation-checked (closed-Ticket gating removed: four tests failed) |
| UI-29 | AC-46 | Double submit | Two rapid clicks send one request; the control is disabled and labelled busy | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — two submits fired before the first request answers send one request (a ref guard, since two submits in one tick both read the busy state as false); the control reads "Saving…", is disabled and `aria-busy`; a double click on Save also sends one; the create and complete forms' fields are disabled while the request is out and enabled again, text kept, on a refusal; a write answering after another row's form has opened leaves that form and its draft open. Mutation-checked (guard removed: the two-submit test failed; fields enabled and unguarded close: the three added tests failed first) |
| UI-30 | AC-42 | Stale Action write | `409 STALE_UPDATE` shows the message, loads the latest record, keeps the user's text and re-enables the control | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — a `409 STALE_UPDATE` on the edit form shows the section 8 message as an alert associated with the form, re-reads the list (the row shows the colleague's text), keeps the typed description, re-enables Save, and the retry names the reloaded version (3, not 1); with the reload failing the distinct "could not be loaded" wording is shown and the fresh-data wording is not; the complete form uses the same wording and keeps its text. Mutation-checked (no reload; fresh-data wording on a failed reload; fixed version: each failed its test) |
| UI-31 | AC-22 | Status control | Offers exactly the permitted targets for each status, read from the shared transitions module | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-32 | AC-41 | Resolve dialog | Choosing Resolved opens the dialog with the summary field and the four-condition checklist, each met or not met in text and icon, from the loaded Actions | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass — choosing Resolved opens the dialog (heading with the ticket number, summary box, Confirm disabled) and sends nothing; the four conditions show in text with the hidden met / not met state; "2 open" and "1 planned" with a link to the first; typing marks the summary met and counts characters; whitespace alone keeps Confirm disabled |
| UI-33 | AC-18, AC-41 | Gate refusal | A `RESOLUTION_GATE_FAILED` response updates the checklist and shows each message beside its condition; the Ticket summary status is unchanged | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass — a server refusal replaces the checklist with its own list although the loaded Actions said all met, each message beside its condition, the dialog stays open with the text, the Ticket status is unchanged; mutation: server details ignored fails |
| UI-34 | AC-41 | Resolve success | The request carries the summary and the version; the Ticket summary status and version refresh from the response | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass — the request carries `{status, version, resolutionSummary}`; the dialog closes and the control and the Resolution Summary show the response; every other status change is still one request without a summary; mutations: summary not sent, and Resolved bypassing the dialog, fail |
| UI-35 | AC-43 | Dialog focus | Focus enters the dialog, is trapped, `Escape` closes, and focus returns to the opening control | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass — focus moves into the dialog, Tab from the last control wraps to the first and Shift+Tab back, Escape closes it with nothing sent, and focus returns to the status control; Cancel closes with nothing applied; mutations: no Escape, no focus return and no Tab wrap each fail |
| UI-36 | AC-42 | Stale status change | `409 STALE_UPDATE` shows the message, reloads the Ticket and keeps the summary text | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass — for the Ticket forms (status, claim, IT Priority): the stale message shows, the Ticket reloads without remounting the control, the control is re-enabled and the retry names the new version; mutation-checked (reload removed, STALE_UPDATE branch removed); a failed reload shows a distinct message and no longer claims the latest version was loaded (added after review). The resolve dialog (Issue #75): a stale resolve shows the stale message inside the dialog, reloads the Ticket behind it, keeps the typed summary and retries with the new version; a failed reload shows the distinct message; mutation: text cleared on stale fails |
| UI-37 | AC-49 | Planned-action condition in the resolve dialog | With a Planned Action loaded the checklist shows "No planned actions pending" as not met with the count and a link; a server `details.plannedActions` sets the same state; completing or cancelling the Action clears it | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass — with a Planned Action loaded the checklist shows "No planned actions pending — 1 planned — not met" and a link to it; a server `details.plannedActions` sets the same state and the other conditions read met; opening the dialog again after the Action is completed shows it met (the Actions are read on every opening) |
| UI-38 | AC-48 | Request key across retries | A failed or lost-response submit resent keeps the same `requestId`; a `200` replay is shown as success without a second row; after a save, or a fresh **Add action**, the next create carries a new key; `REQUEST_ID_CONFLICT` reloads the list, keeps the input and rotates the key | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass — the first create sends a UUID `requestId`; after a 500, an edit of the description and a lost response (fetch rejects) the same key is resent each time; a `200` replay closes the form with one row and one write; after a save and after an abandoned-then-reopened **Add action** the next create carries a new key (three distinct keys over three Actions); `REQUEST_ID_CONFLICT` reloads the list, keeps the input, says "An earlier attempt may already have been saved — check the list." and the next submit carries a different key. Mutation-checked (new key on every submit; key not rotated on conflict: each failed its test) |

### UI style

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| STYLE-01 | AC-40 | Badges | Action state and follow-up state render through the one badge component and carry text | `client/tests/lab-04/style/lab4-style.test.tsx` | Planned |
| STYLE-02 | AC-39 | Card semantics | Metric cards are anchors with focusable, named, visible-focus markers, not clickable divs | `client/tests/lab-04/style/lab4-style.test.tsx` | Planned |
| STYLE-03 | AC-43 | Non-colour cues | Delta, state and follow-up status each have text; the active navigation item has a non-colour marker | `client/tests/lab-04/style/lab4-style.test.tsx` | Planned |
| STYLE-04 | AC-43 | Structure | One `h1` per screen, ordered headings, table headers on the Actions list | `client/tests/lab-04/style/lab4-style.test.tsx` | Planned |
| STYLE-05 | AC-40 | Form labelling | Every Action form field has a bound label; errors are associated by `aria-describedby`; read-only values carry no label | `client/tests/lab-04/style/lab4-style.test.tsx` | Planned |
| STYLE-06 | AC-43 | Dialog markers | The resolve dialog has `role="dialog"`, `aria-modal` and an accessible name | `client/tests/lab-04/style/lab4-style.test.tsx` | Planned |

### Responsive and visual

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| RESP-01 | AC-43 | Staff dashboard at each viewport | Desktop, tablet and mobile: grid as specified, nothing clipped or overlapping, no horizontal scrolling | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-02 | AC-43 | Requester dashboard at each viewport | The same assertions | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-03 | AC-43 | Actions Taken at each viewport | Table at desktop and tablet (scrolling inside its container), cards below 768 px with every column's value | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-04 | AC-43 | Resolve dialog and forms at each viewport | Fits the viewport, scrolls inside itself, no overlap | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-05 | AC-39 | Zen Green tokens and focus | Header, primary buttons and active navigation use the specified greens; focus rings are visible on cards, rows and dialog controls | `e2e/lab-04/responsive.spec.ts` | Planned |

### Migration and regression

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| MIG-01 | AC-35 | Migration preserves data | On a populated Lab 3-shaped database every User, Ticket, Attachment, Public Comment and Internal Note survives with the same ids; every Ticket has `version` 1 and no Actions | `server/tests/lab-04/ticket-versioning-migration.test.ts` | Pass — on a throwaway database built from the earlier migrations and seeded in the Lab 3 shape, every User, Category, Related System, Ticket, Attachment, Public Comment and Internal Note keeps its id, each Ticket reads version 1, and the migration creates no table but TicketStatusChange; mutation-checked (default 2). Actions Taken do not exist until Issue #73, so "no Actions" holds trivially here |
| MIG-02 | AC-35 | History backfill | Each Ticket has `null → NEW` at `createdAt`; each non-New Ticket also `NEW → current` at `updatedAt`; a New Ticket gets no second row; `changedById` null throughout | `server/tests/lab-04/ticket-versioning-migration.test.ts` | Pass — seven history rows for four Tickets (New, In Progress, Resolved, Cancelled) with the exact times and statuses, one row for the New Ticket, no author on any; mutation-checked (the non-New filter removed) |
| MIG-03 | AC-36 | Rollback | The down script drops the two tables, the enum and `Ticket.version` and nothing else; every earlier row is intact | `server/tests/lab-04/ticket-versioning-migration.test.ts` | Partial — down.sql drops TicketStatusChange, Ticket.version and the migration's bookkeeping row, and every earlier table, column and row is intact; mutation-checked (column drop skipped). Dropping ActionTaken and the ActionState enum belongs to the Actions Taken migration, Issue #73, which carries its own down script |
| MIG-04 | AC-36 | Re-apply after rollback | The migration applies again and backfills identically | `server/tests/lab-04/ticket-versioning-migration.test.ts` | Partial — this migration applies again after its rollback and the backfill is row-for-row identical; the Actions Taken part is Issue #73 |
| MIG-05 | AC-35 | Legacy Resolved Ticket | A Resolved Ticket with no Actions stays Resolved and is listed; it can be reopened and then takes Actions; the gate runs only on a new resolve | `server/tests/lab-04/migration.test.ts` | Planned |
| MIG-06 | AC-37 | Seed idempotence and breadth | Two runs leave identical counts; the data holds every status, assigned and unassigned Tickets, zero, one and several Actions, an open and a closed follow-up, and non-zero and zero metrics | `server/tests/lab-04/seed.test.ts` | Planned |
| MIG-07 | AC-45, D-16 | Lab 3 server tests updated | The staff PATCH tests send `version`; the race test expects 409 `STALE_UPDATE`; all green | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/staff-queue.api.test.ts` | Pass — staff-ticket-detail and authorization send version (the detail suite through a helper that reads the current one; its race test reads it once and expects 409 STALE_UPDATE); staff-queue.api.test.ts sends no PATCH and needed no change; the whole server suite is green |
| MIG-08 | AC-38, AC-45, D-16 | Lab 3 and Lab 2 client and browser tests updated | Specs expecting `/my-tickets` after sign-in, or Dashboard absent from navigation, now expect `/dashboard`; all green | `client/tests/lab-03/AuthGuard.test.tsx`, `client/tests/lab-03/AppShell.test.tsx`, `client/tests/lab-02/style/shell.test.tsx`, `e2e/lab-03/auth.setup.ts`, `e2e/lab-03/authentication.spec.ts`, `e2e/lab-03/user-administration.spec.ts`, `e2e/lab-02/support.ts`, `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| MIG-09 | AC-45 | Labs 1 and 2 server suites | Every Lab 1 and Lab 2 server test passes after the sprint | `server/tests/lab-01/`, `server/tests/lab-02/` | Planned |
| MIG-10 | AC-22, AC-45 | Lab 3 server suites | Every Lab 3 server test passes, including the 64-cell transition matrix unchanged | `server/tests/lab-03/` | Planned |
| MIG-11 | AC-45 | Labs 1–3 client suites | Every client component and style test of Labs 1–3 passes | `client/tests/lab-01/`, `client/tests/lab-02/`, `client/tests/lab-03/` | Planned |
| MIG-12 | AC-36 | Migration is one transaction | A failure after the backfill leaves no `version` column, no `TicketStatusChange` table and every earlier row intact; the file opens with `BEGIN;` and ends with `COMMIT;` | `server/tests/lab-04/ticket-versioning-migration.test.ts` | Pass — the script is run on the scratch database with a division by zero injected just before its `COMMIT;`; it fails, and after ending the aborted transaction the column, the table and every earlier row are as before. Added after review; seen failing first on the structural assertion (no `BEGIN;`) — the behavioural half also passes on the old file, because the driver sends a multi-statement string as one implicit transaction, so the explicit `BEGIN;` is what protects a runner that does not |

### Performance-smoke

Not tied to an acceptance criterion: they check assumption A-06, and are the trigger for adding an index (D-22).

| ID | AC / Rule | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| PERF-01 | A-06 | Staff dashboard on a large seed | On a database of about 2,000 Tickets, 5,000 Actions and 6,000 history rows, the median of ten requests answers within 500 ms | `server/tests/lab-04/dashboard-performance.test.ts` | Planned |
| PERF-02 | A-06 | Requester dashboard on a large seed | The same bound for a Requester holding about 200 Tickets | `server/tests/lab-04/dashboard-performance.test.ts` | Planned |
| PERF-03 | A-06 | Queue with the new filters | `statusGroup=open` and `followUp=mine` answer within the same bound | `server/tests/lab-04/dashboard-performance.test.ts` | Planned |

### End-to-end

Each runs at desktop, tablet and mobile. Screenshots land in `artifacts/lab-04/screenshots/` as ui-spec.md §11 names them.

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | AC-01, AC-08, AC-09, AC-40 | Record, edit and complete an Action | Staff add an Action performed by a colleague, another staff member edits it, and it is completed; the list shows the states in turn | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | AC-04, AC-10 | Cancel, and an inactive performer | Cancelling needs a reason and shows Cancelled; an inactive performer is refused with the message beside the field | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-03 | AC-12 | Follow-up opened and closed | An Action requiring follow-up shows Open; a linked Done Action turns it Closed | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-04 | AC-07 | Requester's read-only view | The Requester opens their Ticket, sees every Action and no controls; another Requester's Ticket is not found | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-05 | AC-15, AC-16, AC-19, AC-41 | Resolution gate in the browser | Resolving is blocked with each unmet condition shown, then succeeds once the work, follow-up and summary are in place; the summary status refreshes | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-06 | AC-24, AC-42 | Stale update between two people | Two browser contexts load one Ticket; the second's change is refused with the stale message, its text kept, and succeeds after the reload | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-07 | AC-21 | Requester advice versus staff authority | The Requester indicates the problem looks resolved and the status does not change; staff resolve it; the Requester sees Resolved and the summary; staff reopen | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-08 | AC-28, AC-30 | Staff dashboard and drill-down | Values match the seeded data; a card opens the queue filtered, with a total equal to the card | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-09 | AC-02, AC-33 | Requester dashboard and drill-down | Only that Requester's counts; Open and Waiting for me open My Tickets filtered | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-10 | AC-38 | Landing and navigation | Each role signs in to `/dashboard` with Dashboard first; a Requester sent to `/staff/tickets` ends at `/dashboard` | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-11 | AC-31, AC-39 | Zero and failure states | A user with no Tickets sees zeros and the empty message; a forced 500 shows the safe message and Try again recovers | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-12 | AC-45 | Labs 1–3 regression journeys | Sign-in and first-time password change, create Ticket, attachments, comments, Internal Notes, staff queue and ownership, Administrator user management all still work | `e2e/lab-04/regression.spec.ts` | Planned |
| E2E-13 | AC-47 | Clean run | The Lab 4 journeys produce no console errors and no failed navigations or broken links | `e2e/lab-04/regression.spec.ts` | Planned |
| E2E-14 | AC-46 | Repeated click | Double-clicking Add action in a real browser creates exactly one Action | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |

---

## 3. Acceptance-Criterion Traceability

Every acceptance criterion maps to at least one planned test.

| AC | Tests |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | DASH-09, E2E-09 |
| AC-03 | API-02, SEC-05 |
| AC-04 | API-03, API-04, UI-22, E2E-02 |
| AC-05 | UNIT-04, API-05, UI-20 |
| AC-06 | API-06, UI-19 |
| AC-07 | API-16, SEC-04, SEC-07, UI-27, E2E-04 |
| AC-08 | API-07, E2E-01 |
| AC-09 | API-08, UI-25, E2E-01 |
| AC-10 | API-09, UI-26, E2E-02 |
| AC-11 | UNIT-01, API-10, UI-24 |
| AC-12 | UNIT-02, API-11, E2E-03 |
| AC-13 | API-12 |
| AC-14 | API-13, UI-28 |
| AC-15 | UNIT-03, WF-01, E2E-05 |
| AC-16 | UNIT-03, WF-02, E2E-05 |
| AC-17 | UNIT-05, WF-03 |
| AC-18 | UNIT-03, WF-04, UI-33 |
| AC-19 | WF-05, E2E-05 |
| AC-20 | WF-06 |
| AC-21 | WF-07, E2E-07 |
| AC-22 | WF-08, UI-31, MIG-10 |
| AC-23 | WF-09, WF-10 |
| AC-24 | WF-11, WF-15, E2E-06 |
| AC-25 | API-15, CONC-02 |
| AC-26 | UNIT-07, API-14, WF-12 |
| AC-27 | CONC-01, CONC-03 |
| AC-28 | DASH-01, DASH-02, UI-01, UI-03, E2E-08 |
| AC-29 | UNIT-06, DASH-02 |
| AC-30 | DASH-06, DASH-13, E2E-08 |
| AC-31 | DASH-03, DASH-11, UI-05, UI-12, E2E-11 |
| AC-32 | DASH-04, DASH-14 |
| AC-33 | DASH-10, DASH-12, UI-10, UI-11, E2E-09 |
| AC-34 | UNIT-08, FLT-01, FLT-02, FLT-03, FLT-04, FLT-05, UI-17, UI-18 |
| AC-35 | MIG-01, MIG-02, MIG-05 |
| AC-36 | MIG-03, MIG-04, MIG-12 |
| AC-37 | MIG-06 |
| AC-38 | UI-14, UI-15, UI-16, MIG-08, E2E-10 |
| AC-39 | UI-02, UI-04, UI-06, UI-07, UI-13, STYLE-02, RESP-05, E2E-11 |
| AC-40 | UI-19, UI-21, UI-23, UI-24, UI-27, STYLE-01, STYLE-05, E2E-01 |
| AC-41 | UI-32, UI-33, UI-34, E2E-05 |
| AC-42 | UI-30, UI-36, E2E-06 |
| AC-43 | RESP-01, RESP-02, RESP-03, RESP-04, UI-35, STYLE-03, STYLE-04, STYLE-06 |
| AC-44 | SEC-01, SEC-02, SEC-03, SEC-06 |
| AC-45 | MIG-07, MIG-08, MIG-09, MIG-10, MIG-11, E2E-12 |
| AC-46 | UI-29, E2E-14 |
| AC-47 | E2E-13 |
| AC-48 | UNIT-09, API-19, API-20, API-21, UI-38 |
| AC-49 | WF-16, UI-37 |

**Tests with no acceptance criterion.** API-18 and WF-13 and WF-14 (rules BR-02, BR-17, BR-19), DASH-05, DASH-07, DASH-08, DASH-15 (BR-26, BR-25, handout §6.2, BR-22), UI-08, UI-09 (FR-18, BR-26), API-17 (BR-10), and PERF-01 to PERF-03 (A-06). They check a rule or an assumption directly rather than an acceptance criterion.

---

## 4. Labs 1–3 Regression

Part 8 of the handout asks for representative regression evidence for authentication, My Tickets, Ticket Detail, Attachments, Public Comments, IT Staff functions, Internal Notes and Administrator user management. The method is to **run the earlier suites unchanged**, except where this sprint deliberately changes behaviour (D-16), and to add one browser journey that crosses them.

| Area | Evidence | Rows |
| --- | --- | --- |
| Labs 1 and 2 server | Both suites run after the sprint | MIG-09 |
| Lab 3 server — authentication, comments, notes, administrators, queue, scope, migration, seed | Suites run after the sprint, with the changes below | MIG-10, MIG-07 |
| Labs 1–3 client | Every component and style test | MIG-11, MIG-08 |
| Representative browser journeys | Sign-in, My Tickets, Ticket Detail, attachments, comments, notes, staff queue, user management | E2E-12 |

**Lab 3 tests that must change, because Lab 3 behaviour changes** (D-16). They are updated, never deleted or skipped:

| Change in behaviour | Lab 3 tests that expect the old one | Row |
| --- | --- | --- |
| Staff PATCH bodies must carry `version`; `/status` may carry `resolutionSummary` | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/staff-queue.api.test.ts` | MIG-07 |
| The race refusal is 409 `STALE_UPDATE`, not 400 `INVALID_STATUS_TRANSITION` ("refuses two staff moving one ticket at once") | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | MIG-07 |
| Sign-in and role refusals land on `/dashboard`, not `/my-tickets` | `client/tests/lab-03/AuthGuard.test.tsx`, `e2e/lab-03/auth.setup.ts`, `e2e/lab-03/authentication.spec.ts`, `e2e/lab-03/user-administration.spec.ts`, `e2e/lab-02/support.ts`, `e2e/lab-02/requester-ticket-flow.spec.ts` | MIG-08 |
| Dashboard is the first navigation item for every role | `client/tests/lab-03/AppShell.test.tsx`, `client/tests/lab-02/style/shell.test.tsx` | MIG-08 |

If the implementation finds another earlier test that breaks, it is added to this table in the Pull Request that changes it, with the reason.

---

## 5. Dashboard Metrics Against Direct SQL

DASH-01 (staff) and DASH-09 (Requester) are the evidence for §14 Part 5 of the handout.

**Method.** A controlled dataset is inserted through Prisma: Tickets in every status, owned and unowned, raised by two Requesters, with Actions in every state and follow-ups open and closed, and history rows placed either side of the Bangkok boundary. The expected value for each card is computed by **a separately written SQL query**, run through `$queryRaw`, in the test file — not by importing the endpoint's query. The test fails if the endpoint and the SQL disagree on any card, for any user.

| Card | Reference SQL (shape) |
| --- | --- |
| New, Open, In Progress, Waiting, Reopened | `SELECT count(*) FROM "Ticket" WHERE "currentStatus" = $status` |
| My Assigned | `… WHERE "ticketOwnerId" = $me AND "currentStatus" NOT IN ('RESOLVED','CLOSED','CANCELLED')` |
| Unassigned | `… WHERE "ticketOwnerId" IS NULL AND "currentStatus" NOT IN (…)` |
| My open follow-ups | `SELECT count(DISTINCT a."ticketId") FROM "ActionTaken" a WHERE a."followUpRequired" AND a."state" <> 'CANCELLED' AND a."performedById" = $me AND NOT EXISTS (SELECT 1 FROM "ActionTaken" f WHERE f."followsUpId" = a.id AND f."state" = 'DONE')` |
| Status delta | today's count minus `SELECT count(*) FROM (SELECT DISTINCT ON ("ticketId") "toStatus" FROM "TicketStatusChange" WHERE "changedAt" < $t0 ORDER BY "ticketId", "changedAt" DESC, id DESC) s WHERE "toStatus" = $status` |
| Requester cards | the same counts with `"requesterId" = $me` |

The screenshot evidence for Part 5 is the staff dashboard (`staff-dashboard/loaded`) beside the output of this test.

---

## 6. Test Commands

```bash
docker compose up -d
npm run db:migrate
npm run db:seed                 # reference data, including every user account
npm run db:seed:demo            # tickets, Actions Taken, history
npm run db:test:setup           # migrate and seed the test database
npm test                        # unit, API, workflow, dashboard, authorization, migration, UI, style
npm run test:e2e                # responsive and end-to-end, three viewports
npm exec -- ultracite check
```

---

## 7. Final Results

To be completed in the Pull Request that makes the last row pass. Every figure below is filled from a run, not estimated.

| Level | Files | Tests | Result |
| --- | --- | --- | --- |
| Unit | — | — | Planned |
| API / integration | — | — | Planned |
| Workflow and concurrency | — | — | Planned |
| Dashboard and list filters | — | — | Planned |
| Security / authorization | — | — | Planned |
| UI component | — | — | Planned |
| UI style | — | — | Planned |
| Responsive and visual | — | — | Planned |
| Migration / regression | — | — | Planned |
| Performance-smoke | — | — | Planned |
| End-to-end | — | — | Planned |

---

## 8. Known Limitations

- **Concurrency is tested at the API level.** The interface is not tested under simultaneous editing beyond E2E-06, which uses two browser contexts taking turns, because two browsers racing is not reproducible.
- **Deltas for legacy Tickets are approximate** (specification.md §7): the backfilled history is derived from `updatedAt`, so MIG-02 checks the stated approximation, not the Tickets' real past.
- **Performance is a smoke check,** not a benchmark (A-06); a failing PERF row is a prompt to add an index, not proof of a defect.
- **The end-to-end suite runs single-worker,** as in Labs 2 and 3, because two workers racing over one database produce evidence of nothing.
- **A retry after a lost response is tested against the API** (API-19 to API-21) and in the interface's key handling (UI-38); losing a real response mid-flight in a browser is not reproduced, so E2E-14 covers repeated clicking only.
