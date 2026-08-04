# Lab 1 — Automated Tests

All Lab 1 tests live under a `tests/lab-01/` folder. There are two, because the
API tests and the UI tests need different runtimes: the API tests run in Node
against a real database, the UI tests run in jsdom with `fetch` mocked.

Run everything from the repository root:

```bash
npm test
```

**14 tests across 5 files.** The API tests require a running, migrated and
seeded database — see [the README](../../README.md#setup).

## Test list

| Test File | Tool | Test Description |
| --- | --- | --- |
| `server/tests/lab-01/API-01.health.test.ts` | Supertest | Health endpoint returns 200 and expected JSON |
| `server/tests/lab-01/API-02.categories.test.ts` | Supertest | Categories endpoint returns the four seeded categories |
| `client/tests/lab-01/UI-01.heading.test.tsx` | Vitest | TokTickIT heading renders |
| `client/tests/lab-01/UI-02.loading-to-list.test.tsx` | Vitest | Loading state changes to category list |
| `client/tests/lab-01/UI-03.error-state.test.tsx` | Vitest | API failure displays a useful error message |

## What each file asserts

### API-01 — `GET /api/health`

- Returns HTTP 200.
- Body is exactly `{ "status": "ok", "service": "TokTickIT API" }`.

Supertest imports the Express app directly, so no port is bound.

### API-02 — `GET /api/categories`

- Returns HTTP 200.
- Returns the four seeded categories, in seed order.
- Every entry has exactly an `id` and a `name` — `displayOrder` decides the sort
  but is not part of the contract, so it must not leak into the response.
- Ordering follows `displayOrder`, not `id`: the test swaps two categories'
  positions without touching their ids and asserts the response order follows.

This is an **integration test**: it queries PostgreSQL through Prisma, because
proving the layers work together is the point of Lab 1.

### UI-01 — Landing state

- The `TokTickIT IT Service Desk` heading renders.
- A `Check System` button is offered.
- No system status appears before the button is clicked.

### UI-02 — Success path

- Clicking `Check System` shows a loading state, and the button is disabled
  while it is in flight.
- The loading state is replaced by `Online` and the four categories.
- The list is rendered from the API response, not from a hard-coded array —
  asserted by returning a category that is not in the seed and expecting it on
  screen.

### UI-03 — Failure paths

- API unreachable → `Offline` plus "Unable to connect to TokTickIT API", and no
  category list.
- API up but categories fail → `Offline` plus "Unable to load request categories
  from the database".
- The button is enabled again after a failure, so the check can be retried.

The two failure messages differ on purpose: telling a stopped database apart
from an unreachable API is the reason the page calls both endpoints.
