# Lab 2 Sprint Engineering Specification

TokTickIT — Requester Ticketing MVP with UI Foundation
CPE 334, Semester 1/2026 · Kiatisak Markmeeshap (67070501005)

Companion documents: [`ui-spec.md`](./ui-spec.md) · [`api-spec.md`](./api-spec.md) · [`tests.md`](./tests.md)

---

## 1. Sprint Goal

A Requester can raise an IT support ticket and live with it afterwards: describe the
problem, attach evidence, receive an official ticket number issued by the backend, then
find that ticket again among their own, open it, and manage its attachments — while never
being able to see anyone else's ticket. Everything a later lab needs to reuse is
established here: the Zen Green visual language, the reusable form and list components,
and the ownership boundary that real authentication will slot into in Lab 3.

---

## 2. Stakeholder Request Interpretation

IT is ready to take real requests, so the Requester-facing half of the product has to
work end to end. The stakeholder asks for four things.

**A ticket must be describable and submittable.** Category, related system, a summary, a
description, a requested priority, and optional supporting files. The system — not the
person — issues the official ticket number, and the data must land somewhere durable.

**A ticket must be findable afterwards.** My Tickets is where a Requester goes to see
what they have raised, so it needs search, filters, sorting, and paging, and it must show
only that Requester's tickets. Opening one shows the detail and its attachments.

**One Requester must never reach another Requester's ticket.** This is stated as a
product requirement, not a nice-to-have, which means it is enforced on the server rather
than by hiding a link.

**Login is not part of this sprint.** Because Lab 3 introduces it, we need a stand-in so
that "who is the current user" is answerable today. That stand-in is a Development
Requester selector: pick one of several seeded people, and the whole application behaves
as them. It is a testing device. It authenticates nobody, it protects nothing, and the UI
must never describe it as a login screen.

The fourth request is quieter but has the longest reach: establish presentation
conventions that later screens reuse instead of each screen inventing its own.

---

## 3. Scope

### Included

- Development Requester selection, persistence, display, and switching
- Reference data retrieval for categories and related systems
- Ticket creation with server-issued ticket number and validation on both sides
- My Tickets: search, filtering, sorting, pagination, and ownership scoping
- Requester Ticket Detail, read-only
- Attachment lifecycle: add, list, download, soft-remove
- Ownership enforcement across every requester-scoped endpoint
- Zen Green token layer, application shell, and reusable components
- Responsive behaviour at three viewports and baseline accessibility
- Automated tests at six levels, plus screenshot evidence

### Excluded

Everything in this list is deliberately absent, per §4.2 of the handout.

- Authentication in any form: login, logout, passwords, password hashing, sessions,
  tokens, and real role-based authorization. The Development Requester selector is a
  testing mechanism and is not secure.
- IT Staff workflow: staff dashboards and queues, claiming or reassigning tickets,
  changing IT Priority, and any other ticket-owner function.
- Ticket collaboration: Public Comments, Internal Notes, and Actions Taken.
- Ticket lifecycle beyond creation: any status change after the initial `New`, including
  resolution confirmation, resolving, closing, reopening, and cancelling.
- Administration: managing users, requesters, roles, or reference data.

