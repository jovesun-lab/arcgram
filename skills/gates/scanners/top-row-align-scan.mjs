

import { declarePopulation } from './_population.mjs';

const TOL_FRAC = Number(process.env.TOPROW_TOL_FRAC) || 0.05;

function topRowNodes(nodes, columns) {
  const byId = {}; for (const n of nodes) byId[n.id] = n;
  const tops = [];
  for (const c of (columns || [])) {
    const ms = (c.members || []).map(id => byId[id]).filter(Boolean);
    if (!ms.length) continue;
    const top = ms.reduce((a, b) => (b.y < a.y ? b : a));
    tops.push({ col: c.id, id: top.id, cy: top.y + top.h / 2, h: top.h, y: top.y });
  }
  return tops;
}

function isOffRowLaneHead(t, rowY) {
  return Math.abs(t.cy - rowY) > t.h;
}

function analyze(nodes, columns, edges) {
  const tops = topRowNodes(nodes, columns);
  if (tops.length < 3) return { tops, rowY: null, hits: [], excluded: [] };

  const cys = tops.map(t => t.cy).slice().sort((a, b) => a - b);
  const median = cys[Math.floor(cys.length / 2)];
  const cluster = tops.filter(t => Math.abs(t.cy - median) <= TOL_FRAC * t.h);
  if (cluster.length < 3) return { tops, rowY: null, hits: [], excluded: [] };
  const rowY = cluster.reduce((s, t) => s + t.cy, 0) / cluster.length;
  const outliers = tops.filter(t => Math.abs(t.cy - rowY) > TOL_FRAC * t.h)
                       .map(t => ({ ...t, off: t.cy - rowY, tol: TOL_FRAC * t.h }));
  const excluded = outliers.filter(t => isOffRowLaneHead(t, rowY));
  const hits     = outliers.filter(t => !isOffRowLaneHead(t, rowY));
  return { tops, rowY, hits, excluded };
}

function report(file, r) {
  console.log(`TOP-ROW Y-CENTER ALIGNMENT SCAN — ${file}`);

  declarePopulation({ 'top-nodes': r.rowY == null ? 0 : r.tops.length });
  if (r.rowY == null) { console.log('  no 3+ aligned top row to assert (skip)'); console.log('  VERDICT: TOP-ROW CLEAN — N/A, nothing asserted'); return true; }
  console.log(`  row Y-center : ${Math.round(r.rowY)}  (tolerance = 5% of each node's height)`);
  console.log(`  top-row nodes: ${r.tops.length}  ·  misaligned : ${r.hits.length}  ·  off-row lane heads excluded : ${(r.excluded || []).length}`);
  for (const h of r.hits) console.log(`     ✗ ${h.col}/${h.id}: cy=${Math.round(h.cy)} off by ${Math.round(h.off)}px (tol ±${h.tol.toFixed(1)})`);
  for (const e of (r.excluded || [])) console.log(`     - ${e.col}/${e.id}: ${e.off < 0 ? 'EARLY' : 'LATE'} lane head (${Math.abs(Math.round(e.off))}px ${e.off < 0 ? 'ABOVE' : 'BELOW'} the row, > its own height ${e.h}) - not a top-row node, excluded`);
  const ok = r.hits.length === 0;
  console.log(`  VERDICT: ${ok ? 'TOP-ROW ALIGNED' : 'TOP-ROW MISALIGNED (' + r.hits.length + ')'}`);
  return ok;
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => buf += d);
process.stdin.on('end', () => {
  if (!buf.trim()) { console.error('usage: node audit-harness.mjs <file> | node top-row-align-scan.mjs'); process.exit(2); }
  const j = JSON.parse(buf);
  const eng = j.engine || {};
  if (!eng.nodes || !eng.columns) { console.error('top-row-align-scan: JSON has no engine.nodes/columns'); process.exit(2); }
  const r = analyze(eng.nodes, eng.columns, eng.edges);
  const ok = report(j.meta?.testFile || j.meta?.file || '(stdin)', r);
  process.exit(ok ? 0 : 1);
});
