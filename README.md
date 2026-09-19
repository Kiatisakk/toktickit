# TokTickIT

An IT service desk application for Account and Access, Hardware, Software, and
Network requests.

This repository holds **Lab 3**: the service desk with real authentication and all
three roles end to end. A user signs in with an email address and a password;
the server derives everything from that identity and its role, never from
anything the browser claims. Requesters keep every Lab 2 function and gain
public comments plus a resolved indication. IT Staff get a ticket queue with
search, filters, sorting and pagination, and per-ticket ownership, IT Priority,
status transitions, replies and internal notes. Administrators get a minimal
user-management screen with two safety rules: no self-deactivation, and never
zero active Administrators. The Lab 2 development requester selector is gone.

**Lab 2** — the Requester side under a development identity header — is on
`main` and documented in [docs/lab-02/](./docs/lab-02/).

**Lab 1** — the vertical slice that proved the stack connects, with the
**Check System** button and the category list — is on `main` and documented in
[docs/lab-01/](./docs/lab-01/).

```
React + Vite + Bootstrap  →  Express REST API  →  Prisma ORM  →  PostgreSQL
        (client)                  (server)
```

See [CONTEXT.md](./CONTEXT.md) for the domain vocabulary. The Lab 3 sprint
documents are in [docs/lab-03/](./docs/lab-03/): the specification with its
numbered requirements, rules, acceptance criteria and recorded decisions, the
API and UI contracts, the test plan and results, the peer review record, and
the AI-use log. Lab 2's documents are in [docs/lab-02/](./docs/lab-02/).

## Prerequisites

| Tool | Version used |
| --- | --- |
| Node.js | 24.x |
| npm | 11.x |
| Docker Desktop | required — PostgreSQL runs in a container |

## Setup

```bash
# 1. Install dependencies for both workspaces
npm install

# 2. Create the environment files from their templates
cp server/.env.example server/.env
cp server/.env.test.example server/.env.test
cp client/.env.example client/.env      # optional; defaults work as-is

# 3. Start PostgreSQL
npm run db:up

# 4. Create the database tables
npm run db:migrate

# 5. Insert the reference data
npm run db:seed

# 6. Prepare the separate database the tests use
npm run db:test:setup

# 7. Optional — demonstration tickets, for the screenshots
npm run db:seed:demo
```

The seed is idempotent — running it again does not create duplicates. It writes
the four request categories, seven related systems, and the user accounts of all
three roles. It also **restores their passwords on every run**, so an account
whose password a test changed is returned to its seeded state.

### Upgrading a database created before sign-in existed

The same two commands, `npm run db:migrate` then `npm run db:seed`, are the whole
upgrade — nothing else has to be run between them, and nothing has to be run in a
particular order beyond those two.

The migration that makes passwords required cannot give an existing account a
real password, because hashing happens in Node rather than in SQL. So every
account that predates sign-in is first given a value that is not a hash of
anything, and **cannot be signed in to**. `db:seed` then restores a real password
for every seeded account. An account the seed does not know about stays locked
until an Administrator issues it a password. The upgrade fails closed: no account
ever ends up without a password.

The test database follows the same path through `npm run db:test:setup`.

### Seeded accounts — local development only

These credentials exist so the application can be signed in to straight after
cloning and seeding, and so the test suites can authenticate through the real
sign-in endpoint. They are demonstration passwords for a local database, not
secrets, and must never be used anywhere else (BR-42). The database stores only
their hashes.

| Account | Role | Password | Notes |
| --- | --- | --- | --- |
| `jennifer.anderson@example.ac.th` | Requester | `Requester1!` | |
| `somchai.wattana@example.ac.th` | Requester | `Requester2!` | |
| `pimchanok.srisai@example.ac.th` | Requester | `Requester3!` | |
| `thanakorn.boonmee@example.ac.th` | Requester | `Requester4!` | |
| `kanya.pongsakorn@example.ac.th` | Requester | `Starting1!` | Must choose a new password on first sign-in |
| `natthaphong.chaiyaporn@example.ac.th` | Requester | `Requester5!` | Deactivated — sign-in is refused |
| `michael.brown@example.ac.th` | IT Staff | `ItStaff1!` | |
| `sarah.johnson@example.ac.th` | IT Staff | `ItStaff2!` | |
| `david.lee@example.ac.th` | IT Staff | `ItStaff3!` | |
| `arthit.saelim@example.ac.th` | IT Staff | `ItStaff4!` | Deactivated |
| `wanida.thongchai@example.ac.th` | Administrator | `Admin1!pass` | |

The list is defined once, in `server/prisma/accounts.ts`, which both the seed and
the tests import.

