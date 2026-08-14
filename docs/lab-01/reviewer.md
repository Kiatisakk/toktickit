# Lab 1 — Peer Review Record

> **Still to fill in.** One thing cannot be recovered from GitHub: my partner's
> real name and student ID. Everything else below is taken from the review
> history on both repositories.

Review ran **both directions** with the same person: they reviewed my four
Pull Requests, and I reviewed four of theirs.

Peer review is mandatory for all Pull Requests. Every Pull Request into
`lab1-staging` in this repository was reviewed and approved before it merged.

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
| #5 | Set up the TokTickIT project foundation | https://github.com/Kiatisakk/toktickit/pull/5 | **Approved** — after 3 inline comments, fixes pushed, review re-requested |
| #6 | Implement the API health check | https://github.com/Kiatisakk/toktickit/pull/6 | **Approved** — no changes requested |
| #7 | Create and seed IT request categories | https://github.com/Kiatisakk/toktickit/pull/7 | **Approved** — after 2 inline comments, one fixed and one deferred by agreement |
| #8 | Display the IT request category list | https://github.com/Kiatisakk/toktickit/pull/8 | **Approved twice** — the first approval predated the `displayOrder` commit by 13 minutes, so I asked for a second pass rather than merge on a stale sign-off |

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
| 2 | Also on `seed.ts`: *"Insertion order does not guarantee API response order, and serial IDs can change after existing or deleted rows. Add explicit `orderBy` in the category query or store a display-order field."* | **Out of scope for Issue 3, carried to Issue 4 — and ultimately accepted in full.** There was no query in this PR to attach an `orderBy` to, so it was deferred to the Issue that owns the endpoint. I initially argued the display-order column could wait until Lab 2; that argument was about timing, not about whether the concern was real, and it did not survive scrutiny. `displayOrder` was added in `9b8f9e9` on Issue 4's branch. |

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

**How it ended.** Once Issue 4 opened properly, I put the question there and
argued the column belonged in Lab 2. It was decided against me, and correctly:
my case was about *when* to add it, never about whether the reviewer was right,
and that is a weak reason to ship a sort I already agreed was wrong. `Category`
now carries `displayOrder`, the API sorts on it, and `API-02` proves it by
swapping two categories' positions without touching their ids.

The most useful thing that came out of this review was not the column. It was
being made to notice that I had turned "I would rather do this later" into an
argument that looked like "this is not needed".

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

### The release Pull Request

Peer review is mandatory for *all* Pull Requests, and the release into `main`
is where that slipped.

PR #9 merged `lab1-staging` into `main` with **no approval on it**. It was
opened, a reviewer was requested, and it was merged before anyone had looked —
the only Pull Request in this repository that went in unreviewed.

That merge was undone: `main` was reset to the commit before it, so nothing
unreviewed remains on the release branch. The release will be reopened as a new
Pull Request and will carry an approval like every other one.

GitHub has no way to un-merge, so **#9 still shows as MERGED** even though its
commit is no longer in `main`. Recorded here rather than left to be discovered.

## Whose work I reviewed

The person whose Pull Requests **I** reviewed.

| Field | Value |
| --- | --- |
| Name | `___` |
| Student ID | `___` |
| GitHub username | [@beambeambeam](https://github.com/beambeambeam) |
| Their repository | https://github.com/beambeambeam/toktickit |

We reviewed each other, so this is the same person in both halves of this file.

### Pull Requests I reviewed for them

| PR | Title | Link | Outcome |
| --- | --- | --- | --- |
| #19 | Set up the TokTickIT project foundation | https://github.com/beambeambeam/toktickit/pull/19 | **Changes requested** — 1 inline comment, discussed and resolved |
| #29 | Implement the API health check | https://github.com/beambeambeam/toktickit/pull/29 | **Changes requested** — 2 inline comments, both fixed with commits |
| #30 | Add Category schema migration and seed | https://github.com/beambeambeam/toktickit/pull/30 | **Approved** — no inline comments |
| #31 | Display the IT request category list | https://github.com/beambeambeam/toktickit/pull/31 | **Changes requested**, then **approved** after the fix |

### My review comments, and how they responded

**PR #19 — unused import**

| My comment | Their response |
| --- | --- |
| On `client/src/main.tsx:8` — *"import but not used, will this effect on performance? bundle — can you check on this?"* | *"It should be fine as this will be used in the future."* Thread resolved after discussion; I accepted the answer rather than pressing it. |

**PR #29 — two defects, both real**

| My comment | Their response |
| --- | --- |
| On `scripts/openapi-check.mjs:59` — *"this will likely break on Windows. `execFileSync` doesn't go through a shell, and Node won't resolve `.cmd` files via `PATHEXT`."* | *"Fixed in `c6851e4`. `openapi-check.mjs` now enables the platform shell on Windows so the `pnpm.cmd` shim resolves, while POSIX keeps direct execution. `pnpm openapi:check` passes."* |
| On `client/src/routes/index.tsx:8` — *"`instanceof TypeError` is too broad here. Any bug in our own response handling (`undefined.map`, calling a non-function) is also a `TypeError`, so users get 'Unable to connect to TokTickIT API' for what's actually our bug, and error reports point the wrong way."* | *"Fixed in `8557566`. Network failures are wrapped as `ApiConnectionError` at the fetch boundary, so the route no longer treats arbitrary `TypeError` values as connection failures. Added regression coverage for response-handling `TypeError`s; full checks pass."* |

**PR #31 — over-broad error match**

| My comment | Their response |
| --- | --- |
| On `client/src/api/categories.ts:15` — *"`Error.prototype.message` is always a string, so this matches every `Error` — including the `SyntaxError` from `res.json()` when the body isn't JSON. Those leak to the UI instead of the #25 fallback."* | *"fix in `2c92c71`"*. I approved after the fix. |

**PR #30 — approved without comment**

I approved this one with a bare *"lgtm"* and no inline comments. Worth recording
honestly: on my own #8 I asked my reviewer to press the Approve button rather
than leave a comment saying LGTM, and here I gave a review with no substance of
its own. The three PRs above carry the real reviewing.

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
