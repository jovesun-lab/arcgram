#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';

const WIRE_HANDLE    = 10;
const PILL_CLEARANCE = 10;
const ATTACH         = 6;

function parse(p) {
  const t = p.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  const num = () => parseFloat(t[i++]);
  const segs = [];
  const push = (x1, y1, x2, y2, curve) => {
    if (Math.abs(x1 - x2) < 0.4 && Math.abs(y1 - y2) < 0.4) return;
    segs.push({ x1, y1, x2, y2, curve, len: Math.hypot(x2 - x1, y2 - y1) });
  };
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') { cx = num(); cy = num(); sx = cx; sy = cy; }
    else if (c === 'H') { const x = num(); push(cx, cy, x, cy, false); cx = x; }
    else if (c === 'V') { const y = num(); push(cx, cy, cx, y, false); cy = y; }
    else if (c === 'L') { const x = num(), y = num(); push(cx, cy, x, y, false); cx = x; cy = y; }
    else if (c === 'Q') { num(); num(); const x = num(), y = num(); push(cx, cy, x, y, true); cx = x; cy = y; }
  }
  return { segs, sx, sy, ex: cx, ey: cy };
}

function detect(j) {
  const nodes = (j.engine.nodes || []).map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));

  const edgeAt = (x, y) => {
    for (const n of nodes) {
      const onY = y >= n.y - ATTACH && y <= n.y + n.h + ATTACH;
      const onX = x >= n.x - ATTACH && x <= n.x + n.w + ATTACH;
      if (onY && Math.abs(x - n.x)        <= ATTACH) return { node: n, side: 'lft' };
      if (onY && Math.abs(x - (n.x+n.w))  <= ATTACH) return { node: n, side: 'rgt' };
      if (onX && Math.abs(y - n.y)        <= ATTACH) return { node: n, side: 'top' };
      if (onX && Math.abs(y - (n.y+n.h))  <= ATTACH) return { node: n, side: 'bot' };
    }
    return null;
  };

  const pills = (j.engine.edges || [])
    .filter(e => e._labelBox && e._labelBox.w)
    .map(e => ({ f: e.f, t: e.t, ...e._labelBox }));

  const pillNear = (px, py) => pills.some(b =>
    px >= b.x - PILL_CLEARANCE && px <= b.x + b.w + PILL_CLEARANCE &&
    py >= b.y - PILL_CLEARANCE && py <= b.y + b.h + PILL_CLEARANCE);

  const paths = [...new Set((j.drawLog || []).filter(o => o.svgPath).map(o => o.svgPath))];
  const violations = [];

  for (const p of paths) {
    const { segs, sx, sy, ex, ey } = parse(p);
    if (!segs.length) continue;

    const ends = [
      { x: sx, y: sy, seg: segs[0],               role: 'exit'    },
      { x: ex, y: ey, seg: segs[segs.length - 1], role: 'arrival' },
    ];
    for (const e of ends) {
      const at = edgeAt(e.x, e.y);
      if (!at) continue;
      const handle = e.seg.curve ? 0 : e.seg.len;
      const min = pillNear(e.x, e.y) ? PILL_CLEARANCE : WIRE_HANDLE;
      if (handle < min - 0.5) {
        violations.push({ node: at.node.id, side: at.side, role: e.role, handle, min });
      }
    }
  }

  const seen = new Set(), uniq = [];
  for (const v of violations) {
    const k = `${v.node}|${v.side}|${v.role}|${v.handle.toFixed(1)}`;
    if (!seen.has(k)) { seen.add(k); uniq.push(v); }
  }
  return { uniq, scanned: paths.length };
}

function run(j) {
  const { uniq, scanned } = detect(j);
  console.log('WIRE HANDLE SCAN (straight clearance off node edge, generic) —', j.meta?.testFile || j.meta?.file || '');
  console.log(`  wires scanned : ${scanned}`);
  declarePopulation({ wires: scanned });
  console.log(`  handle < min  : ${uniq.length}`);
  for (const v of uniq) {
    console.log(`     - ${v.node}.${v.side} ${v.role}: straight handle ${v.handle.toFixed(1)}px < ${v.min} (min)`);
  }
  console.log(uniq.length === 0 ? '  VERDICT: WIRE HANDLE CLEAN' : '  VERDICT: WIRE HANDLE VIOLATED');
  return uniq.length;
}

{
  let buf = '';
  process.stdin.on('data', d => buf += d);
  process.stdin.on('end', () => {
    const n = run(JSON.parse(buf));
    process.exit(n === 0 ? 0 : 1);
  });
}
