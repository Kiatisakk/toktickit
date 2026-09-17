# Lab 3 Sprint Engineering Specification

TokTickIT — Users, Roles, IT Staff Ticketing, and Administrator Screens · CPE 334, Semester 1/2026 · Kiatisak Markmeeshap (67070501005)

Companion documents: [ui-spec.md](ui-spec.md) · [api-spec.md](api-spec.md) · [tests.md](tests.md)

---

## 1. Sprint Goal

Replace the temporary Development Requester selector with real authentication, and build the two roles that were defined but unreachable. A user signs in with an email address and a password; the server decides what they may see and do from that identity and the role attached to it, never from anything the browser claims. Requesters keep every function Lab 2 gave them and gain the ability to talk about a ticket after raising it. IT Staff get a queue to find work in and the operations to work a ticket through its lifecycle. Administrators get one small screen for managing accounts. By the end of the sprint the product supports three roles end to end, and the header that stood in for identity is gone.

## 2. Stakeholder Request Interpretation

The stakeholder is asking for four things, and one of them is a constraint rather than a feature.

**Identity must become real.** The selector was scaffolding. Every operation that today trusts a client-supplied requester id must instead derive the requester from an authenticated session, and a user handed a starting password must choose their own before they can do anything else.

**The work must become workable.** Every ticket ever raised sits in `New`, because nothing in the product can move it. IT Staff need to find tickets, take responsibility for them, record IT's own view of urgency separately from the requester's, advance the ticket through a defined lifecycle, answer the requester in public, and keep notes the requester never sees.

**Accounts must become manageable.** Someone has to be able to create an account, change a role, and take access away — without a developer editing a seed script. The request is explicit that this screen stays minimal: no deletion, no bulk operations, no email, no self-registration.

**And the constraint: hiding a control is not authorization.** Every protected operation is enforced on the server. A disabled button is a courtesy to the user, not a boundary. This shapes the whole test plan — the authorization tests call the API directly rather than driving the UI.

## 3. Scope

### Included

- Email-and-password authentication, sign-out, retrieval of the current user, and a mandatory first-sign-in password change
- Role-based authorization for Requester, IT Staff and Administrator, enforced server-side on every protected endpoint
- Migration from Development Requester identity to the authenticated User, with the selector and its client-side state removed
- Continuation of every Lab 2 Requester ticket and attachment function under the authenticated identity
- IT Staff Ticket Queue with search, filters, sorting and pagination
- IT Staff Ticket Detail: ownership claim and reassignment, IT Priority, permitted status transitions, Public Comments, Internal Notes, attachment continuity
- A Requester's ability to post Public Comments and to indicate that the problem appears resolved
- A minimalist Administrator User Management screen: list, search, optional role filter, create, edit, one-role assignment, activation and deactivation, and issuing a new starting password
- Administrator safety rules: no self-deactivation, and never zero active Administrators
- Zen Green extensions for the new screens, reusing the existing tokens and components

### Excluded

Excluded by the handout, and not built:

- Email invitations, password-reset email, multi-factor authentication, social login, single sign-on
- Self-registration and Requester-created accounts
- Actions Taken by IT Staff
- Formal SLA calculation, escalation rules, notification services
- Dashboards and KPI analytics beyond simple queue counts
- Multi-tenant organisations, departments, customer administration
- Production deployment or cloud infrastructure changes
- More than one role per user
- User deletion, bulk user operations, user import or export, account-history screens
- Department, organisation, profile-photo and other extended profile management
- Email delivery of initial passwords or reset links
- Account unlocking, administrator approval workflows, advanced identity management
- Advanced user-list features: mandatory pagination, multi-column sorting, multiple simultaneous filters

Excluded by this specification, though not forbidden by the handout:

- Editing and deletion of Public Comments and Internal Notes — both are append-only this sprint (§4.6 of the handout requires append-only; the read is that editing is therefore out)
- Deferred to Lab 4: the rule that blocks resolution while Actions Taken remain incomplete, which cannot exist until Actions Taken do

## 4. Functional Requirements

### Authentication

- **FR-01** A user signs in with an email address and a password and receives authenticated access.
- **FR-02** A sign-in attempt with an unknown email address or an incorrect password is refused with a single, indistinguishable response.
- **FR-03** A sign-in attempt with a correct password against a deactivated account is refused, and says so.
- **FR-04** A signed-in user can retrieve their own identity, role, and whether a password change is outstanding.
- **FR-05** A signed-in user can sign out, after which the session cannot be reused.
- **FR-06** A session expires on its own after a fixed lifetime.
- **FR-07** A user flagged as requiring a password change can change it by supplying the current password and a new one.
- **FR-08** Changing a password clears the flag, ends the user's other sessions, and rotates the current one.

