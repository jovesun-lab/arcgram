

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const TOL = 2;

export function overlaps(engineNodes) {
  const nodes = (engineNodes || []).map(n => ({
    id: n.id, x0: n.x, y0: n.y, x1: n.x + n.w, y1: n.y + n.h,
  }));

  const hits = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let k = i + 1; k < nodes.length; k++) {
      const a = nodes[i], b = nodes[k];
      const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ix > TOL && iy > TOL) {
        hits.push({ a: a.id, b: b.id, ix: Math.round(ix), iy: Math.round(iy) });
      }
    }
  }
  return hits;
}

function run(j) {
  const nodes = j.engine.nodes || [];
  const hits = overlaps(nodes);
  console.log(`NODE-OVERLAP SCAN (Gate 0 — naked-eye floor) — ${j.meta.testFile}`);
  console.log(`  node pairs scanned : ${nodes.length * (nodes.length - 1) / 2}`);
  declarePopulation({ pairs: nodes.length * (nodes.length - 1) / 2 });
  console.log(`  overlapping node pairs : ${hits.length}`);
  hits.forEach(h => console.log(`     ✗ ${h.a} ∩ ${h.b}  (${h.ix}×${h.iy}px)`));
  console.log(`  VERDICT: ${hits.length ? 'NODE OVERLAP' : 'NO NODE OVERLAP'}`);
  return hits.length;
}

const arg = process.argv[2];
if (arg) {
  process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
} else {
  let raw = '';
  process.stdin.on('data', d => raw += d).on('end', () => {
    process.exitCode = run(JSON.parse(raw)) ? 1 : 0;
  });
}
