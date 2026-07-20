---
name: checkpoint
description: >-
  Validate an Arcgram diagram as a logic spec: is the flow well-formed and coherent?
  Reads node/edge structure (id/f/t/kind/role/type), never geometry. Typed findings -
  dangling edge, orphan node, missing branch, disconnected island, duplicate id, missing
  schema, plus optional coherence (every action traces to a goal). Marks, never blocks.
  Run after authoring or editing a diagram. Agent-neutral. Sibling to Reconcile
  (Checkpoint = structure; Reconcile = values).
---

# Checkpoint - Arcgram logic self-check validator

One input: a **diagram** (treated as a spec).
One question: **is the flow logic well-formed and coherent?**
Returns typed findings; marks, never blocks.

Sibling to Reconcile: Checkpoint checks **structure** from the diagram alone; Reconcile
checks **values** across diagram + code. Run both -> the diagram is a faithful, current spec.

It checks the graph's logic structure - **not** drawing quality (the engine auto-handles
overlaps/spacing/routing) and **not** semantic correctness (whether the logic is *right* - a
human call).

**Red line:** reads only the semantic field values `id`, `f`, `t`, `kind`, `role`, `type`
(plus optional `status`, `flag`). Never a coordinate, color, size, or spacing. The judge: am I
reading a semantic string, or a rendered visual quantity?

## Findings

**Tier A - structural integrity (always on).** Domain-agnostic graph theory.

| finding | means |
|---|---|
| `dangling-edge` | an edge points at an id that is not a node |
| `orphan-node` | a node has no edge (chain broken) - except a declared `type:'open'` |
| `missing-branch` | a decision (`kind:'diamond'`) lacks its Y or N branch |
| `disconnected-island` | a cluster with no edge to the main flow |
| `duplicate-id` | a node id used more than once |
| `missing-field` | a node has no id, or an edge no `f`/`t` |
| `missing-meta-version` | `ARCGRAM_META.version` absent |
| `empty-diagram` | no nodes - reported uncovered, never falsely "clean" |

**Tier B - justification coherence (auto-on for a thinking flow).** Does it read as reasoning:
every `action` traces back to a `goal`, every `goal` reaches an `action`, every `decision` sits
on a justification path. Auto-on when the diagram has a decision diamond (`kind:'diamond'`, = the
engine's `_isThinkflow`); no-diamond diagrams skip it. Override `--tier-b` / `--no-tier-b`. Roles:
`goal`/`action`/`decision` (coherence-bearing) + `constraint`/`evidence`/`state`/`output`
(recognized). No resolvable role -> `[?]` uncovered, never guessed. `cat` is not read.

Each finding is `{ id, type, severity, note }`; severity = `defect` or `uncovered`.

## Output (same contract as Reconcile)

```
{ findings:[{id,type,severity,note}], summary, attestation, clean }
self-check ran HH:MM:SS | N findings | M unchecked
```

**clean only when N=0 AND M=0** - "checked & clean" never looks like "never checked".
Human reads the marker; agent reads the `type`.

## Use

```sh
node checkpoint.mjs diagram.html [--tier-b | --no-tier-b] [--json]
cat diagram.json | node checkpoint.mjs
```
```js
import { checkpoint } from './checkpoint.mjs';
checkpoint({ nodes, edges, meta });
```

Exit 1 on any defect (advisory - never blocks).
Verify: `node checkpoint-selftest.mjs` (19 checks).
Render-time: the engine exposes the same check via `window.__arcgramInspect()` (the `checkpoint`
field of its result) + the on-canvas `[?]` badge and attestation stamp.
