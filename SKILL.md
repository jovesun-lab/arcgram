---
name: arcgram
description: "Generate an interactive node-and-edge diagram as a single standalone HTML file (Arcgram v2). Triggers on: arcgram, interactive/architectural diagram, topology, node graph, flow diagram, system map, dependency graph, workflow diagram, knowledge map, 'show me how X connects to Y', 'visualize this workflow', 'make this a topology', 'build a diagram of this'. Prefer for any system map, dependency graph, topology, or workflow picture even if interactivity wasn't asked for; on a follow-up 'make it inline' / 'show me' / 'render in chat', stay within Arcgram (Mode 1/2), don't switch tools."
license: Apache-2.0
---

# Arcgram — Interactive Architectural Diagram (v2)

> **For any AI agent — Arcgram is agent-neutral, not a Claude-only skill.** The block above is ordinary YAML frontmatter: Claude's skill system reads `name`/`description` to auto-trigger it, and any other agent (GPT · Gemini · Cline · Continue.dev · Cursor · Aider · local) just reads the plain-markdown body — no rejection, no Claude dependency. This is the **v2** skill — engine `template-v2.html`, fields in `schema.md`, per-platform install in `USAGE.md`.

## What this is

Arcgram is a human↔AI collaboration substrate: the AI externalizes its reasoning as a typed node-and-edge graph the human audits and adjusts, converging on ground truth that survives across turns, sessions, and agents. **The AI draws, the human audits.** (Full positioning: `README.md`.)

**Three guards keep the drawing honest** — internalize them before you build:

- A **node** is a diagram element — a component, step, decision, artifact, or tool. It is **not** an HTML/DOM/React node, and **not** an argument-map "claim." An **edge** carries flow or dependency — **not** "supports/contradicts."
- **The gap signal:** if a step can't be drawn as explicit nodes and edges, that's reasoning with a gap to expose — not a formality to skip.
- **Drawing exposes gaps; it does not certify correctness.** A graph you can draw can still be wrong.

---

## When to use
Reach for Arcgram when the structure of a thing — or of your reasoning about it — gets hard to hold in plain text:
- a system map, dependency graph, topology, architecture, or data/work flow
- "show me how X connects to Y" — relationships or lifecycles hard to track in prose
- a decision / thinking flow (branches, forks) you want **checkable**, not just described
- several people or agents need one shared, point-at-able source of truth

## Do NOT use for
Charts (use a chart tool) · sequence diagrams (use a sequence-diagram tool) · mind maps · auto-layout graphs with hundreds of nodes (this skill assumes deliberate manual placement).

## Files in this skill bundle
| File | Purpose |
|---|---|
| `template-v2.html` | Renderer engine + `DATA SECTION`. Copy it, fill the data near the top, re-open in a browser. One self-contained file — theme inlined. |
| `schema.md` | **Full field reference — the single source** for every node / edge / band / column field. Read it; don't author a schema from memory. |
| `layout-tips.md` | Positioning + edge-routing heuristics. |
| `examples/` | Worked diagrams (system map · H bands · decision diamonds · workflow) — open one first. |
| `skills/checkpoint/`, `reconcile/`, `validate/` | Headless validators — see step 7. |
| `extensions/` | Optional overlays for a rendered flow — notably `arcgram-bugmarks.js`, the **Audit** defect-review UI. See § Audit. |
| `themes/` | `base.css` + `default.css` — reference palette for forking. Optional at runtime: an export inlines the active theme, so the exported diagram needs no themes folder. |
| `new-flow.mjs` | Scaffold a blank flow into `output/`: `node new-flow.mjs my-flow`. |
| `output/` | **Default home for the flows you generate.** Yours — not part of the release, not leak-scanned, not shipped. |

---

## Choose the layout first (pin before building — it's hard to undo)

Pin the layout before you draw — later edits build on it. There are two decisions, and the agent should **derive a recommendation from the flow's logic and help the user confirm it** rather than leave them to guess:

1. **Shape.** Do the nodes fall into **parallel categories** (subsystems, tracks, layers that coexist and wire across each other)? **Yes → group them:** `COLUMNS` (vertical) or `BANDS` (horizontal). **No** (one causal/branching chain) → **free DAG:** leave `COLUMNS`/`BANDS` empty, each node's role on its `cat`.
2. **Decisions.** Does it branch on yes/no forks? **Yes → add diamonds** (`kind:'diamond'`) — an overlay on *any* shape, not a separate option. See `schema.md § Decision diamond`.

