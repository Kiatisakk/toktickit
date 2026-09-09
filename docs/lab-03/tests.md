# Lab 3 Test Plan and Results

Companion to [specification.md](specification.md). Written before implementation, not reconstructed from whatever the coding agent produced.

Every row's **Result** reads `Planned` until the Pull Request implementing it lands, at which point it is updated in that same Pull Request. **No row may read `Planned` at submission.**

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
| UNIT-01 | BR-19, D-08 | Role-to-query-scope mapping | Requester yields an ownership constraint; IT Staff and Administrator yield none | `server/tests/lab-03/scope.test.ts` | Planned |
| UNIT-02 | AC-20, AC-21, BR-25, BR-26 | Status transition matrix, every cell | Each permitted transition allowed; every other refused; `CANCELLED` allows none | `server/tests/lab-03/transitions.test.ts` | Planned |
| UNIT-03 | AC-10, BR-07 | Password rule evaluation | Too short, too long, and each missing character class rejected with the rule named; a compliant password accepted | `server/tests/lab-03/password.test.ts` | Planned |
| UNIT-04 | BR-06 | Hash and verify round-trip | A password verifies against its own hash and not against another; the hash is not the password | `server/tests/lab-03/password.test.ts` | Planned |
| UNIT-05 | BR-10 | Session token generation and hashing | Tokens are unique across many draws; the stored value is a hash, not the token | `server/tests/lab-03/session.test.ts` | Planned |
| UNIT-06 | BR-30 | Comment and note body validation | Empty, whitespace-only and over-length refused; boundary lengths accepted | `server/tests/lab-03/messages.test.ts` | Planned |

### API / integration

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| API-01 | AC-01 | Valid sign-in | 200, session cookie set, identity and role returned, no credential in the body | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | AC-05 | Unknown email vs wrong password | Both 401 `INVALID_CREDENTIALS`, identical body | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | AC-06 | Correct password, deactivated account | 403 `ACCOUNT_INACTIVE` | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | BR-09 | Wrong password on a deactivated account | 401 `INVALID_CREDENTIALS`, not `ACCOUNT_INACTIVE` | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | FR-04 | Current user retrieval | 200 with identity, role and the must-change flag | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-06 | AC-02 | The password-change gate | Every endpoint except `me`, `password`, `logout` answers 403 `PASSWORD_CHANGE_REQUIRED` | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-07 | AC-02 | The three permitted endpoints during the gate | All reachable while the flag is set | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-08 | AC-07 | Sign-out | 204; the previous cookie then answers 401 | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-09 | AC-08 | Expired session | A session past its expiry answers 401 | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-10 | AC-11 | Deactivation mid-session | A live session whose user is deactivated answers 401 on the next request | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-11 | AC-10 | Password change validation | Rule failures 400 with the field named; password unchanged | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-12 | AC-09 | Password change ends other sessions | Other sessions 401 afterwards; the current one continues | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-13 | BR-13 | Sign-out is idempotent | Signing out without a session answers 204 | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-14 | AC-03 | A body carrying `requesterId` | Ignored; the ticket is recorded against the authenticated user | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-15 | AC-15 | Staff queue returns all requesters' tickets | Tickets from several requesters present | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-16 | FR-20 | Queue search, filters and sorting | Each parameter narrows or orders as documented | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-17 | FR-21 | Unassigned filter | Returns only tickets with no owner; `ownerId` and `unassigned` together 400 | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-18 | AC-16 | Blank query parameter | `page`, `pageSize`, `sort`, `order` blank 400; filters blank treated as absent | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-19 | FR-20 | Pagination stability | Paging the full set repeats no ticket and skips none, including ties on timestamp | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-20 | AC-17 | Claiming an unowned ticket | Owner becomes the caller; visible to another staff session | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-21 | AC-18 | Reassignment and release | Owner becomes the named user; `null` releases | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-22 | AC-19 | IT Priority independence | IT Priority set; Requested Priority unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-23 | BR-21 | Ineligible owner | Assigning a Requester or an inactive user 400 `TICKET_OWNER_INELIGIBLE` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-24 | AC-20 | Refused transition | 400 `INVALID_STATUS_TRANSITION`; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-25 | AC-21 | Cancelled is terminal | Every transition out of `CANCELLED` refused | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-26 | BR-25 | A permitted transition | Accepted; new state returned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-27 | AC-22 | Requester resolved indication | 204; timestamp recorded; status unchanged; idempotent | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-28 | AC-24 | Public Comment visibility | Requester and staff both read it with author and time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-29 | BR-29 | Author and timestamp are server-side | Values supplied in the body are ignored | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-30 | AC-26 | Empty and whitespace-only body | 400 `VALIDATION_FAILED` | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-31 | AC-27 | Staff read a requester's attachments | Metadata listed and content downloadable | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-32 | AC-28 | Administrator user list | Name, email, role and state returned; search and role filter narrow it | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-33 | AC-29 | User creation | 201; the user can sign in and is required to change the password | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-34 | AC-30 | Duplicate email on create and on edit | 409 `EMAIL_ALREADY_EXISTS` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-35 | FR-35 | Editing name, email, role and state | Each persists; one role only | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-36 | AC-31 | Self-deactivation | 409 `CANNOT_DEACTIVATE_SELF`; account still active | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-37 | AC-32 | Last active Administrator | Deactivating or demoting the only one 409 `LAST_ACTIVE_ADMIN` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-38 | AC-33 | Two Administrators deactivating each other at once | At least one refused; an active Administrator remains | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-39 | BR-37 | Setting a new initial password | 204; flag set; the user's sessions ended; sign-in with the new password requires a change | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-40 | BR-20 | Error bodies leak nothing | No stack trace, path or database message on any failure path | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-41 | §5 | Reference data now requires a session | Categories and related systems 401 without one; health stays public | `server/tests/lab-03/authorization.api.test.ts` | Planned |

