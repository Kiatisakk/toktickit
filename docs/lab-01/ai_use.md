# Lab 1 — AI Use and Reflection

## What I used

**Claude Code** — Anthropic's terminal-based coding agent — running the
**Claude Opus 5** model, rather than Antigravity. §5 of the lab sheet says the
course will "most likely" use Antigravity "subject to the availability of Google
Cloud Platform support", so this is the tool I actually had.

Two **skills** were loaded into the session by the opening command. A skill is a
packaged set of instructions, not a separate agent — everything ran in one
conversation with one model:

| Skill | What it added |
| --- | --- |
| `grilling` | Interview me one decision at a time and wait for each answer, instead of writing code from assumptions |
| `domain-modeling` | Challenge vague terms, and write the resolved vocabulary into `CONTEXT.md` as it is settled |

**No sub-agents were spawned.** Every prompt below is something I typed.

## How the session was shaped

The first command did not ask for code. It asked the agent to read the lab sheet,
verify what it could from my machine, and then interrogate me. It asked **13
questions** and I answered every one before a single file was written. The plan
was written to disk and I approved it before implementation began.

That ordering is the reason most of the prompts below are short. The decisions
had already been made explicit, so later instructions could be one line.

## Selected key prompts

> **TO FILL IN — every `My Reflection` line below is a placeholder.** Replace each
> with what you actually noticed. Be specific: what did the agent get wrong
> first, what did you have to correct, what surprised you.