### Authorization

- **FR-09** Every protected endpoint refuses an unauthenticated request.
- **FR-10** Every protected endpoint refuses an authenticated request whose role does not permit the operation.
- **FR-11** While a password change is outstanding, every endpoint except retrieving the current user, changing the password and signing out is refused.
- **FR-12** Navigation presents only the destinations the current role may use.

### Requester continuation

- **FR-13** A Requester creates a ticket, and the ticket is recorded against their authenticated identity.
- **FR-14** A Requester lists, searches, filters, sorts and pages through their own tickets.
- **FR-15** A Requester opens the detail of a ticket they own.
- **FR-16** A Requester adds, downloads and soft-removes attachments on tickets they own.
- **FR-17** A Requester posts a Public Comment on a ticket they own.
- **FR-18** A Requester marks that the problem appears to be resolved on a ticket they own.
- **FR-19** A Requester cannot read, create or discover Internal Notes.

### IT Staff

- **FR-20** IT Staff retrieve a queue of all tickets with search, filters, sorting and pagination.
- **FR-21** IT Staff filter the queue for tickets with no owner.
- **FR-22** IT Staff open the detail of any ticket.
- **FR-23** IT Staff claim an unowned ticket for themselves.
- **FR-24** IT Staff assign or reassign a ticket to another eligible user.
- **FR-25** IT Staff set IT Priority independently of Requested Priority.
- **FR-26** IT Staff move a ticket to another status, limited to the permitted transitions.
- **FR-27** IT Staff post a Public Comment on any ticket.
- **FR-28** IT Staff create and read Internal Notes on any ticket.
- **FR-29** IT Staff view and download the attachments of any ticket.
- **FR-30** IT Staff raise and track their own tickets as a requester of them.

### Administrator

- **FR-31** An Administrator lists users showing name, email, role and activation state.
- **FR-32** An Administrator searches users by name or email address.
- **FR-33** An Administrator optionally filters the user list by role.
- **FR-34** An Administrator creates a user with a name, an email address, one role, an activation state, and a starting password.
- **FR-35** An Administrator edits a user's name, email address, role and activation state.
- **FR-36** An Administrator sets a new starting password that the user must change at their next sign-in.
- **FR-37** The system refuses to create or edit a user into a duplicate email address.
- **FR-38** The system refuses an Administrator's attempt to deactivate their own account.
- **FR-39** The system refuses any change that would leave no active Administrator.

## 5. Business Rules

`BR-01` to `BR-05` are fixed by §4.4 of the handout and reproduced as given.

### Authentication and credentials

- **BR-01** Only an active user with valid credentials may authenticate.
- **BR-02** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.
- **BR-03** The authenticated user identity, not a requesterId supplied by the client, determines ownership of Requester operations.
- **BR-06** Passwords are stored only as a hash produced by a memory-hard key-derivation function. Plaintext passwords are never stored, logged, or returned by any endpoint.
- **BR-07** A password is 8 to 128 characters and contains at least one upper-case letter, one lower-case letter, one digit and one special character. The upper bound exists because a memory-hard function applied to unbounded input is a denial-of-service vector.
- **BR-08** An unknown email address and an incorrect password produce the same refusal, so the sign-in form cannot be used to enumerate accounts.
- **BR-09** The deactivated-account refusal is reachable only after the supplied password has been verified. Someone who does not know the password learns nothing; the account's genuine owner gets an answer they can act on.
- **BR-10** A session is identified by an opaque random token held in an httpOnly cookie. The token is stored hashed, so a disclosed database is not a set of usable sessions.
- **BR-11** A session expires eight hours after it is created and is not renewed by activity.
- **BR-12** A user may hold several concurrent sessions. Signing in does not disturb sessions already open.
- **BR-13** Signing out deletes the session. A deleted or expired session is indistinguishable from one that never existed.
- **BR-14** Changing a password deletes every other session belonging to that user and rotates the current session's token.
- **BR-15** The session record stores no copy of the user's role or activation state. Both are read from the user record on every request, so deactivation and role changes take effect on the user's next request rather than at their next sign-in.

### Roles and authorization

- **BR-16** A user holds exactly one role: Requester, IT Staff, or Administrator.
- **BR-17** Authorization is enforced by the server on every protected operation. A control hidden or disabled in the interface is feedback, never a boundary.
- **BR-18** A request that fails the **role** boundary is refused with `403`. A request that fails the **ownership** boundary is refused with `404`, identical to a request for a resource that does not exist.

  These differ because they answer different questions. Roles are not secret — the navigation already implies which exist — so `403` on a role boundary discloses nothing. But `403` on a particular ticket confirms that the ticket exists, which is precisely what Lab 2's D-07 refused to do, and that reasoning has not changed. §6.2 of the handout requires the two to be distinguishable; this is how.