### Security / authorization

Every test here calls the API directly with a session of the wrong kind. None drives the interface.

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | FR-09 | Every protected endpoint without a session | 401 `UNAUTHENTICATED`, enumerated across the whole route table | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-02 | FR-10 | Every role-restricted endpoint with each wrong role | 403 `FORBIDDEN`, enumerated | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-03 | AC-03 | Requester supplying another `requesterId` | Authenticated identity applied; no other requester's data returned | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-04 | AC-12 | Requester reading another's ticket | 404, byte-identical to a ticket that does not exist | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-05 | AC-13 | Requester calling the staff queue | 403 `FORBIDDEN` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-06 | AC-02 | Gated user calling a protected endpoint | 403 `PASSWORD_CHANGE_REQUIRED` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-07 | AC-14 | Requester and IT Staff calling Administrator endpoints | 403 `FORBIDDEN` for both | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-08 | AC-23 | Requester attempting a status change | Refused; no route exists by which a Requester sets status | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-09 | AC-04, AC-25 | Requester requesting Internal Notes | 403 with no note content and no indication whether notes exist, on their own ticket and on a ticket with none | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| SEC-10 | BR-19 | Ownership resolved in the query | Another requester's attachment download and removal both 404 | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-11 | BR-05 | Staff and Administrator posting a resolved indication | 403 — it belongs to the Requester | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| SEC-12 | BR-06 | No endpoint returns a credential | No password hash in any user-bearing response | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| SEC-13 | AC-11 | Role change mid-session | A user demoted from IT Staff is refused staff endpoints on the next request | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-14 | BR-41 | The retired header has no effect | Sending `X-Development-Requester-Id` changes nothing; no route reads it | `server/tests/lab-03/authorization.api.test.ts` | Planned |

