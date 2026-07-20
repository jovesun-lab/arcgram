#!/usr/bin/env node
// checkpoint.mjs - Checkpoint: the Arcgram logic self-check validator.
//
// WHAT IT IS. A public, agent-neutral, tool-type validator. You feed it one Arcgram
// (the diagram, treated as a *spec*); it answers a single question: is this flow a
// valid, coherent spec? It returns typed findings. It is an instrument (a callable
// check), not the orchestrator (the work-loop that decides when to call it).
//
// WHAT IT IS NOT. (1) Not the geometry/drawing-quality checker - the engine's internal
// scanners check "is the diagram drawn cleanly" (overlaps, spacing, routing, pixels);
// Checkpoint reads ZERO geometry. (2) Not semantic correctness - whether the logic is
// actually right stays a human call. Checkpoint is a structural type-checker.
//
// THE RED LINE (load-bearing). Rules may read ONLY the semantic field values of
// nodes/edges - id, f, t, kind, role, type (+ optional status, flag). NEVER a coordinate,
// pixel, color, size, spacing, or any CSS quantity. The judge, one line: am I reading a
// semantic string, or a rendered visual quantity? Semantic string -> allowed.
//
// OUTPUT - mark, don't block. The validator never halts the agent; it annotates.
// Each finding is { id, type, severity, note }. severity is "defect" (a confirmed
// finding) or "uncovered" (could not reach a verdict). The run-level attestation
// "self-check ran HH:MM:SS | N findings | M unchecked" is clean only when N=0 AND M=0,
// so "checked & clean" never looks identical to "never checked".
//
// SCOPE (Tier B v1.1). Tier A (structural integrity) always runs. Tier B
// (justification coherence) AUTO-RUNS on a thinking/
// logic flow - detected exactly as the engine does: a diagram with >=1 decision diamond
// (mirrors the engine's `_isThinkflow = nodes.some(n => n.kind === 'diamond')`). Functional/
// system/storyboard/pipeline diagrams (no diamond) skip Tier B by default. Override either
// way with { tierB: true|false } / --tier-b / --no-tier-b.
//
// Usage:  node checkpoint.mjs <diagram.html | diagram.json>   [--tier-b | --no-tier-b] [--json]
//    or:  node checkpoint.mjs < diagram.json
//   import: import { checkpoint } from './checkpoint.mjs';  checkpoint({nodes, edges, meta})

import fs from 'fs';

// Recognized node roles (Tier B). Closed enumeration - the public `role` vocabulary.
// Coherence-bearing (drive the justification rules): goal, action, decision.
// Recognized structural (valid, but no rule keys off them - pass-through in the justification
// graph): constraint, evidence, state, output. `state`/`output` are the flow/systems vocabulary
// the shipped examples use; reconciled into the closed set so a thinking flow that
// carries them is not falsely role-uncovered.
const ROLES = new Set(['goal', 'constraint', 'decision', 'action', 'evidence', 'state', 'output']);
// Declared-standalone node types: deliberately edge-less, exempt from orphan + island checks.
const STANDALONE_TYPES = new Set(['open']);

