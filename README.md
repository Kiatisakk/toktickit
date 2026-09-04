# TokTickIT

An IT service desk application for Account and Access, Hardware, Software, and
Network requests.

This repository holds **Lab 2**: the Requester side of the service desk, end to
end. A Requester is chosen on a development selection screen — there is no
authentication until Lab 3 — and can then raise a ticket with attachments,
receive a backend-issued ticket number, find that ticket again through search,
filters, sorting and pagination, open it, and add or remove attachments. Each
Requester sees only their own tickets: a ticket belonging to someone else is
indistinguishable from one that does not exist, whether it is missing from a
list or requested by its own URL.

**Lab 1** — the vertical slice that proved the stack connects, with the
**Check System** button and the category list — is on `main` and documented in
[docs/lab-01/](./docs/lab-01/).

```
React + Vite + Bootstrap  →  Express REST API  →  Prisma ORM  →  PostgreSQL
        (client)                  (server)
```

See [CONTEXT.md](./CONTEXT.md) for the domain vocabulary. The Lab 2 sprint
documents are in [docs/lab-02/](./docs/lab-02/): the specification with its
numbered requirements, rules, acceptance criteria and recorded decisions, the
API and UI contracts, the test plan and results, the peer review record, and
the AI-use log.

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
the four request categories, seven related systems, and five Development
Requesters, one of which is deliberately inactive.

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
`artifacts/lab-02/screenshots/`. It starts its own server against the test
database rather than reusing one already running, because a suite that silently
tests the development database looks exactly like a suite that passes.

The test plans and results are in [docs/lab-01/tests.md](./docs/lab-01/tests.md)
and [docs/lab-02/tests.md](./docs/lab-02/tests.md).

## API

### `GET /api/health`

```json
{ "status": "ok", "service": "TokTickIT API" }
```

### `GET /api/categories`

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

The current requester's tickets, one page at a time. Supports `search`, `categoryId`,
`requestedPriority`, `itPriority`, `status`, `sort`, `order`, `page` and `pageSize`.
An unrecognised or out-of-range value is an error rather than a silent default.

### `POST /api/tickets`

Creates one ticket for the current requester and issues its official number.
JSON only — attachments are added afterwards, one request per file, so that a
ticket is never half-created because a file failed.

### `GET /api/tickets/:id`

One ticket the current requester owns, with its attachment metadata. A ticket
belonging to someone else answers exactly as a ticket that does not exist does,
down to the response body: a `403` would confirm it is real.

### `POST /api/tickets/:id/attachments`

Adds one file to an owned ticket. JPG, PNG, WEBP or PDF, up to 5 MB, up to five
active files per ticket — the count is taken under a row lock, so two uploads
racing cannot both see four.

### `GET /api/tickets/:id/attachments`

Attachment metadata for an owned ticket, removed ones included. Removal keeps
the record and the reason; it is not a delete.

### `GET /api/attachments/:id/download`

The stored file, for an active attachment on an owned ticket. Always sent as a
download and never rendered inline, which is what keeps an uploaded file from
executing in the browser as page content.

### `DELETE /api/attachments/:id`

Removes an attachment with a reason of 3 to 500 characters. The metadata and the
reason stay visible afterwards; the file itself stops being downloadable.

### `GET /api/requesters`

Active Development Requesters for the selection screen. Inactive ones never
appear here and can never become the current context.

```json
[{ "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.ac.th" }]
```

### Requester context

Every requester-scoped endpoint requires the `X-Development-Requester-Id` header.
It is a testing mechanism, **not authentication** — anyone can set it to
anything, and Lab 3 replaces it with a real authenticated identity. The full
contract is in [docs/lab-02/api-spec.md](./docs/lab-02/api-spec.md).

## Repository layout

```
toktickit/
├── client/                  React + TypeScript + Vite + Bootstrap
│   ├── src/
│   └── tests/lab-01/        Vitest UI tests
├── server/                  Node.js + Express + TypeScript
│   ├── prisma/              schema, migrations, seed
│   ├── src/
│   └── tests/lab-01/        Supertest API tests
├── docs/lab-01/             tests.md, reviewer.md, ai_use.md
├── material/                course handouts
├── CONTEXT.md               domain glossary
├── docker-compose.yml
└── README.md
```

## Git workflow

`main` is the stable release branch; each lab integrates on its own staging
branch — `lab1-staging`, then `lab2-staging` — and reaches `main` through a
single release Pull Request at the end of the lab. No work happens directly on
any of the three. Every Issue is developed on its own feature branch and merged
through a Pull Request the peer reviewer approves and merges; the author never
clicks Merge on their own work.

Lab 2's Issues, in dependency order:

| Issue | Feature branch | Pull Request target |
| --- | --- | --- |
| 14. Sprint specification and test plan | `docs/lab2-specification` | `lab2-staging` |
| 15. Zen Green UI foundation and shell | `feature/zen-green-foundation` | `lab2-staging` |
| 16. Development Requester context | `feature/requester-context` | `lab2-staging` |
| 17. Ticket creation | `feature/ticket-creation` | `lab2-staging` |
| 18. My Tickets discovery and ownership | `feature/my-tickets` | `lab2-staging` |
| 19. Ticket Detail and attachment lifecycle | `feature/ticket-detail-attachments` | `lab2-staging` |
| 20. End-to-end and visual evidence | `feature/e2e-visual-evidence` | `lab2-staging` |
| 40. Attachments during ticket creation | `feature/create-ticket-attachments` | `lab2-staging` |
| 21. Report and submission evidence | `docs/lab2-report` | `lab2-staging` |

Issues 35 and 37 were opened mid-sprint from an audit that compared the six
sprint documents against the code, and their branches follow the same rule.
Lab 1's four Issues are listed in [docs/lab-01/](./docs/lab-01/).

## Troubleshooting

**`npm run db:up` starts a container that keeps restarting** — remove the stale
volume and recreate it: `docker compose down -v && npm run db:up`.

**Port 5433 is already in use** — change the host port in `docker-compose.yml`
and update `DATABASE_URL` in `server/.env` to match.

**Server tests fail with a connection error** — the database is not running or
has not been seeded. Run `npm run db:up`, `npm run db:migrate`, `npm run db:seed`.
