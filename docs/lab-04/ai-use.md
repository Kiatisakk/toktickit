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

Prompts that changed what got built, or how the work was run. Every prompt of the sprint,
these among them, is in [`ai-use-log.md`](./ai-use-log.md): plain numbers are my prompts,
and **S-** numbers are prompts the Opus 5.5 session wrote to a Sonnet 5.5 sub-agent, quoted
in full in the log's *Sub-agent prompts* section.

| # | Prompt | What it changed | Issue |
| --- | --- | --- | --- |
| [2](./ai-use-log.md) | "Should we use stacked branches?" | The answer came from measured Lab 3 data (median 10.7 hours from opening to merge; 9 of 12 Pull Requests drew findings), not opinion. Result: work in parallel first, stack only one deep, never on the contract, and the rule went into `CLAUDE.md`. | #70 |
| [3](./ai-use-log.md) | "Agreed, rule added. /lab-sprint start Lab 4 ..." | Three grill rounds settled twelve design decisions before a line of specification existed: performer separate from assignee, the Action state machine, the gate, `version` for stale updates, an append-only status history, Bangkok-midnight deltas, the card sets and `/dashboard` as the landing page. | #70 |
| [4](./ai-use-log.md) | "Add requestId" and "Add a fourth condition: no Planned Action" | Action creation became idempotent on a client key (a lost response cannot create a duplicate), and the resolution gate gained a fourth condition so that a Planned Action cannot be left planned in front of the Requester after resolution. Both came from reading the reviewed contract against the handout. | #70 |
| [S-10 to S-12](./ai-use-log.md#s-10) | Three sub-agent prompts sent within 16 seconds after my "do next": *"Implement GitHub Issue #74 / #75 / #76 … Branch … from `origin/lab4-staging` … Migration timestamp if you need one: …"*, all pointing at one shared brief | Three independent Issues built at the same time, each in its own worktree and branch, with a different migration timestamp given to each so they could not collide. Pull Requests #82, #83 and #84 opened within 16 minutes of each other, 48 to 64 minutes after the prompt. None had to be stacked. | #74, #75, #76 |
| [S-22](./ai-use-log.md#s-22) | *"You review classmate @beambeambeam's Pull Request …/pull/84 … DRAFT ONLY — do not post anything to GitHub"* | The sub-agent drafted an approval. Checking its strongest finding before posting showed the peer's success message and keyboard focus disappeared after Complete or Cancel, against his own UI spec, so the review went out as Request changes instead. Every sub-agent review was a draft that Opus checked first. | peer's #76 |
| [S-25](./ai-use-log.md#s-25) | *"Heads-up from the main session: another agent ran `taskkill /F /IM node.exe` … rerun it before trusting its result … Don't kill anything yourself to recover"* | A review sub-agent had killed every Node process on the machine, which could have cut short the hardening agent's test runs. That agent was told to rerun any run that ended oddly, and every later sub-agent prompt (S-26 to S-32) carries a rule never to kill processes by image name. | #78 |
| [S-29](./ai-use-log.md#s-29) | *"You review classmate @beambeambeam's Pull Request …/pull/87 … DRAFT ONLY"* | Found a 🔴 in the peer's tests: a static import bound Prisma to the developer's database before the fixture switched it, so the fixture's clean-up deleted real rows. He fixed it with a dynamic import, then added a guard that fails fixture setup if Prisma is on the wrong database. | peer's #79 |

## 3. My reflection

In this lab, I tried to build a workflow that lets the AI split the implementation work across pull requests and automate it faster. I did this by adapting the idea of stacked branches, or stacked PRs, so that it would not break the workflow rules of the TokTickIT lab. Splitting the work into Issues that did not depend on each other is what let the sub-agents implement several of them in parallel. The main idea was to have a smaller, cheaper sub-agent do the implementation, while a larger model acts as the orchestrator and checks the work. This process reduced the time spent on implementation.
