# Lab 2 Figure Audit

§8.8 requires the built screens to be checked against the labsheet illustrations. This file
is that check, written down. It exists because doing it from memory failed: the My Tickets
figure was declared not to exist, on the strength of a page listing rather than the page,
and the screen shipped a review cycle without the Ticket Owner column the figure shows.

Run `python docs/lab-02/figures/extract.py` to put the three images on disk. They are not
committed — the PDF they come from is tracked in `material/`, so committing them would
store the same bytes twice. This audit is the durable half: it says what the figure shows,
in words, so a later reader can check the claim without opening anything.

## The three illustrations

| Page | Caption | Screen | Built in |
| --- | --- | --- | --- |
| 2 | Figure 1 | Ticket Detail | Issue #19, not yet started |
| 9 | *(none)* | Development Requester Selection | Issue #16 |
| 11 | *(none)* | My Tickets | Issue #18 |

Only page 2 carries a numbered caption. The other two are uncaptioned, which is why a
search for "Figure" finds one hit and gives a misleading answer — the check must be for
images, not for captions.

Note the handout's own header reads **TikTockIT** in both uncaptioned figures and
**TokTickIT** in Figure 1. §1 and every other section use TokTickIT, so the product name is
TokTickIT and the figures carry a typo. We do not reproduce it.

---

## Page 11 — My Tickets

**Nine columns, in this order:** Ticket No. · Created Date · Summary · Category · Requested
Priority · IT Priority · Current Status · Ticket Owner · Last Updated.

| Element | Figure | Built | Status |
| --- | --- | --- | --- |
| Page title | "My Tickets" | same | matches |
| Subtitle | "View and track all of your support requests." | same | matches |
| Header actions | Clear Filters (secondary) · Create Ticket (primary) | same | matches |
| Filter bar | On a white surface | on a surface | matches (fixed `5e3a7d6`) |
| Search placeholder | "Search by ticket number or summary…" | same | matches |
| Filters | Category · Requested Priority · IT Priority · Current Status | same four | matches |
| Filter defaults | All Categories · All Priorities · All Priorities · All Statuses | same | matches |
| Table header tint | Pale green | pale green | matches (fixed `5e3a7d6`) |
| Ticket No. | Green link | green link | matches |
| Ticket Owner | Present, populated | present, em dash | matches (added `5e3a7d6`) |
| Badges | Priority and status both as pills | same | matches |
| Range summary | "Showing 1 to 8 of 42 tickets" | same wording | matches |
| Page controls | Numbered buttons, current filled dark green | same | matches (fixed `5e3a7d6`) |
| Sort indicators | On Ticket No., Created Date, Last Updated only | also Summary and Requested Priority | **superset, deliberate** |
| Page size | 8 rows | 10 by default | **differs, deliberate** |
| Status colours | Open blue · Pending amber · In Progress and Resolved green | not yet differentiated | **open** |

**Ticket numbers in the figure:** `TKT-2025-001234` descending to `TKT-2025-001227` — eight
contiguous values against timestamps that descend with them. This is the evidence behind
D-02, and behind the review finding on beambeambeam#22 that a random suffix does not match
the illustrations.

**IT Priority is populated in the figure** (Medium, High, Low). Lab 2 cannot populate it —
§4.2 excludes the staff workflow — so every row shows an em dash. D-04 and D-14 cover this.

**Ticket Owner is populated in the figure** (Michael Brown, Sarah Johnson, David Lee,
Jennifer Anderson). Same reasoning: the column is present and empty rather than absent.

### Deliberate departures

**Page size 10, not 8.** §6.1 fixes the allowed sizes as 10, 20 and 50 in the query
contract; the figure's eight rows are a drawing convenience and are not among them.
Following the picture here would break the written rule.

**Two more sortable columns than the figure marks.** The figure puts sort carets on three
headers. Sorting by Summary and Requested Priority costs nothing and takes nothing away —
the three the figure marks are all sortable.

**The ellipsis.** The figure draws `1 2 3 4 5 … 6`, placing a gap between 5 and 6 with
nothing skipped between them. Read as a drawing artefact rather than a rule: a gap is
rendered only where pages are genuinely missing, because an ellipsis that hides nothing
promises a page that is not there.

**Status badge colours are still open.** The figure gives Open a blue, Pending an amber,
and In Progress and Resolved a green. Lab 2 never moves a ticket past New (§4.2), so no
screen we can build today shows more than one of them — but the mobile card and the table
would both show the wrong colour the moment Lab 3 does. Worth closing in Issue #20 while
the Playwright pass is being written, since that is where a colour is assertable at all.

---

## Page 9 — Development Requester Selection

| Element | Figure | Built | Status |
| --- | --- | --- | --- |
| Breadcrumb | Home icon › Development Requester Selection | "Home" › same label | matches |
| Card | Centred, narrow, on a white surface | same | matches |
| Title | "Select Development Requester" | same | matches |
| Explanation | "…simulate the current requester context for Lab 2. This is for testing only and is not a login screen." | same meaning, our wording | matches |
| Field label | "Development Requester" with a red asterisk | same | matches |
| Hint | "Only active development requesters are shown." | same | matches |
| Lab 3 notice | Shield icon, "Authentication coming in Lab 3" | same, no icon | matches |
| Actions | Cancel (secondary) · Continue (primary) | Continue always; Cancel only when a requester is already selected | **differs, deliberate** |
| Circular avatar icon above the title | Present | absent | **cosmetic gap** |

**Cancel.** The figure shows it unconditionally. With no requester selected there is nowhere
to cancel to — every other route is guarded, so `/` redirects to My Tickets, which redirects
straight back here. §8.1's list of required elements does not include Cancel. A button that
cannot go anywhere is worse than no button, so it appears only in the "change my mind" case.

**The avatar icon.** Decorative, and the only element of the figure not reproduced. Cheap to
add; noted rather than done, because it belongs to Issue #16's screen and that PR is merged.

---

## Page 2 — Figure 1, Ticket Detail

Not built yet. Recorded here before Issue #19 starts, so the screen is built from the figure
rather than compared to it afterwards.

**Layout.** A four-column grid inside one white card, in this order: Ticket No. · Ticket
Date · Category · Related System, then Requester · Requested Priority · IT Priority ·
Current Status, then Ticket Owner · Summary spanning the rest, then Description full width,
then Resolution Summary full width.

**Every field is read-only**, drawn as a filled grey box shaped like an input rather than as
plain text. Category is drawn with a dropdown chevron even though the screen is read-only.

**Values shown:** `TKT-2025-001234` · May 12, 2025 09:14 AM · Hardware · Corporate Laptop ·
Jennifer Anderson · Medium · Medium · In Progress · Michael Brown (IT Support) · "Laptop
battery drains quickly".

**Resolution Summary** is drawn as italic placeholder text: "No resolution summary available
yet." That is the empty state, and D-04 is why the field exists at all in Lab 2.

**Header.** Breadcrumb "My Tickets › Ticket Details" with a "← Back to My Tickets" outlined
button right-aligned on the same row.

**Four tabs below the card:** Public Comments (3) · Attachments (2) · Service Actions (1) ·
Event Log (6), with Public Comments active and a comment thread beneath.

§4.2 excludes Public Comments, Internal Notes and Service Actions from Lab 2, so **three of
the four tabs must not be built**. Attachments is the one in scope. Whether to draw the
other three disabled or omit them is Issue #19's decision, and it is the first thing to
settle there: the figure shows them, and §8.8 makes the figure binding, but §4.2 excludes
the features — the exclusion wins, and the reasoning belongs in a numbered decision rather
than in a commit message.
