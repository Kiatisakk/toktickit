# Lab 3 Test Plan and Results

Companion to [specification.md](specification.md). Written before implementation, not reconstructed from whatever the coding agent produced.

Every row's **Result** reads `Planned` until the Pull Request implementing it lands, at which point it is updated in that same Pull Request. **No row may read `Planned` at submission.**

A row may read `Partial` while an increment is deliberately half-finished — the expand half of a swap, where the old mechanism and the new one run side by side on purpose. The row then says what passes, what does not, and which ticket finishes it. `Partial` at submission is as much a defect as `Planned`.

---

## 1. Test Strategy

Eight levels, each answering a question the level above it cannot.

| Level | Question it answers | Where it runs |
| --- | --- | --- |
| Unit | Is this decision table correct in every cell? | Vitest, no I/O |
| API / integration | Does the endpoint behave as the contract says, against a real database? | Vitest + Supertest + PostgreSQL |
| UI component | Does the screen render and react correctly? | Vitest + Testing Library, jsdom |
| UI style | Are the markers, classes and accessibility attributes right? | Vitest + Testing Library, jsdom |
| Responsive | Does it hold together at each viewport? | Playwright, real browser |
| Security / authorization | Is the boundary enforced by the server, not the interface? | Vitest + Supertest, calling the API directly |
| Migration / regression | Does the Lab 2 increment still work? | Vitest + Supertest, plus Playwright |
| End-to-end | Does the whole journey join up? | Playwright, three viewports |

**Why authorization gets its own level.** §4.3 of the handout says a hidden or disabled control is feedback, not a security control. A test that drives the interface to check a button is missing proves nothing about the server. Every authorization test therefore calls the endpoint directly, with a session belonging to the wrong role, and asserts the refusal.

**Why style tests assert no colours.** jsdom resolves no stylesheet and has no layout engine. Anything about colour, geometry, clipping or overflow is asserted in a real browser; the component level asserts class names, ARIA attributes and accessible names. This split is inherited from Lab 2 and unchanged.

**Authentication in tests is real authentication.** Server tests sign in through `POST /api/auth/login` and hold the returned cookie. Browser tests sign in once per role in a setup project and reuse the stored session. There is no test-only bypass (D-15).

---

## 2. Planned Tests

### Unit

| ID | AC / Rule | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | BR-19, D-08 | Role-to-query-scope mapping | Requester yields an ownership constraint; IT Staff and Administrator yield none | `server/tests/lab-03/scope.test.ts` | Pass |
| UNIT-02 | AC-20, AC-21, BR-25, BR-26 | Status transition matrix, every cell | Each permitted transition allowed; every other refused; `CANCELLED` allows none | `server/tests/lab-03/transitions.test.ts` | Pass — all 64 cells asserted against §5's own table, written out separately so the module cannot define what it is checked against; `CANCELLED` permits none, and no status transitions to itself. |
| UNIT-03 | AC-10, BR-07 | Password rule evaluation | Too short, too long, and each missing character class rejected with the rule named; a compliant password accepted | `server/tests/lab-03/password.test.ts` | Pass |
| UNIT-04 | BR-06 | Hash and verify round-trip | A password verifies against its own hash and not against another; the hash is not the password | `server/tests/lab-03/password.test.ts` | Pass |
| UNIT-05 | BR-10 | Session token generation and hashing | Tokens are unique across many draws; the stored value is a hash, not the token | `server/tests/lab-03/session.test.ts` | Pass |
| UNIT-06 | BR-30 | Comment and note body validation | Empty, whitespace-only and over-length refused; boundary lengths accepted | `server/tests/lab-03/messages.test.ts` | Pass — empty, whitespace-only, missing and non-text bodies refused; 1 and 5000 characters after trimming accepted, 5001 refused; markup kept as written; only `body` is read. |

