# TokTickIT

An IT service desk application for Account and Access, Hardware, Software, and
Network requests.

This repository holds **Lab 1**: a full-stack vertical slice that proves every
layer of the stack works as one integrated system. Opening the app shows the
product name and a **Check System** button; clicking it reports the system
status and lists the supported request categories loaded from PostgreSQL.

```
React + Vite + Bootstrap  →  Express REST API  →  Prisma ORM  →  PostgreSQL
        (client)                  (server)
```

See [CONTEXT.md](./CONTEXT.md) for the domain vocabulary and
[docs/lab-01/](./docs/lab-01/) for the Lab 1 test list, reviewer record, and
AI-use log.

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
cp client/.env.example client/.env      # optional; defaults work as-is

# 3. Start PostgreSQL
npm run db:up

# 4. Create the database tables
npm run db:migrate

# 5. Insert the four request categories
npm run db:seed
```

The seed is idempotent — running it again does not create duplicates.

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

- **server** — Supertest API tests. `API-02` queries the real database, so
  `npm run db:up`, `npm run db:migrate` and `npm run db:seed` must have been run
  first.
- **client** — Vitest UI tests in jsdom. These mock `fetch` and never contact a
  real backend.

The full list is in [docs/lab-01/tests.md](./docs/lab-01/tests.md).

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
├── docs/lab-01/             tests.md, reviewer.md, ai_use.md, submission.md
├── material/                course handouts
├── CONTEXT.md               domain glossary
├── docker-compose.yml
└── README.md
```

## Git workflow

`main` is the stable release branch and `lab1-staging` is the Lab 1 integration
branch. No work happens directly on either — every Issue is developed on its own
feature branch and merged through a peer-reviewed Pull Request.

| Issue | Feature branch | Pull Request target |
| --- | --- | --- |
| 1. Project Foundation | `feature/1-project-foundation` | `lab1-staging` |
| 2. API Health Check | `feature/2-health-check` | `lab1-staging` |
| 3. Create and Seed Categories | `feature/3-category-seed` | `lab1-staging` |
| 4. Display Category List | `feature/4-category-list` | `lab1-staging` |

## Troubleshooting

**`npm run db:up` starts a container that keeps restarting** — remove the stale
volume and recreate it: `docker compose down -v && npm run db:up`.

**Port 5433 is already in use** — change the host port in `docker-compose.yml`
and update `DATABASE_URL` in `server/.env` to match.

**Server tests fail with a connection error** — the database is not running or
has not been seeded. Run `npm run db:up`, `npm run db:migrate`, `npm run db:seed`.
