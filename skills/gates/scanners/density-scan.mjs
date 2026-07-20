

import fs from 'fs';
import { declarePopulation } from './_population.mjs';

const WIRE_HANDLE   = 10;
const PILL_CLEARANCE = 10;
const ARROW_LEN     = 9;
const NODE_GAP_MIN  = 16;
const EPS = 0.5;

function rectClearance(a, b) {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  if (dx === 0 && dy === 0) return -1;
  return Math.hypot(dx, dy);
}

function segRectDist(s, r) {
  const rx0 = r.x, rx1 = r.x + r.w, ry0 = r.y, ry1 = r.y + r.h;
  if (s.vertical) {
    const x = s.x1, ya = Math.min(s.y1, s.y2), yb = Math.max(s.y1, s.y2);
    const hx = x < rx0 ? rx0 - x : x > rx1 ? x - rx1 : 0;
    const vy = yb < ry0 ? ry0 - yb : ya > ry1 ? ya - ry1 : 0;
    return Math.hypot(hx, vy);
  }
  if (s.horizontal) {
    const y = s.y1, xa = Math.min(s.x1, s.x2), xb = Math.max(s.x1, s.x2);
    const vy = y < ry0 ? ry0 - y : y > ry1 ? y - ry1 : 0;
    const hx = xb < rx0 ? rx0 - xb : xa > rx1 ? xa - rx1 : 0;
    return Math.hypot(hx, vy);
  }
  return Infinity;
}

function run(j) {
  const nodes = (j.engine.nodes || []).map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));

  const paths = (j.drawLog || []).filter(o => o.svgPath).map(o => o.svgPath);
  const segsByPath = [];
  const pathEndNodes = [];
  const ATTACH = 5;
  const nodeAt = (x, y) => nodes.filter(n =>
    x >= n.x - ATTACH && x <= n.x + n.w + ATTACH && y >= n.y - ATTACH && y <= n.y + n.h + ATTACH
  ).map(n => n.id);

  paths.forEach((p, pi) => {
    const toks = p.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
    const segs = [];
    const num = () => parseFloat(toks[i++]);
    const push = (x1, y1, x2, y2) => {
      if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5) return;
      segs.push({ x1, y1, x2, y2, vertical: Math.abs(x1 - x2) < 2, horizontal: Math.abs(y1 - y2) < 2 });
    };
    while (i < toks.length) {
      const c = toks[i++];
      if (c === 'M') { cx = num(); cy = num(); sx = cx; sy = cy; }
      else if (c === 'L') { const x = num(), y = num(); push(cx, cy, x, y); cx = x; cy = y; }
      else if (c === 'H') { const x = num(); push(cx, cy, x, cy); cx = x; }
      else if (c === 'V') { const y = num(); push(cx, cy, cx, y); cy = y; }
      else if (c === 'Q') { num(); num(); const x = num(), y = num(); push(cx, cy, x, y); cx = x; cy = y; }
    }
    segsByPath[pi] = segs;
    pathEndNodes[pi] = new Set([...nodeAt(sx, sy), ...nodeAt(cx, cy)]);
  });

  const pills = (j.engine.edges || [])
    .filter(e => e._labelBox && e._labelBox.w)
    .map(e => ({ id: `${e.f}→${e.t}`, t: e.t, ...e._labelBox }));

  const v = { wireNode: [], pillNode: [], pillPill: [], nodeNode: [] };

  const pop = { 'wire-node': 0, 'pill-node': 0, 'pill-pill': 0, 'node-node': 0 };

  segsByPath.forEach((segs, pi) => {
    for (const s of segs) for (const n of nodes) {
      if (pathEndNodes[pi].has(n.id)) continue;
      pop['wire-node']++;
      const d = segRectDist(s, n);
      if (d < WIRE_HANDLE - EPS) {
        const where = s.vertical ? `V@x=${s.x1.toFixed(0)}` : `H@y=${s.y1.toFixed(0)}`;
        v.wireNode.push(`wire ${where} only ${d.toFixed(1)}px from node ${n.id} (min ${WIRE_HANDLE})`);
      }
    }
  });

  for (const p of pills) for (const n of nodes) {
    pop['pill-node']++;
    const isTarget = n.id === p.t;
    const min = isTarget ? (ARROW_LEN + PILL_CLEARANCE) : PILL_CLEARANCE;
    const c = rectClearance(p, n);
    if (c < min - EPS)
      v.pillNode.push(`pill "${p.id}" ${c < 0 ? 'OVERLAPS' : 'only ' + c.toFixed(1) + 'px from'} node ${n.id} (min ${min}${isTarget ? ' = arrow+handle off own target' : ''})`);
  }

  for (let a = 0; a < pills.length; a++) for (let b = a + 1; b < pills.length; b++) {
    pop['pill-pill']++;
    const c = rectClearance(pills[a], pills[b]);
    if (c < PILL_CLEARANCE - EPS)
      v.pillPill.push(`pills "${pills[a].id}" & "${pills[b].id}" ${c < 0 ? 'OVERLAP' : 'only ' + c.toFixed(1) + 'px apart'} (min ${PILL_CLEARANCE})`);
  }

  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    const A = nodes[a], B = nodes[b];
    const xOv = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
    const yOv = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
    let gap = null, axis = '';
    if (xOv > 0 && yOv <= 0) { gap = -yOv; axis = 'V'; }
    else if (yOv > 0 && xOv <= 0) { gap = -xOv; axis = 'H'; }
    if (gap !== null) pop['node-node']++;
    if (gap !== null && gap < NODE_GAP_MIN - EPS)
      v.nodeNode.push(`nodes ${A.id} & ${B.id} only ${gap.toFixed(1)}px apart (${axis}; min ${NODE_GAP_MIN})`);
  }

  const uniq = a => [...new Set(a)];
  for (const k in v) v[k] = uniq(v[k]);
  const total = v.wireNode.length + v.pillNode.length + v.pillPill.length + v.nodeNode.length;

  console.log(`DENSITY SCAN (Gate 5 — minimum safe space) — ${j.meta.testFile}`);
  console.log(`  pairs examined — wire↔node ${pop['wire-node']} · pill↔node ${pop['pill-node']} · pill↔pill ${pop['pill-pill']} · node↔node ${pop['node-node']}`);
  declarePopulation(pop);
  console.log(`  wire↔node  (<${WIRE_HANDLE}px) : ${v.wireNode.length}`); v.wireNode.forEach(x => console.log('     - ' + x));
  console.log(`  pill↔node  (<${PILL_CLEARANCE}px): ${v.pillNode.length}`); v.pillNode.forEach(x => console.log('     - ' + x));
  console.log(`  pill↔pill  (<${PILL_CLEARANCE}px): ${v.pillPill.length}`); v.pillPill.forEach(x => console.log('     - ' + x));
  console.log(`  node↔node  (<${NODE_GAP_MIN}px): ${v.nodeNode.length}`); v.nodeNode.forEach(x => console.log('     - ' + x));
  console.log(`  VERDICT: ${total === 0 ? 'CLEAN' : 'SAFE-SPACE VIOLATED'}`);
  return total;
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
