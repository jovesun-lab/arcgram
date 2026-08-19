# Arcgram Layout Tips

Arcgram uses **manual positioning** — no auto-layout. This is a feature: it gives total control over what the reader's eye lands on first. But it means you have to think deliberately about placement. These are the heuristics for getting a clean diagram on the first try.

---

## 0. Canvas size & edge margin

`W` and `H` live at the top of the engine block. Treat them as a **starting hint**, not a hard ceiling — the engine derives the real canvas size from your band stack + content extent and grows beyond the author hint when needed. Your authored H is a floor.

Reasonable starting hints by reading direction and band count:

| Reading direction | Starting hint `W` × `H` |
|---|---|
| Horizontal (L → R primary), ≤4 bands | `1600 × 900` |
| Horizontal (L → R primary), 5–6 bands | `1600 × 1200` |
| Vertical (T → B primary) | `900 × 1600` |

If your hint turns out too small, the engine quietly grows it during `autoExtendCanvas`. The viewport then scales to fit. Nothing breaks — but `fitView` will start at a smaller zoom, which can read as "the diagram looks squashed." Picking a generous hint up front gives a cleaner first paint.

**Edge margin: 50 px recommended, 30 px minimum.** No node's bounding box should sit inside the 50 px ring around the canvas edge. Keeps text clear of the visible boundary and gives tooltips room to render without clipping.

**Doesn't fit? Extend, don't compress.** If your layout needs more room, bump `W` or `H`. Don't tighten the Y-step, don't reroute through awkward lanes, don't shrink the node grid. The diagram should breathe — extra canvas is free, and the viewport scales to fit.

---

## 1. Decide reading direction first

Before placing any node, decide how the reader's eye should travel.

- **Top → bottom** (most common): the diagram tells a story from input (top) to output (bottom). Time flows down. Use this for lifecycles, pipelines, build flows, session-start-to-session-end maps.
- **Left → right**: each column is a stage; rows are parallel tracks. Use this for short linear pipelines or when you have very few rows.
- **Center-out**: a central node with spokes radiating. Use rarely — works only when there's truly one root concept.

Once chosen, every other layout decision follows. Don't mix directions in the same diagram.

---

## 2. Group nodes into columns by category

Every node belongs to one column. Decide your columns *before* placing nodes. Typical column count: **2–5**. More than 5 and the diagram becomes a wall of boxes.

Example column schemes:

| Diagram subject | Columns |
|---|---|
| Codebase architecture | `entry` · `core` · `services` · `storage` |
| Build pipeline | `source` · `tooling` · `artifacts` |
| Knowledge/memory map | `roots` · `memory` · `code` · `docs` |
| Data flow | `ingestion` · `processing` · `storage` · `consumption` |

Each column gets one X coordinate (the left edge of all nodes in that column). All nodes in column A share `x: <X_A>`.

**Spacing rule:** column-to-column X gap ≈ 50 px. Since node floor width is 176 (grows toward 240 for long labels via 4-phase staircase), that's `next_column_x ≈ prev_x + 220`. Widen the gap if labels are long enough to push nodes into Phase 2+ growth.

---

## 3. Vertical spacing within a column

Use a **constant Y-step** within each column. Mixing step sizes makes the diagram look chaotic.

- Tight: `y-step = 75` (44 node + 31 gap) — for stacks of 5+ nodes
- Comfortable: `y-step = 80` (44 node + 36 gap) — default
- Airy: `y-step = 95` — for short lists where breathing room helps

Snap every node in a column to `y = baseY + n * y-step`. Avoid one-off offsets — they read as misalignment, not emphasis.

---

## 4. Bands for horizontal phases

Bands are full-width horizontal stripes that group rows of nodes by *meaning*, not position. Use them when the diagram has clear phases.

Good band uses:

- **Lifecycle**: `SESSION START` · `LOADING` · `MAIN WORK` · `SESSION END`
- **Layer**: `PRESENTATION` · `BUSINESS LOGIC` · `DATA ACCESS` · `STORAGE`
- **State**: `INPUT` · `TRANSFORMATION` · `OUTPUT`

Bands work best when **each band contains a recognizable row of nodes** that share a phase. Don't band an empty area — the reader expects content there.

