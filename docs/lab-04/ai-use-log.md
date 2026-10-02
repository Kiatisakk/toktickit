# Lab 4 AI Use -- Full Prompt Log

The companion to [`ai-use.md`](./ai-use.md), which carries what section 14
Part 4 asks for: the models used, selected prompts, and the reflection.
This file is everything else, and it is here rather than there so the
submitted document stays the length the labsheet means by "concise" while
nothing is thrown away.

A prompt cannot be reconstructed accurately weeks after it was typed, and the
ones that look minor are often the ones that stopped something going wrong.

---

Every prompt of the sprint so far. Kept complete because a prompt cannot be recovered
accurately once the session is over.

| # | Prompt | What it produced |
| --- | --- | --- |
| 1 | `@material/UTF-8_SE+Lab+4.pdf อัน 4 มาแล้ว` | Lab 4 arrived. The AI read the sheet, first checked that Lab 3 was fully released (release PR #69 on `main`), then listed six ambiguities in the handout that had to be settled before any specification could be written. |
| 2 | *"ควรใช้ stacked branches ไหม"*<br>"Should we use stacked branches?" | Answered from measured Lab 3 data rather than opinion: median 10.7 hours from opening to merge, and 9 of 12 Pull Requests drew findings. Conclusion: work in parallel first, stack only one deep, and never on the contract. It became a rule in `CLAUDE.md`. |
| 3 | *"เห็นด้วย เพิ่มกฎแล้ว /lab-sprint start Lab 4 …"*<br>"Agreed, rule added. /lab-sprint start Lab 4 …" | Three grill rounds settled twelve decisions before any specification was written: performed-by separate from the assignee; Action state Planned to Done or Cancelled; a three-condition resolution gate; Requester sees every Action; a follow-up closed by a following Action; any staff edits while Planned; a `version` integer for stale updates; an append-only status-history table; deltas from that history at midnight Asia/Bangkok; the staff cards; the Requester cards; and `/dashboard` as the landing page. The plan was then approved, with Sonnet 5.5 implementing and Opus 5.5 verifying. |
| 4 | *"เพิ่ม requestId"* and *"เพิ่มเงื่อนไขที่ 4: ห้ามมี Planned"*<br>"Add requestId" and "Add a fourth condition: no Planned Action" | Two answers after review of the contract. First, Action creation became idempotent on a client-generated `requestId` (unique per Ticket; a repeat returns the existing Action, a changed payload is `409 REQUEST_ID_CONFLICT`), because handout §8.5 asks for duplicates from network retry to be handled and disabling the button cannot cover a lost response (D-24, AC-48). Second, the resolution gate gained a fourth condition, no Planned Action, because Actions are frozen on a Resolved Ticket and a Planned one would otherwise stay planned forever in front of the Requester (D-03, AC-49). |
