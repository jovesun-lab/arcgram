#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';
import { extractPills, pathPoints } from './pill-lib.mjs';

const INSET = 5;

function corners(pts) {
  const out = [];
  for (let k = 1; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k], [cx, cy] = pts[k + 1];
    const d1x = Math.sign(Math.round(bx - ax)), d1y = Math.sign(Math.round(by - ay));
    const d2x = Math.sign(Math.round(cx - bx)), d2y = Math.sign(Math.round(cy - by));
    if (d1x !== d2x || d1y !== d2y) out.push([bx, by]);
  }
  return out;
}

function cornerInBox(c, b) {
  if (!(c[0] >= b.x0 && c[0] <= b.x1 && c[1] >= b.y0 && c[1] <= b.y1)) return false;

  const dx = Math.min(c[0] - b.x0, b.x1 - c[0]);
  const dy = Math.min(c[1] - b.y0, b.y1 - c[1]);
  return dx >= INSET || dy >= INSET;
}

function run(j) {
  const pills = extractPills(j);
  const eps = j.edgePaths || [];
  const byLbl = {};
  for (const e of eps) if (e.lbl) (byLbl[e.lbl] = byLbl[e.lbl] || []).push(e);

  let checked = 0; const bad = [];
  for (const p of pills) {
    const cands = byLbl[p.lbl];
    if (!cands || !cands.length) continue;

    let bestE = null, bestCorners = null, bestD = Infinity;
    for (const e of cands) {
      const pp = pathPoints(e.pathStr);
      const cs = corners(pp);

      const pcx = (p.x0 + p.x1) / 2, pcy = (p.y0 + p.y1) / 2;
      let d = Infinity; for (const v of pp) d = Math.min(d, Math.hypot(pcx - v[0], pcy - v[1]));
      if (d < bestD) { bestD = d; bestE = e; bestCorners = cs; }
    }
    if (!bestE) continue;
    checked++;
    const hit = bestCorners.find(c => cornerInBox(c, p));
    if (hit) bad.push({ lbl: p.lbl, edge: `${bestE.f}→${bestE.t}`, corner: `(${Math.round(hit[0])},${Math.round(hit[1])})` });
  }

  console.log(`PILL-CORNER SCAN (a pill must clear its own wire's bends — branch-fit) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  pills checked            : ${checked}`);
  declarePopulation({ pills: checked });
  console.log(`  pills SITTING ON A CORNER: ${bad.length}`);
  for (const o of bad) console.log(`     ✗ pill "${o.lbl}" [${o.edge}] — its wire bends at ${o.corner} INSIDE the pill box → branch too short, grow it`);
  console.log(`  VERDICT: ${bad.length ? 'PILLS ON CORNERS (' + bad.length + ')' : 'CLEAN — every pill clears its wire bends'}`);
  return bad.length;
}

const arg = process.argv[2];
if (arg) process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
