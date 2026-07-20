#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const TOL = 2.5;
const DEEP_INSIDE = 6;

function endpoints(e) {
  const s = (e.pathStr || '').trim();
  if (s) {
    const t = s.split(/\s+/); const pts = []; let x = 0, y = 0, i = 0;
    while (i < t.length) {
      const c = t[i++];
      if (c === 'M' || c === 'L') { x = +t[i++]; y = +t[i++]; pts.push([x, y]); }
      else if (c === 'H') { x = +t[i++]; pts.push([x, y]); }
      else if (c === 'V') { y = +t[i++]; pts.push([x, y]); }
      else if (c === 'Q') { i += 2; x = +t[i++]; y = +t[i++]; pts.push([x, y]); }
    }
    if (pts.length >= 2) return [pts[0], pts[pts.length - 1]];
  }
  if (e.p1 && e.p2) return [[e.p1.x, e.p1.y], [e.p2.x, e.p2.y]];
  return null;
}

function boxFit(px, py, n) {
  let x0 = n.x, y0 = n.y, x1 = n.x + n.w, y1 = n.y + n.h;

  if (n.kind === 'diamond') {
    const DIAMOND_TIP_R = 14, hw = n.w / 2, hh = n.h / 2, diag = Math.hypot(hw, hh) || 1;
    const inX = (DIAMOND_TIP_R / 2) * (hw / diag), inY = (DIAMOND_TIP_R / 2) * (hh / diag);
    x0 += inX; x1 -= inX; y0 += inY; y1 -= inY;
  }
  const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
  const dy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  const outside = Math.hypot(dx, dy);
  if (outside > 0) return outside;
  const inset = Math.min(px - x0, x1 - px, py - y0, y1 - py);
  return -inset;
}

function arrowheadApexes(dl) {
  const out = [];
  for (const o of (dl || [])) {
    if (o.kind !== 'fill' || !o.path) continue;
    const pts = o.path.filter(s => s[0] === 'M' || s[0] === 'L').map(s => [s[1], s[2]]);
    if (pts.length !== 3) continue;
    let apex = pts[0], best = -1;
    for (const v of pts) {
      const r = pts.filter(p => p !== v);
      const mid = [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2];
      const d = Math.hypot(v[0] - mid[0], v[1] - mid[1]);
      if (d > best) { best = d; apex = v; }
    }
    out.push(apex);
  }

  const seen = new Set();
  return out.filter(a => { const k = a[0].toFixed(1) + ',' + a[1].toFixed(1); if (seen.has(k)) return false; seen.add(k); return true; });
}

function run(j) {
  const byId = Object.fromEntries((j.engine?.nodes || []).map(n => [n.id, n]));
  const bands = new Set((j.engine?.bands || []).filter(b => b.id).map(b => b.id));
  const bad = [];

  const pop = { endpoints: 0, arrowheads: 0 };
  for (const e of (j.edgePaths || [])) {
    const ep = endpoints(e); if (!ep) continue;
    const [a, b] = ep;
    const s = byId[e.f], t = byId[e.t];
    if (s) {
      pop.endpoints++;
      const f = boxFit(a[0], a[1], s);
      if (f > TOL || f < -DEEP_INSIDE) bad.push({ edge: `${e.f}→${e.t}`, end: 'src', node: e.f, gap: +f.toFixed(1) });
    }
    if (t) {
      pop.endpoints++;
      const f = boxFit(b[0], b[1], t);
      if (f > TOL || f < -DEEP_INSIDE) bad.push({ edge: `${e.f}→${e.t}`, end: 'tgt', node: e.t, gap: +f.toFixed(1) });
    } else if (!bands.has(e.t)) {
      bad.push({ edge: `${e.f}→${e.t}`, end: 'tgt', node: e.t, gap: NaN });
    }
  }

  const boxes = [];
  for (const e of (j.engine?.edges || [])) {
    for (const c of [e._container, e._srcContainer]) if (c && c.w != null) boxes.push(c);
  }
  for (const apex of arrowheadApexes(j.drawLogRaw ?? j.drawLog)) {
    pop.arrowheads++;
    let best = Infinity;
    for (const n of [...(j.engine?.nodes || []), ...boxes]) {
      const f = boxFit(apex[0], apex[1], n);
      const d = f > 0 ? f : 0;
      if (d < best) best = d;
    }
    if (best > TOL) bad.push({ edge: `arrowhead @${apex[0].toFixed(0)},${apex[1].toFixed(0)}`, end: 'arrow', node: 'open space (no node border)', gap: +best.toFixed(1) });
  }
  console.log(`WIRE-ATTACHMENT SCAN (drawn endpoint must touch the node border, ≤${TOL}px) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  edges: ${(j.edgePaths || []).length}   endpoints measured : ${pop.endpoints}   arrowheads measured : ${pop.arrowheads}   detached endpoints: ${bad.length}`);
  declarePopulation(pop);
  for (const d of bad)
    console.log(`     ✗ ${d.edge} ${d.end} endpoint ${Number.isNaN(d.gap) ? 'has no resolvable node' : (d.gap > 0 ? d.gap + 'px off ' + d.node : Math.abs(d.gap) + 'px buried inside ' + d.node)}`);
  console.log(`  VERDICT: ${bad.length ? 'DETACHED WIRES (' + bad.length + ')' : 'NO DETACHED WIRES — every endpoint sits on its node'}`);
  return bad.length;
}

const arg = process.argv[2];
if (arg) process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
