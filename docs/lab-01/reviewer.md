# Lab 1 — Peer Review Record

| | Name | Student ID | GitHub |
| --- | --- | --- | --- |
| **Author of this repository** | Kiatisak Markmeeshap | 67070501005 | [@Kiatisakk](https://github.com/Kiatisakk) |
| **Peer reviewer** | Supawit Marayat | 67070501045 | [@beambeambeam](https://github.com/beambeambeam) |

Throughout this file, "I" and "my" mean the author. Review ran **both
directions** with the same partner, so the same person appears on both sides:
they reviewed my four Pull Requests, and I reviewed four of theirs in
[beambeambeam/toktickit](https://github.com/beambeambeam/toktickit).

**Every Pull Request that implements an Issue was reviewed and approved before
it merged** — all four, in both repositories. Everything below is quoted from
the review history.

---

## Part A — Pull Requests they reviewed for me

### PR #5 — Set up the TokTickIT project foundation

<https://github.com/Kiatisakk/toktickit/pull/5> · **Approved** after changes

`COMMENTED` on `b8dbbad` — *"lgtm in a lot of part."* — with three inline
comments, then `APPROVED` on `a7b61c2` — *"LGTM"*.

| # | Their comment | My response |
| --- | --- | --- |
| 1 | On `client/vitest.config.ts`: *"Can we instead use `tests/lab-**/**/*.test.tsx`? as it will be more lab with more test inside the lab"* | Took it, with a tweak. Changed to `tests/lab-*/**/*.test.{ts,tsx}` — in picomatch a `**` only acts as a globstar when it is a whole path segment, so `lab-**` behaves identically to `lab-*`. Also widened the extension so a future non-rendering client test cannot be silently skipped. Applied to `server/vitest.config.ts` too. (`a7b61c2`) |
| 2 | On `client/.gitignore`: *"should this be only in .gitignore? i mean .vscode is toktickit/client/.vscode no actual toktickit/.vscode? this is generated .gitignore from vite cli template tho"* | Correct, and the reason given was the real problem — `.vscode/*` inside `client/.gitignore` only ever matched `client/.vscode/`. Deleted both per-workspace files and consolidated into the root `.gitignore`, carrying across `dist-ssr/`, `*.local` and the `!.vscode/extensions.json` exception. §8 of the brief also shows exactly one `.gitignore`. (`92a5d7c`, `a7b61c2`) |
| 3 | On `server/.gitignore`: *"same as comment on `client/server/.gitignore`"* | Same fix. The one genuinely path-specific rule, `/src/generated/prisma`, moved to the root as `server/src/generated/prisma/`. Verified with `git check-ignore` that `.env`, the generated Prisma client, `node_modules`, `dist-ssr` and `.vscode` are all still ignored, and that both `.env.example` files are still tracked. |

All three threads resolved. The fixes were merged forward into the other three
feature branches so they would not reintroduce the deleted files.

### PR #6 — Implement the API health check

<https://github.com/Kiatisakk/toktickit/pull/6> · **Approved** first time

`APPROVED` on `8f2c1c8`, no inline comments:

> *"LGTM. Reviewed `/api/health`, client loading/success/error flow, and related
> tests. No actionable findings. No remote checks were reported."*

Nothing to respond to. The decision I had flagged in the description for
challenge — that `GET /api/health` deliberately does not query the database —
drew no comment.

### PR #7 — Create and seed IT request categories

<https://github.com/Kiatisakk/toktickit/pull/7> · **Approved** after changes

Two `COMMENTED` reviews on `c445ef6` carrying one inline comment each, then
`APPROVED` on `173b4fc` — *"LGTM"*.

| # | Their comment | My response |
| --- | --- | --- |
| 1 | On `server/prisma/seed.ts`: *"Mutable display name is used as seed identity; renaming a constant creates a new row and leaves the old row, so reruns can exceed four categories. Use stable seed keys or handle renames explicitly."* | A real bug, and I reproduced it before fixing: renaming `"Hardware"` to `"Hardware and Devices"` and reseeding produced **5 rows**, while the log still printed `Seeded 4 categories (5 total)` and carried on. Fixed by making `CATEGORY_NAMES` authoritative — upsert what is listed, then `deleteMany` anything that is not — plus a count assertion so a future divergence throws instead of printing. (`173b4fc`) **Thread resolved.** |
| 2 | Also on `seed.ts`: *"Insertion order does not guarantee API response order, and serial IDs can change after existing or deleted rows. Add explicit `orderBy` in the category query or store a display-order field."* | **Out of scope for Issue 3, carried to Issue 4 — and ultimately accepted in full.** There was no query in this PR to attach an `orderBy` to, so it was deferred to the Issue that owns the endpoint. I initially argued the display-order column could wait until Lab 2; that argument was about timing, not about whether the concern was real, and it did not survive scrutiny. `displayOrder` was added in `9b8f9e9` on Issue 4's branch. |

### PR #8 — Display the IT request category list

<https://github.com/Kiatisakk/toktickit/pull/8> · **Approved twice**, no inline comments

`APPROVED` on `521f3f2`:

> *"LGTM for question 2 please follow the product requirements but for now it's
> already ok"*

That approval landed **thirteen minutes before** the `displayOrder` commit that
answered their own review comment on #7. Rather than merge on a sign-off that
predated a schema change, a migration and a rewritten seed, I asked for a second
pass — `APPROVED` again on `2027fac` — *"LGTM"*.

---

## Part B — Pull Requests I reviewed for them

### PR #19 — Set up the TokTickIT project foundation

<https://github.com/beambeambeam/toktickit/pull/19> · I requested **changes**

`CHANGES_REQUESTED` — *"discuss thhis"* — with one inline comment.

| My comment | Their response |
| --- | --- |
| On `client/src/main.tsx:8` — *"import but not used, will this effect on performance? bundle — can you check on this?"* | *"It should be fine as this will be used in the future."* Thread resolved after discussion; I accepted the answer rather than pressing it. |

### PR #29 — Implement the API health check

<https://github.com/beambeambeam/toktickit/pull/29> · I requested **changes** — two defects, both real

Two `COMMENTED` reviews then `CHANGES_REQUESTED`. Both were fixed with commits.

| My comment | Their response |
| --- | --- |
| On `scripts/openapi-check.mjs:59` — *"this will likely break on Windows. `execFileSync` doesn't go through a shell, and Node won't resolve `.cmd` files via `PATHEXT`."* | *"Fixed in `c6851e4`. `openapi-check.mjs` now enables the platform shell on Windows so the `pnpm.cmd` shim resolves, while POSIX keeps direct execution. `pnpm openapi:check` passes."* |
| On `client/src/routes/index.tsx:8` — *"`instanceof TypeError` is too broad here. Any bug in our own response handling (`undefined.map`, calling a non-function) is also a `TypeError`, so users get 'Unable to connect to TokTickIT API' for what's actually our bug, and error reports point the wrong way."* | *"Fixed in `8557566`. Network failures are wrapped as `ApiConnectionError` at the fetch boundary, so the route no longer treats arbitrary `TypeError` values as connection failures. Added regression coverage for response-handling `TypeError`s; full checks pass."* |

### PR #30 — Add Category schema migration and seed

<https://github.com/beambeambeam/toktickit/pull/30> · I **approved**, no inline comments

`APPROVED` — *"lgtm"*.

Worth recording honestly: on my own #8 I asked my reviewer to press the Approve
button rather than leave a comment saying LGTM, and here I gave a review with no
substance of its own. The other three carry the real reviewing.

### PR #31 — Display the IT request category list

<https://github.com/beambeambeam/toktickit/pull/31> · I requested **changes**, then **approved**

`CHANGES_REQUESTED` with one inline comment, then `APPROVED` — *"lgtm"* — once
the fix landed.

| My comment | Their response |
| --- | --- |
| On `client/src/api/categories.ts:15` — *"`Error.prototype.message` is always a string, so this matches every `Error` — including the `SyntaxError` from `res.json()` when the body isn't JSON. Those leak to the UI instead of the #25 fallback."* | *"fix in `2c92c71`"* |
