# Lab 2 UI Specification — Zen Green

Presentation rules for TokTickIT. §7 of the handout says Lab 2 establishes these and later
labs reuse them rather than inventing a new visual system per screen, so this document is
written to be extended, not replaced.

Companion to [`specification.md`](./specification.md) and [`api-spec.md`](./api-spec.md).

---

## 1. Colour tokens

Defined once as CSS custom properties on `:root`. No component hard-codes a colour.

| Token | Value | Used for |
| --- | --- | --- |
| `--tkt-green` | `#006B3C` | Application header, primary buttons, strong emphasis |
| `--tkt-green-accent` | `#0B7A46` | Active tab, focus ring, links, hover |
| `--tkt-green-pale` | `#EAF6EF` | Selected rows, success backgrounds, subtle section emphasis |
| `--tkt-page` | `#F5F7F6` | Page background |
| `--tkt-surface` | `#FFFFFF` | Cards and panels |
| `--tkt-border` | `#DDE3E0` | Surface borders, input borders |
| `--tkt-text` | `#1F2A24` | Body text — charcoal-green, never pure black |
| `--tkt-text-muted` | `#5B6B62` | Helper text, placeholders, metadata |
| `--tkt-readonly` | `#EEF1EF` | Read-only and system-generated field backgrounds |
| `--tkt-hover` | `#E8ECEA` | Hover fill for rows and list items |
| `--tkt-error` | `#A4262C` | Validation text and invalid borders |
| `--tkt-warning` | `#B4690E` | Warning callouts and badges — never decoration |
| `--tkt-success` | `#0B7A46` | Success confirmation, paired with an icon and text |
| `--tkt-info` | `#1B5E9E` | Open status — a state that is neither good, bad nor waiting |
| `--tkt-info-pale` | `#EAF1F8` | Background for the above |

Bootstrap's own variables are remapped onto these (`--bs-primary`, `--bs-body-bg`,
`--bs-body-color`, `--bs-border-color`) so framework components inherit the palette
without being restyled individually.

`--tkt-hover` was added in review of PR #27. The palette had no hover fill, so the pale
green was borrowed for one — and the pale green means *selected*. A row that looks selected
whenever the pointer crosses it has spent that meaning on nothing. Controls that are
themselves interactive, such as the page buttons, take `--tkt-green-accent` on hover as the
table above says; the neutral fill is for rows and list items, which are not.

**Contrast.** Body text on surface and on page background both exceed 7:1. Every state
signalled by colour also carries an icon or a word, so nothing depends on colour alone.

---

## 2. Typography and spacing

| Role | Size | Weight |
| --- | --- | --- |
| Page title | 1.75rem | 600 |
| Section heading | 1.25rem | 600 |
| Field label | 0.875rem | 600 |
| Body and input text | 1rem | 400 |
| Helper, metadata, validation | 0.8125rem | 400 |

Spacing is a 4 px scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Field vertical rhythm is 8 px
between label and control and 4 px between control and its message. Cards use 24 px
padding on desktop and 16 px below 768 px.

---

## 3. Component states

Semantic classes are our own, not Bootstrap utilities, because §8.8 requires automated
assertions against required CSS classes and a utility soup is neither stable nor readable.

### Fields

| State | Class | Presentation |
| --- | --- | --- |
| Editable | `tkt-field` | White background, `--tkt-border` border |
| Focused | `tkt-field:focus` | 2 px `--tkt-green-accent` ring, always visible |
| Invalid | `tkt-field--invalid` | `--tkt-error` border, message directly beneath |
| Read-only | `tkt-field--readonly` | `--tkt-readonly` background, no focus ring, not editable |
| Disabled | `tkt-field--disabled` | Muted text, `not-allowed` cursor, cannot be activated |

All single-line inputs share one height (40 px). The description textarea is taller and
resizable vertically only, so resizing cannot break the layout.

### Required marker and validation message

Required fields render `<span class="tkt-required" aria-hidden="true">*</span>` after the
label text, in `--tkt-error`. The asterisk never replaces the message: the accessible name
carries `required`, and any violation produces text beneath the control.

Validation messages use `tkt-field-error`, are tied to their control by
`aria-describedby`, and appear beside the field they concern. There is no single error
summary at the top of the form (§8.3).

### Buttons