Tests run against their own database, `toktickit_test`, in the same container.
Sharing one database would mean every test run wiped the demonstration data the
screenshots depend on.

Step 7 fills the development database with tickets spread deliberately across the
seeded requesters — twenty-five for the first so pagination spans several pages,
six for the second, none for the third so the empty state can be seen, and three
for the fourth. Re-running it replaces them rather than adding more.

## Running the app

```bash
npm run dev
```

| Service | URL |
| --- | --- |
| Frontend (Vite) | http://localhost:5173 |
| Backend (Express) | http://localhost:3000 |
| PostgreSQL (Docker) | localhost:**5433** |

> PostgreSQL is published on host port **5433**, not the usual 5432, so the
> container can run alongside a PostgreSQL server already installed on the
> machine.

## Running the tests

```bash
npm test
```

This runs both workspaces:

- **server** — Vitest and Supertest against a real PostgreSQL database. Step 6
  of the setup must have been run first, and the suite refuses to start if
  `DATABASE_URL` is not pointing at `toktickit_test`.
- **client** — Vitest and React Testing Library in jsdom. These stub `fetch` and
  never contact a real backend.

jsdom has no layout engine, so anything about rendered colour, clipping or
horizontal overflow is checked with Playwright instead:

```bash
npm run test:e2e
```

That rebuilds `toktickit_test` first, then drives a real browser at three
viewport widths, and writes the report screenshots into
`artifacts/lab-03/screenshots/` (Lab 2's live under
`artifacts/lab-02/screenshots/`). It starts its own server against the test
database rather than reusing one already running, because a suite that silently
tests the development database looks exactly like a suite that passes.

The test plans and results are in [docs/lab-01/tests.md](./docs/lab-01/tests.md),
[docs/lab-02/tests.md](./docs/lab-02/tests.md) and
[docs/lab-03/tests.md](./docs/lab-03/tests.md).

## API

Every endpoint except `GET /api/health`, `POST /api/auth/login` and
`POST /api/auth/logout` requires a signed-in session, held in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie. There
is no test-only bypass and no client-supplied identity: the retired
`X-Development-Requester-Id` header changes nothing. The full contract is in
[docs/lab-03/api-spec.md](./docs/lab-03/api-spec.md); what follows is the map.

### `POST /api/auth/login`

Email and password in, identity plus role and a session cookie out. An unknown
address and a wrong password answer identically (`401 INVALID_CREDENTIALS`), so
the form cannot be used to discover who holds an account. A correct password on
a deactivated account answers `403 ACCOUNT_INACTIVE` — only after the password
is proven.

### `GET /api/auth/me`

The current identity, role and must-change flag.

### `POST /api/auth/password`

Change the password; clears the must-change flag, ends every other session and
keeps the caller signed in. An account issued a starting password can reach
only this, `me` and `logout` until it changes it (`403
PASSWORD_CHANGE_REQUIRED` everywhere else).

### `POST /api/auth/logout`

Ends the session. Idempotent — answering 204 with no session, always.

### `GET /api/health`

```json
{ "status": "ok", "service": "TokTickIT API" }
```

### `GET /api/categories`

Active categories in display order. Requires a session since Lab 3 — the only
reason it was public was the deleted selector, which needed it before any
identity existed.

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

### `GET /api/related-systems`

Active related systems in display order — `{ "id": 1, "name": "Email" }` and so on.

### `GET /api/tickets`

The caller's own tickets, whatever their role — staff raise tickets too; the
all-tickets view is the staff queue below. One page at a time. Supports `search`,
`categoryId`, `requestedPriority`, `sort`, `order`, `page` and `pageSize`.
An unrecognised or out-of-range value is an error rather than a silent default.
The queue-only parameters and filters (`itPriority`, `status`, owner …) are
refused here — they belong to the staff queue below.

### `POST /api/tickets`

Creates one ticket for the caller and issues its official number.
JSON only — attachments are added afterwards, one request per file, so that a
ticket is never half-created because a file failed.

### `GET /api/tickets/:id`

One ticket with its attachment metadata. A Requester may read only their own;
IT Staff and Administrators may read any ticket. A Requester asking for someone
else's ticket gets exactly the answer a ticket that does not exist gets, down to
the response body: a `403` would confirm it is real.

### `POST /api/tickets/:id/attachments`

Adds one file to a ticket the caller raised — own only for every role, staff
included. JPG, PNG, WEBP or PDF, up to 5 MB, up to five
active files per ticket — the count is taken under a row lock, so two uploads
racing cannot both see four.

### `GET /api/tickets/:id/attachments`

Attachment metadata, removed ones included, with the same scope as ticket
detail: a Requester's own tickets, or any ticket for IT Staff and Administrators. Removal keeps
the record and the reason; it is not a delete.