Author each band with the 2-field color schema — `fill` (an **opaque** base color) and `color` (the tag text / accent, echoing the dominant node `type` color in that band). The engine applies the tint alpha itself, so nodes stay dominant; a pre-baked low-alpha `rgba(...)` double-dims. The v1 fields `areaBg` / `tagFill` / `tagColor` are **dead in v2** and render the band transparent — see `schema.md § Band`.

---

## 5. Columns scaffold for vertical lanes

The `COLUMNS` object provides:

- **Dividers**: thin dashed vertical lines (5% white alpha) between columns. Subtle but helpful when columns have similar visual weight.
- **Headers**: pill-shaped labels above each column.

Use both together. Header labels should be SHORT and uppercase — `MEMORY LAYER`, `CODE`, `DOCS`. Match the header tag color to the dominant `type` color in that column.

Skip the column scaffold if your diagram has fewer than 3 columns — the reader doesn't need help finding two lanes.

---

## 6. Edge router selection — decision tree

For each edge, pick the router this way:

1. **Source and target in the same column (vertical neighbours)?**
   - Use `vhv` (the default). The path will be near-straight if X is identical, or a slight VHV jog if X differs by a few pixels.

2. **Source and target in different columns, source above target (top-to-bottom flow)?**
   - Use `vhv` with `fromPt: 'bot'` → `toPt: 'top'`. Edge exits source's bottom, drops to a horizontal lane, slides across, then enters target's top.

3. **Source and target on the same horizontal level (side-by-side)?**
   - Use `hvh` with `fromPt: 'rgt'` → `toPt: 'lft'`. Edge exits right, jogs vertically, enters target's left.

4. **Source far away, edge needs to detour around a block of nodes?**
   - Use `3leg` with an explicit `via: Y`. The Y should be in a "lane" that doesn't contain any nodes. Common pattern: route a long edge along the very bottom (`via: H - 20`) or the very top (`via: 10`) of the canvas.
   - ⚠️ **Under revision:** the current engine does **not** honor this `via: Y` detour lane on vertical-anchored (top/bot) edges — the middle-leg Y is auto-computed. On lateral (lft/rgt) edges, `via` sets the vertical middle leg's **X**.


5. **Source and target on the same node (self-loop)?**
   - Don't. The renderer doesn't support self-loops cleanly. If you need cyclic semantics, draw two opposing edges (A→B and B→A) with `offset` to separate them.

### Clearance — keep routed wires away from nodes they don't connect to

Any leg of a routed edge (vertical or horizontal) that passes near a node the edge does *not* connect to must stay **at least 10–30 px** clear of that node's bounding box. A wire scraping a node's edge reads to the viewer as "this wire connects to that node" — a false signal.

When picking `via` Y for a `3leg` route, do this check:

