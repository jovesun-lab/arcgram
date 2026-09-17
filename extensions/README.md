# Arcgram extensions

Optional overlays that attach to a rendered Arcgram flow. Load one as a `<script>` **after** the
engine; it reads the engine's runtime and draws on top. Each is standalone (no dependencies, no CDN).

## arcgram-bugmarks.js — the Audit overlay

Marks bugs and logic holes on a flow: a pulsing ring plus a short reason tag at each marked element,
and an "Audit" findings list. It **self-hides when there are no marks**, so a clean flow looks
identical with or without it.

```html
<script src="extensions/arcgram-bugmarks.js"></script>
<script>
  ArcgramBugs.set([
    { level: 'medium', anchor: { node: 'NODE_ID' }, reason: 'short label', desc: 'what is wrong' }
  ]);
</script>
```

Marks are written **by hand, into the page**, in that `ArcgramBugs.set([...])` call. There is no
build step and no marks file to compile — an agent authoring a flow inlines the array directly.

## API

| call | does |
|---|---|
| `ArcgramBugs.set([bug, …])` | replace the whole mark set |
| `.add(bug)` | append one mark; returns its `id` |
| `.clear()` | remove all marks |
| `.resolve(id)` | close a mark (see *Closing a mark*). Also accepts any of the mark's `previousIds` |
| `.reopen(id)` | reverse a close. Same id lookup as `.resolve` |
| `.show()` / `.hide()` / `.toggle()` | overlay visibility |
| `.list()` | a copy of the current marks |
| `.visible` | current visibility |

## The mark record

```js
{
  id:        'BUG-260911-ag-01',   // see "Mark ids" below; auto-generated if omitted
  level:     'high' | 'medium' | 'low',
  type:      'logic',              // the public edition marks reasoning only
  anchor:    { node: 'ID' } | { edge: { f, t, lbl? } } | { world: { x, y } },
  reason:    'short label shown on the flow',
  desc:      'the full explanation',
  evidence:  'scanner: the line the cause is read from',
  resolved:  false,                // closure fields below
  disposition: '', resolution: '', revivesIf: '',
  previousIds: []
}
```

### `level` is SEVERITY — it is not the checkpoint skill's `severity`

`level` answers **how bad is this**: `high` / `medium` / `low`. It drives the ring colour, the list
chip, and the list sort order, and nothing else.

The checkpoint skill has a field spelled `severity`, and the two are **unrelated measurements that
happen to share a word**. `severity` there is `defect` / `uncovered` and answers *could a verdict be
reached at all*. Neither field is ever read from the other. Do not map one onto the other, and do not
use `level` to record where a finding came from — that is what `evidence` is for.

### `type` — `logic` only in this edition

The public edition marks **reasoning**, not geometry: use `type: 'logic'`. Geometry is not marked here
because it is *gated* here — the shipped gate bundle checks it and the engine fixes it, so a geometry
problem is a build failure, not an annotation on a finished picture.

### `evidence` — ground every mark, with a prefix

A mark asserts that something is wrong, so it owes the line it read that from. `evidence` is a plain
string, and it opens with one of three prefixes saying **what kind of source** it is:

| prefix | means |
|---|---|
| `scanner:` | output from a gate, validator, linter, or test run |
| `doc:` | a spec, schema, or written requirement the flow contradicts |
| `derived:` | a conclusion reached by reading the flow itself — say how |

The overlay warns (never throws) on a mark with no `evidence`. An ungrounded mark is an opinion
wearing a ring.

### Mark ids

`BUG-<yymmdd>-<agent>-<seq>` — e.g. `BUG-260911-ag-01`.

All four segments are **facts at the moment the mark is born** and none of them can ever become false
later: the date it was filed, who filed it, and its sequence within that day. That is the whole design
— because nothing in the id can go stale, an id never needs to be reissued, and no central registry is
needed to hand them out.

Omit `id` and one is generated, but a generated id is **not stable across page loads** — it cannot be
cited, and `.resolve()` cannot reliably target it. Write the id yourself for any mark you intend to
refer to.

### `previousIds` — the ids a mark used to carry

If a mark is ever renamed — most often a one-time migration of older marks onto the id shape above —
put the old ids in `previousIds` and `.resolve()` / `.reopen()` will still answer to them, so existing
citations keep working. The detail card shows them under *previously filed as*.

Expect this list to hold **one** entry. Because every segment of an id is a birth fact, a mark that
already has a well-formed id should never need another one.

## Closing a mark

A mark's life has exactly two states: **open**, and **closed with a reason**. There is no third.

Closing sets `resolved: true` plus a `disposition` saying *why* it closed:

| `disposition` | means | also owes |
|---|---|---|
| `RESOLVED` | the hole was **closed**. It is gone. | `resolution` — the evidence that it is gone |
| `SUPERSEDED` | the hole is **still there, untouched**. It is not live because the path it belongs to was not taken — a decision closed it, nobody fixed it. | `resolution` **and** `revivesIf` |

`RESOLVED` is the default when you set `resolved: true` without naming a disposition.

`resolution` is free text and carries the *whole* reason, including the cases that are not fixes. A
reviewer deciding **"this is not a defect here"** is a close: `RESOLVED`, with the judgement and who
made it written into `resolution`. Resist the urge to add a state for it — why a mark closed is
content, not schema, and a new state would have to be understood by every surface that renders one.

⛔ **Never write a `SUPERSEDED` hole up as fixed.** Nothing was fixed. And a `SUPERSEDED` mark without
`revivesIf` can die by omission: `revivesIf` is the condition that would make it live again, and it is
the only thing standing between "deliberately parked" and "quietly lost".

`resolved` is **not** self-certified by an agent. Set it after the fix is verified *and* a human
confirms it.

## Per-map stamps — authored defaults as HTML comments (no JS API)

A **stamp** is an HTML comment in the flow file, placed **before** the extension's `<script>`
region, read once at load by one regex over comment nodes. It makes a display default an
*authored property of the map* — it travels with the file through every re-bake (baking rewrites
only the marks-data region), instead of living in a viewer's hand on a toggle that resets at
every page load.

```html
<!--BUGMARK:SHOW-COMPLETED-->
```

declares: **this map's resolved marks are part of the story — show their rings on the flow by
default.** The "Show completed" toggle still works; the stamp only sets where it starts.

**Absent = off.** With the stamp absent, resolved rings stay hidden on the flow — and the Audit
header then prints **"N closed hidden"**, because a filter that hides must say what it hid. A
map whose closed holes should be visible from the reviewer's chair (an audit snapshot where "5
closed" stands next to "2 open") is exactly the map that should carry the stamp.

**Unknown stamps warn.** Every `BUGMARK:*` comment is validated against the known set — `START`,
`END` (the region markers), `AUDIT-SCOPE` (reserved per-map declaration), `SHOW-COMPLETED`. A
stamp outside that set gets a console warning naming it, and is ignored — a typo'd declaration
fails loud, never silently.

---

`arcgram-bugmarks.js` in this folder is generated at each release by the standard build (comment
scrubbed, attribution-checked, parse-guarded) — do not hand-edit it. This README is written by hand
and is not generated.
