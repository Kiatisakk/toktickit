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
| `--tkt-error` | `#A4262C` | Validation text and invalid borders |
| `--tkt-warning` | `#B4690E` | Warning callouts and badges — never decoration |
| `--tkt-success` | `#0B7A46` | Success confirmation, paired with an icon and text |

Bootstrap's own variables are remapped onto these (`--bs-primary`, `--bs-body-bg`,
`--bs-body-color`, `--bs-border-color`) so framework components inherit the palette
without being restyled individually.

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

`tkt-badge` plus a modifier. Every badge pairs its colour with the word, so meaning
survives without colour.

| Kind | Modifiers |
| --- | --- |
| Requested / IT priority | `tkt-badge--low` `tkt-badge--medium` `tkt-badge--high` |
| Current status | `tkt-badge--new` `tkt-badge--open` `tkt-badge--in-progress` `tkt-badge--pending` `tkt-badge--resolved` `tkt-badge--closed` |
| Attachment | `tkt-badge--active` `tkt-badge--removed` |

An unset IT priority renders as `—` with the accessible text "not set", not as an empty
cell.

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

Read-only context at the top (Ticket Number placeholder, Ticket Date, Requester), then
classification side by side (Category, Related System, Requested Priority), then Summary
at full width, then Description at full width and taller, then Attachments, then actions
at the bottom right with Cancel to the left of Create Ticket.

System-generated and read-only values use `tkt-field--readonly` so they are visibly
distinct from anything the user can type into.

| State | Presentation |
| --- | --- |
| Initial | Empty form, reference data loaded, Create Ticket enabled |
| Loading reference data | Category and Related System show a loading placeholder |
| Validation failure | Offending fields get `tkt-field--invalid` and a message; focus moves to the first one |
| Submitting | Create Ticket busy and disabled; fields remain readable |
| Success | Success panel with the generated Ticket Number and two actions — View Ticket, Create Another |
| API failure | Error callout above the actions; **every entered value is preserved** |
| Invalid attachment | The offending file is listed with its reason; valid selections survive |

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

Header block of read-only fields laid out as the approved illustration does: Ticket No.,
Ticket Date, Category, Related System on the first row; Requester, Requested Priority, IT
Priority, Current Status on the second; Ticket Owner and Summary on the third; then
Description; then Resolution Summary.

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

```
create-ticket/{desktop,tablet,mobile}.png
create-ticket/{validation-failure,submitting,success,api-failure,invalid-attachment}.png
my-tickets/{desktop,tablet,mobile}.png
my-tickets/{empty,no-results,requester-a,requester-b}.png
ticket-detail/{desktop,tablet,mobile}.png
ticket-detail/{attachment-active,attachment-removed,unauthorized}.png
```