| shape ↓ · decisions → | plain | + diamonds |
|---|---|---|
| parallel categories · vertical | V — `COLUMNS` | V + thinking |
| parallel categories · horizontal | H — `BANDS` | H + thinking |
| no categories (logic chain) | free DAG | free thinking-flow |

**Orientation (V vs H)** applies only when grouped and is the user's preference — so the agent proposes shape + decisions and **asks the user the reading direction** (default V): top→bottom story (lifecycles, pipelines) → `COLUMNS`; left→right stages/tracks → `BANDS` (`layout-tips.md §10b`). If the platform has a selection UI (`AskUserQuestion`), use it; otherwise ask inline and wait. ⚠ Never force a no-category chain into `COLUMNS`/`BANDS` — the tags float off their nodes. Keep the same mode on later edits unless the user asks to switch.

---

## Workflow

> **Hard gate — read before you draw.** Before you place a single node, read `schema.md` (every field) and `layout-tips.md` (routing + positioning), and open one file in `examples/`. Authoring from memory of how generic diagram tools look — skipping these reads — is the single biggest cause of broken graphs: drifted field names, all-to-all edge meshes, and wires routed straight through nodes. Skipping the reads is the bug, not a shortcut.
>
> **Decide Audit up front.** Ask the user whether they want an **Audit** defect review of the finished flow (§ Audit). Settle it before you draw — never auto-annotate defects with icons.

### 1. Understand the topology
Group nodes by category, decide reading direction, mark the critical connections. **Draw only the edges that exist in the real structure** — never wire every node in one group to every node in the next (a *mesh*). If a band-to-band connection comes out all-to-all, a structural element is missing (usually a convergence node — many inputs feed one decision); see `layout-tips.md §10b`. Logic-check the draft (step 7, pre-draw) before you place anything.

### 2. Read the references once
`schema.md` for every field, `layout-tips.md` for positioning — read them instead of inlining a schema from memory. `schema.md` is gated against the engine (`schema-xref`), so any drift is caught.

### 3. Pin layout + sizing
Pin the shape before drawing (§ Choose the layout first). The engine sizes nodes from their labels — you don't set `w`/`h` except on diamonds. Plan spacing per `schema.md § Sizing rules of thumb` + `layout-tips.md §3`.

### 4. Fill the DATA SECTION
Scaffold a copy into `output/` — `node new-flow.mjs my-flow` → `output/my-flow.html` — (or copy `template-v2.html` by hand). Then in the `DATA SECTION` set `<title>`, the title lines, `W`/`H`, and fill `nodes[]`, `edges[]`, and optionally `BANDS[]`, `COLUMNS{}` / `HCOLUMNS[]`, `CANVASES[]`, `STATUS_LEGEND{}`. Minimal shape (full fields: `schema.md § Node` / `§ Edge`):

```js
// node — required: id, label, cat, type, desc, x, y
{ id:'FEED', label:'Feeding', cat:'CORE LOOP', type:'core',
  role:'action', desc:'Tap to feed.\nRestores hunger.', x:220, y:120 }
// edge — required: f, t, fromPt, toPt
{ f:'FEED', t:'FOOD', fromPt:'bot', toPt:'top', route:'vhv', style:'solid' }
```

Declare node ownership on **both sides** — a node's `band`/`free` (plus `column`/`colFree` in H) and the band/column `members[]` must agree (gated A27/A28). The engine does the rest: bands auto-fit, lanes auto-grow, loose entry nodes wrap in a LIFECYCLE band. (`schema.md § Node ownership` · `§ Column ownership` · `§ Auto LIFECYCLE band` · `§ Canvas filter`.)

### 5. Features & styling — all optional, all in the references
Add only what the flow needs; every field is defined in `schema.md`, every heuristic in `layout-tips.md`:
- **Node types** — built-ins + the custom-type recipe: `§ Adding a custom type`.
- **Edge routing** — `vhv`/`hvh`/`3leg` per edge; pick `fromPt`/`toPt` so lines exit/enter clean (arrowhead points at `toPt`): `§ Routers` + `layout-tips.md §6, §9`.
- **Edge styling** — solid/dashed/bold + `crit`: `§ Edge styling decision matrix`.
- **Critical paths** — `crit:true` + `lbl:'🔑N +verb'`, 3–7 per 30 edges: `layout-tips.md §8`.
- **Decisions** — `kind:'diamond'` + `branch:'Y'/'N'`: `§ Decision diamond`.
- **Status dots + author flags** — `status` (+ `STATUS_LEGEND`) and `flag` (a lightweight per-node "look here" note): `§ Status dot` · `§ Audit marker`. For a real **defect review** — bugs, logic holes, geometry defects like a wire through a node — use the **Audit** extension, not `flag` icons (§ Audit).