- **BR-19** Ownership is resolved inside the database query, never by fetching a record and comparing its owner afterwards. The scope a role implies — own tickets only, or all tickets — is part of that query.
- **BR-20** An error response never discloses a stack trace, a file path, a database message, or the existence of a resource the caller may not see.

### Ticket ownership, priority, and status

- **BR-21** A ticket has at most one owner, who must be an active IT Staff or Administrator user. A ticket may be unowned.
- **BR-22** Requested Priority is set by the Requester at creation and is never altered afterwards.
- **BR-23** IT Priority is set at creation to a copy of Requested Priority, as §4.5 requires. From then on the two are independent: only IT Staff or an Administrator may change IT Priority, and changing it never alters Requested Priority. Existing tickets receive the same copy during the migration, so no ticket is left without one.
- **BR-24** The ticket statuses are New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened and Cancelled.
- **BR-25** Only IT Staff and Administrators change a ticket's status, and only along a permitted transition. §5 records the matrix.
- **BR-26** `Cancelled` is terminal. A cancelled ticket does not move again.

#### Permitted status transitions

Every transition below belongs to IT Staff or an Administrator. A Requester
appears nowhere in this table: they set no status at all.

| From | Permitted transitions |
| --- | --- |
| New | Open, Cancelled |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened |
| Closed | Reopened |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled |
| Cancelled | *(terminal)* |

- **BR-05** A Requester may indicate the problem appears resolved, but cannot formally set the Ticket to Resolved or Closed.
- **BR-27** A Requester's indication that the problem appears resolved is recorded as a timestamp on the ticket, not as a status. It is set once and may be cleared only by the ticket leaving a resolved-or-closed state.

### Comments and notes

- **BR-04** Public Comments are visible to the Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator.
- **BR-28** Public Comments and Internal Notes are append-only. Neither can be edited or deleted this sprint.
- **BR-29** Each entry records its author and its creation time from the server. Neither is accepted from the client.
- **BR-30** Content is 1 to 5000 characters after trimming. Whitespace-only content is rejected.
- **BR-31** Content is rendered as text. It is never interpreted as markup.
- **BR-32** A Requester requesting an Internal Note endpoint is refused without any indication of whether notes exist on that ticket.

### Administrator

- **BR-33** An email address identifies exactly one account. Creating or editing a user into an address another account holds is refused.
- **BR-34** An Administrator cannot deactivate their own account.
- **BR-35** No change may leave the system with zero active Administrators. The count and the change occur in one transaction that locks the Administrator records, so two Administrators acting simultaneously cannot each observe a safe count and both proceed.
- **BR-36** Users are deactivated, never deleted, so the tickets, comments, notes and attachments they produced remain intact and attributed.
- **BR-37** An Administrator may set a new starting password, which flags the account as requiring a change at next sign-in. An Administrator never learns a user's existing password.
- **BR-38** Administrator and IT Staff responsibilities stay separate. Holding the Administrator role does not confer IT Staff ticket operations except where §6 states it explicitly.

### Migration and continuity

- **BR-39** Existing users keep their identifiers. Every existing ticket, attachment and relation continues to refer to the same person after the migration.
- **BR-40** Lab 2's BR-36 promised that this sprint would replace the source of identity without changing the ownership relationships, the ownership checks, or the responses they produce. That promise is kept: the handlers change by the name they import, not by their behaviour.
- **BR-41** The Development Requester selector, its route, its API endpoint and its client-side stored state are removed entirely. No part of the application retains a client-supplied identity mechanism.
- **BR-42** Seeded credentials are for local development only, are documented as such, and are never real personal passwords or secrets.
- **BR-43** The reference seed restores credentials on every run rather than skipping accounts that already exist, so that an account flagged for a first-sign-in password change is returned to that state for the next test run.

### Authorization matrix