> ⚠️ **Under revision:** this `via: Y` control is **not honored by the current engine** for vertical-anchored (top/bot) edges — the middle-leg Y is auto-computed. The check below is retained for when author control returns; on lateral (lft/rgt) routes, `via` is an **X** (the vertical middle leg's position).


- For each *vertical* leg of the path, walk down the column at that X and confirm no unrelated node's bounding box crosses the leg's Y range. Use the runtime size (engine sets `n.w` / `n.h` via the 4-phase staircase — `n.w` is 176 at floor, up to 240; `n.h` is 48 at floor, up to 128). For collision checks, read `n.w` / `n.h` rather than assuming a fixed size.
- For the *horizontal* leg at `via`, confirm `via` is at least 10 px above (or below) every unrelated node's top (or bottom) edge that overlaps the leg's X range.

Example: if `SHIPPED` is at `y=460` with `h=48` at floor (so its top is 460, bottom is 508) and a feedback edge needs to pass through that vertical span, `via:470` puts the leg 10 px inside `SHIPPED`'s top — wrong. `via:430` puts it 30 px above. `via:524` puts it 16 px below. Either works. If `SHIPPED`'s label grows it into Phase 2+ (e.g. h=88), recheck the clearance.

The same applies to `hvh` routes whose horizontal leg passes through another node's vertical band at the same Y.

---

## 7. Disambiguating parallel edges with `offset`

When two edges run between the same two columns at the same Y, they overlap visually. Use `offset` to nudge them apart.

```js
{ f: 'A', t: 'B', fromPt: 'rgt', toPt: 'lft', route: 'hvh', offset: -10 },
{ f: 'B', t: 'A', fromPt: 'lft', toPt: 'rgt', route: 'hvh', offset: +10 },
```

The two edges now run as parallel lines 20 px apart instead of one on top of the other. Useful for showing bidirectional relationships.

Suggested offset values: `±6` for subtle separation, `±10` for clearly visible parallel lines, `±20` for emphasized parallel lines.

---

## 8. Marking critical paths

Set `crit: true` only on edges where breakage = system failure. Critical edges render in red, slightly thicker, and on top of other edges. Use sparingly — if every edge is critical, none of them are.

Number critical paths with `lbl: '🔑1'`, `'🔑2'`, etc. The reader can then follow the numbered sequence to understand the system's load-bearing structure.

A diagram with 30 edges should typically have **3–7** critical edges, not 20.

---

## 9. Anchor point selection (`fromPt` / `toPt`)

The four anchor points (`top`, `bot`, `lft`, `rgt`) determine where the edge attaches to the node box. Pick the anchor closest to the path's direction.

| Source position vs target | `fromPt` | `toPt` |
|---|---|---|
| Above (target is below) | `bot` | `top` |
| Below (target is above) | `top` | `bot` |
| Left of target | `rgt` | `lft` |
| Right of target | `lft` | `rgt` |
| Diagonal | Pick the side closest to the path direction. Trust your eye. |

Mismatched anchors (e.g. `fromPt: 'top'` when the target is below) make the path travel awkwardly through the box. The renderer doesn't prevent this; you have to choose right.

---

## 10. Tooltip writing — `desc` field guidelines

The tooltip is where the diagram earns its richness. Treat each node's `desc` as a 1–3 sentence answer to "What is this and why does it matter?"

Good `desc` patterns:

- **One-line summary** then a `\n` then a **why-it-matters** sentence.
- Use `🔑N` references to call out which critical paths this node participates in.
- Use emoji sparingly as semantic markers: `🛑` blocker, `⏳` pending, `📋` checklist, `🔴` terminal state, `✅` done.
- Mention **paths**, **other node IDs**, or **field names** when they help. The reader can hover other nodes to follow up.

Bad `desc` patterns:

- Restating the label ("App.tsx is App.tsx").
- Generic descriptions copy-pasted across nodes.
- Paragraphs longer than ~4 lines — they overflow the 290px max-width and scroll.

---

## 10b. H-layout authoring — collision-free by construction

A *banded* (H) layout — a left→right spine across `BANDS`, with branch nodes attaching from a band above or below — has its own authoring discipline, in two parts: first get the **edges** right (a mesh is the single biggest cause of an un-fixable tangle), then **place** them. Both were derived by tuning real H-flows until the full gate suite read all-green; follow them and most overlaps never appear, so you don't tune them out afterward.

### Author the edges from real structure — never a mesh

Get the *connectivity* right before you place anything. The most common way a flow turns into an un-fixable tangle is drawing an edge from **every** node in one band to **every** node in the next — a full mesh. A mesh is not a routing problem you can tune out later: two fully-connected rows are mathematically non-planar (they contain the K(3,3) crossing graph), so the crossings and shared arrival lanes are a property of *the edges you chose*, not a limit of the router. No amount of re-routing planarizes it. Fix it at authoring time:

- **A. Translate, never invent.** Every edge must come from a real relationship in the thing you're drawing. If the source material doesn't say A connects to B, there is no A→B edge. Don't generate edges by pairing up band members — that is exactly how a mesh appears.
- **B. No all-to-all between bands.** If you're about to wire every node in one band to every node in the next, stop — a real structural element is missing. Usually it's a **convergence node** (many inputs feed *one* decision or aggregator) or a **class split** (each input routes to *one* bucket by type, not to all of them). Real flows are sparse.
- **C. Mutually-exclusive outcomes are not parallel targets.** A set of exclusive results — `OK` / `WARN` / `FAIL`, or `approved` / `rejected` — is *one selected outcome*, not several things every input points at. Draw the **selection** (a decision node picks one), then send each outcome to **its own** next step. Don't fan every input into every outcome.
- **D. A red is fixed, not stamped.** When the gate suite flags an overlap or crossing, that's a defect to fix — usually by correcting the edges (A–C) or the anchors (rules 1–4 below). Don't label it "by design" to silence the banner; "by design" is only for genuinely irreducible density, never for a tangle you authored.

**The shape that stays clean — converge, then fan out once.** Most flows that *look* like they need a mesh actually have this structure hiding inside them:

1. **Class-route the inputs** — each input goes to exactly one collector/counter by type, never to all of them.
2. **Converge to a single decision node** — the collectors feed *one* node that makes the call. This pinch point is exactly what a mesh is missing.
3. **Fan out once, from that decision** — the decision node branches to the outcomes. This single 1→N fan-out is the one the engine bundles cleanly onto a shared trunk.
4. **One outcome → its own exit** — each branch goes to its own action or end state; exclusive outcomes never share a target.

Sparse, faithful edges make the geometry fall out clean on the first try; a dense, invented mesh is red and stays red.

### Place the wires — anchor by role

**1. Anchor discipline — assign anchors by ROLE so no two wires share a column.** This is the single highest-leverage rule: almost every wire↔wire overlap traces to two wires occupying the same vertical column. Decide by the wire's role, not just its direction:

- **Spine wires** (the main left→right flow) enter a target from `lft` and exit from `rgt`.
- **Branch wires** (a node in another band closing onto the spine) enter from `top` or `bot`.

The trap: any wire entering a node's `top` drops vertically at that node's center-X. If a branch *also* rises into that node's `bot` at the same center-X, the two share the column and overlap. Routing the spine in through `lft` instead keeps the column clear for the branch.

**2. Center-align a branch under its target for a straight close.** H-mode uses `BANDS`, not `COLUMNS`, so you lose the engine's column auto-centering (which snaps members to a shared center-X). To draw a *straight* vertical branch-close, set the branch node's **center-X** (`x + w/2`) equal to the target's center-X — account for the auto-grown width, not just `x`. Two nodes with the same `x` but different label widths have different centers and the close-edge will bend (kink Rule 10).

**3. One column per branch-bearing spine node.** If two spine nodes stack in the same column, their two branches are forced into the same column → collision (rule 1 again). Give every spine node that has a branch below it its own X.

**4. Don't put a wide pill on a short branch wire.** A long edge label on a short vertical jams the target node — the arrival needs `arrow (9) + handle (10) = 19 px` of clearance before the pill (conformance C3). Put the relationship in the branch node's own `label`; leave the connector unlabeled — or lengthen the wire.

> **Engine-compile candidate.** Rule 1 (anchor-by-role) is a deterministic function of each edge's role, so it's a candidate to bake into the engine as an *opt-in* auto-anchor (assign `fromPt`/`toPt` only when the author omits them, so it never overrides hand-authored anchors). That would give agents collision-free H-routing without hand-tuning — the kind of learned rule that, once compiled in, every agent inherits. Building it is its own focused change (verify against a known-good reference diagram first, since it touches anchor assignment).

---

## 11. Common mistakes

| Mistake | Fix |
|---|---|
| Nodes overlap visually | Re-check Y-steps; nodes are 44 tall, leave at least 30 px gap. |
| Nodes hugging the canvas edge | Bump `W` or `H`; keep every node ≥ 50 px clear of every edge (§0). |
| Edges overlap each other | Use `offset`, or pick different `fromPt` / `toPt` anchors. |
| Edges pass through nodes | Switch router (`vhv` → `3leg`), or move nodes. |
| Diagram feels lopsided | Add a band or column header to anchor the empty side. |
| Too many critical edges | Trim. Only mark edges whose failure = system failure. |
| Long labels overflow | Shorten the `label`; put the long version in `desc`. |
| Type isn't in `COL` | Either add it to `COL` (with `{fill, stroke}`) or use an existing type. The renderer falls back to `memory` but you lose semantic color. |
| Routed wire grazes an unrelated node | Change anchor (`fromPt`/`toPt`) so the leg uses a different lane; on lateral (lft/rgt) edges, move `via` (the vertical leg's X). The vertical-edge middle-leg Y is auto-computed (under revision). |

---

## 12. Iteration workflow

1. Draft node positions in a flat layout (one column, vertical list).
2. Group into columns — assign each node its column X.
3. Add edges. Start with `vhv` everywhere.
4. Open in browser. Note overlaps and awkward routes.
5. Switch routers on overlap edges. Add `offset` where needed.
6. Add bands and column headers last, once the node layout is stable.
7. Mark critical paths.
8. Write or refine `desc` for each node.

Don't try to finalize layout and content in one pass. The renderer is fast — iterate.
