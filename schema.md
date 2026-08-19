# Arcgram Schema Reference

> **Engine:** this reference documents the **v2** engine — `template-v2.html`. An older **v1** engine (`template.html`) has a separate schema reference with a different node schema (v1 has no `role` or `band` / `free` field). The two docs read alike at the top, so confirm you are reading the reference for the engine you build on.

Every Arcgram diagram is defined by four JavaScript arrays/objects inside the diagram's HTML:

- `nodes[]` — the boxes
- `edges[]` — the lines connecting boxes
- `BANDS[]` — optional horizontal background bands (for grouping rows)
- `COLUMNS{}` — optional vertical scaffolding (dividers + column headers)

Plus two scalars:

- `W`, `H` — world canvas dimensions in pixels (logical coordinate space, not screen pixels)

Colors and other visual values come from **CSS custom properties** ("design tokens") defined in `themes/default.css` — see the Design Tokens section below. There's no `COL{}` JS object anymore; the engine reads tokens via `getComputedStyle()` and exposes them through an internal `COL` map and `THEME` object.

---

## Node

```js
{
  id:    'UNIQUE_ID',
  label: 'Display Name',
  cat:   'category text',
  type:  'session',
  role:  'action',
  desc:  'Tooltip body text.\nUse \\n for line breaks.',
  status: 'done',
  band:  'CORE',        // or: free: true
  x: 590, y: 24,
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique within the diagram. Referenced by `edges[].f` and `edges[].t`. Convention: SHORT_UPPERCASE_SNAKE. |
| `label` | string | yes | Shown on the node face, second line. Node auto-grows for longer labels via 4-phase staircase (176×48 floor → 240×128 max). For floor sizing, keep label under ~14 chars on one line. |
| `cat` | string | yes | Shown on the node face, first line (small, uppercase). Acts as a category tag. ~20 chars max. |
| `type` | string | yes | A key that resolves to `--node-<type>-bg` and `--node-<type>-border` CSS variables. Determines fill + stroke (the **render axis**). See built-in types below. |
| `role` | string | no | **Optional.** The node's *reasoning role* — a semantic label read by **downstream agents**, not drawn by the engine (color comes from `type`). See [§ Reasoning role](#reasoning-role-role). Common values: `goal` · `action` · `decision` · `state` · `output` (extensible). |
| `kind` | `'diamond'` | no | **Optional.** Makes the node a decision diamond (thinking-flow). Author-sized — you set `w`/`h` (default 190×150); the auto-grow passes skip it. See [§ Decision diamond](#decision-diamond-thinking-flow). |
| `desc` | string | yes | Tooltip body. `\n` becomes a `<br>`. Supports emoji. Keep paragraphs short — tooltip max-width is 290 px. |
| `status` | string | no | **Optional.** A key into `STATUS_LEGEND` (see below). Draws a small theme-immune dot leading the cat row + a hover tooltip. Omit the field → no dot, no reserved space (existing diagrams render unchanged). |
| `flag` | string \| `true` | no | **Optional.** A lightweight per-node "look here" marker — draws a small red bug on the node's **top-right corner**; a string value shows as a hover note. Draw-only (does not affect layout or canvas bounds). It is **not** a defect review — for marking bugs / logic holes / geometry defects, use the Audit extension instead (`SKILL.md § Audit`). See [§ Audit marker](#audit-marker-flag). |
| `band` | string | **yes, if the diagram has bands** | The `id` of the band that OWNS this node. The band must also list it in its `members[]` — **both sides declare, and they must agree.** See [§ Node ownership](#node-ownership-band--free). |
| `free` | `true` | **yes, if the diagram has bands and no band owns this node** | Declares that **no band owns this node**. The honest alternative to `band` — never leave both off. See [§ Node ownership](#node-ownership-band--free). |
| `column` | string | **yes, in an H-band diagram** | The `id` of the `HCOLUMNS` entry that owns this node's **x** (its column). The column must also list it in `members[]` — **both sides declare, and must agree.** The x-twin of `band`. See [§ Column ownership](#column-ownership-column--colfree). |
| `colFree` | `true` | **yes, in an H-band diagram, if no column owns this node** | Declares that **no column owns this node's x** — a lifecycle/session node, a decision diamond, a node on a solo chain. The x-twin of `free`. See [§ Column ownership](#column-ownership-column--colfree). |
| `x` | number | yes | Top-left X in world coordinates (px). |
| `y` | number | yes | Top-left Y in world coordinates (px). |

### Node ownership (`band` / `free`)

**In a banded diagram, every node says who owns it — and the band says so too.**

```js
const BANDS = [
  { id:'CORE', label:'CORE', y:480, fill:'#142a1a', color:'#6cc77b',
    members:['FOOD','HUNGER','GROWTH'] },          // ← A. the band's roster
];
const nodes = [
  { id:'FOOD',   band:'CORE', label:'Feeding',  … },   // ← B. the node's owner
  { id:'HUNGER', band:'CORE', label:'Hunger',   … },
  { id:'PLAYER', free:true,   label:'Player',   … },   // ← no band owns it, and it SAYS so
];
```

**Why both sides.** The engine can move a node — it spaces bands, it centres spines, it places nodes nobody
placed. Before it moves one it asks *"does anyone own you?"*. That answer used to be **inferred from the
node's `y`** (whichever band's range it fell into) — a guess read off the very coordinate the move is about
to overwrite. A **declaration** cannot be moved. And a declaration on **one** side can still be silently
overruled; two sides that must agree have something to argue with.

**The rules.**

- A node in a banded diagram declares **either** `band:'<BAND_ID>'` **or** `free:true`. Never neither, never both.
- The owning band lists it in `members:[…]`. The two must name each other — a one-sided claim is an error.
- **`free:true` means: no BAND owns this node.** (It does *not* mean "unplaced" or "the engine may put it
  anywhere" — a free node can still belong to a column.) Lifecycle/entry nodes above the bands are typically free.
- **Moving a node no longer re-parents it.** Drag a node into another band's rows and it still belongs to the
  band it declares; the diagram is now *wrong*, and it will say so instead of silently changing owner.
- **Deleting a node is not done until its band stops claiming it** — remove it from `members[]` too. A roster
  entry that names nothing reads as ownership until you look.
- A diagram with **no bands** has nothing to declare here; `band`/`free` are ignored.

Checked by the `ownership` gate (A27), which reds on a mismatch, a one-sided declaration, a roster entry
naming a node that does not exist, or a node that declares nothing at all.

### Column ownership (`column` / `colFree`)

**The x-twin of node ownership.** In an H-band diagram a node sits in a **band** (its row, its `y`) *and* a
**column** (its lane, its `x`). The band is declared with `band` / `free` above; the column is declared with
`column` / `colFree` and a separate roster, `HCOLUMNS`.

```js
const HCOLUMNS = [
  { id:'C1', members:['FEED','FOOD','JOURNAL'] },   // ← A. the column's roster (a SEPARATE list from COLUMNS)
];
const nodes = [
  { id:'FEED',   band:'ACTIONS', column:'C1', … },  // ← B. the node names its band AND its column
  { id:'FOOD',   band:'CORE',    column:'C1', … },
  { id:'IDLE',   band:'CORE',    colFree:true, … },  // ← a lifecycle node — no column owns its x, and it SAYS so
];
```

**Why a separate `HCOLUMNS` and not `COLUMNS`.** `COLUMNS` drives the whole vertical-layout column subsystem
(inter-column spacing, column tints, column tags). Populating it on an H-band flow turns all of that on and
moves the diagram. `HCOLUMNS` is the H-flow column **roster only** — it declares membership without touching
layout.

**The rules** (they mirror band ownership exactly):

- In an H-band diagram every node declares **either** `column:'<COL_ID>'` **or** `colFree:true`. Never neither, never both.
- The owning column lists it in `HCOLUMNS[…].members`. The two must name each other — a one-sided claim is an error.
- **`colFree:true` means: no COLUMN owns this node's x.** It is DISTINCT from `free` (which is about the band): a
  node can be `colFree` and still have its x set by a solo `bot→top` chain, just as a `free` node can sit in a column.
- **Moving a node no longer re-columns it.** Change a node's authored `x` and it still belongs to the column it
  declares — the engine keeps it on that column's line instead of silently regrouping it by the new coordinate.
- **Deleting a node is not done until its column stops claiming it** — remove it from `HCOLUMNS[…].members` too.
- A **V/column diagram** (one with a populated `COLUMNS`) declares its columns there and ignores `column`/`colFree`.

Checked by the `column-ownership` gate (A28), the x-twin of A27: it reds on a mismatch, a one-sided declaration,
an `HCOLUMNS` roster entry naming a node that does not exist, or an H-band node that declares no column at all.

> ⚠️ `CANVASES[].members` is **not** ownership — it is a filter overlay, and its sets may overlap (one node
> can appear in several canvases). A node has at most **one** band.

### Reasoning role (`role`)

A node carries **two independent classifications**:

- **`type` — the render axis.** Resolves to a color (fill + stroke). It's what the *reader's eye* uses to group nodes. Required.
- **`role` — the reasoning axis.** A semantic label for what the node *does in the flow* — `goal`, `action`, `decision`, `state`, `output`. The engine does **not** draw it; it exists for **downstream agents** reading the diagram as data, so they can reconstruct the logic (which node is a decision, which is a step, which holds state) without parsing geometry or guessing from color. Optional, but recommended for any diagram meant to be machine-read.

The vocabulary is open — use terms that fit your diagram. The two public examples show the common set: the thinking-flow example (`examples/example-thinkflow.html`) uses `goal` / `action` / `decision`; the system-map example (`examples/example.html`) adds `state` / `output`. `role` never affects layout or color, so adding it to an existing diagram is render-neutral.

### Status dot (`status` + `STATUS_LEGEND`)

A node may carry an optional `status` key — a small colored **work-status dot** for tracking flows: **development pipelines, project boards, roadmaps** — anything where a node has a state like *in progress / open bug / done / frozen*. It renders **left-pinned at the text margin** on the category row (its left edge sits at `NODE_MARGIN_X`), with a hover tooltip showing the status label. The dot is independent of the text — the cat/title stay centered. Fully opt-in: a node with no `status` draws no dot and reserves no space (existing diagrams render unchanged). If a node has a `status` but no `cat`, the dot sits on the title row instead.

`STATUS_LEGEND` is a diagram-level object mapping each status key to an inline **`color`** (a hex) + a **`label`**:

```js
const STATUS_LEGEND = {
  done:     { color: '#4caf72', label: 'Done / landed' },
  wip:      { color: '#ffcf4d', label: 'In progress' },
  open:     { color: '#ff7a5c', label: 'Open bug' },
  critical: { color: '#ff5470', label: 'Critical / frontier' },
  frozen:   { color: '#7bccc7', label: 'Frozen / shipped' },
  queued:   { color: '#9aa0ff', label: 'Queued / scheduled' },
};
```

Four keys are **built in** and always available (no legend entry needed): `inactive` (grey), `in-progress` (amber), `done` (green), `critical` (red). Custom keys — like `wip` / `open` / `frozen` / `queued` above — merge over them.

The dot color is an **inline hex** and is **theme-immune**: status colors are held in the engine (not in CSS tokens), and are excluded from the B&W / W&B theme transform, because a status is *semantic*, not chrome — `done` stays green even in a black-and-white export, the way a critical edge stays red. The legend is not auto-drawn; place a manual node if you want an on-canvas key.

### Audit marker (`flag`)

A node may carry an optional `flag` — a small **red bug marker** pinned to its **top-right corner**, for flagging a problem, loophole, or open bug on a specific node (one side marks the node the other should look at and audit). Set `flag: 'note text'` and the note shows on hover; `flag: true` draws the marker with no note. It is **draw-only** — not reserved or sized into layout and not counted in canvas bounds, so adding it to an existing diagram is render-stable (nothing else moves). Omit the field → no marker. Like the status dot, it is a node-level tracking marker; use it on development pipelines, review flows, and audits where a node needs a "look here" mark. **It is not a defect review:** for marking bugs, logic holes, or geometry defects (e.g. a wire through a node) across a flow, use the Audit extension (`extensions/arcgram-bugmarks.js`; see `SKILL.md § Audit`), which draws a proper overlay ring + reason tag + an "Audit" findings list. `flag` must not stand in for it.

### Counter emphasis (category prefix)

The leading **counter** segment of the first category line — the text before the first `·` (e.g. `STEP 1` in `'STEP 1 · LOCKED · 2026-05-23'`) — renders with a heavier weight (600) and a thin same-color stroke (a glyph border) for emphasis; the rest of the line stays regular. This is automatic for any cat containing a `·`; a cat with no `·` renders plain. It is render-only — `measureNodes` measures the cat at one weight, so the emphasis never shifts layout.

Each built-in type resolves to a pair of CSS variables (`--node-<type>-bg`, `--node-<type>-border`) declared in `themes/default.css`.

| `type` | Fill | Stroke | Typical use |
|---|---|---|---|
| `session` | `#162640` navy | `#23dfdd` cyan | Lifecycle start, entry points |
| `sessionEnd` | `#2a1010` crimson | `#ff5555` red | Lifecycle terminators |
| `memory` | `#1c1c32` indigo | `#9b8cff` violet | Memory / state / config |
| `doc` | `#14261c` forest | `#6cc77b` green | Documentation, markdown sources |
| `core` | `#1a1f3a` midnight | `#6985c2` steel-blue | Core/primary nodes — central system pieces |
| `output` | `#2a1e15` umber | `#ffaa78` peach | Outputs, results, end-of-pipeline data |
| `input` | `#1f1a3a` deep violet | `#9b8cff` lavender | Inputs, triggers, externally supplied data |
| `code` | `#281c10` amber | `#ffa86c` orange | Source code, components, modules |
| `artifact` | `#2a1020` plum | `#ff6c9b` pink | Outputs, build artifacts, generated assets |
| `tool` | `#102626` deep teal | `#7bccc7` teal | External tools, utilities |