Every protected operation, and what each role may do with it. `—` means refused with `403`; ownership-scoped entries are refused with `404` when the resource is not in scope.

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Sign in, sign out, read own identity | Yes | Yes | Yes |
| Change own password | Yes | Yes | Yes |
| Create ticket | Yes | Yes | Yes |
| List own tickets | Own only | Own only | Own only |
| Read ticket detail | Own only | Any | Any |
| Add or remove an attachment | Own ticket | Own ticket | Own ticket |
| Download an attachment | Own ticket | Any ticket | Any ticket |
| Read the staff Ticket Queue | — | Yes | Yes |
| Claim or reassign ticket ownership | — | Yes | Yes |
| Set IT Priority | — | Yes | Yes |
| Change ticket status | — | Yes | Yes |
| Mark "problem appears resolved" | Own only | — | — |
| Read Public Comments | Own ticket | Any | Any |
| Post Public Comment | Own ticket | Any | Any |
| Read or create Internal Notes | — | Yes | Yes |
| List, search or filter users | — | — | Yes |
| Create or edit a user | — | — | Yes |
| Set a user's new starting password | — | — | Yes |
| Activate or deactivate a user | — | — | Yes |

Administrators are granted the ticket operations above because they must be able to verify the system works without a second account; §4.3 permits this where the approved matrix states it explicitly, and this is that statement. Administrators are **not** granted the Requester-only action of marking a problem resolved, which belongs to the person who raised the ticket.

## 6. UI Specification Summary

Full detail is in [ui-spec.md](ui-spec.md). In summary:

**New screens.** Login; mandatory Change Password; IT Staff Ticket Queue; IT Staff Ticket Detail; Administrator User Management with a create/edit form.

**Changed screens.** The application shell replaces the Development Requester name and the Change Requester action with the authenticated user's name, their role, and Logout. Navigation renders only the destinations the current role may use. Requester Ticket Detail gains Public Comments and the "problem appears resolved" action.

**Removed screens.** Development Requester Selection, and its route.

**Consistency.** Existing Zen Green tokens, form conventions, cards, badges, buttons, validation placement, responsive rules and accessibility expectations remain in force unchanged. Ticket status, Requested Priority, IT Priority and role are all presented as badges from the same badge component. Editable and read-only fields remain visually distinct. Every required screen works at desktop, tablet and mobile.

**Feedback.** Every screen provides meaningful feedback for processing, validation, success, empty, no-results, forbidden, not-found, conflict and safe API failure, wherever those conditions are reachable on that screen.

## 7. Data Changes

### Changed models

**User** gains two columns: a password hash, and a flag recording that a password change is required before the application may be used. Nothing else about the model changes. The role enumeration already contains all three roles and the activation flag already exists — both were added in Lab 2 for this sprint, which is why there is no data migration here.

**Ticket** gains one column: a nullable timestamp recording that the Requester indicated the problem appears resolved.

### New models

**Session** — an identifier, a reference to the user, a creation timestamp and an expiry timestamp. The token itself is not stored; its hash is. Indexed by user so that ending a user's other sessions is one statement.

**PublicComment** — a reference to the ticket, a reference to the author, the body text, and a creation timestamp.

**InternalNote** — the same shape, in a separate table.

Two tables rather than one table with a visibility column: with one table every requester-facing query needs a visibility filter, and the first query that forgets one leaks internal notes to the requester. With two, the requester-facing endpoints never name the internal-note model, so the leak is structurally unavailable rather than merely guarded against.

### Changed enumerations

`TicketStatus` renames `PENDING` to `WAITING_FOR_REQUESTER` and adds `REOPENED` and `CANCELLED`.

### Relationships

- One User has one role.
- One User may own many tickets as their requester; one Ticket has exactly one requester.
- One Ticket has zero or one owner, who is a User.
- One Ticket has many Public Comments and many Internal Notes; each has exactly one author, who is a User.
- Categories, Related Systems, Tickets and Attachments are unchanged and remain valid.

### Indexes

The existing index on requester and creation date is retained for My Tickets. The staff queue adds an index supporting its default ordering — creation time then id, both descending — and one on the ticket owner, which the Owner and Unassigned filters read. The comment and note tables are indexed by ticket. Sessions are indexed by user.

### Migration strategy

Migrations arrive with the increment that needs them rather than as one migration at the start of the sprint. Authentication brings the two user columns and the session table; the message tables, the ticket column and the status rename arrive with the tickets that use them. Writing them all up front would mean shipping tables nothing reads and a status value nothing can set, and a migration is the one artefact that cannot be revised once it has been applied anywhere.

Two existing-row changes follow from it, and neither is a no-op. Every ticket currently in `PENDING` is rewritten to `WAITING_FOR_REQUESTER`. And the password hash arrives in three steps rather than one, because a single `NOT NULL` column cannot be added to populated rows and SQL cannot derive a `scrypt` hash anyway — the hashing lives in Node. So: add the column nullable; run a bootstrap step that hashes each existing account's issued starting password and sets the must-change flag on it; then alter the column to `NOT NULL` once no row is left null. The middle step is application code, not SQL, and the third step is what proves the second one finished. An account able to sign in with a null hash would be an account with no password, which is why the constraint is not simply left off.

