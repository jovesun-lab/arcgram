

import { declarePopulation } from './_population.mjs';

const EPS = 2;
const MIN_OVERLAP = 6;

export function detect(j) {
  const nodes = j.engine.nodes.map(n => ({
    id: n.id, x: n.x, y: n.y, w: n.w, h: n.h,
    x0: n.x, x1: n.x + n.w, y0: n.y, y1: n.y + n.h,
  }));
  const headers = (j.columnZones?.headers || []).map(hd => {
    const w = (hd.label.length * 7.2) + 22, h = 22;
    return { label: hd.label, x0: hd.cx - w / 2, x1: hd.cx + w / 2, y0: hd.y - h / 2, y1: hd.y + h / 2 };
  });

  const paths = (j.drawLog || []).filter(o => o.svgPath).map(o => o.svgPath);
  const segs = [];
  const pathEnds = [];
  paths.forEach((p, pi) => {
    let cx = 0, cy = 0, sx = 0, sy = 0;
    const toks = p.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    let i = 0;
    const num = () => parseFloat(toks[i++]);
    while (i < toks.length) {
      const c = toks[i++];
      if (c === 'M') { cx = num(); cy = num(); sx = cx; sy = cy; }
      else if (c === 'L') { const x = num(), y = num(); push(pi, cx, cy, x, y); cx = x; cy = y; }
      else if (c === 'H') { const x = num(); push(pi, cx, cy, x, cy); cx = x; }
      else if (c === 'V') { const y = num(); push(pi, cx, cy, cx, y); cy = y; }
      else if (c === 'Q') { num(); num(); const x = num(), y = num(); push(pi, cx, cy, x, y); cx = x; cy = y; }
      else {  }
    }
    pathEnds[pi] = { sx, sy, ex: cx, ey: cy };
    function push(pi, x1, y1, x2, y2) {
      if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5) return;
      segs.push({ pi, x1, y1, x2, y2,
        vertical: Math.abs(x1 - x2) < EPS, horizontal: Math.abs(y1 - y2) < EPS });
    }
  });

  const ANCHOR_EPS = 3;
  function siblings(pa, pb) {
    const a = pathEnds[pa], b = pathEnds[pb];
    if (!a || !b) return false;
    const near = (x1, y1, x2, y2) => Math.abs(x1 - x2) < ANCHOR_EPS && Math.abs(y1 - y2) < ANCHOR_EPS;
    return near(a.sx, a.sy, b.sx, b.sy) || near(a.ex, a.ey, b.ex, b.ey);
  }

  const hits = { header: [], throughNode: [], wireWire: [], wireWireBundle: [] };

  for (const s of segs) for (const h of headers) {
    if (s.vertical) {
      const x = s.x1, ya = Math.min(s.y1, s.y2), yb = Math.max(s.y1, s.y2);
      if (x > h.x0 && x < h.x1 && ya < h.y1 && yb > h.y0)
        hits.header.push(`V wire at x=${x.toFixed(0)} crosses header "${h.label}" (${h.x0.toFixed(0)}..${h.x1.toFixed(0)} × ${h.y0.toFixed(0)}..${h.y1.toFixed(0)})`);
    } else if (s.horizontal) {
      const y = s.y1, xa = Math.min(s.x1, s.x2), xb = Math.max(s.x1, s.x2);
      if (y > h.y0 && y < h.y1 && xa < h.x1 && xb > h.x0)
        hits.header.push(`H wire at y=${y.toFixed(0)} crosses header "${h.label}"`);
    }
  }

  for (const s of segs) for (const n of nodes) {
    if (s.vertical) {
      const x = s.x1, ya = Math.min(s.y1, s.y2), yb = Math.max(s.y1, s.y2);
      if (x > n.x0 + 1 && x < n.x1 - 1 && ya < n.y0 - 1 && yb > n.y1 + 1)
        hits.throughNode.push(`V wire at x=${x.toFixed(0)} passes THROUGH node ${n.id} (y ${n.y0}..${n.y1})`);
    } else if (s.horizontal) {
      const y = s.y1, xa = Math.min(s.x1, s.x2), xb = Math.max(s.x1, s.x2);
      if (y > n.y0 + 1 && y < n.y1 - 1 && xa < n.x0 - 1 && xb > n.x1 + 1)
        hits.throughNode.push(`H wire at y=${y.toFixed(0)} passes THROUGH node ${n.id} (x ${n.x0}..${n.x1})`);
    }
  }

  for (let a = 0; a < segs.length; a++) for (let b = a + 1; b < segs.length; b++) {
    const s = segs[a], t = segs[b];
    if (s.pi === t.pi) continue;
    let ov = 0, desc = null;
    if (s.vertical && t.vertical && Math.abs(s.x1 - t.x1) < EPS) {
      ov = Math.min(Math.max(s.y1, s.y2), Math.max(t.y1, t.y2)) - Math.max(Math.min(s.y1, s.y2), Math.min(t.y1, t.y2));
      if (ov > MIN_OVERLAP) desc = `two V wires overlap at x=${s.x1.toFixed(0)} for ${ov.toFixed(0)}px`;
    } else if (s.horizontal && t.horizontal && Math.abs(s.y1 - t.y1) < EPS) {
      ov = Math.min(Math.max(s.x1, s.x2), Math.max(t.x1, t.x2)) - Math.max(Math.min(s.x1, s.x2), Math.min(t.x1, t.x2));
      if (ov > MIN_OVERLAP) desc = `two H wires overlap at y=${s.y1.toFixed(0)} for ${ov.toFixed(0)}px`;
    }
    if (desc) (siblings(s.pi, t.pi) ? hits.wireWireBundle : hits.wireWire).push(desc);
  }

  const uniq = arr => [...new Set(arr)];
  return {
    H: uniq(hits.header), T: uniq(hits.throughNode),
    W: uniq(hits.wireWire), B: uniq(hits.wireWireBundle),
    nWires: paths.length, nSegs: segs.length, nNodes: nodes.length,
  };
}

function run(j) {
  const { H, T, W, B, nWires, nSegs, nNodes } = detect(j);
  console.log(`COLLISION SCAN — ${j.meta.testFile}`);
  console.log(`  wires scanned : ${nWires} (${nSegs} segments vs ${nNodes} nodes)`);
  declarePopulation({ wires: nWires, segments: nSegs });
  console.log(`  wire↔header   : ${H.length}`); H.forEach(x => console.log('     - ' + x));
  console.log(`  wire↔node(through): ${T.length}`); T.forEach(x => console.log('     - ' + x));
  console.log(`  wire↔wire (signal): ${W.length}`); W.forEach(x => console.log('     - ' + x));
  console.log(`  wire↔wire (bundle, suppressed): ${B.length}`);
  console.log(`  VERDICT: ${H.length + T.length + W.length === 0 ? 'CLEAN' : 'COLLISIONS FOUND'}`);
  return H.length + T.length + W.length;
}

{
  let raw = '';
  process.stdin.on('data', d => raw += d).on('end', () => {
    process.exitCode = run(JSON.parse(raw)) ? 1 : 0;
  });
}