### `GET /api/attachments/:id/download`

The stored file, for an active attachment — on the Requester's own ticket, or on
any ticket for IT Staff and Administrators. Always sent as a
download and never rendered inline, which is what keeps an uploaded file from
executing in the browser as page content.

### `DELETE /api/attachments/:id`

Removes an attachment from a ticket the caller raised — own only for every role;
staff can read and download others' files but never remove them. A reason of 3
to 500 characters is required. The metadata and the
reason stay visible afterwards; the file itself stops being downloadable.

### Staff — queue and ticket operations (IT Staff and Administrator)

`GET /api/staff/tickets` (search, filters, sorting with severity/lifecycle
ordering, stable pagination), `GET /api/staff/owners`,
`PATCH /api/staff/tickets/:id/owner` (claim, reassign, release with `null`),
`PATCH /api/staff/tickets/:id/it-priority` (never touches Requested Priority),
`PATCH /api/staff/tickets/:id/status` (matrix-checked, `CANCELLED` terminal).
Public comments both directions; internal notes staff-only — a Requester gets
an identical `403` whether notes exist or not.

### Requester resolved indication

`POST /api/tickets/:id/resolved-indication` — Requester only, on their own
ticket, status unchanged, timestamp recorded once. Staff and Administrators are
refused, even on tickets they raised.

### Administrator user management (Administrator only)

`GET`/`POST /api/admin/users`, `PATCH /api/admin/users/:id`,
`POST /api/admin/users/:id/password` (issue a starting password; ends the
user's sessions). Self-deactivation is refused, as is removing the last active
Administrator. A Requester or IT Staff caller gets `403` on all four.

## Repository layout

```
toktickit/
├── client/                  React + TypeScript + Vite + Bootstrap
│   ├── src/
│   └── tests/lab-01/        Vitest UI tests (lab-02, lab-03 alongside)
├── server/                  Node.js + Express + TypeScript
│   ├── prisma/              schema, migrations, seed
│   ├── src/
│   └── tests/lab-01/        Supertest API tests (lab-02, lab-03 alongside)
├── docs/lab-01/             specification, api-spec, ui-spec, tests.md, reviewer.md, ai-use.md
├── docs/lab-02/             as above, for the Requester MVP
├── docs/lab-03/             as above, for users, roles and staff ticketing
├── material/                course handouts
├── CONTEXT.md               domain glossary
├── docker-compose.yml
└── README.md
```

## Git workflow

`main` is the stable release branch; each lab integrates on its own staging
branch — `lab1-staging`, `lab2-staging`, `lab3-staging` — and reaches `main`
through a single release Pull Request at the end of the lab. No work happens
directly on any of them. Every Issue is developed on its own feature branch and
merged through a Pull Request the peer reviewer approves and merges; the author
never clicks Merge on their own work.

Lab 3's Issues, in dependency order:

| Issue | Feature branch | Pull Request target |
| --- | --- | --- |
| 45. Sprint 3 engineering contract | `docs/lab3-specification` | `lab3-staging` |
| 46. Client test fixtures | `feature/lab3-test-fixtures` | `lab3-staging` |
| 47. Sign in, sign out, forced password change | `feature/authentication` | `lab3-staging` |
| 48. Authenticated requester, selector deleted | `feature/authenticated-requester` | `lab3-staging` |
| 53. Administrator user management | `feature/admin-user-management` | `lab3-staging` |
| 50. Staff ticket queue | `feature/staff-ticket-queue` | `lab3-staging` |
| 49. Requester comments, resolved indication | `feature/requester-comments` | `lab3-staging` |
| 51. Staff take a ticket and advance it | `feature/staff-ticket-operations` | `lab3-staging` |
| 52. Internal notes, staff only | `feature/internal-notes` | `lab3-staging` |
| 54. End-to-end journeys and visual evidence | `feature/e2e-visual-evidence-lab3` | `lab3-staging` |
| 55. Report, submission and release | `feature/lab3-closing-tests` | `lab3-staging` |

Lab 2's Issues are listed in [docs/lab-02/](./docs/lab-02/); Lab 1's four in
[docs/lab-01/](./docs/lab-01/).

## Troubleshooting

**`npm run db:up` starts a container that keeps restarting** — remove the stale
volume and recreate it: `docker compose down -v && npm run db:up`.

**Port 5433 is already in use** — change the host port in `docker-compose.yml`
and update `DATABASE_URL` in `server/.env` to match.

**Server tests fail with a connection error** — the database is not running or
has not been seeded. Run `npm run db:up`, `npm run db:migrate`, `npm run db:seed`.