**Revised in review.** The three steps above were built first, with the bootstrap as a separate script, and they worked — but only for someone who knew to run the script between the two migrations. The ordinary `db:migrate` and `db:test:setup` commands apply both migrations back to back, so a populated database took the null-value failure every time. A step a person has to remember is a step that gets skipped.

So the middle step moved into the second migration. It gives every account that predates authentication the value `!`, which is not a hash of anything, and then applies `NOT NULL`. Sign-in refuses any stored value that is not a well-formed scrypt encoding, so those accounts **cannot be signed in to** until they are issued a password — the upgrade fails closed rather than leaving an account with no password. Running the seed afterwards restores real credentials for every seeded account; anything else stays locked for an Administrator to reset.

Checked against a throwaway database built in the Lab 2 shape, with users and no passwords: one `prisma migrate deploy` succeeded, both accounts received `!`, and the seed then unlocked the seeded one and left the unknown one locked. Because Lab 2 named the model `User` rather than `RequesterUser` and defined all three roles up front, no identifier changes and no foreign key is rewritten.

### Seed

Reference data — categories, related systems, and **all user accounts of all roles** — is seeded into both the development and the test database. Demonstration data — tickets, comments and notes — is seeded only into the development database.

User accounts belong to the reference seed because the test suites must be able to sign in. Lab 2 kept its three IT Staff rows in the *demonstration* seed, since nothing but a screenshot needed them; they moved here with authentication, which is what the comment on that constant said would happen. The demonstration seed now reads them rather than writing them — two seeds writing one row is how a row ends up with a different role depending on which ran last. The seed provides at least four active Requesters and one inactive Requester, at least three active IT Staff and one inactive IT Staff, and at least one active Administrator, together with realistic tickets distributed across requesters, statuses, priorities and assigned or unassigned ownership, and example comments and notes that expose nothing sensitive.

The seed **restores** credentials on every run rather than creating only what is missing. An account flagged as requiring a password change exists to demonstrate that flow, and the end-to-end test that demonstrates it consumes the flag; a create-if-absent seed would let that test pass once and fail on every run afterwards.

## 8. API Contract

Full detail is in [api-spec.md](api-spec.md). In summary:

**Authentication** — sign in, sign out, read the current user, change password. The session travels in an httpOnly cookie; it never appears in a response body.

**Requester tickets and attachments** — the Lab 2 endpoints, unchanged in path, shape and status codes, now scoped by the authenticated identity.

**Staff queue and ticket operations** — retrieve the queue with search, filters, sorting and pagination; retrieve one ticket for staff purposes; claim, assign or reassign ownership; set IT Priority; change status.

**Comments and notes** — create and retrieve Public Comments; create and retrieve Internal Notes for permitted roles only.

**Administrator users** — list with search and optional role filter; create; edit; set a new starting password.

The queue reuses the existing ticket-query parser rather than introducing a second one. That parser already implements the documented rejection of blank parameter values and the secondary ordering key that prevents pagination from repeating or skipping rows; a second implementation would be a second opportunity to get those wrong differently.

### Status codes

| Code | Meaning |
| --- | --- |
| `200` / `201` / `204` | Success |
| `400` | Malformed input, or an invalid query parameter |
| `401` | No session, an expired session, or invalid sign-in credentials |
| `403` | The role forbids this, a password change is outstanding, or the credentials were correct but the account is deactivated |
| `404` | Resource absent, or outside the caller's ownership scope |
| `409` | Duplicate email, last active Administrator, self-deactivation |
| `413` | Request body too large |
| `500` | Unexpected server error, with no internal detail disclosed |

### Error codes

The Lab 2 request-context codes are retired rather than re-mapped. They answered `400`; their situations are now `401`, and keeping the old names alive would leave the API document describing responses nothing produces.

`UNAUTHENTICATED` · `INVALID_CREDENTIALS` · `ACCOUNT_INACTIVE` · `PASSWORD_CHANGE_REQUIRED` · `FORBIDDEN` · `EMAIL_ALREADY_EXISTS` · `LAST_ACTIVE_ADMIN` · `CANNOT_DEACTIVATE_SELF` · `INVALID_STATUS_TRANSITION` · plus the Lab 2 codes that survive unchanged for validation, tickets and attachments.

## 9. Acceptance Criteria

`AC-01` to `AC-04` are given by §9.1 of the handout and reproduced as stated.