### Adding a custom type

Add a `<style>` block in the diagram HTML's `<head>` (after the theme `<link>` tags):

```html
<style>
  :root {
    --node-commerce-bg:     #1e1830;   /* dark fill */
    --node-commerce-border: #b89cff;   /* bright stroke */
  }
</style>
```

Any node with `type: 'commerce'` now picks up that palette. **Pick the border color first** (it's what the reader sees most clearly); the `bg` is a dark "shadow" of the same hue (low saturation, low lightness, same H). Unknown types fall back to the `memory` palette automatically.

---

## Edge

```js
{
  f: 'FROM_ID', t: 'TO_ID',
  fromPt: 'bot', toPt: 'top',
  style: 'solid', crit: false,
  route: 'vhv', via: undefined,
  lbl: undefined, offset: 0,
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `f` | string | yes | — | Source node `id`. |
| `t` | string | yes | — | Target node `id`. |
| `fromPt` | `'top'\|'bot'\|'lft'\|'rgt'` | yes | — | Which side of the source node the edge exits from. |
| `toPt` | `'top'\|'bot'\|'lft'\|'rgt'` | yes | — | Which side of the target node the edge enters. The arrowhead points here. |
| `style` | `'solid'\|'dashed'\|'bold'` | no | `'solid'` | Stroke style. Maps to `--edge-default` / `--edge-dashed` / `--edge-bold`. |
| `crit` | boolean | no | `false` | If `true`: red (`--edge-crit`), thicker, drawn on top of other edges. |
| `route` | `'vhv'\|'hvh'\|'3leg'` | no | `'vhv'` | Path router. See below. |
| `via` | number | no | — | World X-coordinate of the vertical middle leg on lateral (lft/rgt) routes. Ignored on vertical (top/bot) anchors — see the 3leg note. |
| `lbl` | string | no | — | Midpoint label. For critical paths, combine the marker with a 1–3 word verb: `'🔑1 +GP'`, `'🔑2 drives'`. |
| `offset` | number | no | `0` | Pixel offset applied to both endpoints (perpendicular to the edge), to separate parallel lines. |
| `branch` | `'Y'\|'N'` | no | — | Marks an edge as a decision-diamond branch: `'Y'` → green ✓ badge at the exit, `'N'` → red ✗ badge. The branch colors are a **fixed convention** (see [§ Decision diamond](#decision-diamond-thinking-flow)) — not author-set. |

### Routers

**`vhv`** — vertical → horizontal → vertical. Default. Best for top→bottom flow between columns.

```
   A                    A
   |                    |
   +---------+    or    +--+
             |             |
             +-- B         B
```

**`hvh`** — horizontal → vertical → horizontal. Best for left↔right relations within a row.

```
   A ---+         A ---+
        |              |
        +--- B    or   +--- B
```

**`3leg`** — three segments with the horizontal middle leg at `via: Y`. Use when an edge needs to detour around other nodes — for example, a connection from a top-row node down to a bottom-row node that has to go *under* the entire middle of the diagram.

> ⚠️ **Note — under revision:** the current engine auto-computes this middle-leg Y for vertical-anchored (top/bot) edges and does **not** read `via` there. Author control of the detour lane via `via: Y` is being revised. On lateral (lft/rgt) routes, `via` is the **X** of the vertical middle leg — see the `via` field above.

```
   A          via: y=1040
   |              |
   +--------------+
                  |
                  B
```

### Edge styling decision matrix

| Style | Token | Color | When to use |
|---|---|---|---|
| `solid` | `--edge-default` | grey | Default direct relationship (creates, produces, writes) |
| `dashed` | `--edge-dashed` | blue-grey | Reference or read relationship (loads, reads, points to) |
| `bold` | `--edge-bold` | yellow | Primary data flow (canonical extract, main pipeline) |
| `crit: true` | `--edge-crit` | red | Load-bearing — if this breaks the system fails |

`crit` is independent of `style` — you can have `crit: true, style: 'bold'` for a bold-and-red critical edge.

---

## Band (optional)

```js
{
  id: 'CORE',                 // the band's membership key — REQUIRED once the band owns nodes
  label: 'BAND NAME',
  y: 252, h: 526,             // h is a HINT — the engine auto-fits the band to its members + wire lanes
  fill:  '#1e1e3a',           // OPAQUE base color — the engine applies its own tint alpha
  color: '#9b8cff',           // tag text + accent
  members: ['FOOD','HUNGER'], // the band's ROSTER — and each of those nodes declares band:'CORE' back
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Optional. Stable membership key for the band. Falls back to positional (`__band0`, `__band1`, …) if omitted — but **name it** if the band owns nodes: it is what they point at. |
| `members` | string[] | **The band's roster** — the ids of the nodes it owns. Each of them must declare `band:'<this id>'` back. Membership is **declared, not inferred from `y`**: a node's position can be changed by the engine, and a coordinate is not an owner. See [§ Node ownership](#node-ownership-band--free). |
| `y` | number | Top Y of the band in world coords. |
| `h` | number | Band height in world coords — a **hint**. The engine takes `max(authored h, computed h)`: bands auto-fit to their members plus the wire lanes routed through them. |
| `label` | string | Text shown on the left-edge pill tag. |
| `fill` | CSS color | **Opaque base color** for the band area and its tag chip. The engine applies the alpha itself (band tint ≈ 0.6, chip 0.95; the Terracotta theme substitutes its own). Do **not** pre-bake a low-alpha `rgba(...)` — it double-dims into invisibility. |
| `color` | CSS color | Tag text color / band accent. Usually the border color of the dominant node `type` in that band. |

> ⛔ **`areaBg` / `tagFill` / `tagColor` are the v1 band schema and are DEAD in v2.** The v2 engine's
> `_visualBands()` reads **only `fill` and `color`** (identical to `COLUMNS`). A band written with the old
> three fields resolves to `themed(undefined)` → the band renders **transparent with a fallback chip**:
> authored, and invisible. Migration: `tagFill` → `fill` · `tagColor` → `color` · **drop `areaBg`**.
> (Live check: `examples/example-bands.html` is the correct 2-field form.)

Bands render full-width in screen space — they extend beyond the diagram's world width on pan/zoom. This is intentional: bands frame *layers* of meaning, not specific X-ranges.

Common use: divide a diagram into lifecycle phases (start → middle → end) or layer types (presentation / business / data / storage).

### Auto LIFECYCLE band (loose anchors above the top band)

If you place one or more nodes **above your topmost band** — a node whose vertical center sits above the top band's top edge — and don't assign them to any band, the engine **auto-wraps them in a synthetic `LIFECYCLE` band**: a muted, draw-only region labeled `LIFECYCLE`, prepended above your authored bands. You don't author it — it appears whenever loose anchors sit above the bands and disappears when there are none (fully opt-in, no geometry change). Use it for entry-point / session-start / lifecycle nodes that sit above the main banded body. A node that is loose *elsewhere* (e.g. below the last band) is **not** wrapped.

---

## Columns (optional)

`COLUMNS` is the vertical scaffolding of a column (V-layout) diagram: it declares which nodes share a **column** (an x-lane) and draws a **column tag** above each. It is an **array**, one entry per column:

```js
const COLUMNS = [
  { id: 'CORE', label: 'CORE LOOP', members: ['FOOD','HUNGER','GROWTH'] },
  { id: 'IO',   label: 'I/O',       members: ['LOGIN','JOURNAL'], fill: '#2a1e40', color: '#9b8cff' },
];
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Stable id of the column. |
| `members` | string[] | yes | The node ids in this column. The column tag centers over their combined width, and the layout keeps the column's nodes on one x-line. |
| `label` | string | yes | Column tag text. Usually short and uppercase. |
| `fill` | CSS color | no | Column tag background. Omit to auto-derive (see below). |
| `color` | CSS color | no | Column tag text color. Omit to auto-derive. |

The tag is drawn above the column, centered on its members. There are **no divider lines**: v2 organizes columns by the tags and the shared x-lane alone. (Dashed vertical dividers were a v1 device and are intentionally not drawn — they compete with the wires and the node grid.)

### Auto header color

When a column **omits `fill`/`color`**, the engine derives the tag palette from the **dominant member type** — the most common `n.type` among that column's members (tie-break: first type in authored member order). The tag then takes that type's `--node-<type>-bg` as `fill` and `--node-<type>-border` as `color`, so the label reads in the same color family as the nodes it sits over instead of asserting an unrelated identity hue.

Author-set values still win: `fill`/`color` only fill the gaps (`col.fill ?? domBg`, `col.color ?? domBorder`), so any column that specifies them — and every existing diagram — is unchanged. Set both to a neutral pair if you want a deliberately quiet, type-agnostic header. The derivation is color-only (no geometry impact); the dominant type is also stamped on `col._domType`.

---

## Canvas filter / spotlight (optional)

```js
const CANVASES = [
  { id: 'SYSTEM',    label: 'SYSTEM',    members: ['FEED', 'LOGIN', 'HUNGER'] },
  { id: 'ARTIFACTS', label: 'ARTIFACTS', members: ['JOURNAL', 'PUZZLE', 'PHOTO'] },
];
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique id of the canvas (group). |
| `label` | string | Text shown on the top-left filter tab. |
| `members` | string[] | Node ids belonging to this canvas. |
| `color` | CSS color | **Optional.** Tab + spotlight accent; falls back to a palette slot. |

Each canvas becomes a clickable tab in the **top-left filter**. Click a tab → its members stay bright while everything else dims to a spotlight (`SPOT_DIM_ALPHA`); click again to clear. Mutually exclusive with click-to-focus. The engine auto-sizes each canvas box from its members' bounding box — you only list members. Leave `CANVASES` empty (`[]`) to hide the filter entirely; an empty filter renders byte-identical to no filter (fully opt-in).

**Auto-populate by priority (authoring convention).** When a flow has natural groupings, fill `CANVASES` so the reader gets a top-left category filter: group nodes into the few highest-priority categories a reader would filter by — system layers, artifact types, lifecycle phases, etc. — most-important first. Skip it for small or single-theme flows where a filter adds nothing.

---

## Decision diamond (thinking-flow)

A **decision diamond** is a logic / condition / trigger node — a yes/no fork in the flow. Any diagram that contains at least one diamond switches into **thinking-flow** mode: the engine colors the branches and draws Y/N badges automatically.

### Make a node a diamond

Add `kind:'diamond'` to the node. A diamond is **author-sized** — you set `w`/`h` (default `190 × 150` if omitted), and the engine's auto-grow passes all skip it (long text wraps to ~62% of the width, then truncates). Everything else is a normal node; use `cat` / `label` to say what the decision is (`CONDITION`, `TRIGGER`, `DECISION`, …).

```js
{ id:'CHK', label:'Logged in?', cat:'CONDITION', type:'tool',
  kind:'diamond', w:190, h:120, desc:'A yes/no check.', x:170, y:200 }
```

### Wire the two branches

A diamond has **exactly two outgoing edges, on two different faces**. Tag each with `branch`:

| Field | On | Effect |
|---|---|---|
| `branch:'Y'` | the "yes" edge | green ✓ badge at the exit; conventionally goes **down** the spine (`fromPt:'bot'`) |
| `branch:'N'` | the "no" edge | red ✗ badge at the exit; conventionally **peels right** (`fromPt:'rgt'`, `route:'hvh'`) |

The Y/N branch colors are a **fixed, dedicated convention** — the engine draws Y in green and N in red (theme-aware: it uses its own thinking-flow palette in each theme). They are **not author-overridable**: a diamond's yes/no colors are part of the reading convention, the same way a critical edge is always red.

Put the two outs on **distinct faces** — both on the same face collapses the fork (a build-time check enforces out-degree 2 on distinct faces).

### Place the targets so the lines stay straight

- **Y target** sits **directly below** the diamond (`target.cx === diamond.cx`).
- **N target** sits **directly right** of the diamond (`target.cy === diamond.cy`).
- Misaligned centers bend the connector (the kink check flags it).

A **merge / reconverge** edge — where the Yes and No paths rejoin — is *not* a diamond out: author it as a normal edge; it carries no Y/N badge.

### The Y/N tips are output-only

A diamond's tip is a single point, so a wire may **not arrive** on a tip that a branch **exits** from — an incoming wire on the Y or N tip would collide with the branch leaving it. This holds for a **loop-back / reconverge** too (e.g. a decision whose "no" path routes back into an earlier node): send it into one of the diamond's *other* tips — a fan-in attaches at the nearest **non-Y/N** tip — never back onto the Y or N tip. (A fan-in on a Y/N tip is enforced-illegal: `diamond-fanin-scan`.)

### Minimal example

```js
const nodes = [
  { id:'IN',  label:'Request',    cat:'ENTRY',     type:'input', x:200, y:60 },
  { id:'CHK', label:'Logged in?', cat:'CONDITION', type:'tool',
    kind:'diamond', w:190, h:120, desc:'A yes/no check.', x:170, y:200 },
  { id:'OK',  label:'Home',       cat:'YES', type:'core',   x:177, y:430 }, // directly below CHK
  { id:'NO',  label:'Login page', cat:'NO',  type:'output', x:480, y:236 }, // directly right of CHK
];
const edges = [
  { f:'IN',  t:'CHK', fromPt:'bot', toPt:'top', route:'vhv' },
  { f:'CHK', t:'OK',  fromPt:'bot', toPt:'top', branch:'Y', crit:true },   // yes → down, green ✓
  { f:'CHK', t:'NO',  fromPt:'rgt', toPt:'lft', route:'hvh', branch:'N' }, // no → right, red ✗
];
```

---

## World coordinates vs screen coordinates

- **World** is the diagram's logical coordinate space. Node positions, band ranges, column dividers — all in world coordinates.
- **Screen** is the actual browser pixels. The viewport (`vp.x`, `vp.y`, `vp.scale`) maps world → screen.

You only ever write world coordinates. The renderer handles the mapping.

`W` and `H` should be the bounding box of your content. `fitView()` scales the whole world to fit the browser at startup.

---

## Sizing rules of thumb

- Node size: **floor 176 × 48 → cap 240 × 128**. Engine 4-phase staircase grows node W then H as labels lengthen; you don't set `w`/`h` per node. For multi-line labels, plan ~100 px Y-step.
- Row spacing in a column: **Y-step ≈ 100 px** (allows for grown nodes at floor + clearance).
- Column spacing: **`next_column_x ≈ previous_column_x + 220`** (176 floor + ~44 gap; widen if labels grow toward 240).
- World canvas size: author values are hints — engine auto-extends if any node overflows. Reasonable starting `W = max(node.x + 200) + 40`, `H = max(node.y + 60) + 56`.
- Band height: engine auto-fits content + adds topLane/botLane for any wires routing through. Authored `h` is a starting hint; engine takes `max(authoredH, computedH)`.

> [!info] Staircase phases (`measureNodes` in `template-v2.html`)
> Phase 0: floor at 176 × 48. Phase 1: W grows single-line up to `W_TRANSITION` (208). Phase 2: W locks at 208, label wraps, H grows up to `H_TRANSITION` (88). Phase 3: smooth W↔H interpolation toward max (240 × 128). Phase 4: clamp at 240 × 128, soft-clip with ellipsis.

---

## Design tokens

All 56 tokens are declared as CSS custom properties in `themes/default.css` (scoped to `:root`). They're consumed by `themes/base.css` and by the canvas engine (via `getComputedStyle()`).

### Canvas

| Token | Default | Used for |
|---|---|---|
| `--canvas-bg` | `#0b0d18` | Canvas background, label-pill mask |
| `--canvas-divider` | `rgba(255,255,255,.18)` | Dashed column dividers on the canvas |

### Title BG (topbar)

| Token | Default | Used for |
|---|---|---|
| `--title-bg` | `rgba(11,13,24,0.7)` | Topbar background (70% opaque) |
| `--title-main` | `rgba(255,255,255,0.85)` | Project name (`.title-main` h1) |
| `--title-sub-1` | `rgba(255,255,255,0.65)` | First subtitle |
| `--title-sub-2` | `rgba(255,255,255,0.45)` | Secondary hint text |
| `--title-zoom-label` | `rgba(255,255,255,0.25)` | Zoom % label |
| `--title-control-bg` | `#141828` | Zoom button background |
| `--title-control-border` | `#1e2240` | Zoom button border |
| `--title-control-text` | `rgba(255,255,255,0.45)` | Zoom button glyphs |
| `--title-control-border-hover` | `#4a5a90` | Zoom button hover border |
| `--title-control-text-hover` | `rgba(255,255,255,0.85)` | Zoom button hover text |

### Export button

| Token | Default | Used for |
|---|---|---|
| `--export-bg` | `#1444aa` | Export button background |
| `--export-border` | `#3364ce` | Export button border |
| `--export-text` | `rgba(255,255,255,0.85)` | Export button text |
| `--export-bg-hover` | `#3191ff` | Hover background |
| `--export-border-hover` | `#53e0ff` | Hover border |
| `--export-text-hover` | `#ffffff` | Hover text |

### Theme switcher

| Token | Default | Used for |
|---|---|---|
| `--theme-label-text` | `rgba(77,238,225,0.85)` | "THEME" label color |
| `--theme-btn-bg` | `rgba(255,255,255,0.02)` | Switcher button background |
| `--theme-btn-hover-border` | `rgba(77,238,225,0.47)` | Hover border on switcher button |
| `--theme-indicator-active` | `#94fff6` | Active stripe (4 px on left of button) |
| `--theme-indicator-inactive` | `#0f4a45` | Inactive stripe |
| `--theme-name-active` | `rgba(255,255,255,0.85)` | Active button text (bold) |
| `--theme-name-inactive` | `rgba(38,196,183,0.85)` | Inactive button text |
| `--theme-name-hover` | `rgba(214,255,252,0.85)` | Hover state text |

### Tooltip

| Token | Default | Used for |
|---|---|---|
| `--tip-bg` | `#0e0f20` | Tooltip background |
| `--tip-border` | `#9b8cff` | Default border (overridden per-node at hover) |
| `--tip-sub-1` | `#5571AD` | Subtitle (cat) line in tooltip |
| `--tip-body` | `#5571AD` | Description paragraph |
| `--tip-entry` | `#5571AD` | Default connection-list entries |
| `--tip-shadow` | `rgba(0,0,0,0.8)` | Drop shadow color (always dark) |

### Node palette — per type

The engine looks up `--node-<type>-bg` and `--node-<type>-border` for each `type` used in `nodes[]`. Custom types just add new pairs.

| Token (bg) | Default | Token (border) | Default |
|---|---|---|---|
| `--node-session-bg` | `#162640` | `--node-session-border` | `#23dfdd` |
| `--node-sessionEnd-bg` | `#2a1010` | `--node-sessionEnd-border` | `#ff5555` |
| `--node-memory-bg` | `#1c1c32` | `--node-memory-border` | `#9b8cff` |
| `--node-doc-bg` | `#14261c` | `--node-doc-border` | `#6cc77b` |
| `--node-core-bg` | `#1a1f3a` | `--node-core-border` | `#6985c2` |
| `--node-output-bg` | `#2a1e15` | `--node-output-border` | `#ffaa78` |
| `--node-input-bg` | `#1f1a3a` | `--node-input-border` | `#9b8cff` |
| `--node-code-bg` | `#281c10` | `--node-code-border` | `#ffa86c` |
| `--node-artifact-bg` | `#2a1020` | `--node-artifact-border` | `#ff6c9b` |
| `--node-tool-bg` | `#102626` | `--node-tool-border` | `#7bccc7` |

### Node state (shared across types)

| Token | Default | Used for |
|---|---|---|
| `--node-main-rest` | `#d8e4f8` | Node label text when not hovered |
| `--node-main-hover` | `#ffffff` | Node label on hover |
| `--node-border-hover` | `#ffffff` | Node border on hover |
| `--node-glow-hover` | `18px` | Hover shadow-blur amount (`0` in B&W if you ever want a flat theme) |

### Edges (by style)

| Token | Default | Used for |
|---|---|---|
| `--edge-default` | `#3a5070` | `style: 'solid'`, non-crit |
| `--edge-dashed` | `#6985C2` | `style: 'dashed'` |
| `--edge-bold` | `#ffd966` | `style: 'bold'` |
| `--edge-crit` | `#ff4c6e` | `crit: true` |

### Tag fallback

Used by `drawTag` only when band/column data omits its own fill/color. Per-band and per-column-header colors specified in data override these.

| Token | Default | Used for |
|---|---|---|
| `--tag-default-bg` | `#1e3a5f` | Fallback tag pill background |
| `--tag-default-text` | `#ffffff` | Fallback tag pill text |

### Status dot (theme-immune, inline hex)

A node's status-dot color is **not** a CSS token — it is an inline hex held in `STATUS_LEGEND` and the engine's built-in defaults (see [§ Status dot](#status-dot-status--status_legend)). Status colors are **excluded from the B&W / W&B theme transform** on purpose — a status is semantic, so it keeps its color in every theme. The four built-in defaults:

| Key | Default | Used for |
|---|---|---|
| `inactive` | `#6b7280` grey | `status: 'inactive'` |
| `in-progress` | `#f5a623` amber | `status: 'in-progress'` |
| `done` | `#4caf72` green | `status: 'done'` |
| `critical` | `#ff6b6b` red | `status: 'critical'` |

> Note: `themes/default.css` still declares four legacy `--status-*` custom properties from a pre‑v2 mechanism. The v2 engine does **not** read them (status colors live in JS); they are vestigial.

---

## Semantic vs Chrome tokens

The theme system distinguishes two classes of tokens. The distinction matters because B&W and W&B themes transform one class but not the other.

**Semantic tokens** (theme-adapted — desaturated in B&W, inverted in W&B):

- `--canvas-bg`, `--canvas-divider`
- All `--edge-*` (default, dashed, bold, crit)
- All `--node-<type>-bg` / `--node-<type>-border` (built-in *and* custom)
- `--node-main-rest`, `--node-main-hover`, `--node-border-hover`
- `--tip-bg`, `--tip-border`, `--tip-sub-1`, `--tip-body`, `--tip-entry`

Plus in-data colors that get transformed at draw time: `BANDS[].fill`, `BANDS[].color`, `COLUMNS.headers[].fill`, `COLUMNS.headers[].color`.

**Chrome tokens** (preserved across all themes):

- `--title-*` (project title + subtitles + zoom label)
- `--title-control-*` (zoom button colors)
- `--export-*` (Export button colors)
- `--theme-*` (theme switcher panel — but see W&B override below)
- `--tip-shadow` (drop shadows always dark, regardless of theme)
- `--tag-default-*` (tag fallback)

**Why the split:** semantic tokens describe the *content* of the diagram (nodes, edges, surfaces); chrome describes the *UI surrounding* the content. When the user switches to B&W or W&B, they expect the content to change but the controls to stay legible. Without this split, switcher buttons would become invisible after a theme flip.

The W&B theme has one targeted exception — it applies `[data-theme="wb"]` overrides on the switcher tokens so the floating switcher panel reads correctly on the light canvas. Those overrides live in `themes/default.css` (the `[data-theme="wb"]` block).

---

## Where these tokens live

| Token category | Defined in |
|---|---|
| All defaults (`:root` block) | `themes/default.css` |
| W&B switcher overrides (`[data-theme="wb"]`) | `themes/default.css` (same file) |
| Custom node types (per project) | Inline `<style>` in the diagram HTML |
| Structural rules consuming these tokens | `themes/base.css` |

The runtime semantic-token transformations (B&W desaturation, W&B inversion) are computed in JS via the engine's `refreshTheme()` and `desaturate()` functions in `template-v2.html` — read those functions for the exact math.
