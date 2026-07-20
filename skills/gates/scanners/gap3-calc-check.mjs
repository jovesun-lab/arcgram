

import { declarePopulation } from './_population.mjs';
import { loadEngine } from './_engine-load.mjs';
const STACK_GAP = 50, ALIGN_TOL = 1.5;
const cxOf = n => n.x + n.w / 2;

const isFreeLifecycleNode = n =>
  !!n && (n.type === 'session' || n.type === 'sessionEnd' || n.type === 'entry' || n.type === 'central-source');

function authoredCols(N) {
  const m = new Map();
  for (const n of N) {

    if (n.kind === 'diamond') continue;

    if (isFreeLifecycleNode(n)) continue;
    const k = Math.round(n._authoredX != null ? n._authoredX : n.x);
    (m.get(k) || m.set(k, []).get(k)).push(n);
  }
  return [...m.entries()]
    .map(([ax, mem]) => ({ ax, x: mem.reduce((s, n) => s + cxOf(n), 0) / mem.length, m: mem }))
    .sort((p, q) => p.ax - q.ax);
}
function gridFails(N) {
  const fails = [];
  for (const c of authoredCols(N)) {
    if (c.m.length < 2) continue;
    const cs = c.m.map(cxOf), spread = Math.max(...cs) - Math.min(...cs);
    if (spread > ALIGN_TOL) fails.push(`GRID col@${Math.round(c.x)} cx-spread ${spread.toFixed(1)} > ${ALIGN_TOL} (${c.m.map(n => n.id).join(',')})`);
  }
  return fails;
}

const F = process.argv[2];

const x = loadEngine(F);
const A = { engine: { nodes: x.nodes || [], edges: x.edges || [] }, __stDiag: globalThis.window.__stDiag || [] };
const N = A.engine.nodes, st = A.__stDiag || [];

if (N.some(n => n.kind === 'diamond')) {
  const yoT = (p, q) => p.y < q.y + q.h && q.y < p.y + p.h;
  const needT = {}; for (const l of st) { const m = l.match(/^(\S+)~(\S+).*need=(\d+)/); if (m) needT[m[1] + '|' + m[2]] = +m[3]; }
  const tf = [];
  let floorPairs = 0, demandPairs = 0;
  const sortedT = [...N].sort((a, b) => a.x - b.x);
  for (const a of sortedT) {
    const r = sortedT.find(b => b.id !== a.id && b.x > a.x + 1 && yoT(a, b));
    if (!r) continue;
    const gap = r.x - (a.x + a.w), nd = needT[a.id + '|' + r.id];
    floorPairs++;
    if (gap < STACK_GAP - 0.5) tf.push(`FLOOR ${a.id}~${r.id} gap ${gap.toFixed(0)} < ${STACK_GAP}`);
    if (nd != null) { demandPairs++; if (gap < nd - 1.5) tf.push(`DEMAND ${a.id}~${r.id} gap ${gap.toFixed(0)} < need ${nd}`); }
  }
  console.log('--- gap#3 calc check (THINKING-FLOW mode) ---');
  console.log('  GRID/TIGHT : not applicable — free-xy diamond/spine layout has no column grid (its centring rule is LI-2, asserted by spine-ctr #15 check 3)');
  console.log(`  FLOOR      : ${floorPairs} same-row adjacent pair(s) checked >= STACK_GAP ${STACK_GAP}`);
  console.log(`  DEMAND     : ${demandPairs} pair(s) carried a radar demand (__stDiag)`);
  declarePopulation({ 'floor-pairs': floorPairs, 'demand-pairs': demandPairs });
  console.log('\n' + (tf.length ? '❌ FAIL:\n  ' + tf.join('\n  ')
    : `✅ GAP#3 (thinking-flow): floor>=${STACK_GAP} on ${floorPairs} pair(s) · demand met on ${demandPairs}`));
  process.exit(tf.length ? 1 : 0);
}