- **AC-01** Given an active user with valid credentials, when the user logs in, then the backend establishes authenticated access and returns the permitted user identity and role.
- **AC-02** Given a user who must change the initial password, when login succeeds, then normal application screens remain unavailable until a valid new password is saved.
- **AC-03** Given an authenticated Requester, when the client supplies another requesterId, then the backend still applies the authenticated identity and does not return another Requester's data.
- **AC-04** Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected without exposing note content.
- **AC-05** Given an unknown email address, and given a known email address with the wrong password, when either is submitted, then both are refused with the same status and the same error code.
- **AC-06** Given a deactivated account and its correct password, when sign-in is attempted, then it is refused and the response identifies the account as inactive.
- **AC-07** Given a signed-in user, when they sign out, then reusing the previous session is refused as unauthenticated.
- **AC-08** Given a session past its expiry, when any protected endpoint is requested, then it is refused as unauthenticated.
- **AC-09** Given a user with several open sessions, when they change their password, then the other sessions are refused on their next request and the current one continues.
- **AC-10** Given a new password that fails the length or composition rules, when it is submitted, then it is rejected with a message naming the rule it failed and the password is unchanged.
- **AC-11** Given a signed-in user whose account is then deactivated by an Administrator, when the user makes their next request, then it is refused without requiring them to sign out first.
- **AC-12** Given an authenticated Requester, when they request the ticket detail of a ticket owned by another Requester, then the response is identical to the response for a ticket that does not exist.
- **AC-13** Given an authenticated Requester, when they request the staff Ticket Queue, then the request is refused as forbidden.
- **AC-14** Given an authenticated Requester, when they request any Administrator endpoint, then the request is refused as forbidden.
- **AC-15** Given authenticated IT Staff, when they request the queue, then it returns tickets belonging to all requesters, with search, filters, sorting and pagination applied as requested.
- **AC-16** Given a queue request with a blank parameter value, when it is submitted, then it is refused with an invalid-parameter error rather than silently defaulting.
- **AC-17** Given an unowned ticket and authenticated IT Staff, when they claim it, then they become its owner and the change is visible to other staff.
- **AC-18** Given a ticket owned by one member of staff, when another reassigns it to a third, then the new owner is recorded.
- **AC-19** Given a ticket, when IT Staff set IT Priority, then Requested Priority is unchanged.
- **AC-20** Given a ticket in a given status, when a transition outside the permitted matrix is requested, then it is refused and the status is unchanged.
- **AC-21** Given a cancelled ticket, when any status change is requested, then it is refused.
- **AC-22** Given a Requester on their own ticket, when they indicate the problem appears resolved, then the indication is recorded and the ticket's status is unchanged.
- **AC-23** Given a Requester, when they attempt to set a ticket to Resolved or Closed, then the attempt is refused.
- **AC-24** Given a ticket with a Public Comment, when the Requester who owns it and a member of IT Staff each view it, then both see the comment with its author and creation time.
- **AC-25** Given a ticket with an Internal Note, when the Requester who owns the ticket views it, then no note content and no indication that notes exist is returned.
- **AC-26** Given comment or note content that is empty or only whitespace, when it is submitted, then it is rejected.
- **AC-27** Given an existing attachment on a ticket, when IT Staff open that ticket, then the attachment's metadata is listed and its content can be downloaded.
- **AC-28** Given an Administrator, when they list users, then name, email, role and activation state are returned, and the list can be searched by name or email and filtered by role.
- **AC-29** Given an Administrator, when they create a user with one role and a starting password, then the user can sign in with it and is required to change it before proceeding.
- **AC-30** Given an email address already held by an account, when an Administrator creates or edits a user into it, then the operation is refused as a conflict.
- **AC-31** Given an Administrator, when they attempt to deactivate their own account, then the attempt is refused.
- **AC-32** Given exactly one active Administrator, when a change would deactivate or demote them, then the change is refused.
- **AC-33** Given two Administrators submitting mutually deactivating changes at the same moment, when both are processed, then at least one is refused and an active Administrator remains.
- **AC-34** Given each role in turn, when the application shell is rendered, then only the destinations that role may use are present in the navigation.
- **AC-35** Given every required screen, when rendered at desktop, tablet and mobile widths, then no content is clipped, nothing overlaps, and the page does not scroll horizontally.
- **AC-36** Given a backend failure on any screen, when it occurs, then the user sees a safe message that discloses no internal detail and any data they had entered is preserved.

## 10. Definition of Done

The sprint is complete when every item below holds on `main`.

**Product**

