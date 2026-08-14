# Lab 1 — AI Use and Reflection

> **`[ WRITE THIS ]` marks what is mine to write — 6 of them.** §13: the agent is
> an assistant, not the owner of the work. It can record what happened; it cannot
> tell me what I learned.

## 1. Which AI I used

**Claude Code** running **Claude Opus 5**, this is the tool I had. One session, one model, **no
sub-agents**. Two skills were loaded by the opening command: `grilling`
(interview me one decision at a time before writing anything) and
`domain-modeling` (challenge vague terms, record them in `CONTEXT.md`).

The first command asked for an interrogation rather than for code. It produced
**13 decisions before a single file was written**, and the plan was written to
disk and approved before implementation began. The decisions that redirected the
work appear below as prompts; the rest are in *Decisions that were mine*, because
they were choices between options I was offered rather than instructions I gave.

## 2. Selected key prompts

| # | Prompt Name | Actual Prompt Text |
| --- | --- | --- |
| 1 | **Plan Lab 1** | `/grill-with-docs ให้ดู labsheet ใน material/UTF-8_Lab1_Labsheet.pdf แล้วก็ดูว่าต้องทำอะไรบ้าง`<br>→ Found five self-contradictions in the lab sheet before asking anything.<br>**My Reflection:** I chose the `grill-with-docs` skill to summarise the lab sheet's requirements and draft a plan, since it outlines the actions and planning steps needed before implementation begins. It turned out to be a useful skill: it gave me a clearer view of the overall shape of the work, and of the constraints on the design. It also saved time — planning properly first was better than implementing and then having to go back and rework it. |
| 2 | **Ask instead of choosing blind** | `คือยังไงนะอธิบายเพิ่มเติมได้ไหม`<br>→ I did not know what an ADR was, so I refused the question. After the explanation I dropped the idea.<br>**My Reflection:** `[ WRITE THIS ]` |
| 3 | **Challenge the branch naming** | `ใช้ main/dev/feature แทน lab1-staging`<br>→ The agent disagreed with evidence: `dev` appears once, `lab1-staging` six times. I changed my mind.<br>**My Reflection:** `[ WRITE THIS ]` |
| 4 | **Enforce the branch structure** | `merge #5 แล้วก็ rebase #6 ทำตาม branch ที่กำหนด`<br>→ Branches had been stacked on each other. #6 went 3 commits → 2, #7 went 11 → 2.<br>**My Reflection:** `[ WRITE THIS ]` |
| 5 | **Overrule the agent** | `displayOrder น่าจะแนะนำว่าให้เพิ่ม`<br>→ The agent had argued on the PR that the column belonged in Lab 2. It reversed and said why its own argument was weak. A schema change, a migration and a new test followed.<br>**My Reflection:** `[ WRITE THIS ]` |
| 6 | **Check the source material** | `ใน material บอกไหมว่าใครต้องกด`<br>→ Revealed the agent had planned the whole lab from two of the three handouts, never opening the Git cheat sheet.<br>**My Reflection:** `[ WRITE THIS ]` |

## 3. My reflection on improving the prompts

`[ WRITE THIS ]`

> Worth answering: the agent argued back at prompts 3 and 5 and was right once
> each way — useful or annoying? Prompts 4 and 6 are both me catching something
> it had done, or failed to do, without flagging. And of the four decisions I
> flagged in my own Pull Requests as "look here", my reviewer commented on none
> of them.

## Extra — Decisions that were mine, not the AI's

*Not asked for by Part 3. Included because §13 says judgment and responsibility
cannot be delegated, and this is the evidence.*

| Decision | What I chose | What I gave up |
| --- | --- | --- |
| Integration branch | `lab1-staging` | `dev`, which §4 also mentions |
| Database | PostgreSQL in Docker, port 5433 | The PostgreSQL 18 already installed |
| API-02 | Integration test against a real database | A hermetic test with Prisma mocked |
| System Status | Aggregate of two API calls | A health check that probes the database |
| Category ordering | A `displayOrder` column, in Lab 1 | Sorting on the serial `id` |
| Release into `main` | Undone, to be reopened with an approval | Leaving an unreviewed merge standing |
| Documentation | Finished on its own reviewed branch | Committing straight to a protected branch |
| `submission.md` | Deleted — not in §8 or the checklist | Tracking screenshots and URLs in git |

## Extra — Where the AI was wrong, and who found it

*Not asked for by Part 3. Included because a log of only the successes would
imply I trusted it blindly. **I caught three of the six.***

| What went wrong | Caught by |
| --- | --- |
| Planned the whole lab from two of the three handouts | **Me**, days later |
| A commit deleted two `.gitignore` files without their replacements | The agent, after pushing |
| A review answer pointed at an Issue that had not started | **Me** |
| A comment in `seed.ts` described an endpoint absent from that branch | The agent, once I pointed at the symptom |
| Argued `displayOrder` could wait — about timing, not correctness | The reviewer raised it; **I** overruled |
| Advised keeping merged branches; the cheat sheet says delete them | **Me**, once it was finally read |
