// checkpoint-selftest.mjs - proves Checkpoint catches each violation class, passes a
// clean baseline, and does NOT false-positive on the legitimate cases (loop-back to the
// entry node; declared type:'open' standalone). Self-contained synthetic diagrams.
// Pure ASCII output (machine-output discipline). Usage: node checkpoint-selftest.mjs
import { checkpoint } from './checkpoint.mjs';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' - ' + detail : ''}`);
  ok ? pass++ : fail++;
};
const has = (rep, type, id) => rep.findings.some((f) => f.type === type && (id === undefined || f.id === id));
const META = { name: 'Test', version: 'v2' };

console.log('CHECKPOINT SELF-TEST');

// A clean, valid flow: START -> CHK(diamond) -> STEP -> END, the diamond has both branches.
// Role-tagged so it is also coherence-clean: the diamond makes this a thinking flow, so Tier B
// AUTO-RUNS on it (v1.1). goal -> decision -> action -> output is a complete justification chain.
const cleanFlow = () => ({
  meta: META,
  nodes: [
    { id: 'START', type: 'session',    role: 'goal' },
    { id: 'CHK',   type: 'tool', kind: 'diamond' },   // -> decision (auto from kind)
    { id: 'STEP',  type: 'code',       role: 'action' },
    { id: 'END',   type: 'sessionEnd', role: 'output' },
  ],
  edges: [
    { f: 'START', t: 'CHK' },
    { f: 'CHK', t: 'STEP', branch: 'Y' },
    { f: 'CHK', t: 'END', branch: 'N' },
    { f: 'STEP', t: 'END' },
  ],
});

// 0. clean baseline -> 0 defects, 0 unchecked, clean.
{ const r = checkpoint(cleanFlow());
  check('clean baseline is CLEAN (0 defects, 0 unchecked)', r.clean && r.summary.defects === 0 && r.summary.unchecked === 0,
    `defects ${r.summary.defects}, unchecked ${r.summary.unchecked}`); }

// 1. dangling-edge: an edge points at a non-existent node.
{ const d = cleanFlow(); d.edges.push({ f: 'STEP', t: 'GHOST' });
  const r = checkpoint(d); check('catches a dangling-edge', has(r, 'dangling-edge'), `defects ${r.summary.defects}`); }

// 2a. orphan-node: a node with no attached edge.
{ const d = cleanFlow(); d.nodes.push({ id: 'LONE', type: 'doc' });
  const r = checkpoint(d); check('catches an orphan-node', has(r, 'orphan-node', 'LONE')); }
// 2b. a declared type:'open' standalone is EXEMPT (no orphan finding).
{ const d = cleanFlow(); d.nodes.push({ id: 'FUTURE', type: 'open' });
  const r = checkpoint(d); check('type:open standalone is exempt from orphan', !has(r, 'orphan-node', 'FUTURE') && r.clean); }

// 3. missing-branch: a diamond missing its N branch.
{ const d = cleanFlow(); d.edges = d.edges.filter((e) => !(e.f === 'CHK' && e.branch === 'N'));
  // re-wire END so it is not orphaned, keeping the test focused on the missing branch
  d.edges.push({ f: 'STEP', t: 'END' });
  const r = checkpoint(d); check('catches a diamond missing a branch', has(r, 'missing-branch', 'CHK')); }

// 4. duplicate-id.
{ const d = cleanFlow(); d.nodes.push({ id: 'STEP', type: 'code' });
  const r = checkpoint(d); check('catches a duplicate node id', has(r, 'duplicate-id', 'STEP')); }

// 5. missing-meta-version.
{ const d = cleanFlow(); d.meta = { name: 'Test' };
  const r = checkpoint(d); check('catches a missing schema version', has(r, 'missing-meta-version')); }

// 6. missing-field: an edge with no target.
{ const d = cleanFlow(); d.edges.push({ f: 'STEP' });
  const r = checkpoint(d); check('catches an edge missing f/t', has(r, 'missing-field')); }

// 7a. disconnected-island: a second cluster with no edge to the main flow.
{ const d = cleanFlow(); d.nodes.push({ id: 'ISL_A', type: 'code' }, { id: 'ISL_B', type: 'code' });
  d.edges.push({ f: 'ISL_A', t: 'ISL_B' });
  const r = checkpoint(d); check('catches a disconnected island', has(r, 'disconnected-island')); }
// 7b. loop-back to the ENTRY node must NOT false-positive A-4 (the common, legitimate case).
{ const d = cleanFlow(); d.edges.push({ f: 'END', t: 'START' }); // retry/loop-back to entry
  const r = checkpoint(d); check('loop-back to entry does NOT false-positive A-4', !has(r, 'disconnected-island') && r.clean,
    `defects ${r.summary.defects}`); }

// 7c. an empty diagram is UNCOVERED (not falsely clean).
{ const r = checkpoint({ meta: META, nodes: [], edges: [] });
  check('empty diagram is UNCOVERED, not clean', has(r, 'empty-diagram') && !r.clean && r.summary.defects === 0,
    `defects ${r.summary.defects}, unchecked ${r.summary.unchecked}`); }

// 8a. AUTO-TRIGGER: a diagram WITH a decision diamond auto-runs Tier B (no opts) - mirrors the
//     engine's _isThinkflow. A role-less node then honestly surfaces as role-uncovered.
{ const d = { meta: META,
    nodes: [{ id: 'G', role: 'goal' }, { id: 'D', kind: 'diamond' }, { id: 'A', role: 'action' }, { id: 'N', type: 'tool' }],
    edges: [{ f: 'G', t: 'D' }, { f: 'D', t: 'A', branch: 'Y' }, { f: 'D', t: 'N', branch: 'N' }] };
  const r = checkpoint(d); // no opts -> auto
  check('auto-trigger: a diamond turns Tier B on by default',
    r.summary.tierB === true && has(r, 'role-uncovered', 'N'), `tierB ${r.summary.tierB}`); }
// 8b. AUTO-TRIGGER: a diagram with NO diamond (functional/system/pipeline) skips Tier B.
{ const d = { meta: META, nodes: [{ id: 'A', type: 'code' }, { id: 'B', type: 'doc' }], edges: [{ f: 'A', t: 'B' }] };
  const r = checkpoint(d); // no opts -> auto
  check('auto-trigger: no diamond keeps Tier B off',
    r.summary.tierB === false && !has(r, 'role-uncovered') && !has(r, 'coherence-not-assessable'), `tierB ${r.summary.tierB}`); }
// 8c. OVERRIDE: { tierB:false } forces Tier B off even on a diamond flow.
{ const r = checkpoint(cleanFlow(), { tierB: false });
  check('override: tierB:false forces off on a diamond flow',
    r.summary.tierB === false && !has(r, 'role-uncovered') && !has(r, 'coherence-not-assessable')); }
// 8d. OVERRIDE: { tierB:true } forces Tier B on even with no diamond.
{ const d = { meta: META, nodes: [{ id: 'G', role: 'goal' }, { id: 'A', role: 'action' }], edges: [{ f: 'G', t: 'A' }] };
  const r = checkpoint(d, { tierB: true });
  check('override: tierB:true forces on with no diamond', r.summary.tierB === true, `tierB ${r.summary.tierB}`); }
// 8e. ROLE VOCAB: state + output are recognized (NOT role-uncovered) on a thinking flow.
{ const d = { meta: META,
    nodes: [{ id: 'G', role: 'goal' }, { id: 'D', kind: 'diamond' }, { id: 'A', role: 'action' },
            { id: 'S', role: 'state' }, { id: 'O', role: 'output' }],
    edges: [{ f: 'G', t: 'D' }, { f: 'D', t: 'A', branch: 'Y' }, { f: 'D', t: 'S', branch: 'N' }, { f: 'A', t: 'O' }] };
  const r = checkpoint(d); // auto (has diamond)
  check('role vocab: state + output are recognized, not role-uncovered',
    !has(r, 'role-uncovered') && r.clean, `defects ${r.summary.defects}, unchecked ${r.summary.unchecked}`); }

// 9a. Tier B on: a coherent goal->action graph is clean of coherence defects.
{ const d = { meta: META,
    nodes: [{ id: 'G', role: 'goal' }, { id: 'A', role: 'action' }, { id: 'EV', role: 'evidence' }],
    edges: [{ f: 'G', t: 'A' }, { f: 'A', t: 'EV' }] };
  const r = checkpoint(d, { tierB: true });
  check('Tier B: coherent graph has no coherence defect', !has(r, 'orphan-action') && !has(r, 'dead-goal') && !has(r, 'dangling-decision'),
    `defects ${r.summary.defects}`); }
// 9b. Tier B on: an action with no goal upstream is an orphan-action.
{ const d = { meta: META,
    nodes: [{ id: 'G', role: 'goal' }, { id: 'A', role: 'action' }, { id: 'C', role: 'constraint' }, { id: 'AO', role: 'action' }],
    edges: [{ f: 'G', t: 'A' }, { f: 'C', t: 'AO' }] };
  const r = checkpoint(d, { tierB: true });
  check('Tier B: catches an orphan-action', has(r, 'orphan-action', 'AO')); }
// 9c. Tier B honesty guard: a role-sparse flow is NOT-ASSESSABLE (uncovered), never a false defect.
{ const d = { meta: META,
    nodes: [{ id: 'H', type: 'tool' }, { id: 'X', type: 'tool', kind: 'diamond' }, { id: 'O', type: 'doc' }],
    edges: [{ f: 'H', t: 'X' }, { f: 'X', t: 'O' }] };
  const r = checkpoint(d, { tierB: true });
  check('Tier B: role-sparse flow is NOT-ASSESSABLE (uncovered, no false defect)',
    has(r, 'coherence-not-assessable') && !has(r, 'orphan-action') && !has(r, 'dead-goal')); }

// 10. BAND COLOR SCHEMA — the v1 fields are dead in v2 and fail silently (band renders transparent).
// 10a. a band written with v1's areaBg/tagFill/tagColor is caught.
{ const d = cleanFlow();
  d.bands = [{ id: 'CORE', label: 'CORE', y: 100, h: 200, areaBg: 'rgba(20,20,50,.14)', tagFill: '#1e1e3a', tagColor: '#9b8cff' }];
  const r = checkpoint(d); check('catches a v1-schema band (areaBg/tagFill/tagColor)', has(r, 'dead-band-schema', 'CORE'), `defects ${r.summary.defects}`); }
// 10b. a band missing fill/color is caught (unresolvable color -> transparent band).
{ const d = cleanFlow(); d.bands = [{ id: 'NOCOLOR', label: 'NOCOLOR', y: 100, h: 200 }];
  const r = checkpoint(d); check('catches a band with no fill/color', has(r, 'dead-band-schema', 'NOCOLOR')); }
// 10c. the correct 2-field band passes.
{ const d = cleanFlow(); d.bands = [{ id: 'CORE', label: 'CORE', y: 100, h: 200, fill: '#1e1e3a', color: '#9b8cff' }];
  const r = checkpoint(d); check('a clean fill/color band passes', !has(r, 'dead-band-schema') && r.clean); }
// 10d. a group band is a stroke-only overlay -> fill-exempt (color only, no false defect).
{ const d = cleanFlow(); d.bands = [{ id: 'GRP', label: 'GRP', group: true, y: 100, h: 200, color: '#9b8cff' }];
  const r = checkpoint(d); check('a group band is fill-exempt', !has(r, 'dead-band-schema') && r.clean); }
// 10e. no bands at all (V layout / free DAG) -> no band findings.
{ const r = checkpoint(cleanFlow()); check('a band-less diagram raises no band finding', !has(r, 'dead-band-schema') && r.clean); }

// 11. BAND-TARGET edges — `t:'BAND_ID'` lands the wire on the container box edge (the engine's
// band-target / group-box path, used by the shipped example-bands.html). It is NOT a dangling edge.
{ const d = cleanFlow();
  d.bands = [{ id: 'CORE', label: 'CORE', y: 100, h: 200, fill: '#1e1e3a', color: '#9b8cff' }];
  d.edges.push({ f: 'START', t: 'CORE' });                   // wire into the band container
  const r = checkpoint(d); check('a band-target edge is NOT dangling', !has(r, 'dangling-edge') && r.clean, `defects ${r.summary.defects}`); }
// 11b. ...but an unknown id is still dangling (the union must not swallow real breaks).
{ const d = cleanFlow();
  d.bands = [{ id: 'CORE', label: 'CORE', y: 100, h: 200, fill: '#1e1e3a', color: '#9b8cff' }];
  d.edges.push({ f: 'START', t: 'GHOST_BAND' });
  const r = checkpoint(d); check('an unknown id is still a dangling-edge', has(r, 'dangling-edge')); }

// 12. PROTOTYPE-KEY IDS — an id/type/role is an AUTHOR STRING, and every id-keyed map must be
// prototype-free. On a plain `{}`, `map['toString']` inherits a truthy value (a FUNCTION) from
// Object.prototype: a membership test silently passes, a real defect vanishes, a clean diagram is
// falsely flagged, and `groups[r].push(...)` THROWS. Arcgram draws code — a node named `constructor`
// is not a corner case. These are guard tests: they FAIL LOUD if anyone reintroduces a bare `{}`.
const PROTO_KEYS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];

// 12a. the crash: a prototype-named id inside an island check must not throw.
{ let threw = null;
  for (const k of PROTO_KEYS) {
    const d = cleanFlow();
    d.nodes.push({ id: k, type: 'doc', role: 'action' }, { id: k + '_2', type: 'doc', role: 'action' });
    d.edges.push({ f: k, t: k + '_2' });                       // a second, disconnected component
    try { checkpoint(d); } catch (e) { threw = `${k}: ${e.message}`; break; }
  }
  check('no crash on a prototype-named id (islandCheck groups/parent)', threw === null, threw || `${PROTO_KEYS.length} keys, none threw`); }

// 12b. a dangling edge to a prototype-named node is still CAUGHT (must not be swallowed).
{ let missed = null;
  for (const k of PROTO_KEYS) {
    const d = cleanFlow(); d.edges.push({ f: 'STEP', t: k });
    if (!has(checkpoint(d), 'dangling-edge')) { missed = k; break; }
  }
  check('a dangling edge to a prototype-named node is caught', missed === null, missed ? `MISSED: ${missed}` : 'all 5 keys caught'); }

// 12c. a node legitimately NAMED `toString` is NOT a duplicate-id (must not be invented).
{ let falsePos = null;
  for (const k of PROTO_KEYS) {
    const d = cleanFlow(); d.nodes.push({ id: k, type: 'doc', role: 'action' }); d.edges.push({ f: 'STEP', t: k });
    if (has(checkpoint(d), 'duplicate-id', k)) { falsePos = k; break; }
  }
  check('a prototype-named id is not a false duplicate-id', falsePos === null, falsePos ? `FALSE POSITIVE: ${falsePos}` : 'no false positives'); }

// 12d. a node whose TYPE is prototype-named is not falsely treated as a declared standalone.
{ const d = cleanFlow(); d.nodes.push({ id: 'LONE', type: 'constructor' });
  const r = checkpoint(d);
  check('type:"constructor" is NOT a declared standalone (orphan still caught)', has(r, 'orphan-node', 'LONE')); }

// 12e. a node whose ROLE is prototype-named resolves to UNROLED, not to a bogus role.
{ const d = cleanFlow(); d.nodes.push({ id: 'X', type: 'doc', role: 'valueOf' }); d.edges.push({ f: 'STEP', t: 'X' });
  const r = checkpoint(d);
  check('role:"valueOf" is UNROLED, not a bogus resolved role', has(r, 'role-uncovered', 'X')); }

// 12f. a BAND named with a prototype key is still a legal endpoint, and an unknown one still dangles.
{ const d = cleanFlow();
  d.bands = [{ id: 'toString', label: 'B', y: 100, h: 200, fill: '#1e1e3a', color: '#9b8cff' }];
  d.edges.push({ f: 'START', t: 'toString' });
  const ok = !has(checkpoint(d), 'dangling-edge');
  const d2 = cleanFlow();
  d2.bands = [{ id: 'CORE', label: 'CORE', y: 100, h: 200, fill: '#1e1e3a', color: '#9b8cff' }];
  d2.edges.push({ f: 'START', t: 'valueOf' });
  const caught = has(checkpoint(d2), 'dangling-edge');
  check('a prototype-named BAND is a legal endpoint; an unknown one still dangles', ok && caught, `legal=${ok} dangling=${caught}`); }

console.log(`\n  ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
