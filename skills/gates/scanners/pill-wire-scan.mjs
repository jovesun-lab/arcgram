#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';

const PILL_CLEARANCE = Number(process.env.PILL_CLEARANCE) || 10;

function segRectInfo(s, r) {
  const rx0 = r.x, rx1 = r.x + r.w, ry0 = r.y, ry1 = r.y + r.h;
  let hx, vy, side;
  if (s.vertical) {
    const x = s.x1, ya = Math.min(s.y1, s.y2), yb = Math.max(s.y1, s.y2);
    if (yb < ry0 || ya > ry1) {  }
    hx = x < rx0 ? rx0 - x : x > rx1 ? x - rx1 : 0;
    vy = yb < ry0 ? ry0 - yb : ya > ry1 ? ya - ry1 : 0;
    side = x < rx0 ? 'left' : x > rx1 ? 'right' : (yb < ry0 ? 'above' : 'below');
  } else if (s.horizontal) {
    const y = s.y1, xa = Math.min(s.x1, s.x2), xb = Math.max(s.x1, s.x2);
    vy = y < ry0 ? ry0 - y : y > ry1 ? y - ry1 : 0;
    hx = xb < rx0 ? rx0 - xb : xa > rx1 ? xa - rx1 : 0;
    side = y < ry0 ? 'above' : y > ry1 ? 'below' : (xb < rx0 ? 'left' : 'right');
  } else return { d: Infinity, side: '?' };
  return { d: Math.hypot(hx, vy), side };
}

function detect(j) {
  const nodes = (j.engine.nodes || []).map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));
  const ATTACH = 5;
  const nodeAt = (x, y) => nodes.filter(n =>
    x >= n.x - ATTACH && x <= n.x + n.w + ATTACH && y >= n.y - ATTACH && y <= n.y + n.h + ATTACH
  ).map(n => n.id);

  const bands = (j.engine.bands || []).map(b => ({ id: b.id || b.label, y: b.y, h: b.h }));
  const bandAt = (x, y) => bands.filter(b => y >= b.y && y <= b.y + b.h).map(b => b.id);

  const GBM = 20, GTAG = 28, GATTACH = 6;
  const groupBoxes = (j.engine.bands || []).filter(b => b.group && Array.isArray(b.members)).map(b => {
    const ms = nodes.filter(n => b.members.includes(n.id)); if (!ms.length) return null;
    const minX = Math.min(...ms.map(n => n.x)), minY = Math.min(...ms.map(n => n.y));
    const maxX = Math.max(...ms.map(n => n.x + n.w)), maxY = Math.max(...ms.map(n => n.y + n.h));
    return { id: b.id || b.label, x: minX - GBM, y: minY - GBM - GTAG, w: (maxX - minX) + 2 * GBM, h: (maxY - minY) + 2 * GBM + GTAG };
  }).filter(Boolean);
  const groupAt = (x, y) => groupBoxes.filter(b => x >= b.x - GATTACH && x <= b.x + b.w + GATTACH && y >= b.y - GATTACH && y <= b.y + b.h + GATTACH).map(b => b.id);
  const endIds = (x, y) => [...nodeAt(x, y), ...bandAt(x, y), ...groupAt(x, y)];

  const paths = (j.drawLog || []).filter(o => o.svgPath).map(o => o.svgPath);
  const segsByPath = [], pathEndNodes = [];
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
    pathEndNodes[pi] = new Set([...endIds(sx, sy), ...endIds(cx, cy)]);
  });

  let pills = (j.engine.edges || [])
    .filter(e => e._labelBox && e._labelBox.w)
    .map(e => ({ id: `${e.f}→${e.t}`, f: e.f, t: e.t, lbl: e.lbl, ...e._labelBox }));

  if (!pills.length && (j.pillRects || []).length)
    pills = j.pillRects.map(r => ({ id: `${r.f}→${r.t}`, f: r.f, t: r.t, lbl: r.lbl, x: r.x, y: r.y, w: r.w, h: r.h }));

  const violations = [];
  for (const p of pills) {
    let worst = null;
    segsByPath.forEach((segs, pi) => {
      const own = pathEndNodes[pi].has(p.f) && pathEndNodes[pi].has(p.t);
      if (own) return;
      for (const s of segs) {
        const { d, side } = segRectInfo(s, p);
        if (d < PILL_CLEARANCE) {
          if (!worst || d < worst.d) worst = { d, side };
        }
      }
    });
    if (worst) violations.push({ pill: p.id, lbl: p.lbl, d: worst.d, side: worst.side });
  }
  return { violations, pills };
}

function run(j) {
  const { violations, pills } = detect(j);
  console.log('PILL SAFE-SPACE SCAN (pill ↔ other wire, 4 directions) —', j.meta?.file || '');
  console.log(`  pills scanned : ${pills.length}`);
  declarePopulation({ pills: pills.length });
  console.log(`  pill ↔ wire (<${PILL_CLEARANCE}px, not own wire) : ${violations.length}`);
  for (const v of violations) {
    console.log(`     - pill "${v.lbl ?? v.pill}" (${v.pill}): a wire is ${v.d.toFixed(1)}px off its ${v.side} side (min ${PILL_CLEARANCE})`);
  }
  console.log(violations.length === 0 ? '  VERDICT: PILL SAFE-SPACE CLEAN' : '  VERDICT: PILL SAFE-SPACE VIOLATED');
  return violations.length;
}

{
  let buf = '';
  process.stdin.on('data', d => buf += d);
  process.stdin.on('end', () => {
    const j = JSON.parse(buf);
    const n = run(j);
    process.exit(n === 0 ? 0 : 1);
  });
}
