#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';
import { extractPills, pathPoints, polyBoxDist } from './pill-lib.mjs';

const ARROW_LEN = 9, PILL_CLEARANCE = 10;

function run(j) {
  const pills = extractPills(j);
  const eps = j.edgePaths || [];
  const byLbl = {};
  for (const e of eps) if (e.lbl) (byLbl[e.lbl] = byLbl[e.lbl] || []).push(e);

  const SLACK = 26;
  let checked = 0, faninChecked = 0; const bad = [];
  for (const p of pills) {
    const cands = byLbl[p.lbl];
    if (!cands || !cands.length) continue;
    let best = Infinity, bestE = null, bestPts = null;
    for (const e of cands) { const pp = pathPoints(e.pathStr); const d = polyBoxDist(pp, p); if (d < best) { best = d; bestE = e; bestPts = pp; } }
    if (!bestE || !bestPts || bestPts.length < 2) continue;
    const pcx = (p.x0 + p.x1) / 2, pcy = (p.y0 + p.y1) / 2;
    const pillW = p.x1 - p.x0;

    if (bestE._fanInBundled) {
      faninChecked++;
      const src = bestPts[0];
      const dist = Math.hypot(pcx - src[0], pcy - src[1]);
      const budget = PILL_CLEARANCE + pillW + SLACK;
      if (dist > budget)
        bad.push({ lbl: p.lbl, edge: `${bestE.f}→${bestE.t}`, dist: Math.round(dist), budget: Math.round(budget), end: 'SOURCE', why: 'a diamond fan-in pill (LI-3) rides its OWN first leg near the SOURCE — the arrivals merge to one vertex, so it cannot seat at the target' });
      continue;
    }

    checked++;
    const tgt = bestPts[bestPts.length - 1];
    const dist = Math.hypot(pcx - tgt[0], pcy - tgt[1]);
    const budget = ARROW_LEN + PILL_CLEARANCE + pillW + SLACK;
    if (dist > budget)
      bad.push({ lbl: p.lbl, edge: `${bestE.f}→${bestE.t}`, dist: Math.round(dist), budget: Math.round(budget), end: 'TARGET', why: 'floating on a perpendicular leg?' });
  }

  console.log(`PILL-ON-ARRIVAL-LEG SCAN (pill = neighbor of its ANCHOR END — arrow for a normal wire, SOURCE for a diamond fan-in) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  normal pills checked (→ARROW)      : ${checked}`);
  console.log(`  fan-in pills checked (→SOURCE, LI-3): ${faninChecked}`);

  declarePopulation({ 'normal-pills': checked, 'fanin-pills': faninChecked });
  console.log(`  pills FLOATING off their anchor end : ${bad.length}`);
  for (const o of bad) console.log(`     ✗ pill "${o.lbl}" [${o.edge}] — ${o.dist}px from its ${o.end} (budget ${o.budget}px) — ${o.why}`);
  console.log(`  VERDICT: ${bad.length ? 'FLOATING PILLS (' + bad.length + ')' : 'CLEAN — every pill rides near its anchor end'}`);
  return bad.length;
}

const arg = process.argv[2];
if (arg) process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