### UI component

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| UI-01 | FR-01 | Login renders its fields | Email and password with real labels; Sign In enabled | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | AC-05 | Login validation | Field-level messages; the API is not called for an invalid form | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-03 | AC-05 | Invalid credentials presentation | One message, wording identical for both causes; neither field singled out; values preserved | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-04 | AC-06 | Inactive account presentation | A distinct message naming the account as deactivated | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-05 | AC-36 | Login API failure | Safe failure block; entered values preserved | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-06 | FR-01 | Busy state on submit | Button disabled and labelled as working; no second submission | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-07 | AC-10 | Password rules panel | Each rule ticks as it is satisfied while typing | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-08 | AC-10 | Confirmation mismatch | Reported against Confirm, not against New | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-09 | AC-02 | The gated shell | No navigation is rendered while a password change is outstanding | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-10 | FR-20 | Queue renders rows and controls | Search, filters, sort and pagination present; rows populated | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-11 | FR-21 | Unassigned rendering | An unowned ticket reads *Unassigned*, never an empty cell | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-12 | FR-20 | Queue empty and no-results | Distinct messages; no-results offers Clear Filters | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-13 | AC-34 | Role-dependent navigation | Each role sees only its destinations; unauthorized ones absent, not disabled | `client/tests/lab-03/AppShell.test.tsx` | Planned |
| UI-14 | FR-04 | Shell shows identity | Name and role badge shown; Logout present; no Change Requester action | `client/tests/lab-03/AppShell.test.tsx` | Planned |
| UI-15 | FR-23 | Claim and reassign controls | Claim shown when unassigned; a select of eligible users when assigned | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-16 | AC-20 | Only permitted transitions offered | The status control lists exactly the permitted targets; a cancelled ticket shows it read-only | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-17 | BR-04 | Comments and notes are distinct | Separate headings, standing notes, and the note composer warns before posting | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-18 | AC-25 | A Requester's detail has no notes section | Absent entirely, not empty and not disabled | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| UI-19 | AC-36 | Composer failure preserves text | Typed content survives a failed post | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-20 | AC-22 | Resolved indication | Confirmed before firing; replaced afterwards by a statement of when | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| UI-21 | AC-28 | User list renders | Name, email, role, status and an Edit action per row | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-22 | AC-29 | Create form | One role as a select; rules panel on the initial password | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-23 | AC-30 | Duplicate email presentation | Message against the Email field | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-24 | AC-31, AC-32 | Refusal presentation | Toggle springs back; the row does not update optimistically; each refusal has its own message | `client/tests/lab-03/UserManagement.test.tsx` | Planned |

### UI style

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| STYLE-01 | §1 | Role badge | Renders through the shared badge component with a role modifier | `client/tests/lab-03/style/badges.test.tsx` | Planned |
| STYLE-02 | §1 | New status badges | `Reopened` and `Cancelled` carry their modifiers; `Waiting for Requester` is labelled, not `Pending` | `client/tests/lab-03/style/badges.test.tsx` | Planned |
| STYLE-03 | AC-34 | Active navigation marking | Marked by class and `aria-current`, not colour alone | `client/tests/lab-03/style/shell.test.tsx` | Planned |
| STYLE-04 | §10 | Password toggle accessibility | A button whose accessible name changes between Show and Hide | `client/tests/lab-03/style/fields.test.tsx` | Planned |
| STYLE-05 | §10 | Rules panel semantics | A list; each rule's state conveyed by text or accessible name | `client/tests/lab-03/style/fields.test.tsx` | Planned |
| STYLE-06 | §10 | Queue header sorting | `aria-sort` present on every sortable column, `none` when inactive | `client/tests/lab-03/style/queue.test.tsx` | Planned |
| STYLE-07 | BR-04 | Note section restriction is textual | The restriction is stated in text, not conveyed by tint alone | `client/tests/lab-03/style/messages.test.tsx` | Planned |
| STYLE-08 | §10 | Labels bind to controls | Every new field has a real label bound to a real control; read-only values carry none | `client/tests/lab-03/style/fields.test.tsx` | Planned |
| STYLE-09 | §1 | Editable versus read-only | Staff detail marks operational fields editable and the rest read-only | `client/tests/lab-03/style/fields.test.tsx` | Planned |
| STYLE-10 | §1 | Validation placement | Every new message renders inside its own field group | `client/tests/lab-03/style/fields.test.tsx` | Planned |

### Responsive and visual

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| RESP-01 | AC-35 | No horizontal page scroll | Every new screen, all three viewports | `e2e/lab-03/visual.spec.ts` | Planned |
| RESP-02 | AC-35 | Nothing clipped | No text clipped at any viewport, screen-reader-only text excepted | `e2e/lab-03/visual.spec.ts` | Planned |
| RESP-03 | AC-35 | Queue becomes cards below 768 px | Table absent and cards present on mobile; the reverse above; asserted from both sides | `e2e/lab-03/visual.spec.ts` | Planned |
| RESP-04 | AC-35 | Sorting reachable on mobile | The sort control is present once the table is gone | `e2e/lab-03/visual.spec.ts` | Planned |
| RESP-05 | §1 | Zen Green palette | Header, primary buttons and active navigation read the §7 greens from the live browser | `e2e/lab-03/visual.spec.ts` | Planned |
| RESP-06 | §10 | Touch targets | Interactive targets at least 44 px in the mobile band | `e2e/lab-03/visual.spec.ts` | Planned |