| # | Prompt Name | Actual Prompt Text |
| --- | --- | --- |
| 1 | **Plan Lab 1 implementation** | `/grill-with-docs ให้ดู labsheet ใน material/UTF-8_Lab1_Labsheet.pdf แล้วก็ดูว่าต้องทำอะไรบ้าง`<br><br>*Read the lab sheet and work out what has to be done.* It found five places where the lab sheet contradicts itself before asking anything — including that §10.1 fixes the health-check response with no database field, while Part 4 shows the screen going Offline when the database stops.<br><br>**My Reflection:** `___` |
| 2 | **Set the scope of delegation** | *(answering "How much of Lab 1 should I take on?")* `ทำทุกอย่างที่ automate ได้ รวม GitHub API` — do everything that can be automated, including driving the GitHub API. This is why the Issues, the Project board, the branches and all the Pull Requests were created from the terminal rather than by hand.<br><br>**My Reflection:** `___` |
| 3 | **Ask for an explanation instead of choosing blind** | `คือยังไงนะอธิบายเพิ่มเติมได้ไหม` — *explain that further.* I did not know what an ADR was, so I refused the question rather than guessing. The agent explained it, showed which decisions passed its own three-part test and which did not, and noted the lab sheet never asks for one.<br><br>**My Reflection:** `___` |
| 4 | **Challenge the branch naming** | `ใช้ main/dev/feature แทน lab1-staging` — *use `main/dev/feature`.* The agent disagreed and showed its evidence: `dev` appears once, in §4; `lab1-staging` appears in §6 twice, §12, the PR-target table on page 11, and the git graph on page 7. I changed my mind.<br><br>**My Reflection:** `___` |
| 5 | **Cut unnecessary scope** | `ไม่เอา ADR ละ` — *drop the ADR.* The reasoning moved into `CONTEXT.md` and a code comment instead of a `docs/adr/` folder the brief never asked for.<br><br>**My Reflection:** `___` |
| 6 | **Enforce the prescribed branch structure** | `merge #5 แล้วก็ rebase #6 ทำตาม branch ที่กำหนด` — *merge #5, then rebase #6 to follow the specified branch structure.* Before this, every feature branch was stacked on the one before it, so each PR's diff carried the earlier work along. Afterwards #6 went from 3 commits to 2, and #7 from 11 to 2.<br><br>**My Reflection:** `___` |
| 7 | **Catch a scope leak in the review** | `เห็นใน comment ที่ตอบกลับ #7 มีการเอ่ยถึง #8 ด้วย` … `มันไม่ควรโดนเอ่ยถึงหรือป่าว อยากให้ edit comment เอาออก` — *the reply on #7 mentions #8 … it should not be mentioned, edit it out.* The agent had answered a review comment by pointing at a Pull Request for an Issue that, under the brief's dependency order, had not started. Six comments were rewritten or deleted.<br><br>**My Reflection:** `___` |
| 8 | **Overrule the agent on a design decision** | *(on the reviewer's ordering comment)* `displayOrder น่าจะแนะนำว่าให้เพิ่ม` — *displayOrder should probably be added.* The agent had argued in public on the PR that the column belonged in Lab 2. It reversed, and said plainly why its own argument had been weak: it was about *when*, never about whether the reviewer was right.<br><br>**My Reflection:** `___` |
| 9 | **Decide where documentation lives** | `docs ที่ทำใน lab1 ควรอยู่ใน lab1-staging ไหม หรือว่าแตก branch จาก main` … `git มันคือ version control ไม่ใช่ที่เก็บไฟล์` — *should Lab 1's docs live in `lab1-staging`, or a branch off `main`? … git is version control, not file storage.* Settled that `tests.md` ships with the code it describes, while the evidence documents are brought up to date on their own branch once the code Issues are finished, and screenshots go in the PDF rather than the repository.<br><br>**My Reflection:** `___` |
| 10 | **Verify rather than assume** | `re-approve แล้ว merge เข้า main ได้เลย` — *re-approved, merge into main.* The agent checked before merging and found the earlier approval sat on a commit from thirteen minutes before the `displayOrder` change, then refused to merge on a stale sign-off and asked the reviewer to look again.<br><br>**My Reflection:** `___` |

## Reflection on improving my prompts

> **TO FILL IN.** A few honest paragraphs. Prompts you might answer — only use the
> ones that are actually true for you:
>
> - Prompt 1 asked for an interrogation, not for code. Was that better or worse
>   than asking for code directly?
> - The agent disagreed with you twice (prompts 4 and 8) and was right once each
>   way. Was being argued with useful, or annoying?
> - Prompt 3 was you refusing to answer a question you did not understand. What
>   would have happened if you had just picked an option?
> - Prompts 6, 7 and 9 are all you noticing process problems the agent had
>   created and not flagged. What pattern does that suggest about what to check?
> - Which parts of the result can you explain to someone else right now, and
>   which would you have to go and read first?

## What I remain responsible for

The agent wrote the code; the decisions are mine. Each of these was put to me
explicitly and could have gone the other way:

| Decision | What I chose | What I gave up |
| --- | --- | --- |
| Integration branch name | `lab1-staging` | `dev`, which §4 also mentions |
| Database | PostgreSQL in Docker on port 5433 | The PostgreSQL 18 already installed locally |
| API-02 | Integration test against a real database | A faster, hermetic test with Prisma mocked |
| System Status | Aggregate of two API calls | A health check that probes the database itself |
| Category ordering | A `displayOrder` column, added in Lab 1 | Sorting on the serial `id` and deferring to Lab 2 |
| Peer review | Four PRs held open for a reviewer | Merging straight through to `main` |

## Mistakes the agent made, and how they were caught

Recorded because a log of only the successes would be dishonest. Details are in
[`reviewer.md`](reviewer.md).

| What went wrong | Caught by |
| --- | --- |
| A commit deleted two `.gitignore` files without adding their replacements — a pathspec typo made `git add` fail as a whole | The agent, after pushing; fixed forward rather than force-pushing a branch under review |
| A review answer pointed at a Pull Request for an Issue that had not started | **Me**, reading the reply |
| A doc comment in `seed.ts` described an endpoint that did not exist in that branch, which is what invited the misplaced review comment | The agent, once I pointed at the symptom |
| Arguing that `displayOrder` could wait, when the argument was about timing rather than correctness | The reviewer raised it; **I** decided against the agent |
