# Lab 4 AI Use

A living document. Prompts are recorded in the Pull Request that used them, not reconstructed
at the end of the sprint from memory.

## 1. Which AI I used

**Claude Code** in the terminal, with access to the repository and to the `gh` command line
tool. Two models, in two roles:

- **Claude Opus 5.5** ran the grill, wrote the plan, and verified the work of the others: it
  re-read each diff, re-ran the suites and checked each new test by breaking the rule it
  guards. It also wrote the small fixes made while verifying and the review replies and
  records made after a Pull Request was reviewed.
- **Claude Sonnet 5.5 sub-agents** implemented. Each was launched by the Opus 5.5 session with
  a written brief and worked alone, usually in its own git worktree. They wrote the contract,
  the Ticket versioning and status history, the Actions Taken API and interface, the
  resolution gate, the dashboards, the browser suite, the hardening Issue, and first
  drafts of several of the reviews given on the peer's Pull Requests (each checked by the Opus session
  before it was posted). This records half of the closing Issue (#79) was also done by a
  Sonnet 5.5 agent, verified by Opus 5.5.

**What the commit trailers say.** Every commit in the sprint carries a `Co-Authored-By`
trailer, and it names the model that ran `git commit`, not necessarily the one that wrote
every line. Of the 64 non-merge commits between `main` and `lab4-staging` before this Pull
Request, 52 name Sonnet 5.5 and 12 name Opus 5.5 (the 12 are the records of reviews and
merges, a few verification fixes, and the CLAUDE.md rule on stacking). A commit that names
Opus 5.5 can therefore contain Sonnet-drafted text that Opus edited, and the other way
round. The full account, prompt by prompt, is [`ai-use-log.md`](./ai-use-log.md). No other
AI tool wrote code or documents; an automated reviewer (Greptile) commented on the peer's
Pull Requests and was read, not used to write anything.

## 2. Selected key prompts

Prompts that changed what got built, or what I believed. Every prompt of the sprint, these
among them, is in [`ai-use-log.md`](./ai-use-log.md) under the same numbers.

| Log # | Prompt | What it changed | Issue |
| --- | --- | --- | --- |
| 2 | "Should we use stacked branches?" | The answer came from measured Lab 3 data (median 10.7 hours from opening to merge; 9 of 12 Pull Requests drew findings), not opinion. Result: work in parallel first, stack only one deep, never on the contract, and the rule went into `CLAUDE.md`. | #70 |
| 3 | "Agreed, rule added. /lab-sprint start Lab 4 ..." | Three grill rounds settled twelve design decisions before a line of specification existed: performer separate from assignee, the Action state machine, the gate, `version` for stale updates, an append-only status history, Bangkok-midnight deltas, the card sets and `/dashboard` as the landing page. | #70 |
| 4 | "Add requestId" and "Add a fourth condition: no Planned Action" | Action creation became idempotent on a client key (a lost response cannot create a duplicate), and the resolution gate gained a fourth condition so that a Planned Action cannot be left planned in front of the Requester after resolution. Both came from reading the reviewed contract against the handout. | #70 |
| 6 | "go" (Issue #73) | The Actions Taken API: every write takes the Ticket row lock first, so "exactly one of two simultaneous completions wins" is true and testable. 125 new tests, each rule broken in turn to see its test fail. | #73 |
| 8 | "do next" (Issue #75) | The resolution gate decided inside the transaction with the Ticket locked, naming every unmet condition at once; the reviewer then found it compared the version only before the lock, which became `STALE_UPDATE` under the lock. | #75 |
| 9 | "do next" (Issue #76) | Dashboard cards computed by the backend and compared with separately written SQL; whole-database comparisons were found to flake when another suite wrote at the same moment, so they repeat. | #76 |
| 10 | "beam merge laa then continue" | The browser suite with a console-error guard. It found a real defect (24 px tall links on mobile), and review then showed the guard accepted every 4xx, so it was rewritten to accept only declared refusals. | #77 |
| 11 | "beam merge laa do next issue and review beam pr 84 and 85" | The hardening Issue found that the Actions Taken migration had no rollback script though the contract promised one, and wrote it with a test that rolls forward, back and forward again. | #78 |

## 3. My reflection

> Deliberately left for the author to write by hand, in their own words, at the end of the sprint.