Three columns — IT Priority, Ticket Owner, and Resolution Summary — **do** appear in the
data model and render as placeholders on Ticket Detail. That is not a scope violation:
§4.2 excludes the staff *actions* that populate them, and the approved Ticket Detail
illustration shows the fields present and empty. See [decision D-04](#d-04-fields-lab-2-does-not-populate).

---

## 4. Functional Requirements

### Requester context

- **FR-01** The system presents a Development Requester selector listing only active
  Development Requesters retrieved from the database.
- **FR-02** The system retains the chosen Development Requester across page reloads and
  supplies it to the server on every requester-scoped request.
- **FR-03** The system displays the current Development Requester in the application
  shell and offers an action to change it.
- **FR-04** The system reloads requester-scoped data when the current Development
  Requester changes.

### Reference data

- **FR-05** The system retrieves active categories, in display order, from the database.
- **FR-06** The system retrieves active related systems, in display order, from the
  database.

### Ticket creation

- **FR-07** The system creates one ticket from a category, a related system, a summary, a
  description, and a requested priority, owned by the current Development Requester.
- **FR-08** The system issues the official ticket number during creation and returns it to
  the client.
- **FR-09** The system validates ticket input on the client before submission and again on
  the server, where the server's judgement is final.

### Ticket listing

- **FR-10** The system returns only tickets owned by the current Development Requester.
- **FR-11** The system searches tickets by ticket number and summary.
- **FR-12** The system filters tickets by category, requested priority, IT priority, and
  current status.
- **FR-13** The system sorts tickets by any documented sortable field in either direction.
- **FR-14** The system returns tickets one page at a time, together with the metadata a
  client needs to render pagination controls.

### Ticket detail

- **FR-15** The system returns one owned ticket with its attachment metadata.
- **FR-16** The system presents ticket information read-only, with no control capable of
  changing a system-managed value.

### Attachments

- **FR-17** The system accepts a permitted attachment against an owned ticket, both during
  creation and afterwards.
- **FR-18** The system lists attachment metadata for an owned ticket, including
  attachments that have been removed.
- **FR-19** The system serves the stored file for an active owned attachment as a
  download.
- **FR-20** The system soft-removes an owned attachment, recording who removed it, when,
  and why.

### Ownership

- **FR-21** The system rejects any attempt to read or modify a ticket or attachment
  belonging to a Development Requester other than the current one, regardless of how the
  identifier was obtained.

---

## 5. Business Rules

### Ticket defaults and system-generated values

- **BR-01** The official Ticket Number is generated by the backend and must be unique.
- **BR-02** A new Ticket begins with Current Status `New`.
- **BR-04** Ticket Number has the form `TKT-<four-digit year>-<six-digit sequence>`, with
  the sequence restarting at `000001` each calendar year.
- **BR-05** Ticket date, created timestamp, and updated timestamp are set by the server.
  A value for any of them supplied by the client is ignored.
- **BR-06** IT Priority, Ticket Owner, and Resolution Summary are left unset on creation
  and are not settable in Lab 2.

### Requester selection and switching

- **BR-03** Lab 2 uses a Development Requester selector instead of login. The selected
  identity is for testing only and is not authentication.
- **BR-07** Inactive Development Requesters never appear in the selector and can never
  become the current context.
- **BR-08** Changing the current Development Requester discards all requester-scoped data
  held by the client before the replacement identity's data is requested.
- **BR-09** Changing the current Development Requester while a ticket is being drafted
  discards the draft and returns the user to My Tickets. A draft written as one Requester
  is never submitted as another.
- **BR-10** Requester-scoped screens are unreachable without a current context; reaching
  one redirects to the selector.

### Ticket ownership

- **BR-11** Ticket ownership is taken from the validated request context. A requester
  identifier present in a request body is ignored and never overrides the context.
- **BR-12** A ticket or attachment that does not exist and one that belongs to another
  Development Requester produce byte-identical responses, so that an identifier can never
  confirm that another Requester's record exists.

### Validation and duplicate submission

- **BR-13** Summary is required, trimmed before validation and storage, and must be 5–150
  characters after trimming.
- **BR-14** Description is required, trimmed before validation and storage, and must be
  10–5000 characters after trimming.
- **BR-15** Category and related system are required and must reference rows that exist
  and are active.
- **BR-16** Requested Priority is required and must be one of `LOW`, `MEDIUM`, `HIGH`;
  the form offers `MEDIUM` as its initial value.
- **BR-17** The submit control is disabled and visibly busy for the lifetime of a creation
  request. This is the duplicate-submission control.
- **BR-18** A rejected submission creates no ticket, no attachment, and no partial record.

### Failure behaviour

- **BR-19** A recoverable failure preserves every value the user entered. Recovering from
  a dropped connection must never cost the user their description.
- **BR-20** Error responses never contain stack traces, database messages, filesystem
  paths, or configuration values.

### Attachments

- **BR-21** Permitted attachment types are JPEG, PNG, WEBP, and PDF.
- **BR-22** An attachment may be at most 5 MB.
- **BR-23** A ticket may hold at most five active attachments.
- **BR-24** Stored filenames are generated by the server. The uploaded filename is
  retained as metadata only and is never used as a path, nor as an input to any
  authorization decision.
- **BR-25** Every download is served with a disposition that forces saving rather than
  rendering, so uploaded content can never execute in the application's origin.
- **BR-26** Removal is soft: the metadata row survives, and removal time, reason, and
  remover are recorded.
- **BR-27** A removal reason is required and must be 3–500 characters after trimming.
- **BR-28** A removed attachment is never downloadable and never previewable, including by
  requesting its download address directly.
- **BR-29** The five-attachment limit counts active attachments only; removed rows do not
  occupy a slot.
- **BR-30** If storing a file succeeds but recording its metadata fails, the stored file is
  deleted. No orphan is left in either direction.

### Search, filtering, sorting, and pagination

- **BR-31** Search matches ticket number and summary, case-insensitively, on the trimmed
  search term.
- **BR-32** Default ordering is newest first by creation time, with the immutable ticket
  identifier as a secondary key. Every sort carries that secondary key, so a page boundary
  can never repeat or skip a row when timestamps collide.
- **BR-33** Permitted page sizes are 10, 20, and 50; the default is 10.
- **BR-34** An unrecognised or out-of-range query parameter is an error. Parameters never
  silently fall back to a default.

### Empty and no-results states

- **BR-35** A Requester with no tickets and a query that matched nothing are different
  situations and are presented differently.

### Transition to real authentication

- **BR-36** In Lab 3 the request-context header is replaced by an authenticated identity.
  The ticket-to-owner relationship, the ownership checks, and the responses they produce
  do not change; only the source of the identity does.

---

## 6. UI Specification Summary

Full detail, including every token and every component state, lives in
[`ui-spec.md`](./ui-spec.md). This section states the structure and the rules that
constrain implementation.

**Application shell.** TokTickIT identity, My Tickets and Create Ticket navigation, the
current Development Requester with a Change Requester action, a visible indication of the
active page, and a breadcrumb beneath the header. Navigation collapses to a usable mobile
presentation below 768 px.

**Screens.** Development Requester Selection; Create Ticket; My Tickets; Requester Ticket
Detail.

**Component rules**, fixed by §8.3 of the handout: labels sit above their controls;
required fields carry a red asterisk, which never replaces the validation message; inputs
share one height, and the multiline description is taller; buttons carry visible text;
icon-only controls carry an accessible name and tooltip; disabled controls are visually
distinct and cannot be activated; focus indicators stay visible for keyboard users; the
submit button shows a busy state while its request is in flight; validation messages
appear beside the field they concern rather than as one summary at the top; and the
success state shows the generated ticket number together with the next action.

**States every data-backed view must define**: initial, loading, empty, no-results,
validation failure, submitting, success, and failure.

**Responsive rules** at the three breakpoints, with no horizontal page scrolling, no
clipped labels, no overlapping messages, no hidden buttons, and no unreadable attachment
filenames at any size.

**Accessibility**: semantic labels, visible keyboard focus, accessible names for icon-only
controls, and no state — error, warning, success, priority, or status — signalled by
colour alone.

---

## 7. Data Changes

### New enumerations

| Enum | Values | Notes |
| --- | --- | --- |
| `Role` | `REQUESTER`, `IT_STAFF`, `ADMIN` | All three defined now; Lab 2 seeds only `REQUESTER`. Matches the three roles in `CONTEXT.md`. |
| `Priority` | `LOW`, `MEDIUM`, `HIGH` | Used by both Requested Priority and IT Priority. |
| `TicketStatus` | `NEW`, `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED` | Only `NEW` is reachable in Lab 2 — no route writes this column. The handout never lists the statuses; these come from the illustrations. See D-15 for why the demonstration seed uses the others. |

### New models

| Model | Fields |
| --- | --- |
| `User` | id · name · email (unique) · role · isActive · createdAt |
| `RelatedSystem` | id · name (unique) · displayOrder (unique) · isActive · createdAt |
| `Ticket` | id · ticketNumber (unique) · requester → User · category → Category · relatedSystem → RelatedSystem · summary · description · requestedPriority · itPriority (nullable) · currentStatus · ticketOwner → User (nullable) · resolutionSummary (nullable) · createdAt · updatedAt |
| `Attachment` | id · ticket → Ticket · originalFilename · storedFilename (unique) · mimeType · sizeBytes · uploadedBy → User · uploadedAt · removedAt (nullable) · removedReason (nullable) · removedBy → User (nullable) |
| `TicketCounter` | year (primary key) · lastNumber |

### Changed models

`Category` gains `isActive`, so a category can be retired without deleting tickets that
reference it. Its existing `displayOrder` is unchanged.

### Relationships

One `User` owns many `Ticket`s; one `Ticket` belongs to exactly one `User`, one
`Category`, and one `RelatedSystem`; one `Ticket` holds many `Attachment`s. All four
relationships are required and enforced by foreign keys. Reference data is deactivated
rather than deleted, so no ticket is ever orphaned.

### Indexes

| Index | Justification |
| --- | --- |
| `Ticket(requesterId, createdAt DESC)` | Every My Tickets query filters on owner and orders by creation time. This is the one index the sprint cannot do without. |
| `Ticket(ticketNumber)` unique | Enforces BR-01 at the database level, independently of application logic. |
| `Attachment(ticketId, removedAt)` | The active-attachment count in BR-23 and BR-29 is a filtered count per ticket. |
| `User(isActive)` | The selector reads active users on every load. |

### Soft removal

`removedAt` is the single source of truth: an attachment is active exactly when it is
null. There is deliberately no separate boolean, because two columns describing one fact
can disagree. See [decision D-05](#d-05-representing-soft-removal).

### Migrations

One migration adds the enumerations, the four new models, and the `Category.isActive`
column. `Category` already carries rows, so `isActive` is added with a default of true.

### Seed

Two layers, run independently.

- **Reference data** — the four required categories, at least six related systems, four
  active Development Requesters, and one inactive Development Requester. Idempotent:
  re-running it changes nothing. This is the only seed the test database receives.
- **Demonstration data** — tickets spread deliberately across requesters so that the
  submission evidence has something to show: roughly twenty-five for one requester so
  pagination spans several pages, a handful for a second, three for a third, and **none**
  for a fourth so the empty state can be photographed. Never run against the test
  database.

---

## 8. API Contract

Full request and response shapes are in [`api-spec.md`](./api-spec.md).

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/categories` | Active categories, in display order |
| `GET` | `/api/related-systems` | Active related systems, in display order |
| `GET` | `/api/requesters` | Active Development Requesters for the selector |
| `POST` | `/api/tickets` | Create one ticket for the current context |
| `GET` | `/api/tickets` | The current context's tickets, filtered and paged |
| `GET` | `/api/tickets/:id` | One owned ticket with attachment metadata |
| `POST` | `/api/tickets/:id/attachments` | Add one attachment to an owned ticket |
| `GET` | `/api/tickets/:id/attachments` | Attachment metadata for an owned ticket |
| `GET` | `/api/attachments/:id/download` | Stream one active owned attachment |
| `DELETE` | `/api/attachments/:id` | Soft-remove one owned attachment |

`GET /api/health` from Lab 1 is unchanged.

### Requester context

Every requester-scoped endpoint requires the `X-Development-Requester-Id` header. A
missing, malformed, unknown, or inactive value is rejected before any other processing.
The header is trivially forgeable — which is the point, and why §4.2 forbids calling it
authentication.

### Ticket list query

| Parameter | Values | Default |
| --- | --- | --- |
| `search` | free text, trimmed, matched against ticket number and summary | none |
| `categoryId` | integer | none |
| `requestedPriority` | `LOW` · `MEDIUM` · `HIGH` | none |
| `itPriority` | `LOW` · `MEDIUM` · `HIGH` | none |
| `status` | any `TicketStatus` value | none |
| `sort` | `ticketNumber` · `createdAt` · `updatedAt` · `summary` · `requestedPriority` | `createdAt` |
| `order` | `asc` · `desc` | `desc` |
| `page` | integer ≥ 1 | `1` |
| `pageSize` | `10` · `20` · `50` | `10` |

Responses carry the page, the page size, the total item count, and the total page count
alongside the data.

### Status codes

| Code | Used for |
| --- | --- |
| `200` | Successful retrieval, download, and soft removal |
| `201` | Ticket and attachment creation |
| `400` | Invalid field, invalid query parameter, or invalid/missing requester context |
| `404` | Resource absent — **and** resource owned by another requester |
| `409` | The five-active-attachment limit has been reached |
| `413` | Uploaded file above 5 MB |
| `415` | Unsupported file type |
| `500` | Unexpected failure, reported safely |

### Error envelope

Every failure, without exception, returns one shape: a stable machine-readable code, a
human-readable message safe to display, and — for validation failures — a per-field detail
object the form places beside the offending control.

---

## 9. Acceptance Criteria

- **AC-01** *(FR-01, BR-07)* Given the database holds four active and one inactive
  Development Requester, when the selection screen loads, then exactly the four active
  ones are offered and the inactive one is absent.
- **AC-02** *(FR-01)* Given the requester list is still loading, has come back empty, or
  has failed, when the selection screen renders, then a distinct state is shown for each
  of those three situations.
- **AC-03** *(BR-03)* Given the selection screen is open, when it renders, then it states
  that the selector is a Lab 2 testing context and not a login screen.
- **AC-04** *(FR-02, BR-10)* Given no Development Requester has been selected, when My
  Tickets is opened, then the selection screen is shown instead.
- **AC-05** *(FR-02)* Given a Development Requester has been selected, when the page is
  reloaded, then the same Development Requester is still current.
- **AC-06** *(FR-03, FR-04, BR-08)* Given Requester A is current and their tickets are on
  screen, when the context is changed to Requester B, then A's tickets leave the screen
  and B's are loaded.
- **AC-07** *(BR-09)* Given a ticket is half drafted, when the current Requester is
  changed, then the draft is discarded and the user is taken to My Tickets.
- **AC-08** *(FR-05, FR-06)* Given the form is open, when the category and related system
  controls render, then their options came from the database rather than from the source.
- **AC-09** *(FR-07, FR-08, BR-01, BR-02, BR-04)* Given valid ticket data, when the form
  is submitted, then exactly one ticket is stored, owned by the current Requester, with
  status `New` and a server-issued number of the form `TKT-<year>-<six digits>`, and that
  number is displayed.
- **AC-10** *(FR-09, BR-13, BR-14, BR-18)* Given a summary or description that is missing,
  whitespace only, too short, or too long, when the form is submitted, then no ticket is
  created and a message appears beside the offending field.
- **AC-11** *(BR-11)* Given a request body carrying a requester identifier other than the
  context's, when a ticket is created, then the stored ticket is owned by the context and
  the supplied identifier is ignored.
- **AC-12** *(BR-17)* Given a creation request is in flight, when the submit control is
  inspected, then it is disabled and visibly busy.
- **AC-13** *(BR-19)* Given the API is unreachable, when a completed form is submitted,
  then a safe error is shown and every entered value is still present.
- **AC-14** *(FR-10, FR-21)* Given Requester A owns tickets, when Requester B requests the
  ticket list, then none of A's tickets appear.
- **AC-15** *(FR-11, FR-12, FR-13, FR-14, BR-32)* Given a Requester with more tickets than
  one page, when the list is searched, filtered, sorted, and paged, then results match the
  documented contract and no row is repeated or skipped across page boundaries.
- **AC-16** *(BR-34)* Given an unrecognised or out-of-range query parameter, when the list
  is requested, then a validation error naming the parameter is returned rather than a
  silent fallback.
- **AC-17** *(BR-35)* Given a Requester with no tickets at all, and separately a query
  that matched nothing, when My Tickets renders, then the two are visibly different.
- **AC-18** *(FR-15, FR-16, BR-12)* Given a ticket owned by Requester A, when Requester B
  requests it by its direct address, then the response is indistinguishable from the
  response for a ticket that does not exist.
- **AC-19** *(FR-17, BR-21, BR-22, BR-23)* Given an owned ticket, when a file is uploaded,
  then permitted files under 5 MB are accepted up to five active attachments, and a
  disallowed type, an oversized file, and a sixth attachment are each rejected with their
  own message.
- **AC-20** *(FR-19, BR-25)* Given an active owned attachment, when it is downloaded, then
  the stored file is returned as a download rather than rendered in the browser.
- **AC-21** *(FR-20, BR-26, BR-27)* Given an owned attachment, when it is removed with a
  confirmed reason of 3–500 characters, then its metadata remains visible and it is marked
  removed.
- **AC-22** *(BR-28, BR-29)* Given a removed attachment, when its download address is
  requested directly, then the request fails, and the attachment no longer counts toward
  the five-attachment limit.
- **AC-23** *(BR-30)* Given metadata cannot be written after a file has been stored, when
  the upload completes, then the stored file is deleted and no partial record survives.
- **AC-24** *(BR-20)* Given any failure, when the response is inspected, then it carries
  no stack trace, database message, filesystem path, or configuration value.
- **AC-25** Given each of the three viewports, when Create Ticket, My Tickets, and Ticket
  Detail are rendered, then the Zen Green tokens are applied, nothing is clipped or
  overlapping, no page scrolls horizontally, and every action stays reachable.

---

## 10. Definition of Done

### Product

- [ ] Every acceptance criterion above is satisfied and demonstrable
- [ ] Data model, migrations, and seeds match section 7
- [ ] Every endpoint matches [`api-spec.md`](./api-spec.md), including its failure cases
- [ ] Every screen matches [`ui-spec.md`](./ui-spec.md), including every state
- [ ] Validation is enforced on both client and server, with the server authoritative
- [ ] Ownership is enforced on the server for every requester-scoped operation
- [ ] Tests pass at all six levels from the documented commands on `main`
- [ ] No required test is skipped, disabled, or commented out
- [ ] Every acceptance criterion traces to at least one passing test with a real file path
- [ ] Success, failure, and boundary cases are each handled and each covered
- [ ] `README.md` setup and verification instructions are accurate against the code

### Course delivery

- [ ] Work was decomposed into GitHub Issues carrying acceptance criteria
- [ ] Each Issue moved through Backlog → Specified → Started → PR Review → Done, entering
      Fixing when changes were requested
- [ ] Each Issue was implemented on its own feature branch and reached `lab2-staging`
      through a peer-reviewed Pull Request
- [ ] Every Pull Request is linked to its Issue through the Development panel
- [ ] Every review comment received has a reply, and the reviewer merged what they approved
- [ ] One release Pull Request took `lab2-staging` into `main`
- [ ] `reviewer.md`, `ai-use.md`, and `tests.md` are complete with no placeholder text
- [ ] Screenshots are committed and readable without extreme zoom
- [ ] The submission PDF uses the headings `Answer Part 1` through `Answer Part 9` in that
      exact order, with working links

---

## 11. Assumptions and Decisions

Only choices the handout left open. Anything it fixed is recorded above, not here.

### D-01 Identity is modelled as `User`, not `RequesterUser`

The handout's example coding-agent prompt names a `RequesterUser` model, but §5 states
that model and table names are the student's to determine, and §5.2 asks how the schema
will evolve when Lab 3 introduces authentication.

A `User` with a `Role` enum answers that question with "it doesn't have to". Lab 3 adds a
password column and seeds rows with other roles. The alternative — a `RequesterUser` table
— means renaming a table, migrating its rows, and rewriting every foreign key that points
at it, all to arrive at the same place.

*Risk accepted:* a grader searching for the literal string `RequesterUser` will not find
it. This entry is the answer.

### D-02 Ticket numbers come from a per-year counter

**What the handout fixes.** Very little. BR-01 is the only rule about ticket numbers —
"generated by the backend and must be unique" — and §4.4 adds that the field is read-only
and assigned after successful creation. Neither says what a ticket number looks like. §9.2
refers to "the required format" without ever defining one.

**What the figures show.** Two of them, and together they settle the format. Figure 1 on
page 2 (Ticket Detail) prints `TKT-2025-001234`. The My Tickets illustration on page 11
prints eight rows descending — `TKT-2025-001234`, `-001233`, `-001232`, `-001231`,
`-001230`, `-001229`, `-001228`, `-001227` — against timestamps that descend with them.

Eight contiguous values are not eight random ones. The trailing six digits are a sequence,
and it runs in step with creation time. §8.8 requires the screens to be checked against
these illustrations, which is what makes them binding rather than decorative.

*Retraction.* Commit `19dfb1d` on this branch deleted the paragraph above, on the claim
that no My Tickets figure existed. It does exist, on page 11, and the contiguous run is
real. The denial came from listing the pages that carry images, then failing to open the
one that mattered — the error was not reading the source, while claiming to have read it.
This entry is now the third revision of the same decision and the only one written with the
figure actually on screen.

**What we chose, with nothing in the handout to settle it.** Whether the sequence restarts
each year. Both figures are from 2025, so `TKT-2025-001234` fits a per-year counter and a
single running counter with the year merely printed in front equally well.

We restart it. A sequence makes ticket numbers ordered and
makes a gap visible; a random suffix makes both impossible. And a number that carries a
year and then ignores it is a label pretending to be information — by Lab 4 the leading
digits would say nothing about when the ticket was raised.

**How it is implemented.** The counter lives in its own table, one row per year, and is
claimed with a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` inside the same
transaction that inserts the ticket. Reading the current maximum and adding one would be a
race — two simultaneous submissions read the same value — and so would a Prisma `upsert`,
which is a select followed by an insert or update. The unique constraint on the column is
the backstop that turns any residual race into a failed insert rather than a duplicate
number.

Formatting refuses a sequence outside 1–999999 rather than widening to seven digits. A
value that does not match the documented pattern is not a ticket number, and producing one
that fails our own validator would be stored, displayed, and then fail somewhere unrelated.

### D-03 Attachments are stored on disk, not in the database

Files land under `server/uploads/` with generated names; the row holds the metadata.

Storing bytes in a column would make creation atomic and remove the need for any
compensation logic — which is precisely why it was rejected. §4.5 asks for a documented
transaction or compensation strategy, and the honest answer under that design is "there
isn't one". Keeping the file outside the transaction makes the failure mode real, which
makes BR-30 real.

### D-04 Fields Lab 2 does not populate

IT Priority, Ticket Owner, and Resolution Summary exist in the schema and render on Ticket
Detail as placeholders.

The approved Ticket Detail illustration shows all three, and draws Resolution Summary as
italic placeholder text — which is what an unpopulated field looks like, not what an
absent field looks like. §8.8 requires screens to be checked against those illustrations.
Adding three nullable columns is not implementing the staff workflow that §4.2 excludes;
that exclusion is about actions, and no action here can set them.

### D-05 Representing soft removal

A nullable `removedAt`, with `removedReason` and `removedBy` beside it. An attachment is
active exactly when `removedAt` is null.

The alternative, an `isActive` boolean alongside a timestamp, encodes one fact twice and
admits a state where they contradict each other. With one column that state is
unreachable, and "at most five active" becomes a count of rows where the column is null.

### D-06 Categories and related systems are independent

No foreign key joins them, and choosing a category does not filter the related-system
list.

§5.1 enumerates the required relationships and none connects them. The seed makes the
reason concrete: of the four required categories, *Account and Access* has no natural
related system in the handout's own example list, so a dependent dropdown would produce a
category that cannot be submitted. `CONTEXT.md` already records that the two answer
different questions — what kind of problem, and what the problem is about.

### D-07 Unowned resources return `404`, not `403`

`403` asserts that the resource exists and access was refused, which confirms the
existence of another Requester's ticket to anyone willing to try identifiers. `404` says
nothing. BR-12 requires the two responses to be byte-identical so that response size and
timing cannot be used to tell them apart either.

### D-08 Attachments are downloaded, never previewed

Every download carries a disposition that forces saving. Serving user-uploaded content
inline from the application's own origin is how uploaded files become script execution;
forcing the download removes the question entirely. §4.5 asks for preview and download
behaviour to be defined — this is the definition, and Part 8 asks only that download works
and that removed files cannot be fetched.

### D-09 Duplicate submission is prevented on the client only

§8.3 requires the submit control to be disabled and busy while its request is in flight,
and that is the whole of the mechanism.

*Limitation accepted:* two browser tabs submitting the same draft simultaneously will
create two tickets. A server-side idempotency key would close this, and nothing in the
handout asks for one. It is recorded here rather than left to be discovered.

### D-10 Changing requester discards an in-progress draft

Keeping the draft and re-owning it would submit, as Requester B, text written as Requester
A. That is the exact confusion this sprint exists to prevent. A confirmation dialogue
would be kinder, and costs a component and two more states to specify and test for no
marks; BR-09 takes the simple correct behaviour instead.

### D-11 The test database is separate from the development database

Both live in the same container; only the database name differs.

Tests that truncate and reseed would otherwise destroy the demonstration data on every
run — and that data is what the Part 7 evidence photographs, spread deliberately across
four requesters with a pagination-length list for one and none at all for another.
Rebuilding it after every test run is not a reasonable ask.

### D-13 "Ticket Date" is a label, not a column

BR-05 names three server-set timestamps — ticket date, created, updated — but the model
carries two. Ticket Date is how the screens label `createdAt`; there is no separate column.

A distinct date field could only ever agree with `createdAt` or disagree with it, and
disagreeing would mean the ticket claims to have been raised on a day it was not. One
value, one meaning.

### D-12 Bootstrap is retained beneath the Zen Green layer

Zen Green is applied by overriding Bootstrap's CSS custom properties, and every component
also carries a semantic class of our own.

Bootstrap's grid breakpoints already sit at 768 px and 992 px, exactly where §8.7 puts
them. The semantic classes exist because §8.8 requires automated assertions against
required CSS classes, and asserting a utility-class soup is neither stable nor readable.

### D-14 The My Tickets column set is ours, and this is the justification

Page 11 requires it in as many words: "Students must decide and justify the final columns
or card fields." It offers five examples — Ticket Number, Summary, Category, Current
Status, Last Updated — and then says outright that "the example is not a complete mandatory
column list."

We show eight: those five, plus three.

**Created Date**, because Last Updated alone cannot answer "how long has this been open?",
which is the question a requester chasing a ticket is actually asking. Two timestamps
together give an age and a sign of life; either alone gives neither.

**Requested Priority**, because it is the one field on this screen the requester themselves
chose. BR-11 lets them set it at creation and never again, so the list is the only place
they can check what they picked. Without it the list is a report about them rather than a
record of what they asked for.

**IT Priority**, because §4.2 excludes the staff workflow from Lab 2 but not from the
product. Lab 2 never sets it, so the column shows an em dash on every row today. That is
deliberate and it is the point: it says the field exists and that IT has not triaged the
ticket yet, which is information, where a missing column would be silence. D-04 covers why
the three unused columns exist at all.

Nothing is dropped from the five examples. Related System appears on the mobile card but
not in the desktop table: eight columns already sit at the limit of `--tkt-content-max`
before horizontal scrolling starts, and a ticket's system is a detail-screen fact rather
than one you scan a list by.

### D-15 Demonstration tickets carry statuses Lab 2 cannot produce

The handout never lists the statuses. Searching all twenty-two pages finds one
rule — BR-02, "a new Ticket begins with Current Status New" — and one exclusion,
§4.2's "status changes beyond the initial New status". The six values in
`TicketStatus` come from the two illustrations, which draw *Open*, *In Progress*,
*Pending* and *Resolved*, and from our own decision to define the enum in full.

So the demonstration seed writes tickets in states the application cannot reach.
That deserves a numbered decision rather than a comment in a seed file, because
it is the sort of thing that looks like scope creep at a glance.

**Why we do it.** §14 Part 7 asks for evidence that the filters work. Two of the
four — Current Status and IT Priority — demonstrate nothing when every row is
`NEW` with a null IT priority: the dropdown offers six statuses that all return
the same list, and the screenshot proves the control exists rather than that it
filters. Both illustrations show the columns populated and the statuses varied,
and §8.8 makes the illustrations binding.

**Why it is not the excluded workflow.** §4.2 excludes *building* it. No screen,
endpoint, service or test in this repository changes a status, claims a ticket or
resolves one; `POST /api/tickets` hard-codes `NEW`, and there is no route that
writes `currentStatus` at all. What §4.2 excludes is the machinery. Rows in a
development database are not machinery.

**What it costs.** A reader who sees a `RESOLVED` ticket and does not read this
entry may think the lifecycle was implemented. That is the risk we are taking,
and it is why the seed is `db:seed:demo` — separate from `db:seed`, absent from
the test database, and reproducible in one command.

**The alternative we rejected.** Seeding `NEW` throughout is unarguably within
scope, and leaves two of the four filters unable to show they do anything. Given
the choice between evidence a grader can check and a purity no rule actually
asks for, we chose the evidence.

`CLOSED` is left unused so that one status filter still finds nothing, which is
what demonstrates BR-35's no-results state now that the others all match.