- [ ] A user signs in with email and password; invalid credentials and unknown accounts are refused identically; a deactivated account is told so only after its password verifies
- [ ] A user with an initial password must change it before any other screen or endpoint is available
- [ ] Signing out ends the session, and the ended session cannot be reused
- [ ] Every protected endpoint refuses unauthenticated requests, and refuses authenticated requests whose role does not permit them
- [ ] Deactivating a user takes effect on that user's next request
- [ ] Every Lab 2 Requester function works under the authenticated identity, and no client-supplied identity mechanism remains anywhere in the product
- [ ] A Requester posts Public Comments and can indicate that a problem appears resolved, and cannot set Resolved or Closed
- [ ] IT Staff find work in a queue with search, filters, sorting and pagination, and can tell assigned from unassigned
- [ ] IT Staff claim and reassign ownership, set IT Priority, and move tickets only along permitted transitions
- [ ] IT Staff post Public Comments and record Internal Notes; a Requester can neither read notes nor learn that any exist
- [ ] Existing attachments remain reachable by their owner and by staff
- [ ] An Administrator lists, searches, filters, creates and edits users, assigns one role, activates and deactivates, and issues a new starting password
- [ ] An Administrator cannot deactivate themselves, and the system cannot be left with no active Administrator, including under concurrent changes
- [ ] Every required screen is usable at desktop, tablet and mobile, in the Zen Green language, with no clipping, overlap or horizontal scrolling

**Engineering**

- [ ] Every acceptance criterion maps to at least one passing test
- [ ] Unit, API/integration, UI component, UI style, responsive, authorization, migration/regression and end-to-end suites all pass on `main`
- [ ] No test is skipped, disabled or commented out
- [ ] The formatter and linter report no errors
- [ ] The seed is idempotent, restores credentials, and is safe to run repeatedly
- [ ] No credential, secret or plaintext password appears in the repository
- [ ] `specification.md`, `tests.md`, `ui-spec.md` and `api-spec.md` describe what the code actually does

**Process**

- [ ] Every Issue is Issue-backed, labelled `lab-03`, and on the board in Done
- [ ] Every Pull Request was reviewed and merged by the peer reviewer, and none by its author
- [ ] This specification merged before any implementation Pull Request
- [ ] `reviewer.md` and `ai-use.md` are current

## 11. Assumptions and Decisions

- **D-01 Sessions rather than stateless tokens.** An opaque token in an httpOnly `SameSite=Lax` cookie, with a row in a session table. *Rejected:* a stateless token. §14 Part 5 assesses evidence that access is blocked after sign-out, and revoking a stateless token requires a denylist table — which is a session table with a different name and an extra failure mode. `SameSite=Lax` covers cross-site request forgery because no mutating endpoint is a `GET`.

- **D-02 The session record caches nothing about the user.** Role and activation state are read from the user record on every request. *Why:* the Administrator safety rules only mean anything if deactivation takes effect promptly. Caching would give the product two different rules — one for new sign-ins, another for sessions already open — and the second would be the one nobody tested. *Cost:* one extra join per request, on an indexed primary key.

- **D-03 Password hashing uses the platform's `scrypt`.** *Why:* memory-hard, in the standard library, no dependency and no native build step on any developer machine. *Rejected:* `argon2` (a native dependency to build on Windows) and `bcrypt` (slower per unit of resistance, and a 72-byte input limit that would have to be documented).

- **D-04 The deactivated-account message is reachable only after the password verifies.** *Why:* §8.1 asks for a clear response for inactive accounts *and* for no unnecessary disclosure, which reads as a contradiction until the two are ordered. Verifying first means an attacker who does not know the password cannot distinguish an inactive account from a non-existent one, while the account's owner gets an actionable answer.

- **D-05 The forced password change is a guard in the middleware chain.** *Rejected:* a restricted session with a scope column, and a separate single-use change token. *Why:* both introduce a second credential type, which then needs its own expiry, storage and revocation rules. A guard reuses the mechanism already in place and makes AC-02 a single assertion.

- **D-06 403 at the role boundary, 404 at the ownership boundary.** Recorded in full at BR-18. Written down because a reader checking the API against §6.2's list of required distinctions will otherwise read the `404`s as an oversight rather than as Lab 2's D-07 continuing to hold.

- **D-07 The requester-only restriction is removed from the ticket routes.** Lab 2's context middleware resolves the role inside its database lookup, so a non-Requester account cannot reach any ticket route. Ownership is defined by identity, so scoping by identity alone is both simpler and more correct — and IT Staff need to raise tickets like anyone else.

- **D-08 Role-derived query scope is a single named helper.** It maps the current user to a query fragment: for a Requester, a constraint that the ticket is theirs; for IT Staff and Administrators, no constraint. *Why:* it keeps ownership resolved inside the query as BR-19 requires, keeps the decision in one testable place, and makes the `403`/`404` split fall out automatically rather than being restated per handler. *As built:* the helper answers what a user may **read**. Changing a ticket's attachments is own-only for every role (api-spec.md §6), so writes use a second fragment beside it that constrains every role to their own tickets — two named fragments in one module, rather than a write handler quietly reusing the read scope and handing staff a destructive capability.