### API / integration

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| API-01 | AC-01 | Valid sign-in | 200, session cookie set, identity and role returned, no credential in the body | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | AC-05 | Unknown email vs wrong password | Both 401 `INVALID_CREDENTIALS`, identical body | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | AC-06 | Correct password, deactivated account | 403 `ACCOUNT_INACTIVE` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-04 | BR-09 | Wrong password on a deactivated account | 401 `INVALID_CREDENTIALS`, not `ACCOUNT_INACTIVE` | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | FR-04 | Current user retrieval | 200 with identity, role and the must-change flag | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-06 | AC-02 | The password-change gate | Every endpoint except `me`, `password`, `logout` answers 403 `PASSWORD_CHANGE_REQUIRED` | `server/tests/lab-03/auth.api.test.ts` | Pass — asserted against `GET /api/tickets` and `GET /api/categories` since the selector was deleted; the probe route mounted in the test is gone. SEC-06 walks the whole route table. |
| API-07 | AC-02 | The three permitted endpoints during the gate | All reachable while the flag is set | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-08 | AC-07 | Sign-out | 204; the previous cookie then answers 401 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-09 | AC-08 | Expired session | A session past its expiry answers 401 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-10 | AC-11 | Deactivation mid-session | A live session whose user is deactivated answers 401 on the next request | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-11 | AC-10 | Password change validation | Rule failures 400 with the field named; password unchanged | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-12 | AC-09 | Password change ends other sessions | Other sessions 401 afterwards; the current one continues | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-13 | BR-13 | Sign-out is idempotent | Signing out without a session answers 204 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-14 | AC-03 | A body carrying `requesterId` | Ignored; the ticket is recorded against the authenticated user | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-15 | AC-15 | Staff queue returns all requesters' tickets | Tickets from several requesters present | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — IT Staff and an Administrator both read tickets from two requesters; the row carries requester and owner, and no credential. |
| API-16 | FR-20 | Queue search, filters and sorting | Each parameter narrows or orders as documented | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — literal search (`100%`, `snake_case`), IT Priority, status and requester filters, and sorts by severity, lifecycle and owner name. My Tickets refuses the queue-only parameters and searches literally too. |
| API-17 | FR-21 | Unassigned filter | Returns only tickets with no owner; `ownerId` and `unassigned` together 400 | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — `unassigned=true` returns only unowned tickets, `ownerId` only that owner's; together they answer 400, and `unassigned=false` is refused. |
| API-18 | AC-16 | Blank query parameter | `page`, `pageSize`, `sort`, `order` blank 400; filters blank treated as absent | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — `page`, `pageSize`, `sort` and `order` blank are 400; `ownerId`, `unassigned`, `requesterId` and `status` blank read as no filter. |
| API-19 | FR-20 | Pagination stability | Paging the full set repeats no ticket and skips none, including ties on timestamp | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — twelve tickets share one timestamp across two pages of ten: all twelve appear once, and the same page answers the same way twice. |
| API-20 | AC-17 | Claiming an unowned ticket | Owner becomes the caller; visible to another staff session | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — an unowned ticket is claimed and the owner is read back by a second staff session; the response carries the whole ticket. |
| API-21 | AC-18 | Reassignment and release | Owner becomes the named user; `null` releases | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — reassigned to a third person, then released with `null`. |
| API-22 | AC-19 | IT Priority independence | IT Priority set; Requested Priority unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — IT Priority set and cleared, Requested Priority untouched in the response and in the row; a `requestedPriority` sent to this endpoint is refused. Checked by writing both columns: the test failed. |
| API-23 | BR-21 | Ineligible owner | Assigning a Requester or an inactive user 400 `TICKET_OWNER_INELIGIBLE` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — a Requester, an inactive account and an unknown id all answer 400 `TICKET_OWNER_INELIGIBLE`, leaving the ticket unowned. Checked by admitting Requesters: the test failed. |
| API-24 | AC-20 | Refused transition | 400 `INVALID_STATUS_TRANSITION`; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — a transition outside the matrix is 400 `INVALID_STATUS_TRANSITION` and the status is unchanged; `PENDING` and an invented status are refused as values. Checked by removing the matrix check: three tests failed. |
| API-25 | AC-21 | Cancelled is terminal | Every transition out of `CANCELLED` refused | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — every one of the eight is refused from `CANCELLED`; a ticket can be cancelled from each status the matrix allows and from no other. |
| API-26 | BR-25 | A permitted transition | Accepted; new state returned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — a permitted transition returns the new state, and the whole lifecycle New → Open → In Progress → Waiting for Requester → Resolved → Closed → Reopened → Resolved is walked. Two staff moving one ticket at once: one applies, the other is refused. |
| API-27 | AC-22 | Requester resolved indication | 204; timestamp recorded; status unchanged; idempotent | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — 204 with no body; the time is recorded and the status unchanged; a second call keeps the first time (BR-27); a status sent in the body changes nothing; ticket detail carries the time for the Requester and for staff, and the staff queue row carries the same time (`null`, not absent, before). Checked by removing the set-once condition: the test failed. |
| API-28 | AC-24 | Public Comment visibility | Requester and staff both read it with author and time | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — the Requester, IT Staff and an Administrator read the same entry with author name, role and time; a staff reply lists beneath the Requester's comment, oldest first, with id settling a shared timestamp. |
| API-29 | BR-29 | Author and timestamp are server-side | Values supplied in the body are ignored | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — an `id`, `authorId`, `author`, `createdAt` and `ticketId` in the body are all ignored; the stored row is the caller's, on the path's ticket. Checked by reading the author from the body: the test failed. |
| API-30 | AC-26 | Empty and whitespace-only body | 400 `VALIDATION_FAILED` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — empty, whitespace-only, missing and non-text bodies answer 400 `VALIDATION_FAILED` with `details.body` and store nothing; 5001 characters refused, 5000 accepted. |
| API-31 | AC-27 | Staff read a requester's attachments | Metadata listed and content downloadable | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — staff list the metadata (filename, type, size, uploader, status, no `storedFilename`) and download the bytes with content type, length and disposition; the staff detail carries the same row. |
| API-32 | AC-28 | Administrator user list | Name, email, role and state returned; search and role filter narrow it | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-33 | AC-29 | User creation | 201; the user can sign in and is required to change the password | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-34 | AC-30 | Duplicate email on create and on edit | 409 `EMAIL_ALREADY_EXISTS` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-35 | FR-35 | Editing name, email, role and state | Each persists; one role only | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-36 | AC-31 | Self-deactivation | 409 `CANNOT_DEACTIVATE_SELF`; account still active | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-37 | AC-32 | Last active Administrator | The sole Administrator demoting themselves 409 `LAST_ACTIVE_ADMIN` — reachable precisely because self-demotion is not caught by the self-check | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-38 | AC-33 | Two Administrators deactivating each other at once | At least one refused; an active Administrator remains | `server/tests/lab-03/users-admin.api.test.ts` | Pass — five rounds of two real concurrent requests. Removing `FOR UPDATE` from the handler makes the first round fail with both deactivations succeeding, which is how the test is known to exercise the lock. |
| API-39 | BR-37 | Setting a new initial password | 204; flag set; the user's sessions ended; sign-in with the new password requires a change | `server/tests/lab-03/users-admin.api.test.ts` | Pass — the old session answers 401, the old password is refused, and the new one signs in with the must-change flag set. |
| API-40 | BR-20 | Error bodies leak nothing | No stack trace, path or database message on any failure path | `server/tests/lab-03/auth.api.test.ts` | Pass — 401/404/400/403/unknown-route plus 409 duplicate email, 413 over the JSON limit, 415 wrong file type, and a 500 from bytes missing on disk: every body carries only the `error` envelope and matches no leak pattern. |
| API-41 | §5 | Reference data now requires a session | Categories and related systems 401 without one; health stays public | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-42 | BR-23 | IT Priority at creation | A new ticket's IT Priority equals its Requested Priority; changing one afterwards never moves the other | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — created HIGH reads HIGH/HIGH; setting IT Priority to LOW leaves Requested HIGH in the response and in the row. Checked by writing both columns: the test failed. |
| API-43 | FR-35 | User edit validation | Empty name, malformed email, invalid role and non-boolean active each 400 with the field named in `details` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-44 | BR-37 | Reset password validation | A starting password failing the rules 400 with `details.initialPassword`; the user's existing credential unchanged | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-45 | §8 | Lab 2 list envelope preserved | The ticket list answers `data` and `meta` with `totalItems`, exactly as Lab 2 documents | `server/tests/lab-03/migration.api.test.ts` | Pass |
| API-46 | FR-30 | Staff raise and track their own tickets | IT Staff and an Administrator each create a ticket recorded against them, find it in My Tickets, and find no one else's there | `server/tests/lab-03/authorization.api.test.ts` | Pass |

