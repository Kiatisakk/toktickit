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

---

## Coverage

| Pull Request | Direction | Findings | Verdict | State |
| --- | --- | --- | --- | --- |
| [beambeambeam#80](https://github.com/beambeambeam/toktickit/pull/80) | given | 8 | Changes requested | Open |