| Variant | Class | Use |
| --- | --- | --- |
| Primary | `tkt-btn tkt-btn--primary` | One per screen — the main action |
| Secondary | `tkt-btn tkt-btn--secondary` | Cancel, Back, Clear filters |
| Destructive | `tkt-btn tkt-btn--danger` | Remove attachment |
| Busy | `tkt-btn--busy` | Spinner plus changed label; `aria-busy="true"`; disabled |
| Disabled | `[disabled]` | Visually distinct, not activatable |

Every button carries visible text. Icons may accompany text but never replace it, and any
icon-only control carries both an accessible name and a tooltip.

### Badges

Pills carry a `1px` outline in `currentColor`, so each variant gets its own edge
without a rule of its own to maintain. Two pale fills in adjacent columns read as one
smear; an edge makes the row scannable.

**Priority is filled, status is outlined**, and each status has its own colour: grey for
untouched (New), blue for live (Open), green for being worked (In Progress) and for done
(Resolved), amber for waiting on someone (Pending), flat grey for inert (Closed).

The two treatments exist because the columns sit two apart and previously shared a palette.
`Open`, `In Progress` and `Pending` were one amber between them — three quarters of the
lifecycle looking identical — and that amber was also priority `Medium`. A reader scanning
a row met the same chip twice and had to read both to learn they meant unrelated things.
The word is still what carries the meaning; the colour never stands alone.

`tkt-badge` plus a modifier. Every badge pairs its colour with the word, so meaning
survives without colour.

| Kind | Modifiers |
| --- | --- |
| Requested / IT priority | `tkt-badge--low` `tkt-badge--medium` `tkt-badge--high` |
| Current status | `tkt-badge--new` `tkt-badge--open` `tkt-badge--in-progress` `tkt-badge--pending` `tkt-badge--resolved` `tkt-badge--closed` |
| Attachment | `tkt-badge--active` `tkt-badge--removed` |

An unset IT priority renders as `—` with the accessible text "not set", not as an empty
cell.

### Icons

Bootstrap Icons, the set the illustrations were drawn from. A hand-cut path is recognisably
not the same icon, which is worse than no icon.

Sized at `0.85em`, not `1em`: an icon glyph fills its em box while a letter uses about seven
tenths of one, so matching the numbers makes the icon visibly larger than the word beside
it.

§8.3 keeps them decorative — every one is `aria-hidden`, and the label beside it carries the
meaning. The test that matters is not that an icon renders, but that deleting every icon on
the page would leave every control still saying what it does.

Our names map to Bootstrap's in one file, so the set can be replaced without touching a call
site.

A mark inside a control — the magnifier in the search box — is wrapped around the input
itself (`.tkt-control-icon`), not floated over the field group. Against the group it has to
be positioned from the bottom edge, and that guess is wrong the moment a hint or a validation
message appears beneath, or the control height changes at the mobile breakpoint.

### State blocks

One component, `tkt-state`, covers loading, empty, no-results and error. Each has an icon,
a heading, one line of explanation, and — for empty and error — an action.

### Ticket list

`TicketTable` renders a table at 768px and above and a card per ticket below it. Both
carry the same values: §8.7 allows the two presentations to look different, but a column
dropped on a phone is information the reader cannot reach at all, since there is no wider
view to switch to.

Named for tickets rather than as a generic data table. It has exactly one caller, and a
column-definition API written for one consumer is a guess about the second.

Sortable headers are buttons carrying `aria-sort`, so the current sort is announced rather
than only drawn as an arrow.

Both presentations are surfaces — `--tkt-surface` on `--tkt-border`, rounded and carrying
`--tkt-shadow`, the same treatment `.tkt-card` and the state blocks already use. A bare
table inherits `--tkt-page` behind it and reads as loose text lying on the background
rather than as one object with an edge, which is what every other block on the screen has.

The header row is tinted `--tkt-page` rather than `--tkt-green-pale`: §7 reserves the pale
green for selected and success, and a permanently green header would spend that meaning on
a row that is neither.

The corner radius is applied to the corner cells rather than by clipping the table with
`overflow: hidden`. A table is not a reliable overflow container, and clipping it would cut
the focus ring off the sort buttons in the top row.

Header labels wrap rather than carrying `white-space: nowrap`. Eight unbreakable headings
would push the table past `--tkt-content-max` and produce the horizontal scroll §8.7
forbids.

### The list surface

The table and the page controls are one object, `.tkt-list`: a single surface with the
controls as its footer above a divider, as the illustration draws them. As two boxes the
controls read as a separate widget that happens to sit underneath.