function timestamp(now) {
  const d = now instanceof Date ? now : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// The pure validator. Reads only semantic fields. No I/O, no geometry, no engine.
// ---------------------------------------------------------------------------
export function checkpoint(diagram, opts = {}) {
  const nodes = Array.isArray(diagram && diagram.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram && diagram.edges) ? diagram.edges : [];
  const bands = Array.isArray(diagram && (diagram.bands || diagram.BANDS)) ? (diagram.bands || diagram.BANDS) : [];
  const meta = (diagram && (diagram.meta || diagram.ARCGRAM_META)) || null;
  // Tier B auto-runs on a thinking/logic flow (a diagram with a decision diamond), exactly as
  // the engine gates its thinking-flow passes (`_isThinkflow`). Explicit opts.tierB (true|false)
  // overrides the auto-detection either way.
  const hasDiamond = nodes.some((n) => n && n.kind === 'diamond');
  const tierB = opts.tierB === undefined ? hasDiamond : !!opts.tierB;

  const findings = [];
  const add = (type, severity, id, note) =>
    findings.push({ id: id == null ? null : id, type, severity, note });

  // -- empty diagram: nothing to validate -> UNCOVERED, never falsely "clean" --
  // (an empty starter template hasn't been checked against anything; do not merge
  //  "nothing to check" with "checked & clean" - same anti-silent-pass principle as the
  //  per-node [?] marker and the run-level "M unchecked" stamp).
  if (nodes.length === 0)
    add('empty-diagram', 'uncovered', null,
      'no nodes - nothing to validate (a starter template or an empty diagram)');

  // -- A-5 (part) schema/version present --
  if (!meta || meta.version == null || meta.version === '')
    add('missing-meta-version', 'defect', null,
      'ARCGRAM_META.version is absent - the diagram declares no schema version');

  // -- A-5 (part) required fields + A-6 id uniqueness --
  const idSet = new Set();
  const seen = new Set();
  for (const n of nodes) {
    if (!n || n.id == null || n.id === '') { add('missing-field', 'defect', null, 'a node has no id'); continue; }
    if (seen.has(n.id)) add('duplicate-id', 'defect', n.id, `node id "${n.id}" is used more than once`);
    seen.add(n.id); idSet.add(n.id);
  }
  for (const e of edges) {
    if (!e || e.f == null || e.t == null)
      add('missing-field', 'defect', (e && (e.f != null ? e.f : e.t)) || null,
        `an edge is missing f or t (${e ? `f=${e.f} t=${e.t}` : 'null edge'})`);
  }

  // -- A-5 (part) BAND COLOR SCHEMA — the v1 fields are DEAD in v2 and fail SILENTLY --
  // The v2 engine's _visualBands() reads ONLY `fill` and `color` (identical to COLUMNS). A band
  // written with v1's `areaBg` / `tagFill` / `tagColor` — or missing fill/color — resolves to
  // themed(undefined): the band still "exists" but renders TRANSPARENT with a fallback chip. Nothing
  // in the engine complains, so an author reading an out-of-date reference ships an invisible band and
  // is told "self-check passed". This is a structural type error on the spec, which is exactly what
  // Checkpoint is for — it is not a geometry judgement, so it stays inside the tool's boundary.
  const DEAD_BAND_FIELDS = ['areaBg', 'tagFill', 'tagColor'];
  bands.forEach((b, i) => {
    if (!b || typeof b !== 'object') return;
    if (b.group) return;                                   // group bands are stroke-only overlays: fill-exempt
    const name = b.id || b.label || `BANDS[${i}]`;
    const dead = DEAD_BAND_FIELDS.filter((k) => b[k] != null);
    if (dead.length)
      add('dead-band-schema', 'defect', name,
        `band "${name}" uses the v1 field(s) ${dead.join('/')} - the v2 engine reads only fill/color, so this band renders TRANSPARENT (migrate: tagFill->fill, tagColor->color, drop areaBg)`);
    else if (b.fill == null || b.color == null)
      add('dead-band-schema', 'defect', name,
        `band "${name}" is missing ${b.fill == null ? 'fill' : ''}${b.fill == null && b.color == null ? ' and ' : ''}${b.color == null ? 'color' : ''} - an unresolvable band color renders TRANSPARENT with a fallback chip`);
  });

  // -- A-1 referential integrity / no dangling edge --
  // A BAND / GROUP-BOX id is a LEGAL edge endpoint: `t:'BAND_ID'` (no inner node id) lands the wire on
  // the container's box edge — the engine's band-target path in buildPaths, used by the shipped
  // example-bands.html itself. Resolving edges against nodes ALONE reported that convention as a
  // dangling edge: the self-check called the engine's own example broken. Endpoints resolve against
  // node ids UNION band ids.
  const bandIdSet = new Set(bands.map((b) => b && b.id).filter((x) => x != null && x !== ''));
  const endpointOk = (id) => idSet.has(id) || bandIdSet.has(id);
  for (const e of edges) {
    if (!e || e.f == null || e.t == null) continue; // already flagged by missing-field
    const fOk = endpointOk(e.f), tOk = endpointOk(e.t);
    if (fOk && tOk) continue;
    const realEnd = fOk ? e.f : (tOk ? e.t : null);
    const missing = !fOk ? e.f : e.t;
    add('dangling-edge', 'defect', realEnd,
      `edge ${e.f}->${e.t} references "${missing}", which is neither a node nor a band/group id`);
  }

  // -- degree (resolvable endpoints only), for A-2 --
  // ⚠️ EVERY id-keyed map here is PROTOTYPE-FREE (`Object.create(null)`), and that is load-bearing, not
  // style. A node id is an AUTHOR STRING. On a plain `{}`, an id like `toString` / `constructor` /
  // `valueOf` / `hasOwnProperty` inherits a truthy value from Object.prototype — so a membership test
  // silently passes, a lookup returns a FUNCTION, and `groups[r].push(...)` THREW. Arcgram draws code:
  // a node called `constructor` is not exotic, it is Tuesday. See the guard cases in the selftest.
  const deg = Object.create(null);
  for (const id of idSet) deg[id] = 0;
  for (const e of edges) {
    if (!e) continue;
    if (idSet.has(e.f)) deg[e.f]++;
    if (idSet.has(e.t)) deg[e.t]++;
  }

  // -- A-2 no broken orphan (every node needs >=1 edge, except declared standalone) --
  for (const n of nodes) {
    if (!n || n.id == null) continue;
    if ((deg[n.id] || 0) > 0) continue;
    if (STANDALONE_TYPES.has(n.type)) continue; // declared standalone -> OK
    add('orphan-node', 'defect', n.id,
      `node "${n.id}" has no attached edge - the chain is broken (the behavior it represents never triggers)`);
  }

  // -- A-3 branch completeness (every diamond carries both a Y and an N branch) --
  for (const n of nodes) {
    if (!n || n.kind !== 'diamond') continue;
    const outs = edges.filter((e) => e && e.f === n.id);
    const hasY = outs.some((e) => e.branch === 'Y');
    const hasN = outs.some((e) => e.branch === 'N');
    if (hasY && hasN) continue;
    const missing = [!hasY ? 'Y' : null, !hasN ? 'N' : null].filter(Boolean).join(' + ');
    add('missing-branch', 'defect', n.id,
      `decision "${n.id}" is missing its ${missing} branch (a diamond needs both a Y and an N outgoing branch)`);
  }

  // -- A-4 loop closure / no disconnected island (weak connectivity over non-standalone nodes) --
  islandCheck(nodes, edges, add);

  // -- Tier B (gated; v1.1) justification coherence --
  if (tierB) coherenceCheck(nodes, edges, idSet, add);

  const defects = findings.filter((f) => f.severity === 'defect').length;
  const unchecked = findings.filter((f) => f.severity === 'uncovered').length;
  const attestation = `self-check ran ${timestamp(opts.now)} | ${defects} findings | ${unchecked} unchecked`;
  return {
    findings,
    summary: { nodes: nodes.length, edges: edges.length, defects, unchecked, tierB },
    attestation,
    clean: defects === 0 && unchecked === 0,
  };
}

// A-4: a single coherent flow is one weakly-connected component. A second cluster with
// no edge joining it to the main flow is a dangling island / a loop never entered.
// Realizes the spec's "no open/dangling loop" without the false positives that pure
// directed reachability hits when a flow legitimately loops back to its entry node.
// type:'open' nodes are declared standalone and are excluded from the check entirely.
function islandCheck(nodes, edges, add) {
  const core = [];
  const coreSet = new Set();
  for (const n of nodes) {
    if (!n || n.id == null || STANDALONE_TYPES.has(n.type)) continue;
    core.push(n.id); coreSet.add(n.id);
  }
  if (core.length <= 1) return; // 0 or 1 node -> no island possible

  const parent = Object.create(null);          // prototype-free: an id may be `constructor` / `toString`
  for (const id of core) parent[id] = id;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  for (const e of edges) if (e && coreSet.has(e.f) && coreSet.has(e.t)) union(e.f, e.t);

  const groups = Object.create(null);          // prototype-free: `groups['toString']` used to return a FUNCTION,
  for (const id of core) { const r = find(id); (groups[r] || (groups[r] = [])).push(id); }   // and .push() threw
  const comps = Object.values(groups);
  if (comps.length <= 1) return; // single connected flow -> clean

  comps.sort((a, b) => b.length - a.length); // largest = primary; the rest are islands
  for (const island of comps.slice(1))
    for (const id of island)
      add('disconnected-island', 'defect', id,
        `node "${id}" is in a subgraph disconnected from the main flow (a dangling island / a loop never joined to the rest)`);
}

// Tier B role resolution (whitelist-clean: explicit role, else kind, else type regex,
// else UNROLED park). DECISION: `cat` stays OFF the red-line whitelist - it is a
// freeform band/display-grouping label (drives grouping + colour), not a reasoning role, and
// `role` is authored on every node anyway, so cat-inference buys no coverage while blurring the
// schema-only red line. Unresolved -> UNROLED (an honest [?], never a guess).
function resolveRole(n) {
  if (n.role && ROLES.has(String(n.role).toLowerCase())) return String(n.role).toLowerCase();
  if (n.kind === 'diamond') return 'decision';
  const s = String(n.type || '').toLowerCase();
  if (/\bgoal\b/.test(s)) return 'goal';
  if (/\bdecision\b/.test(s)) return 'decision';
  if (/\bconstraint\b|\bguard\b/.test(s)) return 'constraint';
  if (/\bevidence\b|\bproof\b/.test(s)) return 'evidence';
  if (/\baction\b|\bstep\b/.test(s)) return 'action';
  return null; // UNROLED
}

// Tier B: structural justification-graph
// traceability. Honesty guard - assessable only with >=1 goal AND >=1 action resolved;
// otherwise NOT-ASSESSABLE (uncovered), never a false defect on a role-sparse flow.
function coherenceCheck(nodes, edges, idSet, add) {
  const roleOf = Object.create(null);          // prototype-free (id-keyed)
  for (const n of nodes) {
    if (!n || n.id == null) continue;
    if (STANDALONE_TYPES.has(n.type)) continue; // declared standalone -> not part of the flow, not role-checked
    const r = resolveRole(n);
    roleOf[n.id] = r;
    if (!r) add('role-uncovered', 'uncovered', n.id,
      `node "${n.id}" has no resolvable reasoning role - not evaluated by the coherence rules`);
  }
  const idsWith = (role) => nodes.filter((n) => n && roleOf[n.id] === role).map((n) => n.id);
  const goals = idsWith('goal'), actions = idsWith('action'), decisions = idsWith('decision');

  if (!goals.length || !actions.length) {
    add('coherence-not-assessable', 'uncovered', null,
      `coherence not evaluated - need >=1 goal AND >=1 action role-resolved (have goal ${goals.length}, action ${actions.length})`);
    return;
  }

  const fwd = Object.create(null), rev = Object.create(null);   // prototype-free (id-keyed)
  for (const id of idSet) { fwd[id] = []; rev[id] = []; }
  for (const e of edges) if (e && idSet.has(e.f) && idSet.has(e.t)) { fwd[e.f].push(e.t); rev[e.t].push(e.f); }
  const reach = (start, adj) => {
    const seen = new Set(), stk = [start];
    while (stk.length) { const x = stk.pop(); for (const y of (adj[x] || [])) if (!seen.has(y)) { seen.add(y); stk.push(y); } }
    return seen; // excludes start
  };
  const backToGoal = (id) => { for (const g of reach(id, rev)) if (roleOf[g] === 'goal') return true; return false; };
  const fwdToAction = (id) => { for (const a of reach(id, fwd)) if (roleOf[a] === 'action') return true; return false; };

  for (const a of actions) if (!backToGoal(a))
    add('orphan-action', 'defect', a, `action "${a}" has no justification chain back to any goal`);
  for (const g of goals) if (!fwdToAction(g))
    add('dead-goal', 'defect', g, `goal "${g}" reaches no action downstream (goal->action broken)`);
  for (const d of decisions) if (!backToGoal(d))
    add('dangling-decision', 'defect', d, `decision "${d}" is not reachable from any goal (floating decision)`);
}

// ---------------------------------------------------------------------------
// Input extraction (CLI only - the core above never touches a file).
// ---------------------------------------------------------------------------
// Balanced-literal slice: from the declaration match, capture the bracketed literal,
// respecting strings (single/double/backtick) so brackets inside text are ignored.
function sliceLiteral(src, declRegex, open, close) {
  const m = declRegex.exec(src);
  if (!m) return null;
  const start = src.indexOf(open, m.index);
  if (start < 0) return null;
  let depth = 0, inStr = null, esc = false;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}

function extractFromHtml(src) {
  const evalLit = (lit) => (lit ? Function(`"use strict"; return (${lit});`)() : null);
  const nodes = evalLit(sliceLiteral(src, /\b(?:const|let|var)\s+nodes\s*=/, '[', ']')) || [];
  const edges = evalLit(sliceLiteral(src, /\b(?:const|let|var)\s+edges\s*=/, '[', ']')) || [];
  const bands = evalLit(sliceLiteral(src, /\b(?:const|let|var)\s+BANDS\s*=/, '[', ']')) || [];
  const meta = evalLit(sliceLiteral(src, /ARCGRAM_META\s*=/, '{', '}'));
  return { nodes, edges, bands, meta };
}

function parseInput(raw, file) {
  const looksHtml = (file && /\.html?$/i.test(file)) || /<\s*html|<\s*script|ARCGRAM_META/i.test(raw.slice(0, 4000));
  if (looksHtml) return extractFromHtml(raw);
  const j = JSON.parse(raw);
  // accept {nodes,edges,meta} OR an internal audit wrapper {engine:{nodes,edges}}
  if (j.engine && (j.engine.nodes || j.engine.edges))
    return { nodes: j.engine.nodes || [], edges: j.engine.edges || [], bands: j.engine.bands || j.engine.BANDS || [], meta: j.meta || j.ARCGRAM_META || null };
  return { nodes: j.nodes || [], edges: j.edges || [], bands: j.bands || j.BANDS || [], meta: j.meta || j.ARCGRAM_META || null };
}

function printReport(rep, file) {
  console.log(`CHECKPOINT - logic self-check (${file || 'stdin'})`);
  console.log(`  nodes: ${rep.summary.nodes}  edges: ${rep.summary.edges}  tierB: ${rep.summary.tierB ? 'on' : 'off'}`);
  for (const f of rep.findings) {
    const tag = f.severity === 'defect' ? '[!]' : '[?]';
    console.log(`     ${tag} [${f.type}] ${f.id != null ? f.id : '(graph)'} - ${f.note}`);
  }
  console.log(`  ${rep.attestation}`);
  console.log(`  VERDICT: ${rep.clean ? 'CLEAN - valid, coherent spec' : (rep.summary.defects ? 'FINDINGS (' + rep.summary.defects + ')' : 'CLEAN defects, ' + rep.summary.unchecked + ' UNCHECKED')}`);
}

// Run as CLI only when invoked directly (not when imported).
const invokedDirectly = process.argv[1] && /checkpoint\.mjs$/.test(process.argv[1]);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const opts = {};
  if (args.includes('--tier-b')) opts.tierB = true;          // force on
  else if (args.includes('--no-tier-b')) opts.tierB = false; // force off
  // else: leave undefined -> auto-detect (Tier B on iff the diagram has a decision diamond)
  const asJson = args.includes('--json');
  const file = args.find((a) => !a.startsWith('--'));
  const go = (raw) => {
    let diagram;
    try { diagram = parseInput(raw, file); }
    catch (e) { console.error(`checkpoint: could not parse input - ${e.message}`); process.exit(2); }
    const rep = checkpoint(diagram, opts);
    if (asJson) console.log(JSON.stringify(rep, null, 2));
    else printReport(rep, file);
    process.exitCode = rep.summary.defects ? 1 : 0; // advisory (mark-don't-block)
  };
  if (file) go(fs.readFileSync(file, 'utf8'));
  else { let raw = ''; process.stdin.on('data', (d) => (raw += d)).on('end', () => go(raw)); }
}
