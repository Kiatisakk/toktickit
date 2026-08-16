# Lab 1 — AI Use and Reflection

> **Every reflection below is mine.** §13: the agent is an assistant, not the
> owner of the work — it can record what happened, but it cannot tell me what I
> learned.

## 1. Which AI I used

**Claude Code** running **Claude Opus 5**, this is the tool I had. One session, one model, **no
sub-agents**. Two skills were loaded by the opening command: `grilling`
(interview me one decision at a time before writing anything) and
`domain-modeling` (challenge vague terms, record them in `CONTEXT.md`).

The first command asked for an interrogation rather than for code. It produced
**13 decisions before a single file was written**, and the plan was written to
disk and approved before implementation began. The decisions that redirected the
work appear below as prompts. The rest were choices between options the agent put
to me rather than instructions I composed, so they are not listed here.

## 2. Selected key prompts

| # | Prompt Name | Actual Prompt Text |
| --- | --- | --- |
| 1 | **Plan Lab 1** | `/grill-with-docs ให้ดู labsheet ใน material/UTF-8_Lab1_Labsheet.pdf แล้วก็ดูว่าต้องทำอะไรบ้าง`<br>→ Found five self-contradictions in the lab sheet before asking anything.<br>**My Reflection:** I chose the `grill-with-docs` skill to summarise the lab sheet's requirements and draft a plan, since it outlines the actions and planning steps needed before implementation begins. It turned out to be a useful skill: it gave me a clearer view of the overall shape of the work, and of the constraints on the design. It also saved time — planning properly first was better than implementing and then having to go back and rework it. |
| 2 | **Ask instead of choosing blind** | `คือยังไงนะอธิบายเพิ่มเติมได้ไหม`<br>→ I did not know what an ADR was, so I refused the question. After the explanation I dropped the idea.<br>**My Reflection:** Sometimes the AI introduces new techniques that would improve the quality of my work, but there are times when I do not fully understand what it is suggesting. Being able to ask it to elaborate — while keeping the original context — helps me gain a better understanding before making any decision. |
| 3 | **Challenge the branch naming** | `ใช้ main/dev/feature แทน lab1-staging`<br>→ The agent disagreed with evidence: `dev` appears once, `lab1-staging` six times. I changed my mind.<br>**My Reflection:** I used this prompt to debate the AI when I wanted to deviate from the established plan — largely because I had misunderstood the requirements. The AI stepped in to enforce the specific instructions outlined in the lab, preventing me from going down the wrong path. It is reassuring to have the AI there to guide me and make sure I stick to the necessary instructions. |
| 4 | **Enforce the branch structure** | `merge #5 แล้วก็ rebase #6 ทำตาม branch ที่กำหนด`<br>→ Branches had been stacked on each other. #6 went 3 commits → 2, #7 went 11 → 2.<br>**My Reflection:** This was a huge help. The branches had ended up stacked on one another, and I asked the AI to restructure them — otherwise I would have had to start all over. It was a complex issue that would definitely have taken me a day or two to resolve on my own, yet the AI managed to fix it correctly in under 30 minutes. |
| 5 | **Overrule the agent** | `displayOrder น่าจะแนะนำว่าให้เพิ่ม`<br>→ The agent had argued on the PR that the column belonged in Lab 2. It reversed and said why its own argument was weak. A schema change, a migration and a new test followed.<br>**My Reflection:** This prompt came about after the reviewer suggested adding this feature. I agreed it was a good idea; while the AI suggested it could be added later, I felt there was no harm in including it right away, so I decided to go ahead and add it immediately. |
| 6 | **Check the source material** | `ใน material บอกไหมว่าใครต้องกด`<br>→ Revealed the agent had planned the whole lab from two of the three handouts, never opening the Git cheat sheet.<br>**My Reflection:** There was a discussion in the Facebook group about merging Pull Requests — specifically that the reviewer is supposed to perform the merge. Since I had already completed the work but merged it myself, I wanted to check whether that requirement was actually specified in the course materials. Using the AI to verify it saved me a significant amount of time that would otherwise have gone on digging through the documentation. |

## 3. My reflection on improving the prompts

I still struggle with how I give the AI context when troubleshooting. It frequently
has to read through files to find what it needs, which spends tokens
unnecessarily, and prompting in Thai consumes more tokens than English does. This
should improve as I get a better understanding of the project's scope and detail,
and can point it at the right place from the start.
