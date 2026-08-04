# Lab 1 — AI Use and Reflection

## Which agent I used

I used **Claude Code** (Anthropic's terminal-based coding agent) with the
**Claude Opus 5** model, rather than Antigravity. §5 of the lab sheet says the
course will "most likely" use Antigravity "subject to the availability of Google
Cloud Platform support", so this is the tool I actually had.

The work ran through a `grill-with-docs` workflow: instead of asking the agent
to write code straight away, I had it read the lab sheet, look up everything it
could verify from my machine, and then interview me one decision at a time. It
asked 13 questions and I answered each one before any code was written.

## Selected key prompts

> **TO FILL IN — the `My Reflection` lines below are placeholders.** Replace each
> one with what you actually noticed. Be specific: what did the agent get wrong
> first, what did you have to correct, what surprised you.

| Prompt Name | Actual Prompt Text |
| --- | --- |
| **Plan Lab 1 Implementation** | `/grill-with-docs ให้ดู labsheet ใน material/UTF-8_Lab1_Labsheet.pdf แล้วก็ดูว่าต้องทำอะไรบ้าง`<br><br>**My Reflection:** `___` |
| **Set the scope of delegation** | *(answering "How much of Lab 1 should I take on?")* "ทำทุกอย่างที่ automate ได้ รวม GitHub API" — do everything that can be automated, including driving the GitHub API.<br><br>**My Reflection:** `___` |
| **Choose the database setup** | *(answering "How should the database be set up?")* "เปิด Docker แล้วใช้ container" — start Docker and use a container, rather than the PostgreSQL 18 already installed on my machine.<br><br>**My Reflection:** `___` |
| **Resolve a contradiction in the brief** | *(answering "What does System Status actually mean?")* "Online ก็ต่อเมื่อสำเร็จทั้ง 2 call" — Online only when both calls succeed, keeping `/api/health` free of any database probe.<br><br>**My Reflection:** `___` |
| **Ask for an explanation instead of an answer** | "คือยังไงนะอธิบายเพิ่มเติมได้ไหม" — explain that further. I did not know what an ADR was, so I asked before answering rather than guessing.<br><br>**My Reflection:** `___` |
| **Correct the branch naming** | "ใช้ main/dev/feature แทน lab1-staging" — use `main/dev/feature`. The agent pushed back with where each name appears in the brief (`dev` once in §4, `lab1-staging` five times including the PR-target table), and I changed my mind.<br><br>**My Reflection:** `___` |
| **Cut unnecessary scope** | "ไม่เอา ADR ละ" — drop the ADR. The reasoning moved into `CONTEXT.md` and a code comment instead of a separate `docs/adr/` folder the brief never asked for.<br><br>**My Reflection:** `___` |
| **Approve the plan before any code** | *(approving the written plan file)* Nothing was implemented until the whole plan — branch strategy, test layout, decisions, verification steps — was written down and I had read it.<br><br>**My Reflection:** `___` |

## Reflection on improving my prompts

> **TO FILL IN.** A few honest paragraphs. Some things you might have noticed
> and could write about — only use the ones that are actually true for you:
>
> - The first prompt did not ask for code. It asked the agent to read the brief
>   and interrogate me. Was that better or worse than asking for code directly?
> - The agent found five places where the lab sheet contradicts itself. Would
>   you have caught those by reading it yourself?
> - When you said "use `main/dev/feature`", the agent disagreed and showed its
>   evidence rather than just complying. Was that useful or annoying?
> - You asked "what is an ADR?" mid-flow instead of picking an option blind.
>   What would have happened if you had just picked one?
> - Which parts of the result can you actually explain to someone else, and
>   which parts would you have to go and read first?

## What I remain responsible for

The agent wrote the code, but the specifications, the decisions and the
verification are mine. In particular I own these choices, each of which I was
asked about explicitly and each of which could have gone the other way:

| Decision | What I chose | What I gave up |
| --- | --- | --- |
| Integration branch name | `lab1-staging` | `dev`, which §4 also mentions |
| Database | PostgreSQL in Docker on port 5433 | The PostgreSQL 18 already installed locally |
| API-02 | Integration test against a real database | A faster, hermetic test with Prisma mocked |
| System Status | Aggregate of two API calls | A health check that probes the database itself |
| Peer review | Four Pull Requests left open for a reviewer | Merging straight through to `main` |
