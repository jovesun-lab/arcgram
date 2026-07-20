

import { declarePopulation } from './_population.mjs';

const SLOT_LABELED = 28, SLOT_BARE = 10, SIDE_END_MARGIN = 5;
const vertSeatPitch = (anyL) => anyL ? SLOT_LABELED : SLOT_BARE * 2;

function detect(engine, pop) {
  const nodes = engine.nodes || [];
  const edges = engine.edges || [];
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  const faces = {};
  for (const e of edges) {
    const side = e.toPt || 'top';
    if (side !== 'lft' && side !== 'rgt') continue;
    const n = byId[e.t];

    if (!n || n.kind === 'diamond') continue;
    const k = e.t + '|' + side;
    (faces[k] = faces[k] || { t: e.t, side, arr: [] }).arr.push(e);
  }
  const hits = [];
  for (const k of Object.keys(faces)) {
    const f = faces[k];
    const N = f.arr.length;
    if (N < 2) continue;
    if (pop) pop.faces++;
    const anyL = f.arr.some(e => e.lbl);
    const pitch = vertSeatPitch(anyL);
    const required = N * pitch + 2 * SIDE_END_MARGIN;
    const h = byId[f.t].h;
    if (h + 0.5 < required) {
      hits.push({ face: k, N, anyL, pitch, required, h, deficit: +(required - h).toFixed(1) });
    }
  }
  return hits;
}

function report(label, hits, pop) {
  console.log(`FANIN-UNDERGROW SCAN (lft/rgt fan-in: node.h >= N*seatPitch + 2*SIDE_END_MARGIN — LEDGER-008) — ${label}`);
  if (pop) { console.log(`  vertical fan-in faces examined (N>=2 arrivals) : ${pop.faces}`); declarePopulation(pop); }
  console.log(`  UNDER-GROWN vertical fan-in faces (VIOLATION) : ${hits.length}`);
  hits.forEach(h => console.log(`     x ${h.face}  N=${h.N} anyL=${h.anyL} pitch=${h.pitch}  need h>=${h.required}, got ${h.h}  (short ${h.deficit}px -> outer arrivals land off-face)`));
  console.log(`  VERDICT: ${hits.length === 0 ? 'NO UNDER-GROWN FAN-IN FACES' : `UNDER-GROWN (${hits.length}) — reconcile demandV with the seat pitch (vertSeatPitch)`}`);
  process.exitCode = hits.length === 0 ? 0 : 1;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => raw += d).on('end', () => {
  if (!raw.trim()) { console.error('usage: node audit-harness.mjs <f.html> | node v2-normalize.mjs | node fanin-undergrow-scan.mjs'); process.exitCode = 2; return; }
  const j = JSON.parse(raw);
  const engine = j.engine || { nodes: [], edges: [] };
  const pop = { faces: 0 };
  report(j.meta?.testFile || '(stdin)', detect(engine, pop), pop);
});
