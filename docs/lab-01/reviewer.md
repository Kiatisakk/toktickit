# Lab 1 — Peer Review Record

> **TO FILL IN.** Every field below marked `___` needs your reviewer's real
> details. Peer review is mandatory for all Pull Requests, and this file is
> graded.

## My reviewer

The person who reviewed **my** Pull Requests.

| Field | Value |
| --- | --- |
| Name | `___` |
| Student ID | `___` |
| GitHub username | [@beambeambeam](https://github.com/beambeambeam) |

### Pull Requests they reviewed for me

| PR | Title | Link | Approved |
| --- | --- | --- | --- |
| #5 | Set up the TokTickIT project foundation | https://github.com/Kiatisakk/toktickit/pull/5 | Reviewed with comments; fixes pushed and review re-requested |
| #6 | Implement the API health check | https://github.com/Kiatisakk/toktickit/pull/6 | `___` |
| #7 | Create and seed IT request categories | https://github.com/Kiatisakk/toktickit/pull/7 | Reviewed with comments; one fix pushed, one thread open by agreement |
| #8 | Display the IT request category list | https://github.com/Kiatisakk/toktickit/pull/8 | `___` |

### Their review comments, and how I responded

**PR #5 — three inline comments, all addressed and resolved.**

| # | Their comment | My response |
| --- | --- | --- |
| 1 | On `client/vitest.config.ts`: *"Can we instead use `tests/lab-**/**/*.test.tsx`? as it will be more lab with more test inside the lab"* | Took it, with a tweak. Changed to `tests/lab-*/**/*.test.{ts,tsx}` — in picomatch a `**` only acts as a globstar when it is a whole path segment, so `lab-**` behaves identically to `lab-*`. Also widened the extension so a future non-rendering client test cannot be silently skipped. Applied to `server/vitest.config.ts` too. (`a7b61c2`) |
| 2 | On `client/.gitignore`: *"should this be only in .gitignore? i mean .vscode is toktickit/client/.vscode no actual toktickit/.vscode? this is generated .gitignore from vite cli template tho"* | Correct, and the reason given was the real problem — `.vscode/*` inside `client/.gitignore` only ever matched `client/.vscode/`. Deleted both per-workspace files and consolidated into the root `.gitignore`, carrying across `dist-ssr/`, `*.local` and the `!.vscode/extensions.json` exception. §8 of the brief also shows exactly one `.gitignore`. (`92a5d7c`, `a7b61c2`) |
| 3 | On `server/.gitignore`: *"same as comment on `client/server/.gitignore`"* | Same fix. The one genuinely path-specific rule, `/src/generated/prisma`, moved to the root as `server/src/generated/prisma/`. Verified with `git check-ignore` that `.env`, the generated Prisma client, `node_modules`, `dist-ssr` and `.vscode` are all still ignored, and that both `.env.example` files are still tracked. |

The fixes were merged forward into the other three feature branches so they do
not reintroduce the deleted files.

**PR #7 — two inline comments: one fixed, one still under discussion.**

| # | Their comment | My response |
| --- | --- | --- |
| 1 | On `server/prisma/seed.ts`: *"Mutable display name is used as seed identity; renaming a constant creates a new row and leaves the old row, so reruns can exceed four categories. Use stable seed keys or handle renames explicitly."* | A real bug, and I reproduced it before fixing: renaming `"Hardware"` to `"Hardware and Devices"` and reseeding produced **5 rows**, while the log still printed `Seeded 4 categories (5 total)` and carried on. Fixed by making `CATEGORY_NAMES` authoritative — upsert what is listed, then `deleteMany` anything that is not — plus a count assertion so a future divergence throws instead of printing. (`173b4fc`) **Thread resolved.** |
| 2 | Also on `seed.ts`: *"Insertion order does not guarantee API response order, and serial IDs can change after existing or deleted rows. Add explicit `orderBy` in the category query or store a display-order field."* | **Out of scope for Issue 3.** There is no query in this PR — it is the schema, the migration and the seed — so there was nothing in the diff I could change to answer it. The `orderBy` belongs in the endpoint that serves categories, which is Issue 4. Deferred to that Issue, with a commitment to raise it there myself. **Thread resolved as out of scope, not as settled.** |

**A process mistake of mine, and what it cost.** Comment 2 arrived on Issue 3's
PR, but the code it asks about lives in Issue 4's work, which under the brief's
dependency order had not started — Issue 4 begins only once Issue 3 is available
in `lab1-staging`.

That was my doing. The doc comment I wrote at the top of `seed.ts` describes what
`GET /api/categories` will return, an endpoint that does not exist in this
branch. It made an API-ordering concern look in scope on a PR where nothing could
be done about it, and the reviewer had no way to check my answer from the diff
they were reading.

Worse, my first instinct was to answer it by pointing at the later work — which
drags an Issue that has not started into a review that should not know about it.
I removed those references and reframed the reply around what this PR actually
contains. The substance of the concern is preserved and deferred, not dropped.

Two consequences I raised unprompted in those threads, since I would rather the
reviewer hear them from me than find them:

- The reconcile fixes row *count*, not id *stability* — after a rename the ids
  come back as `1,3,4,6`.
- `deleteMany` is safe only while nothing references Category. In Lab 2 it would
  delete a category out from under live tickets. There is a comment in the file
  saying so, but a comment is not a constraint.

I also flagged a mistake of my own in that thread: `92a5d7c` contains only the
deletions, because a pathspec typo made the matching `git add` fail as a whole
and I noticed only after pushing. I fixed it forward in `a7b61c2` rather than
force-push a branch the reviewer was already reading.

## Whose work I reviewed

The person whose Pull Requests **I** reviewed.

| Field | Value |
| --- | --- |
| Name | `___` |
| Student ID | `___` |
| GitHub username | `___` |
| Their repository | `___` |

### Pull Requests I reviewed for them

| PR | Title | Link | I approved |
| --- | --- | --- | --- |
| `___` | `___` | `___` | `___` |

### My review comments, and how they responded

| PR | My comment | Their response |
| --- | --- | --- |
| `___` | `___` | `___` |

---

## Where to find things to comment on

Each of my four Pull Requests ends with a section flagging a decision that
could reasonably have gone the other way. Those are genuine questions, not
rhetorical ones:

- **#5** — PostgreSQL published on host port 5433 instead of 5432; `CONTEXT.md`
  and `docker-compose.yml` are additions beyond the brief's required structure.
- **#6** — `GET /api/health` does not query the database. The brief pulls both
  ways on this; the reasoning is in the PR and in `CONTEXT.md`.
- **#7** — `db:migrate` chains `prisma generate`, which is arguably outside the
  Issue's scope.
- **#8** — The two API calls run sequentially rather than through `Promise.all`.
