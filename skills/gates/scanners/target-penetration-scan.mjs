

import { declarePopulation } from './_population.mjs';

const INSET = 3;
const MIN_PEN = 4;

function ptsOf(e) {
  if (Array.isArray(e.pts) && e.pts.length) return e.pts.map(p => [p.x, p.y]);
  const d = e.pathStr; if (!d) return [];
  const t = String(d).replace(/,/g, ' ').trim().split(/\s+/); let x = 0, y = 0, i = 0; const pts = [];
  while (i < t.length) {
    const c = t[i];
    if (c === 'M' || c === 'L') { x = +t[i + 1]; y = +t[i + 2]; i += 3; pts.push([x, y]); }
    else if (c === 'H') { x = +t[i + 1]; i += 2; pts.push([x, y]); }
    else if (c === 'V') { y = +t[i + 1]; i += 2; pts.push([x, y]); }
    else if (c === 'Q') { x = +t[i + 3]; y = +t[i + 4]; i += 5; pts.push([x, y]); }
    else i++;
  }
  return pts;
}

function interiorLen(x0, y0, x1, y1, xmin, ymin, xmax, ymax) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy], q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
  for (let k = 0; k < 4; k++) {
    if (Math.abs(p[k]) < 1e-9) { if (q[k] < 0) return 0; }
    else {
      const r = q[k] / p[k];
      if (p[k] < 0) { if (r > t1) return 0; if (r > t0) t0 = r; }
      else { if (r < t0) return 0; if (r < t1) t1 = r; }
    }
  }
  if (t1 < t0) return 0;
  return Math.hypot(dx, dy) * (t1 - t0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => raw += d).on('end', () => {
  if (!raw.trim()) { console.error('usage: node v2-normalize.mjs audit.json | node target-penetration-scan.mjs'); process.exitCode = 2; return; }
  const j = JSON.parse(raw);
  const box = {};
  for (const n of (j.engine?.nodes || [])) box[n.id] = { x0: n.x, y0: n.y, x1: n.x + n.w, y1: n.y + n.h };
  const eps = j.edgePaths || [];
  const hits = [];

  const pop = { wires: 0 };
  for (const e of eps) {
    const b = box[e.t]; if (!b) continue;
    const pts = ptsOf(e); if (pts.length < 2) continue;
    const xmin = b.x0 + INSET, ymin = b.y0 + INSET, xmax = b.x1 - INSET, ymax = b.y1 - INSET;
    if (xmax <= xmin || ymax <= ymin) continue;
    pop.wires++;
    let pen = 0;
    for (let k = 0; k < pts.length - 1; k++)
      pen += interiorLen(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], xmin, ymin, xmax, ymax);
    if (pen > MIN_PEN) hits.push(`${e.f}->${e.t}  routed ${pen.toFixed(1)}px INSIDE its own target box (arrival on the wrong face)`);
  }
  const uniq = [...new Set(hits)];
  console.log(`TARGET-PENETRATION SCAN (wire into its OWN target interior) -- ${j.meta?.testFile || '(stdin)'}`);
  console.log(`  wires measured against their own target interior : ${pop.wires}`);
  declarePopulation(pop);
  console.log(`  edges routing into own target : ${uniq.length}`);
  uniq.forEach(s => console.log(`     - ${s}`));
  console.log(`  VERDICT: ${uniq.length === 0 ? 'NO TARGET PENETRATION' : 'TARGET PENETRATION (' + uniq.length + ')'}`);
  process.exitCode = uniq.length === 0 ? 0 : 1;
});