if (N.length && N.every(n => n._authoredX == null)) {
  console.error('❌ gap3: the engine stamped NO _authoredX on any node — refusing to run.');
  console.error('   Grouping would silently fall back to final position (the OLD phantom/blind bug).');
  console.error('   The engine stamps n._authoredX (= n.x before Place); check the loader/engine, not a harness projection.');
  process.exit(2);
}
const need = {}; for (const l of st) { const m = l.match(/^(\S+)~(\S+).*need=(\d+)/); if (m) need[m[1] + '|' + m[2]] = +m[3]; }
const yo = (p, q) => p.y < q.y + q.h && q.y < p.y + p.h;

const pairMetric = (a, b) => cxOf(b) - cxOf(a);
const needAdj = (a, b, nd) => nd + a.w / 2 + b.w / 2;

const cols = authoredCols(N);
const shared = cols.filter(c => c.m.length >= 2);

let fails = gridFails(N);

const gapPop = { columns: shared.length, 'floor-pairs': 0, 'demand-pairs': 0, 'column-gaps': 0 };

const sortedX = [...N].sort((a, b) => a.x - b.x);
for (const a of sortedX) { const r = sortedX.find(b => b.id !== a.id && b.x > a.x + 1 && yo(a, b)); if (!r) continue;
  gapPop['floor-pairs']++;
  const gap = r.x - (a.x + a.w); const nd = need[a.id + '|' + r.id];
  if (nd != null) gapPop['demand-pairs']++;
  if (gap < STACK_GAP - 0.5) fails.push(`FLOOR ${a.id}~${r.id} gap ${gap.toFixed(0)} < ${STACK_GAP}`);
  if (nd != null && gap < nd - 1.5) fails.push(`DEMAND ${a.id}~${r.id} gap ${gap.toFixed(0)} < need ${nd}`);
}

const rows = [];
for (let i = 0; i < shared.length - 1; i++) { gapPop['column-gaps']++; const L = shared[i], R = shared[i + 1];
  const lo = Math.max(...L.m.map(n => n.x + n.w)), hi = Math.min(...R.m.map(n => n.x));
  const between = N.some(n => { const c = cxOf(n); return c > lo + 2 && c < hi - 2 && (L.m.some(m => yo(m, n)) || R.m.some(m => yo(m, n))); });
  const pairGaps = [], needs = [];
  for (const a of L.m) { const b = R.m.find(b => yo(a, b)); if (!b) continue; pairGaps.push(Math.round(pairMetric(a, b))); const nd = need[a.id + '|' + b.id]; if (nd != null) needs.push({ c: needAdj(a, b, nd), e: nd }); }
  if (!pairGaps.length) continue;
  const gmin = Math.min(...pairGaps), gmax = Math.max(...pairGaps);
  const wired = needs.filter(n => n.e > STACK_GAP).map(n => n.c), maxNeed = wired.length ? Math.max(...wired) : null;
  if (gmax - gmin > 1) fails.push(`RAGGED col@${Math.round(L.x)}->${Math.round(R.x)} gaps ${pairGaps.join(',')}`);
  let verdict;
  if (between) verdict = `absorber (off-grid node in gap) — gap ${gmax}, skip tightness`;
  else if (maxNeed == null) verdict = `no-wire, gap ${gmax} (grow-only keeps authored; floor>=50 ${gmax >= STACK_GAP})`;
  else { const want = maxNeed; const tight = Math.abs(gmax - want) <= 2; if (!tight && gmax > want) fails.push(`SLACK col@${Math.round(L.x)}->${Math.round(R.x)} gap ${gmax} > max-row need ${want}`); verdict = `gap ${gmax} == max-row need ${want} ${tight ? 'OK' : 'OFF'}`; }
  rows.push(`  col@${Math.round(L.x)}->col@${Math.round(R.x)}: ${verdict}`);
}
console.log('--- gap#3 calc check (authored-X grouping · cx metric) ---');
console.log(`  examined: ${gapPop.columns} column(s) · ${gapPop['floor-pairs']} same-row pair(s) · ${gapPop['demand-pairs']} with a radar demand · ${gapPop['column-gaps']} column gap(s)`);
declarePopulation(gapPop);
rows.forEach(r => console.log(r));
console.log('\n' + (fails.length ? '❌ FAIL:\n  ' + fails.join('\n  ') : '✅ GAP#3 CALC-VERIFIED: authored columns center-aligned · floor>=50 · demand met · column-gaps tight to max-row demand'));
process.exit(fails.length ? 1 : 0);
