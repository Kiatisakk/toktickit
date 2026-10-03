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

---

### PR #81 — Actions Taken API (Issue #73)

[PR #81](https://github.com/Kiatisakk/toktickit/pull/81) · reviewed 2026-10-03 · **4 line comments**, verdict **Changes requested** (review 5399435686).

Four findings, all real; each was reproduced with a failing test before it was fixed.

| File | Finding | What was done |
| --- | --- | --- |
| routes/actions.ts L230 🔴 | `followsUpId` accepts an Action dated after the new Action, reversing the follow-up chronology | A target dated after the new Action's effective time is refused `400`, `details.followsUpId`; the same instant is allowed (the list breaks ties by id and the target is the older row). The same order is kept when `actionAt` is edited (`details.actionAt`), in both directions: before the Action it follows up, and after any Action that follows it. BR-10, AC-13 and api-spec.md say so; API-12 and API-17 cover it |
| routes/actions.ts L149 🟡 | The performer can be deactivated after the eligibility lookup but before the Action commits | The performer's row is read `FOR SHARE` inside the writing transaction, after the Ticket lock, on create and on edit. `FOR SHARE` rather than `FOR UPDATE` because it must block the deactivation's `UPDATE` but need not make two writes naming one performer queue. Lock order is Ticket then User; the user-edit endpoint locks only User rows and never a Ticket, so there is no cycle. CONC-05 holds a pending deactivation and starts the write; removing the lock fails it |
| actions/validation.ts L149 🔴 | `Date` normalises impossible dates such as 30 February into March | The calendar and clock fields are checked before the instant is accepted: a real day of the month (leap years included), hour below 24, minute and second below 60, an offset of the same shape. Refused `400`, `details.actionAt`; BR-14 says so. Month 13 and minute 60 were already refused by `Date`; 30 February, 29 February in a common year, 31 April and hour 24 were not |
| actions/validation.ts L174 🔴 | A body key such as `__proto__` resolves to an inherited object and is called as a validator, giving a 500 | Validators are looked up in a `Map` and results are kept in prototype-free records, so no body key reaches anything inherited. `__proto__`, `constructor`, `toString` and `hasOwnProperty` are each refused by name on all four writes. `constructor` and `toString` had answered a 400 with an empty `details`; `__proto__` was a 500 |

Lab 3's `onlyField`, `users/validation.ts` and `ticketQuery.ts` were searched for the same lookup-by-body-key pattern: none calls a looked-up value, so none can 500 this way.

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

**Outcome.** He replied on all eight threads within the hour, each naming the commit that fixed it, and fixed the three process problems too: created `lab4-staging`, retargeted the Pull Request, added the `lab-04` label and the two missing registers, and linked his Issue. Re-reviewed at `7717a45` against the files rather than the replies, plus a mechanical check (AC-01 to AC-25 without gaps, every AC in his crosswalk, no duplicate or undefined test ID). **Approved** 2026-10-02 16:46:21Z.

---

## Coverage

| Pull Request | Direction | Findings | Verdict | State |
| --- | --- | --- | --- | --- |
| [#71](https://github.com/Kiatisakk/toktickit/pull/71) | received | 3 | Changes requested | Open — fixes pushed |
| [#81](https://github.com/Kiatisakk/toktickit/pull/81) | received | 4 | Changes requested | Open — fixes pushed |
| [beambeambeam#80](https://github.com/beambeambeam/toktickit/pull/80) | given | 8 | Changes requested → Approved | Open — awaiting merge |