### Migration and regression

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| MIG-01 | BR-39 | Identifiers survive | Every pre-existing user keeps its id; every ticket's requester still resolves | `server/tests/lab-03/migration.api.test.ts` | Planned |
| MIG-02 | BR-39 | Attachment relations survive | Uploader and remover references remain valid | `server/tests/lab-03/migration.api.test.ts` | Planned |
| MIG-03 | BR-24 | The renamed status | Rows previously `PENDING` read as `WAITING_FOR_REQUESTER`; the filter returns them | `server/tests/lab-03/migration.api.test.ts` | Planned |
| MIG-04 | AC-27 | Existing attachments still reachable | By their owner, and now by staff | `server/tests/lab-03/migration.api.test.ts` | Planned |
| MIG-05 | BR-43 | The seed restores credentials | Running it twice returns a consumed must-change flag to its seeded state | `server/tests/lab-03/seed.api.test.ts` | Planned |
| MIG-06 | BR-41 | Nothing client-supplied remains | No route, module or stored value accepts a client-supplied identity | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| MIG-07 | Lab 2 suite | The Lab 2 suites still pass | Every Lab 2 test passes unchanged except where identity setup moved to sign-in | `server/tests/lab-02/`, `client/tests/lab-02/` | Planned |

### End-to-end

| ID | AC | What it tests | Expected result | Test file | Result |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | AC-01 | Sign in and land in the application | Identity and role shown in the shell | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | AC-02 | Initial password login and change | Normal screens open only after a valid change | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-03 | AC-07 | Sign out blocks direct access | A protected URL after sign-out returns to login | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-04 | AC-05, AC-06 | Invalid and inactive sign-in | Each shows its own message | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-05 | AC-15 to AC-22 | The staff journey | Find in the queue, open, claim, set IT Priority, advance status, comment, note | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-06 | AC-29 | Administrator creates a user who then signs in | The new user is forced to change the password on first sign-in | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-07 | AC-31, AC-32 | Administrator safety rules in the interface | Self-deactivation and last-Administrator both refused with their own messages | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-08 | AC-24 | Requester and staff converse | A staff Public Comment appears on the Requester's ticket, and the reverse | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-09 | AC-12 | Cross-requester refusal in the browser | Requester B opening Requester A's ticket URL sees the not-found state | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-10 | AC-22 | Requester indicates resolved, staff sees it | The indication appears on the staff detail | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |

---

## 3. Acceptance-Criterion Traceability

Every criterion in specification.md §9, and the planned tests that cover it. A criterion with no test is a criterion nobody will notice breaking.

| AC | Covered by |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | API-06, API-07, SEC-06, UI-09, E2E-02 |
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

**Tests with no acceptance criterion.** UNIT-01, UNIT-04, UNIT-05, API-04, API-05, API-13, API-16, API-17, API-19, API-23, API-26, API-29, API-39, API-40, API-41, SEC-01, SEC-02, SEC-10, SEC-11, SEC-12, SEC-14, UI-01, UI-06, UI-10, UI-11, UI-12, UI-14, UI-15, UI-17, STYLE-01, STYLE-02, STYLE-04 to STYLE-10, RESP-05, RESP-06, MIG-01, MIG-02, MIG-03, MIG-05, MIG-06, MIG-07 cover business rules or handout requirements that no criterion names. That is a gap in the criteria rather than in the suite, and it is recorded here rather than resolved by attaching a test to an unrelated criterion.

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

To be completed as the implementing Pull Requests land.

| Level | Files | Tests | Result |
| --- | --- | --- | --- |
| Unit | | | Pending |
| API / integration | | | Pending |
| Security / authorization | | | Pending |
| Migration / regression | | | Pending |
| UI component | | | Pending |
| UI style | | | Pending |
| Responsive and visual | | | Pending |
| End-to-end | | | Pending |

---

## 6. Known Limitations

- **Concurrency is tested at one level only.** AC-33 exercises two simultaneous Administrator changes through the API. The interface is not tested under concurrency, because two browsers racing is not reproducible enough to be evidence.
- **Session expiry is tested by writing an expired row**, not by waiting eight hours.
- **The end-to-end suite runs single-worker.** Screenshots are evidence, and two workers racing over one database produce evidence of nothing. Inherited from Lab 2.