Rows alternate with `--tkt-page`, kept lighter than `--tkt-hover` so that pointing at a
striped row still says something.

The header row is `--tkt-green` on `--tkt-green-pale`, at `--tkt-font-body` rather than the
smaller label size, and carries more vertical padding than the rows beneath it. Muted grey
at label size made the header the quietest thing on a screen whose columns are what a reader
navigates by — set smaller than the data it introduces, which is backwards. Body size puts
it level with the ticket numbers underneath.

Ticket numbers are `--tkt-green-accent` and semibold, stated in our own rule rather than
inherited from Bootstrap's link colour: a framework default is not a decision, and §7 fixes
this green. The mobile card carries the same link and the same treatment.

Every cell is one line except Summary, which is capped at `24rem` and wraps: it is the only
column carrying a sentence rather than a value, and left on one line a long summary drags
the whole table sideways. Everything else stays on its line so the column can be scanned.

Below 768 px the cards carry a surface each, so `.tkt-list` gives up its own — a box inside
a box, with the inner one doing the work — and the page controls take the surface instead.

### Pagination

`Pagination` shows a range summary — "Showing 1 to 10 of 42 tickets" — alongside Previous,
the current position, and Next. The summary is the only thing on the screen that tells a
reader the list continues beyond what they can see, and the page 11 figure carries the
same line — "Showing 1 to 8 of 42 tickets".

It renders nothing when everything fits on one page. Controls that can only be pressed to
arrive where you already are are noise.

---

## 4. Application shell

`tkt-shell` contains a `--tkt-green` header with the TokTickIT identity on the left, My
Tickets and Create Ticket in the centre, and the current Development Requester on the
right with a Change Requester action.

The active navigation item carries `tkt-nav-link--active`, an underline in
`--tkt-green-accent`, and `aria-current="page"`. Below the header sits a breadcrumb
(`tkt-breadcrumb`) — for example *My Tickets › Ticket Details*.

Below 768 px the navigation collapses behind a labelled toggle. The current Requester name
stays visible in the collapsed header, because knowing whose data is on screen is the one
thing this shell exists to communicate.

---

### Breadcrumb

Crumbs on the left, an optional control on the right, on one baseline. Figure 1 puts *Back
to My Tickets* there rather than above the card, and the row is otherwise nearly empty.

A crumb may be an icon instead of a word — the Requester Selection illustration draws its
first crumb as a house and no text at all. The label is kept as the accessible name, because
§8.3 does not let an icon replace text; it only lets it stand in front of one.

The right-hand slot is unused on every screen at present: Ticket Detail keeps its back
control beside its heading instead (§5.4). The slot stays because it is where Figure 1 puts
that control, and the next screen that wants one should not have to invent the row again.

---

## 5. Screens

### 5.1 Development Requester Selection

A centred card on the page background. Contains: the TokTickIT title; a short explanation
that this selects a test context and **is not a login screen**; a labelled dropdown of
active Requesters; an informational note that only active Requesters are listed; a note
that Lab 3 replaces this with real authentication; and Cancel and Continue actions.

| State | Presentation |
| --- | --- |
| Loading | `tkt-state` spinner in place of the dropdown; Continue disabled |
| Loaded | Dropdown populated; Continue disabled until a choice is made |
| Empty | "No active Development Requesters" with guidance to run the seed |
| Failure | Safe error text plus a Retry action; no technical detail |

Fully keyboard operable: the dropdown is a native `<select>`, and Continue is reachable by
tab with a visible focus ring.

### 5.2 Create Ticket

Ticket fields four across, as Figure 1 lays them out. §8.2 leaves the arrangement to us and
offers that figure as the example, and §8.8 makes the illustrations binding.

Row one is system-generated and read-only: Ticket No. · Ticket Date · Requester · Current
Status. Row two is classification: Category · Related System · Requested Priority · IT
Priority, the last read-only. Then Summary and Description at full width, then attachments,
then the actions — the order §8.2 gives as its example arrangement.

Current Status and IT Priority are present because the figure has them and because both are
already answered: BR-02 fixes a new ticket at New, and §4.2 says nobody triages in Lab 2, so
the fields read *New* and *Set by IT after triage*. Omitting them would hide settled answers
rather than withhold undecided ones, which is D-04's reasoning applied to a screen.

Read-only controls take `--tkt-readonly` and muted text, so a value the form supplies is
never mistaken for one the requester is expected to type.