### Security / authorization

Every test here calls the API directly with a session of the wrong kind. None drives the interface.

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | FR-09 | Every protected endpoint without a session | 401 `UNAUTHENTICATED`, enumerated across the whole route table, excepting `POST /api/auth/logout` which is idempotent and answers 204 | `server/tests/lab-03/authorization.api.test.ts` | Pass — over the route table as it stands. Each later endpoint is added to the same list in the Pull Request that adds it. |
| SEC-02 | FR-10 | Every role-restricted endpoint with each wrong role | 403 `FORBIDDEN`, enumerated | `server/tests/lab-03/authorization.api.test.ts` | Pass — eleven staff/Admin endpoints refuse a Requester, four Admin endpoints refuse IT Staff, the resolved indication refuses staff and Admin; one allowed-role probe per group answers 200/400, never 403. |
| SEC-03 | AC-03 | Requester supplying another `requesterId` | Authenticated identity applied; no other requester's data returned | `server/tests/lab-03/authorization.api.test.ts` | Pass — an undocumented `requesterId` query parameter is refused with 400 `INVALID_QUERY_PARAMETER` (BR-34) and returns no rows. |
| SEC-04 | AC-12 | Requester reading another's ticket | 404, byte-identical to a ticket that does not exist | `server/tests/lab-03/authorization.api.test.ts` | Pass — for ticket detail and for its attachment list. |
| SEC-05 | AC-13 | Requester calling the staff queue | 403 `FORBIDDEN` | `server/tests/lab-03/authorization.api.test.ts` | Pass — a Requester is refused 403 on the queue and the owner list, before the query is read. |
| SEC-06 | AC-02 | Gated user calling a protected endpoint | 403 `PASSWORD_CHANGE_REQUIRED` | `server/tests/lab-03/authorization.api.test.ts` | Pass — over the route table as it stands, as SEC-01. |
| SEC-07 | AC-14 | Requester and IT Staff calling Administrator endpoints | 403 `FORBIDDEN` for both | `server/tests/lab-03/users-admin.api.test.ts` | Pass — with a session that is absent (401), a Requester's and an IT Staff member's (403), across all four Administrator endpoints; and nothing changes. Kept beside the other Administrator tests rather than in the authorization suite, which is created by a Pull Request not yet merged when this landed. |
| SEC-08 | AC-23 | Requester attempting a status change | Refused; no route exists by which a Requester sets status | `server/tests/lab-03/authorization.api.test.ts` | Pass — `PATCH` and `PUT` on the ticket, and `PATCH` and `POST` on `/status`, all answer 404 `ROUTE_NOT_FOUND`; the resolved indication sent with a status leaves the status New. The staff status endpoint's 403 for a Requester arrives with #51, which adds it. |
| SEC-09 | AC-04, AC-25 | Requester requesting Internal Notes | 403 with no note content and no indication whether notes exist, on their own ticket and on a ticket with none | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — a Requester's own ticket with notes, their own ticket with none, and someone else's ticket all answer byte-identical 403 `FORBIDDEN` bodies (compared on `response.text`), containing no note content. Checked by dropping the role guard: the test failed with 200 instead of 403. |
| SEC-10 | BR-19 | Ownership resolved in the query | Another requester's attachment download and removal both 404 | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| SEC-11 | BR-05 | Staff and Administrator posting a resolved indication | 403 — it belongs to the Requester | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — IT Staff and an Administrator refused 403 on a Requester's ticket, and IT Staff on a ticket they raised; nothing recorded. Checked by removing the role guard: the test failed. |
| SEC-12 | BR-06 | No endpoint returns a credential | No password hash in any user-bearing response | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| SEC-13 | AC-11 | Role change mid-session | A user demoted from IT Staff is refused staff endpoints on the next request | `server/tests/lab-03/authorization.api.test.ts` | Pass — a purpose-made IT Staff account is demoted mid-session; the queue, the owner list and a staff operation all answer 403 on the next request, with the same cookie, while `GET /api/tickets` still answers 200. |
| SEC-14 | BR-41 | The retired header has no effect | Sending `X-Development-Requester-Id` changes nothing; no route reads it | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| SEC-15 | FR-29 | Staff cannot write another's attachments | IT Staff uploading to, or removing from, a ticket they did not raise answers 404; downloading the same ticket's attachment succeeds | `server/tests/lab-03/authorization.api.test.ts` | Pass |