- **D-09 Public Comments and Internal Notes are separate tables.** Recorded at §7. The one-table design is smaller; it is rejected because it makes a leak a matter of remembering a filter.

- **D-10 "The problem appears resolved" is a timestamp, not a status.** BR-05 forbids a Requester setting Resolved or Closed, so it cannot be a status value. A timestamp is filterable, records when, and cannot be confused with the lifecycle.

- **D-11 The status enum is renamed, not relabelled.** `PENDING` becomes `WAITING_FOR_REQUESTER`. The rename is a real migration because the demonstration seed writes these values. *Why:* Lab 2's D-13 already had to justify in prose a column whose name disagreed with its label, and repeating that deliberately would be choosing a known cost for no benefit.

- **D-12 The staff queue extends the existing query parser.** *Rejected:* a second parser for staff. *Why:* search, filtering and sorting are easy to duplicate; pagination stability and invalid-parameter handling are the parts that go subtly wrong, and the existing parser has those documented and tested.

- **D-13 No client-side identity storage at all.** The cookie is the whole of the session state, resolved on load by reading the current user. *Why:* it removes the entire class of defect in which stored client state and server state disagree — a class Lab 2 had to guard against explicitly when a stored requester id might name a since-deactivated account.

- **D-14 The last-Administrator rule is enforced with a locking transaction.** *Rejected:* a database constraint, which cannot express "at least one row"; and raising the transaction isolation level, which imposes a cost on every operation in the system to protect one. The codebase already uses a locking transaction for allocating ticket numbers, so this is an existing shape rather than a new one.

- **D-15 Tests authenticate through the real sign-in endpoint.** Server tests hold the session cookie; browser tests sign in once per role during setup and reuse the stored session. *Rejected:* retaining the development header as a test-only bypass. A working authentication bypass in the shipped repository is exactly what §4.3 means by a control that is feedback rather than security, and the repository is read as part of the assessment. *As built:* a Playwright `setup` project signs in through the sign-in screen once per account and saves each session; the viewport projects depend on it. A test that needs a second person opens a second browser context with that person's saved session — never Logout, which would delete the session every later test reuses.

- **D-16 The seed restores credentials rather than skipping existing accounts.** *Why:* the account flagged for a first-sign-in password change exists to demonstrate that flow, and the test demonstrating it consumes the flag. A create-if-absent seed would make that test pass once and fail on every run afterwards — the same shape as the leftover-test-data defect Lab 2 found late.

- **D-17 Sign-in matches the email address without regard to case.** *Why:* a domain is case-insensitive by definition, providers treat the local part that way in practice, and a person typing their own address with a capital would otherwise be told their credentials are wrong — a refusal they cannot debug, because BR-08 makes it identical to a wrong password. The address is stored as it was entered and returned as stored; only the lookup is case-insensitive. *Rejected:* normalising addresses to lower case on write, which would silently rewrite what somebody typed and would not fix rows already stored.

- **D-18 Account addresses are stored lower-case, and names and addresses are bounded.** *Why:* sign-in already ignores case (D-17), so two accounts differing only by case could never both be signed in to; storing one form lets the unique index enforce BR-33 as sign-in understands it rather than as a byte comparison does. The contract said "over its limit" without naming one, so the limits are named here: a name is 1–100 characters after trimming, and an address at most 254, the longest SMTP can carry. *Rejected:* a case-insensitive index, which needs a `citext` column or an expression index Prisma cannot declare.

- **D-19 Search text is matched literally.** A search for `100%` finds tickets containing "100%", not every ticket containing "100". *Why:* Prisma passes a `contains` term to PostgreSQL's `ILIKE` without escaping it — checked against this version, where `50%` matched "50 off" and `snake_case` matched "snakeXcase" — so `%` and `_` behaved as wildcards in a box that looks like it asks for text. The escaping lives in the one list module both My Tickets and the queue read through, which is how Lab 2's search gained it too. *Rejected:* stripping the two characters, which would make a ticket about "100%" unfindable by the very text it contains.

- **A-01 Assumption:** a single Administrator account is sufficient for the demonstration, provided the last-Administrator rule is tested with at least two.
- **A-02 Assumption:** eight hours is an appropriate session lifetime for a course project. It is a constant, recorded here so that changing it is a decision rather than an edit.
- **A-03 Assumption:** "simple queue counts" in the handout's exclusion of analytics permits the queue's own result count, which pagination requires anyway.