**Attachments** (Issue #40, FR-17). A picker sits inside the same card as the rest of the
form, after Description and before Cancel/Create Ticket, rather than opening a card of its
own as Ticket Detail's does — §5.2 reads Create Ticket as one flowing screen, and a card
nested in a card doubles the border and padding on every edge. It reaches only two of §6's
five row states, because the other three all describe a row with a server-side identity and
nothing here has one until the ticket does:

| State | Reachable here? | Why |
| --- | --- | --- |
| Uploading | Yes, during submit | Each queued file is sent once the ticket has an id |
| Invalid | Yes, before submit | Client-side validation, mirroring `server/src/attachments/rules.ts` |
| Active | No | No attachment has a server id until after the ticket is created |
| Removed | No | Nothing to remove before anything exists |
| Unavailable | No | Nothing has been downloaded yet |

A chosen file that passes validation is held on screen as a *queued* row — filename, type,
size, and a Remove control — rather than uploaded immediately: `POST /api/tickets` stays
JSON-only (`api-spec.md` §3), so there is no ticket id for
`POST /api/tickets/:id/attachments` to target until the ticket itself has been created. One
that fails validation becomes an Invalid row immediately, naming the file and the reason,
and is never sent. Submitting the form creates the ticket first, then uploads each queued
file in turn through the same endpoint and the same `uploadAttachment` call Ticket Detail
uses.

If the ticket is created but one or more attachments then fail to upload, the success screen
names which files did not attach and why, and still offers View Ticket as the way to retry
them there — see D-17 in `specification.md` for the reasoning.

### 5.3 My Tickets

Page title and subtitle, then a filter bar — search box, Category, Requested Priority, IT
Priority, Current Status — with Clear Filters and Create Ticket to the right. Then the
list. Then pagination with a range summary.

Desktop columns: Ticket No. · Created Date · Summary · Category · Requested Priority · IT
Priority · Current Status · Ticket Owner · Last Updated. Sortable headers carry a sort indicator and
`aria-sort`.

These nine are the nine the page 11 illustration shows, in its order. §8.4 leaves the
arrangement to us and page 11 asks us to "decide and justify the final columns or card
fields" from five examples that are "not a complete mandatory column list" — but the same
page carries a picture of the finished table, and §8.8 makes the illustrations binding. The
five named examples are a subset of the nine. D-14 in specification.md records the
reasoning per column.

Below 768 px the table becomes cards (`tkt-ticket-card`): ticket number and status on the
first line, summary on the second, then category and priority, then the date. Every value
present on desktop is present on the card — the layout changes, the information does not.

| State | Presentation |
| --- | --- |
| Loading | Skeleton rows, filter bar interactive |
| Populated | Rows or cards, pagination showing the range and total |
| Empty | "You have not created any tickets yet" plus a Create Ticket action |
| No results | "No tickets match your filters" plus Clear Filters |
| Failure | Safe error plus Retry |

Empty and no-results are deliberately different components with different text and
different actions (BR-35).

### 5.4 Requester Ticket Detail

The ticket number as an `h1` over the summary, with *Back to My Tickets* beside it.

**This is a departure from Figure 1**, which gives the screen no heading at all and puts the
back control on the breadcrumb row. Both arrangements were built; this one was kept. The
figure's version is tidier and the repetition is real — the number and the summary are both
fields in the card immediately beneath — but a page whose first line names what you are
looking at is easier to arrive at than one that opens straight into a grid of labels, and
the cost is one line. §8.5 leaves the arrangement to us in as many words: "students must
determine the exact field grouping, responsive arrangement, attachment presentation, and
navigation".

Header block of read-only fields laid out as the approved illustration does: Ticket No.,
Ticket Date, Category, Related System on the first row; Requester, Requested Priority, IT
Priority, Current Status on the second; Ticket Owner and Summary on the third; then
Description; then Resolution Summary.

Requested Priority, IT Priority and Current Status render a badge inside a read-only box
rather than as bare pills. They had the height of a field and none of its frame, so three
cells in a row of eight appeared to have lost their boxes; the illustration draws the pill
inside the grey field. `.tkt-readonly-badge` restates `.tkt-field--readonly`'s surface
because a badge is not an input and cannot inherit it.

IT Priority, Ticket Owner and Resolution Summary are unset in Lab 2 and render as
placeholders — Resolution Summary as italic muted text reading *No resolution summary
available yet*, matching the illustration. They are present and empty, not absent (D-04).

Below that, the attachment section only. No comment box, no internal notes, no service
actions, no event log, and no control that could change a status.

---

## 6. Attachment section

| State | Class | Presentation |
| --- | --- | --- |
| Active | `tkt-attachment--active` | Filename, type, size, upload time, Download and Remove |
| Uploading | `tkt-attachment--uploading` | Progress indication; Remove hidden |
| Invalid | `tkt-attachment--invalid` | Filename with the reason it was rejected |
| Removed | `tkt-attachment--removed` | Metadata dimmed, `Removed` badge, removal reason and time, **no Download** |
| Unavailable | `tkt-attachment--error` | Metadata with a retry-able error |

The add control states the rules before a file is chosen: *JPG, PNG, WEBP or PDF · up to 5
MB · up to 5 files*. It disables itself at five active attachments and explains why.

Removal opens a confirmation asking for a reason, with the 3–500 character rule stated and
the confirm action disabled until it is satisfied.

Filenames wrap rather than truncate. §8.7 forbids unreadable attachment names at any
viewport, and an ellipsis in the middle of a filename is unreadable.

---

## 7. Responsive rules

| Viewport | Behaviour |
| --- | --- |
| ≥ 992 px | Multi-column layout, content centred with a sensible maximum width |
| 768–991 px | Two columns where practical; Summary and Description keep full width |
| < 768 px | Everything stacks; touch targets at least 44 px; table becomes cards |

The 44 px rule is enforced by raising `--tkt-control-height` to `--tkt-touch-target`
(2.75 rem) inside the mobile breakpoint, so every control sized from the token grows at
once. Each rule remembering separately is how the page buttons came to be 36 px while this
table said 44.

Between 768 px and 991 px the table is still the presentation, and nine columns of real
data are wider than the viewport — the band where this rule bites. The rule itself is
unconditional: `.tkt-table-scroll` carries `overflow-x: auto` at every size, which only
takes effect where the table is wider than its box. Below 768 px the table gives way to
cards, and at desktop widths it fits, so in practice the scrolling happens here. The table
scrolls inside that container rather than
widening the page: §8.7 forbids the *page* scrolling sideways, not a table. That container
is focusable and labelled, because a scrollable box that cannot be focused hides its far
columns from anyone not using a pointer.
| All sizes | No horizontal page scrolling, no clipped labels, no overlapping messages, no hidden buttons, no unreadable attachment names |

Wide content that genuinely cannot shrink scrolls inside its own container. The page body
never does.

---

## 8. Accessibility

- Every control has a programmatic label; placeholders are never used as labels.
- Focus is always visible, and focus order follows reading order.
- Icon-only controls carry an accessible name and a tooltip.
- Validation messages are tied to their control with `aria-describedby`; the first invalid
  control receives focus on a failed submit.
- Loading and success announcements use a polite live region.
- No state is signalled by colour alone — priority, status, error, warning and success all
  carry text.
- Heading order is sequential, one `h1` per screen.

---

## 9. Visual inspection checklist

Run at all three viewports, for each of Create Ticket, My Tickets, and Ticket Detail.
Results are recorded in [`tests.md`](./tests.md).

### Checked against the illustrations

§8.8 asks for two things here, and only one of them is a list of tick boxes. The other is a
"comparison against ui-spec.md and the approved illustrations for Create Ticket, My Tickets,
and Ticket Detail **rather than personal memory**". This subsection is that comparison, and
the phrase is in the handout for a reason — done from memory it failed twice on one screen,
which is how My Tickets reached review without the Ticket Owner column the illustration
shows.

**Where the illustrations are.** Three images in a 22-page PDF: Ticket Detail (Figure 1,
page 2), Development Requester Selection (page 9), My Tickets (page 11). Only the first is
captioned, so searching the document for "Figure" returns a single hit and reads like a
complete answer. The reliable question is which pages carry images.

**The handout names three screens to compare and supplies pictures for two of them.** There
is no Create Ticket illustration, and Requester Selection — the one screen that does have a
picture — is not among the three §8.8 lists. §8.2 offers Figure 1 as "an example of the
Ticket UI screen", which makes it the nearest reference Create Ticket has: usable for field
grouping and control styling, not for layout, since one screen is read-only and the other is
a form.

**My Tickets** matches the page 11 illustration on every element — nine columns in its
order, the filter bar and its four defaults, the pale-green header tint, green ticket-number
links, the range-summary wording, and numbered page buttons. Four of those were wrong until
they were checked against the picture. Three departures are deliberate:

| Departure | Why |
| --- | --- |
| Page size 10, not the figure's 8 | §6.1 fixes the allowed sizes at 10/20/50, and 8 is not one of them — following the picture would break the written rule |
| Summary and Requested Priority also sortable | The three the figure marks are all sortable; two more take nothing away |
| A gap only where pages are skipped | The figure draws `1 2 3 4 5 … 6`, an ellipsis hiding nothing — a drawing artefact, and one that promises a page that is not there |

One item is still open: the figure gives each status its own colour — Open blue, Pending
amber, In Progress and Resolved green — and we render them alike. Nothing on screen is wrong
today because §4.2 keeps every ticket at New, but it will be as soon as Lab 3 moves one.

**Development Requester Selection** matches the page 9 illustration except for a decorative
avatar icon above the title, and Cancel: the figure shows it unconditionally, and it appears
here only when a requester is already selected. With none selected there is nowhere to
cancel to — every other route is guarded, so `/` redirects to My Tickets, which redirects
straight back — and §8.1's required elements do not include it.

**Ticket Detail** is specified from Figure 1 in §5.4 above, before the screen exists rather
than after. The figure also shows four tabs — Public Comments, Attachments, Service Actions,
Event Log — and §4.2 excludes the features behind three of them. The exclusion wins, so §5.4
specifies the attachment section alone and no tab strip at all.

- [ ] Header, primary buttons and active navigation use the specified greens
- [ ] Page background, surfaces and borders match their tokens
- [ ] Read-only fields are visibly distinct from editable ones
- [ ] Required asterisks present, and a message appears beside the field when invalid
- [ ] One primary action per screen; hierarchy between primary, secondary and destructive is clear
- [ ] Disabled and busy controls are visually distinct and cannot be activated
- [ ] Focus ring visible on every interactive element when tabbing
- [ ] Priority and status badges consistent across the list and the detail screen
- [ ] Filters, pagination and attachment controls all usable at the current viewport
- [ ] Empty state and no-results state are visibly different
- [ ] No clipping, no overlap, no unintended horizontal scrolling
- [ ] Attachment filenames fully readable

---

## 10. Screenshot paths

Written by the Playwright run into `artifacts/lab-02/screenshots/`, with stable filenames
so a re-run updates rather than accumulates.

Every file carries its viewport as a prefix, because the three projects write the same
states and a bare state name would have them overwrite each other.

```
create-ticket/{desktop,tablet,mobile}.png
create-ticket/{desktop,tablet,mobile}-{initial,validation-failure,submitting,success,api-failure,invalid-attachment}.png
my-tickets/{desktop,tablet,mobile}.png
my-tickets/{desktop,tablet,mobile}-{empty,no-results,search,requester-a,requester-b,filters,sorting,pagination}.png
ticket-detail/{desktop,tablet,mobile}.png
ticket-detail/{desktop,tablet,mobile}-{initial,with-attachment,removed-attachment,unauthorized}.png
requester-selection/{desktop,tablet,mobile}-{loading,initial,failure,selected}.png
```

Seventy-five files: 21, 27, 15 and 12. This list is the one a reader checks the evidence against,
so it is worth saying what it looked like before Issue #21 audited it, and what the audit
got wrong on its first pass.

It named `attachment-active` and `attachment-removed` for files actually written as
`with-attachment` and `removed-attachment`. It omitted `initial` on two screens and
`search` on My Tickets, all three of which existed.

It also named two files that did not exist, `unauthorized` and `submitting`, and the first
attempt at this section resolved them in opposite directions: `unauthorized` was captured,
and `submitting` was struck out on the reasoning that the busy state lasts one local API
call and photographing it would be a race. That reasoning was wrong twice over. §14 Part 6
names `submitting` among the six Create Ticket states it requires, so the promise was not
the document's to withdraw. And it is not a race: the test holds the *response* rather than
the request, so the real `POST` is issued, the ticket really is created, and the screen sits
on its busy button until the answer is handed back. Nothing in the application was changed
to make the picture possible, which is the only thing that would have made it worthless.

The last twenty-one came from the same audit noticing what the journey never walks
past: the Selection screen has no place in a flow that starts beyond it, and a list of
three tickets never grows a second page. `evidence.spec.ts` photographs those states
deliberately — the four Selection states under `requester-selection/`, and `filters`,
`sorting` and `pagination` beside the rest of My Tickets — with twelve tickets created
through the API so the page control genuinely exists.