### 6. Render — three modes (fall back in order; don't skip ahead)
- **Mode 1 — inline interactive widget.** Render `template-v2.html` via the host's HTML tool (e.g. `mcp__visualize__show_widget`). Pan/zoom/hover native — best for iteration.
- **Mode 2 — inline static SVG (your own output, not a tool call).** If Mode 1 is unavailable, write an `<svg>…</svg>` block directly in your reply, using arcgram conventions (bands as rects, nodes border+dark bg, `vhv`/`hvh`/`3leg` edges, pills, crit red). Don't switch to a different diagram tool — the chat-native SVG routes *around* the failed tool.
- **Mode 3 — standalone HTML export.** Write `template-v2.html` with your data to a file the user opens. Always available with filesystem access; use for handoff.

### 7. Self-check — run the validators (headless Node, under `skills/<tool>/`)
The diagram is a *spec* — check it, don't eyeball the render.
**Pre-draw** (as soon as `nodes`/`edges` exist) — Checkpoint catches dangling edges, orphans, a diamond missing a branch, duplicate ids:
```bash
node skills/checkpoint/checkpoint.mjs your.html
```
**Post-draw** — Validate runs Checkpoint always, and Reconcile too when you pass matching code (a no-code run reports INCOMPLETE, never a silent pass):
```bash
node skills/validate/validate.mjs your.html [code-file ...]
```
The engine also self-checks on render (stamps `self-check ran … | N findings` into the subtitle); the CLI is the enforce-by-construction version.

### 8. Save + syntax-check (Mode 3)
Extract the inline JS and syntax-check before opening — catches typos that silently blank the canvas:
```bash
awk '/<script>/{flag=1;next}/<\/script>/{flag=0}flag' your.html > /tmp/x.js && node --check /tmp/x.js
```
Open in browser. Confirm.

---

## Audit — defect review (opt-in; use the extension, not `flag` icons)

Audit is a defect-review overlay for a *drawn* flow: a pulsing ring + a short reason tag on each marked node or edge, plus an "Audit" findings list. It **self-hides when there are no marks**, so a clean flow looks identical with or without it.

**Ask first, mark only when asked.** Offer the user an Audit pass and settle it up front — do not auto-annotate defects.

**Use the extension — not the `flag` field.** The Audit UI is `extensions/arcgram-bugmarks.js`. The per-node `flag` field draws a small icon but is *not* the Audit overlay — it must never stand in for a defect review. Load the extension *after* the engine (inline the `<script>` for a self-contained file), then call `ArcgramBugs.set([...])`:

```html
<script src="extensions/arcgram-bugmarks.js"></script>
<script>
  ArcgramBugs.set([
    { level:'high',   anchor:{ node:'NODE_ID' },       reason:'wire crosses node', desc:'route around — a wire through a node is a level-1 defect' },
    { level:'medium', anchor:{ edge:{ f:'A', t:'B' } }, reason:'authored concern',  desc:'…' }
  ]);
</script>
```

`level` marks the source: **`high`** = a gate / geometry defect (e.g. a wire through a node), **`medium`** = an authored concern, **`low`** = an agent advisory. Anchor each mark to a `node:'ID'` or an `edge:{ f, t }`. Full API + fields: `extensions/README.md`.

---

## Hard rules

Non-negotiables. Adjust everything else freely; these hold on every diagram.

- **Write permission (two halves).** The agent edits **only the DATA SECTION** — everything below `END OF DATA SECTION` is the engine, off-limits. AND the agent **proposes; the human holds final write-authority** — draft and adjust the diagram data freely, but do not commit it as final shared ground truth without the human's confirmation.
- **Author from `schema.md`, never from memory** of what generic diagram tools look like. Read this body + `schema.md` before generating; name fields, don't invent them.
- **Single source.** `schema.md` owns every field; `README.md` owns the positioning. Point to them — don't restate a field definition or re-argue the job inside this file.
- **Keep attribution.** The "Made with Arcgram" mark + `NOTICE` stay intact when you redistribute (Apache §4(d)); an unbranded / no-attribution build needs the commercial license (`WATERMARK-AND-COMMERCIAL-TERMS.md`).

---

## License
**Apache-2.0.** Attribution rules → `§ Hard rules` (the canonical copy); full terms, trademark, and the unbranded commercial build → `LICENSE` · `NOTICE` · `WATERMARK-AND-COMMERCIAL-TERMS.md`.
