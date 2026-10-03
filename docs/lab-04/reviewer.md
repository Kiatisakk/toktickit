# Lab 4 Peer Review Record

A living document. Each Pull Request adds its own entry as part of that Pull Request,
while the conversation is still open — reconstructing this from GitHub afterwards was what
Lab 1 cost, and expanded-then-collapsed review threads are easy to miss.

| Role | Name | Student ID | GitHub |
| --- | --- | --- | --- |
| Author, repository owner | Kiatisak Markmeeshap | 67070501005 | [@Kiatisakk](https://github.com/Kiatisakk) |
| Peer reviewer | Supawit Marayat | 67070501045 | [@beambeambeam](https://github.com/beambeambeam) |

Review runs in both directions with the same partner: he reviews the Pull Requests in
[Kiatisakk/toktickit](https://github.com/Kiatisakk/toktickit), and I review his in
[beambeambeam/toktickit](https://github.com/beambeambeam/toktickit).

---

## Reviews I received

### PR #71 — Sprint 4 engineering contract (Issue #70)

[PR #71](https://github.com/Kiatisakk/toktickit/pull/71) · reviewed 2026-10-02 · **3 line comments**, verdict **Changes requested**.

Three findings, all real, all about the contract contradicting itself rather than the handout.

*Action edits could race a resolution.* The gate held the Ticket lock and so did Action creation, but an edit can also turn Follow-Up Required on, and the lock was stated for creation only. The fourth gate condition added after the user's review (no Planned Action) already blocks this particular case, because only a Planned Action can be edited — but the rule should not depend on that. Every Action write now takes the Ticket lock and re-checks that the Ticket accepts Actions under it; AC-27 covers edits as well as creation, and CONC-03 races an edit against a resolve.

*Cancelling a closing Action was promised to reopen its follow-up.* Only a Done Action closes a follow-up, and Done is terminal, so the outcome could never happen — and API-11 already said so, which made the contract disagree with its own test. BR-09, D-22 and the cancel response now state the true consequence.

*The edit form offered an immutable field.* It reused the create form, including the Follows-up selector, while BR-10 fixes the link at creation and `PATCH` refuses `followsUpId`. The field is now read-only in edit mode.

He approved with `LGTM` at 16:54:20Z on 2026-10-02 and merged ten seconds later as `5419199`. Issue #70 was closed by hand. Recorded on the next feature branch, #72's.

### PR #80 — Ticket versioning and status history (Issue #72)

[PR #80](https://github.com/Kiatisakk/toktickit/pull/80) · reviewed 2026-10-03 (review 5399433733) · **3 line comments**, verdict **Changes requested**. Fixes in `9edda8a` and `171253a`; each thread answered.

*The migration was not transactional.* Prisma Migrate does not wrap a SQL migration in a transaction, so a failure after the backfill could leave it half-applied, contrary to specification section 7. Real. The file now opens with `BEGIN;` and ends with `COMMIT;` (`down.sql` already did); there is no `ALTER TYPE ... ADD VALUE` in it, which is what would have forbidden that. New test MIG-12 asserts both statements and runs the file on the scratch database with a division by zero injected before the commit, then shows no `version` column, no `TicketStatusChange` table and every earlier row intact; it failed first on the missing `BEGIN;`. Honest limit: the behavioural half alone passes on the old file, because the driver sends a multi-statement string as one implicit transaction. The migration was already applied to the shared databases; `prisma migrate status` and `deploy` do not verify applied checksums, so nothing in `_prisma_migrations` was touched.

*The scratch database name was fixed and dropped with FORCE.* Real: a parallel run or a database with that name would be terminated and erased. The name now carries 12 random hex characters after the same prefix, is created without a prior drop and dropped by that exact name in `afterAll`. Verified by running the suite twice at once; both passed.

*A failed reload after a stale write was swallowed.* Real: the control said "We've loaded the latest version" even when that fetch had failed. The reload now reports whether it worked; the stale message waits for it, and a failure shows a distinct alert saying the data may be out of date and to reload the page. ui-spec section 8 states it. The new client test failed first (the alert never appeared).

---

## Reviews I gave

### beambeambeam#80 — Sprint 4 engineering contract (his Issue beambeambeam/toktickit#73)

[beambeambeam#80](https://github.com/beambeambeam/toktickit/pull/80) · reviewed 2026-10-02 · **8 line comments**, verdict **Changes requested**. Caveman format at the user's request.

A detailed contract — lock ordering, an idempotent create, and drill-down filters defined to reproduce each card's count — and every test file its `tests.md` cites was checked to exist on his branch. Changes were requested for three process problems, stated in the review body because they have no line:

- the Pull Request targets `main`, and no `lab4-staging` exists on his repository, so the feature → staging → main history Part 1 grades would be skipped;
- `docs/lab-04/reviewer.md` and `ai-use.md` are missing, though §12 of the handout lists six files;
- no `lab-04` label, and `Closes beambeambeam/toktickit#73` stops linking once the base is a staging branch.

**Line findings.**

| File | Finding |
| --- | --- |
| specification.md L98 🟡 | Headings drift from the handout's eleven sections; §11 Assumptions and Decisions is missing |
| specification.md L51 🟡 | A Completed action can never carry Follow-Up Required, so the gate clause about one is dead, and the follow-up note is erased before completion |
| specification.md L141 🟡 | Four ACs describe the contract process, not product behaviour |
| specification.md L25 ❓ | Where `reviewer.md` and `ai-use.md` will be created |
| specification.md L3 🔵 | "approved" on an unreviewed PR |
| api-spec.md L244 🟡 | Three error codes for one gate, with no defined precedence when several conditions fail |
| ui-spec.md L96 🟡 | No screenshot inventory for the three folders the handout fixes |
| tests.md L90 🔵 | One test ID bundles about eight behaviours |

Our own contract (this PR) was checked against the same list before it was opened for review: eleven handout headings, ACs in Given/When/Then form, one gate error code listing every unmet condition, and a screenshot inventory.

**Outcome.** He replied on all eight threads within the hour, each naming the commit that fixed it, and fixed the three process problems too: created `lab4-staging`, retargeted the Pull Request, added the `lab-04` label and the two missing registers, and linked his Issue. Re-reviewed at `7717a45` against the files rather than the replies, plus a mechanical check (AC-01 to AC-25 without gaps, every AC in his crosswalk, no duplicate or undefined test ID). **Approved** 2026-10-02 16:46:21Z. Merged 2026-10-02 16:48:36Z by the author's account, Kiatisakk, after the approval.

---

## Coverage

| Pull Request | Direction | Findings | Verdict | State |
| --- | --- | --- | --- | --- |
| [#71](https://github.com/Kiatisakk/toktickit/pull/71) | received | 3 | Changes requested → Approved | Merged |
| [#80](https://github.com/Kiatisakk/toktickit/pull/80) | received | 3 | Changes requested → fixed, awaiting re-review | Open |
| [beambeambeam#80](https://github.com/beambeambeam/toktickit/pull/80) | given | 8 | Changes requested → Approved | Merged |
