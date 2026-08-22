# Lab 2 Peer Review Record

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

### PR #22 — sprint engineering contract

[Kiatisakk/toktickit#22](https://github.com/Kiatisakk/toktickit/pull/22) ·
`docs/lab2-specification` → `lab2-staging` · linked to Issue #14

| | |
| --- | --- |
| Review state | **Approved** — 2026-08-20 17:24 UTC |
| Review body | `LGTM` |
| Inline comments | none |
| Merged by | @beambeambeam, 2026-08-20 17:24 UTC |

Contents under review: `specification.md` (eleven sections, FR-01…FR-21, BR-01…BR-36,
AC-01…AC-25, twelve recorded decisions), `api-spec.md`, `ui-spec.md`, and `tests.md` with
52 planned tests.

The Pull Request description named five decisions I specifically wanted challenged, since
each is expensive to reverse once code exists: modelling identity as `User` rather than
`RequesterUser`, storing attachments on disk rather than in a column, answering `404`
rather than `403` for an unowned resource, carrying three columns Lab 2 does not populate,
and the ticket-number format. None drew a comment.

**Nothing to respond to.** An approval with no comments leaves no thread to reply on. I am
recording that plainly rather than dressing it up — this entry is thinner than a review
record should be, and the remaining Pull Requests are where the substantive exchange has to
happen.

The merge was clicked by the reviewer rather than by me, which is what the workflow guide
requires and what Lab 1 got wrong on every Pull Request.

---

### PR #23 — Zen Green foundation, routing and tooling

[Kiatisakk/toktickit#23](https://github.com/Kiatisakk/toktickit/pull/23) ·
`feature/zen-green-foundation` → `lab2-staging` · linked to Issue #15

| | |
| --- | --- |
| Review state | **Commented** — 2026-08-22 16:04 UTC, three inline comments |
| Review body | "Three changes I would like to see before approval - details inline." |

All three were correct and all three were taken. Nothing was argued down.

| # | File | What he said | What I did |
| --- | --- | --- | --- |
| 1 | `client/tsconfig.app.json` | `strictNullChecks` alone leaves `noImplicitAny`, `strictFunctionTypes` and the rest off. A foundation PR sets the standard every later screen inherits, so enabling the full family here avoids config churn in every screen PR afterwards. | Enabled `strict: true` in all three client tsconfigs. Build clean, no code changes needed. |
| 2 | `CLAUDE.md` | The file is new in this PR but already cites `lab1-staging` as the PR target, while this very PR targets `lab2-staging`. Future agents read it as ground truth. | Rewrote the workflow section around `<lab>-staging` with a note naming the current lab, and fixed the stale `docs/lab1-report` example. Six occurrences. |
| 3 | `client/src/components/fieldAttributes.ts` | The message ids are built by string convention in two places. Rename either and `aria-describedby` silently points at nothing, with no compile error. Suggested exporting an id builder consumed by both. | Added `errorId()` and `hintId()`; `Field.tsx` and `fieldAria` both go through them. The contract now exists once. |

**On comment 1 — his premise was wrong in my favour, and the finding was still right.**
He asked whether stopping at null checks was deliberate. It was not a decision at all:
`strictNullChecks` was what the linter's installer wrote, and I committed it without
looking. Worse than he assumed — `server/tsconfig.json` has carried `strict: true` since
Lab 1, so the repository had two standards and the newer half was the looser one.

**On comment 3 — the coupling was real, though not silent.** The existing test resolves
`aria-describedby` through `document.getElementById` and asserts the element it finds
carries the message, so a rename would have failed a test rather than shipping broken. His
underlying point stands regardless: a convention held together by two independent string
literals is worth removing when the fix is four lines.

Verification after the changes: 50 tests across 6 files passing, `tsc -b && vite build`
clean under full strict, no lint error or warning in any file this PR adds.

---

## Reviews I gave

### beambeambeam/toktickit#39 — Lab 2 specification

[beambeambeam/toktickit#39](https://github.com/beambeambeam/toktickit/pull/39) ·
`feature/5-requester-create` → `lab2-staging` · linked to his Issue #35

| | |
| --- | --- |
| Review state | **Changes requested** — 2026-08-19 07:09 UTC |
| Status | Still open at the time of writing |

**What I asked for**

> Missing numbered FR and BR. §4.3 says rules "must be numbered BR-01, BR-02, and so on"
> and names three mandatory ones. §8.10 lists both as required sections. Part 2's evidence
> asks for "numbered requirements, business rules, acceptance criteria, and Definition of
> Done" — your AC and DoD are there, the other two aren't.

**How I reached it.** His document is thorough — forty user stories, twenty acceptance
criteria, and an attachment compensation ordering more careful than the handout asks for.
The defect is structural rather than intellectual: the functional content is written as
user stories and the rules as prose, so neither carries an identifier. §4.3 requires
numbering and names BR-01, BR-02 and BR-03 as mandatory; §8.10 lists both as required
sections; and Part 2 asks for them by name in the submitted evidence. Without identifiers
the "Requirement / AC" column of the §9.1 planned-test table has nothing to cite either.

**What I found but did not raise this round**, to keep the first review focused on the one
blocking item:

- The ticket number format `TKT-YYYYMMDD-XXXXXX` with a random suffix does not match either
  labsheet figure, which show `TKT-2025-001234` and a contiguous run implying a sequence.
- The `Ticket` model omits IT Priority, Ticket Owner and Resolution Summary, all three of
  which the approved Ticket Detail illustration shows — Resolution Summary already drawn as
  an empty italic placeholder.

**Awaiting his response.** This entry is updated when he replies or pushes a fix.

---

## Still to record

Entries are added by the Pull Request they describe:

- [ ] PR for `refactor/lab1-lint-compliance`
- [ ] Issue #16 — Development Requester context
- [ ] Issue #17 — Ticket creation
- [ ] Issue #18 — My Tickets
- [ ] Issue #19 — Ticket Detail and attachments
- [ ] Issue #20 — End-to-end and visual evidence
- [ ] Issue #21 — Report and submission
- [ ] Release Pull Request into `main`
- [ ] Further reviews given on the partner's repository