### UI component

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UI-01 | FR-01 | Login renders its fields | Email and password with real labels; Sign In enabled | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | AC-05 | Login validation | Field-level messages; the API is not called for an invalid form | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-03 | AC-05 | Invalid credentials presentation | One message, wording identical for both causes; neither field singled out; values preserved | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-04 | AC-06 | Inactive account presentation | A distinct message naming the account as deactivated | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-05 | AC-36 | Login API failure | Safe failure block; entered values preserved | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-06 | FR-01 | Busy state on submit | Button disabled and labelled as working; no second submission | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-07 | AC-10 | Password rules panel | Each rule ticks as it is satisfied while typing | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-08 | AC-10 | Confirmation mismatch | Reported against Confirm, not against New | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-09 | AC-02 | The gated shell | No navigation is rendered while a password change is outstanding | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-10 | FR-20 | Queue renders rows and controls | Search, filters, sort and pagination present; rows populated | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass — rows and the six filters render, on the queue's own six-column grid; IT Priority, Current Status and Ticket Owner are sortable in the headers and in the mobile sort control, Category is not; a failed category load disables Category with a hint. |
| UI-11 | FR-21 | Unassigned rendering | An unowned ticket reads *Unassigned*, never an empty cell | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass — an unowned row reads *Unassigned* in words; the Unassigned option sends `unassigned=true`, a named owner sends `ownerId` and returns to page 1. |
| UI-12 | FR-20 | Queue empty and no-results | Distinct messages; no-results offers Clear Filters | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass — *No tickets yet* and *No tickets match these filters* are separate, the latter with Clear Filters; a failed load offers Try again, but a 401 or 403 does not — it says access has changed and re-reads the identity. |
| UI-13 | AC-34 | Role-dependent navigation | Each role sees only its destinations; unauthorized ones absent, not disabled | `client/tests/lab-03/AppShell.test.tsx` | Pass — each role's navigation holds exactly its destinations in ui-spec.md §2's order: Administrator four, IT Staff three, Requester two; a destination a role may not use is absent, not disabled. |
| UI-14 | FR-04 | Shell shows identity | Name and role badge shown; Logout present; no Change Requester action | `client/tests/lab-03/AppShell.test.tsx` | Pass — Change Requester and the “acting as” note are absent from the application shell. |
| UI-15 | FR-23 | Claim and reassign controls | Claim shown when unassigned; a select of eligible users when assigned | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass — Claim on an unassigned ticket sends the signed-in staff member's id, not the ticket's; an assigned ticket offers the eligible owners and Release; a refusal is shown against the field. Checked by claiming with the ticket id: the test failed. |
| UI-16 | AC-20 | Only permitted transitions offered | The status control lists exactly the permitted targets; a cancelled ticket shows it read-only | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass — from each of the seven non-terminal statuses the control lists exactly the permitted targets; a cancelled ticket shows the status read-only with a note and no dropdown; the client's copy of the matrix is asserted against §5's table. |
| UI-17 | BR-04 | Comments and notes are distinct | Separate headings, standing notes, and the note composer warns before posting | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass — separate headings with the Internal Notes one carrying a lock icon the Public Comments heading does not; both standing notes present ("Visible to the Requester" / "Not visible to the Requester"); a secondary composer button for notes against comments' primary; the restriction repeated at the note composer's own hint. Checked by rendering notes unconditionally: UI-18 failed. |
| UI-18 | AC-25 | A Requester's detail has no notes section | Absent entirely, not empty and not disabled | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass — no notes heading, region, textbox or text on the Requester's detail, and no request to a notes endpoint. |
| UI-19 | AC-36 | Composer failure preserves text | Typed content survives a failed post | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass — the Internal Notes composer keeps the typed text after a failed post. Checked by clearing the field in the failure branch: the test failed with an empty value. |
| UI-20 | AC-22 | Resolved indication | Confirmed before firing; replaced afterwards by a statement of when | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass — a secondary button opens a confirmation saying the status does not change; Cancel sends nothing; confirming sends one request and the button is replaced by a statement carrying the server's time; a failure keeps the confirmation open with the reason; never offered to IT Staff or an Administrator, even on their own ticket; if the time cannot be read back, the statement is made without one. Checked by firing without the confirmation: three tests failed. |
| UI-21 | AC-28 | User list renders | Name, email, role, status and an Edit action per row | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-22 | AC-29 | Create form | One role as a select; rules panel on the initial password | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-23 | AC-30 | Duplicate email presentation | Message against the Email field | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-24 | AC-31, AC-32 | Refusal presentation | Toggle springs back; the row does not update optimistically; each refusal has its own message | `client/tests/lab-03/UserManagement.test.tsx` | Pass — the switch returns to Active after a refused self-deactivation, role and state return after a refused last-Administrator change, each with its own message, and the row changes only on the server's answer. An edit re-reads the list while a search or role is active; saving or resetting your own account re-reads the identity (PR #61 review). |
| UI-25 | §8.3 | Opening a ticket from the queue | Every row and every card exposes the ticket number as a link to the detail, reachable by keyboard | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass — the ticket number links to the detail in the table row and on the card. |
| UI-26 | AC-02 | The route guard | Signed out goes to sign-in; a pending password change goes to Change Password and nowhere else; Change Password turns away anyone without one; a session check in flight waits rather than redirecting | `client/tests/lab-03/AuthGuard.test.tsx` | Pass — including a screen limited to some roles, which redirects every other signed-in role to My Tickets, after the sign-in and password-change checks. |

