#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const TOL      = 12;
const SAME     = 6;
const STRAIGHT = 4;

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
  if (Array.isArray(e.pts) && e.pts.length >= 2) {
    const a = e.pts[0], b = e.pts[e.pts.length - 1]; return [[a.x, a.y], [b.x, b.y]];
  }
  return null;
}

const isV   = s => s === 'lft' || s === 'rgt';
const ctr   = (n, side) => isV(side) ? n.y + n.h / 2 : n.x + n.w / 2;
const coord = (side, pt) => isV(side) ? pt[1] : pt[0];

function run(j) {
  const byId = Object.fromEntries((j.engine?.nodes || []).map(n => [n.id, n]));
  const eps  = j.edgePaths || [];
  const fk = (id, side) => id + '.' + (side || '?');

  const use = {};
  for (const e of eps) { use[fk(e.f, e.fromPt)] = (use[fk(e.f, e.fromPt)] || 0) + 1; use[fk(e.t, e.toPt)] = (use[fk(e.t, e.toPt)] || 0) + 1; }

  const faces = {};
  for (const e of eps) {
    const pe = endpoints(e); if (!pe) continue;
    const s = byId[e.f], t = byId[e.t];
    if (s && e.fromPt) {
      const side = e.fromPt, anchor = coord(side, pe[0]), opp = coord(side, pe[1]);
      (faces[fk(e.f, side)] ||= { node: s, side, items: [] }).items.push({ anchor, straight: Math.abs(anchor - opp) < STRAIGHT, oppFace: fk(e.t, e.toPt) });
    }
    if (t && e.toPt) {
      const side = e.toPt, anchor = coord(side, pe[1]), opp = coord(side, pe[0]);
      (faces[fk(e.t, side)] ||= { node: t, side, items: [] }).items.push({ anchor, straight: Math.abs(anchor - opp) < STRAIGHT, oppFace: fk(e.f, e.fromPt) });
    }
  }

  const hits = [];

  const pop = { faces: 0, 'single-trunk-faces': 0 };
  for (const key of Object.keys(faces)) {
    const F = faces[key]; if (!F.node) continue;
    pop.faces++;
    const seats = F.items.map(it => it.anchor).sort((a, b) => a - b);
    const clusters = [];
    for (const x of seats) if (!clusters.length || Math.abs(x - clusters[clusters.length - 1]) > SAME) clusters.push(x);
    if (clusters.length >= 2) continue;
    pop['single-trunk-faces']++;
    const trunk = seats.reduce((a, b) => a + b, 0) / seats.length;
    const off = trunk - ctr(F.node, F.side);
    if (Math.abs(off) <= TOL) continue;
    if (F.items.every(it => it.straight && (use[it.oppFace] || 0) >= 2)) continue;
    hits.push({ face: key, n: F.items.length, off: Math.round(off) });
  }

  console.log(`OFF-CENTER SCAN (rule 5 — centre a free single-trunk face; >${TOL}px) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  faces seen : ${pop.faces}  ·  single-trunk faces examined : ${pop['single-trunk-faces']}`);
  declarePopulation(pop);
  console.log(`  off-centre connections (with room) : ${hits.length}`);
  for (const h of hits)
    console.log(`     ✗ ${h.face} ${h.off > 0 ? '+' : ''}${h.off}px off the node centre (${h.n > 1 ? 'shared trunk' : 'sole wire'}, face free → should centre)`);
  console.log(`  VERDICT: ${hits.length ? 'OFF-CENTER WIRES (' + hits.length + ')' : 'NO OFF-CENTER WIRES — free single-trunk faces are centred'}`);
  return hits.length;
}

const arg = process.argv[2];
if (arg) process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