### UI style

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| STYLE-01 | §1 | Role badge | Renders through the shared badge component with a role modifier | `client/tests/lab-03/style/badges.test.tsx` | Pass — Requester, IT Staff and Administrator each render the word with `tkt-badge--<role>` and `data-kind="role"`; no raw enum text. |
| STYLE-02 | §1 | New status badges | `Reopened` and `Cancelled` carry their modifiers; `Waiting for Requester` is labelled, not `Pending` | `client/tests/lab-03/style/badges.test.tsx` | Pass — `tkt-badge--reopened` and `tkt-badge--cancelled` asserted; `Waiting for Requester` present, `Pending` absent. |
| STYLE-03 | AC-34 | Active navigation marking | Marked by class and `aria-current`, not colour alone | `client/tests/lab-03/style/shell.test.tsx` | Pass — the current link carries `tkt-nav-link--active` and `aria-current="page"` (added by the router's `NavLink`); every other link carries neither. |
| STYLE-04 | §10 | Password toggle accessibility | A button whose accessible name changes between Show and Hide | `client/tests/lab-03/style/fields.test.tsx` | Pass — `type="button"`, name flips Show/Hide password on click, input type flips password/text. |
| STYLE-05 | §10 | Rules panel semantics | A list; each rule's state conveyed by text or accessible name | `client/tests/lab-03/style/fields.test.tsx` | Pass — a list named Password requirements; every item reads "not yet met" empty and "met" (never "not yet met") with a compliant password. |
| STYLE-06 | §10 | Queue header sorting | `aria-sort` present on every column the API can sort by, `none` when inactive, and absent on Category which it cannot | `client/tests/lab-03/style/queue.test.tsx` | Pass — IT Priority, Current Status and Ticket Owner read `none`, then `descending`/`ascending` when active; Category carries no `aria-sort`; the header sorts through a button. |
| STYLE-07 | BR-04 | Note section restriction is textual | The restriction is stated in text, not conveyed by tint alone | `client/tests/lab-03/style/messages.test.tsx` | Pass — "Not visible to the Requester" appears twice (standing note and composer hint); the section is labelled for assistive technology. |
| STYLE-08 | §10 | Labels bind to controls | Every new field has a real label bound to a real control; read-only values carry none | `client/tests/lab-03/style/fields.test.tsx` | Pass — input, select and textarea each resolve through their label; a read-only owner input keeps its label (it is a control), while badge and block spans are spans, not labels. |
| STYLE-09 | §1 | Editable versus read-only | Staff detail marks operational fields editable and the rest read-only | `client/tests/lab-03/style/detail.test.tsx` | Pass — staff get three labelled selects; a Requester gets badges and no labelled IT Priority or Current Status; a cancelled ticket is read-only even for staff, with the cannot-be-moved note. |
| STYLE-10 | §1 | Validation placement | Every new message renders inside its own field group | `client/tests/lab-03/style/fields.test.tsx` | Pass — the message and the note composer's message each render as an alert inside their own `.tkt-field-group`. |

### Responsive and visual

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| RESP-01 | AC-35 | No horizontal page scroll | Every new screen, all three viewports | `e2e/lab-03/visual.spec.ts` | Pass — zero page overflow asserted on Login, Change Password, the Ticket Queue, both Ticket Detail views and User Management (list and open form), at desktop, tablet and mobile. |
| RESP-02 | AC-35 | Nothing clipped | No text clipped at any viewport, screen-reader-only text excepted | `e2e/lab-03/visual.spec.ts` | Pass — the same six screens asserted with no label, button, link or cell wider than its own container. |
| RESP-03 | AC-35 | Queue becomes cards below 768 px | Table absent and cards present on mobile; the reverse above; asserted from both sides | `e2e/lab-03/visual.spec.ts` | Pass — a ticket is created first so the row is a precondition rather than an empty list passing vacuously, then `.tkt-table` and `.tkt-cards` are each asserted visible or absent by viewport. |
| RESP-04 | AC-35 | Sorting reachable on mobile | The sort control is present once the table is gone | `e2e/lab-03/visual.spec.ts` | Pass — the mobile "Sort by" select is asserted visible below 768 px, and the header's sort button asserted visible at and above it. |
| RESP-05 | §1 | Zen Green palette | Header, primary buttons and active navigation read the handout §7 greens from the live browser | `e2e/lab-03/visual.spec.ts` | Pass — the Ticket Queue header and User Management's Create User button read the handout's primary green from `getComputedStyle`; exactly one link inside the navigation carries `aria-current`, it is Ticket Queue, and its underline is the accent green. |
| RESP-06 | §10 | Touch targets | Interactive targets at least 44 px in the mobile band | `e2e/lab-03/visual.spec.ts` | Pass — every visible button, link, input, select and textarea on the page — header, breadcrumb and opened navigation included, not only `<main>` — is at least 44 px tall on the Ticket Queue and User Management, in the mobile project. Widening the scan found the brand link at 30 px, now raised. |

### Migration and regression

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| MIG-01 | BR-39 | Identifiers survive | Every pre-existing user keeps its id; every ticket's requester still resolves | `server/tests/lab-03/migration.api.test.ts` | Pass — the Lab 3 migrations are read for anything that drops, truncates or renumbers users; the foreign key is read from the schema; and a ticket written against a stored id is read back through a signed-in session. |
| MIG-02 | BR-39 | Attachment relations survive | Uploader and remover references remain valid | `server/tests/lab-03/migration.api.test.ts` | Pass |
| MIG-03 | BR-24 | The renamed status | Rows previously `PENDING` read as `WAITING_FOR_REQUESTER`; the filter returns them | `server/tests/lab-03/migration.api.test.ts` | Pass — the migration renames the enum value in place and drops no type; the database holds the eight statuses in lifecycle order; `PENDING` no longer casts; the queue filter returns the row under the new name and refuses the old one; the same migration backfills IT Priority. |
| MIG-04 | AC-27 | Existing attachments still reachable | By their owner, and now by staff | `server/tests/lab-03/migration.api.test.ts` | Pass — a row written straight to the table with no session, Lab 2 style, is listed and downloaded by its owner and by staff with the bytes intact. (The suite's own fixture cannot serve: it is removed by design and answers 404 by contract.) |
| MIG-05 | BR-43 | The seed restores credentials | Running it twice returns a consumed must-change flag to its seeded state | `server/tests/lab-03/seed.api.test.ts` | Pass — the seed runs in a child process exactly as `prisma db seed` runs it: after a password change consumes the flag, a rerun restores the seeded password and the flag, with no duplicate accounts. |
| MIG-06 | BR-41 | Nothing client-supplied remains | No route, module or stored value accepts a client-supplied identity | `server/tests/lab-03/authorization.api.test.ts` | Pass — read from the source: no module names the header, the endpoint or the route, the client touches no browser storage, and no server module reads `requesterId` from a body. |
| MIG-08 | §7 | Password hash backfill | After migration no account has a null hash; an account the seed does not know stays locked (fails closed) until an Administrator issues it a password | `server/tests/lab-03/migration.api.test.ts` | Pass — the migration sets `'!'` then `NOT NULL` (read from the migration itself); no row holds null; a `'!'` account answers 401 `INVALID_CREDENTIALS` like an unknown address. Corrects the earlier wording, which claimed migrated accounts are flagged to change — the specification (§7) and the code fail them closed instead. |
| MIG-07 | Lab 2 suite | The Lab 2 suites still pass, after the four changes below | Behaviour assertions are untouched; only setup and the renamed value change | `server/tests/lab-02/`, `client/tests/lab-02/`, `e2e/lab-02/` | Pass — server, client and all three browser viewports. Beyond the four changes below, three server assertions that named the retired `REQUESTER_CONTEXT_REQUIRED` now expect its documented successor, 401 `UNAUTHENTICATED` (api-spec.md §3), and one client test about re-selecting the same requester became one about signing out on the page. |

**What changes in the Lab 2 suites, and what does not.** Four things force an edit, and none of them is an assertion about behaviour:

1. **Identity setup.** Every server test that set the development header signs in instead; every browser test that drove the selector starts from a session a Playwright setup project saved by signing in through the real screen, and a second person gets a second browser context rather than a Logout — signing out would delete the session every later test reuses.
2. **The renamed status.** Any fixture or assertion naming `PENDING` becomes `WAITING_FOR_REQUESTER`.
3. **Reference data now needs a session.** Tests that fetched categories or related systems unauthenticated must authenticate first.
4. **The selector's own tests.** The suites covering the selection screen and the stored requester context describe a screen that no longer exists. They are deleted, and the ownership and recovery intent they carried is preserved by the Lab 3 authorization tests rather than lost.

Everything else stays: the assertions about what the product does are exactly the point of a regression suite, and an assertion edited to make a suite pass is not evidence of anything.

### End-to-end

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | AC-01 | Sign in and land in the application | Identity and role shown in the shell | `e2e/lab-03/authentication.spec.ts` | Pass — signs in through the real screen and asserts the name and role badge in the shell. |
| E2E-02 | AC-02 | Initial password login and change | Normal screens open only after a valid change | `e2e/lab-03/authentication.spec.ts` | Pass — an Administrator arms the mandatory-change flag with a new starting password; signing in with it opens only Change Password, a direct `/my-tickets` request bounces back to it, and a valid change is what reaches My Tickets. |
| E2E-03 | AC-07 | Sign out blocks direct access | A protected URL after sign-out returns to login | `e2e/lab-03/authentication.spec.ts` | Pass — after Logout, a direct request for `/my-tickets` returns to `/login`. |
| E2E-04 | AC-05, AC-06 | Invalid and inactive sign-in | Each shows its own message | `e2e/lab-03/authentication.spec.ts` | Pass — a wrong password and a deactivated account's correct one each assert their own message text, in the same run. |
| E2E-05 | AC-15 to AC-22 | The staff journey | Find in the queue, open, claim, set IT Priority, advance status, comment, note | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass — a ticket is found by search in the queue, opened, claimed, released back to Unassigned and claimed again, has its IT Priority changed from High to Low with Requested Priority still High after a reload, is advanced from New to Open, and is given a Public Comment and an Internal Note. |
| E2E-06 | AC-29 | Administrator creates a user who then signs in | The new user is forced to change the password on first sign-in | `e2e/lab-03/user-administration.spec.ts` | Pass — an Administrator creates a Requester, who signs in with the starting password, is redirected to Change Password, and reaches My Tickets only after changing it. |
| E2E-07 | AC-31, AC-32 | Administrator safety rules in the interface | Self-deactivation and last-Administrator both refused with their own messages | `e2e/lab-03/user-administration.spec.ts` | Pass — asserted on the seed's own Administrator: deactivating her own account and demoting her own role (the sole active Administrator) are each refused with their own message, and each field springs back rather than leaving the form looking as though it saved. |
| E2E-08 | AC-24 | Requester and staff converse | A staff Public Comment appears on the Requester's ticket, and the reverse | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass — a staff Public Comment appears on the Requester's own view of the ticket, and the Requester's reply appears back on staff's. |
| E2E-09 | AC-12 | Cross-requester refusal in the browser | Requester B opening Requester A's ticket URL sees the not-found state | `e2e/lab-03/authentication.spec.ts` | Pass — Requester B opening Requester A's ticket URL directly sees *Ticket not found*, worded identically to a ticket that does not exist. |
| E2E-10 | AC-22 | Requester indicates resolved, staff sees it | The indication appears on the staff detail | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass — the Requester's own "Problem appears resolved" indication, once recorded, is asserted on the staff detail worded as the requester's. |

---

## 3. Acceptance-Criterion Traceability

Every criterion in specification.md §9, and the planned tests that cover it. A criterion with no test is a criterion nobody will notice breaking.

| AC | Covered by |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | API-06, API-07, SEC-06, UI-09, UI-26, E2E-02 |
| AC-03 | API-14, SEC-03 |
| AC-04 | SEC-09 |
| AC-05 | API-02, UI-02, UI-03, E2E-04 |
| AC-06 | API-03, UI-04, E2E-04 |
| AC-07 | API-08, E2E-03 |
| AC-08 | API-09 |
| AC-09 | API-12 |
| AC-10 | UNIT-03, API-11, UI-07, UI-08 |
| AC-11 | API-10, SEC-13 |
| AC-12 | SEC-04, E2E-09 |
| AC-13 | SEC-05 |
| AC-14 | SEC-07 |
| AC-15 | API-15, E2E-05 |
| AC-16 | API-18 |
| AC-17 | API-20, E2E-05 |
| AC-18 | API-21 |
| AC-19 | API-22, E2E-05 |
| AC-20 | UNIT-02, API-24, UI-16 |
| AC-21 | UNIT-02, API-25 |
| AC-22 | API-27, UI-20, E2E-10 |
| AC-23 | SEC-08 |
| AC-24 | API-28, E2E-08 |
| AC-25 | SEC-09, UI-18 |
| AC-26 | UNIT-06, API-30 |
| AC-27 | API-31, MIG-04 |
| AC-28 | API-32, UI-21 |
| AC-29 | API-33, UI-22, E2E-06 |
| AC-30 | API-34, UI-23 |
| AC-31 | API-36, UI-24, E2E-07 |
| AC-32 | API-37, UI-24, E2E-07 |
| AC-33 | API-38 |
| AC-34 | UI-13, STYLE-03 |
| AC-35 | RESP-01, RESP-02, RESP-03, RESP-04 |
| AC-36 | UI-05, UI-19 |

**Tests with no acceptance criterion.** UNIT-01, UNIT-04, UNIT-05, API-04, API-05, API-13, API-16, API-17, API-19, API-23, API-26, API-29, API-35, API-39, API-40, API-41, API-42, API-43, API-44, API-45, API-46, SEC-01, SEC-02, SEC-10, SEC-11, SEC-12, SEC-14, SEC-15, UI-01, UI-06, UI-10, UI-11, UI-12, UI-14, UI-15, UI-17, UI-25, STYLE-01, STYLE-02, STYLE-04 to STYLE-10, RESP-05, RESP-06, MIG-01, MIG-02, MIG-03, MIG-05, MIG-06, MIG-07, MIG-08 cover business rules or handout requirements that no criterion names. That is a gap in the criteria rather than in the suite, and it is recorded here rather than resolved by attaching a test to an unrelated criterion.

---

## 4. Test Commands

```bash
docker compose up -d
npm run db:migrate
npm run db:seed                 # reference data, including every user account
npm run db:seed:demo            # tickets, comments and notes
npm run db:test:setup           # migrate and seed the test database
npm test                        # unit, API, authorization, migration, UI, style
npm run test:e2e                # responsive and end-to-end, three viewports
npm exec -- ultracite check
```

---

## 5. Final Results

Run on 2026-09-18/19, after the closing PR's tests landed: server `npx vitest run`
(26 files, 577 tests), client `npx vitest run` (30 files, 436 tests) — both green.
The browser levels ran green as PR #66 and are untouched by this PR, which
changes no application code; their counts below are the specs' own tests times
the three viewport projects.

| Level | Files | Tests | Result |
| --- | --- | --- | --- |
| Unit | 5 | 45 | Pass |
| API / integration | 5 | 151 | Pass |
| Security / authorization | 4 | 38 | Pass — 31 in the authorization suite, 7 SEC rows beside the endpoints they guard |
| Migration / regression | 29 | 625 | Pass — 18 Lab 3 rows (17 migration + 1 seed); the Lab 2 server (331) and client (276) suites green unchanged |
| UI component | 10 | 137 | Pass |
| UI style | 6 | 23 | Pass |
| Responsive and visual | 1 | 27 | Pass as PR #66 — 9 specs × desktop, tablet, mobile |
| End-to-end | 3 | 21 | Pass as PR #66 — 7 journey specs × desktop, tablet, mobile |

---

## 6. Known Limitations

- **Concurrency is tested at one level only.** AC-33 exercises two simultaneous Administrator changes through the API. The interface is not tested under concurrency, because two browsers racing is not reproducible enough to be evidence.
- **Session expiry is tested by writing an expired row**, not by waiting eight hours.
- **The end-to-end suite runs single-worker.** Screenshots are evidence, and two workers racing over one database produce evidence of nothing. Inherited from Lab 2.
