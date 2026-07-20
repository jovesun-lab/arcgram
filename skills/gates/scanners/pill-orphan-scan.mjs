#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';
import { extractPills, pathPoints, polyBoxDist } from './pill-lib.mjs';

const TOL = 12;

function detect(j) {
  const pills = extractPills(j);
  const eps = j.edgePaths || [];

  const byLbl = {};
  for (const e of eps) if (e.lbl) (byLbl[e.lbl] = byLbl[e.lbl] || []).push(e);

  const orphans = [];
  for (const p of pills) {
    const cands = byLbl[p.lbl];
    if (!cands || !cands.length) continue;

    let best = Infinity, bestE = null;
    for (const e of cands) {
      const d = polyBoxDist(pathPoints(e.pathStr), p);
      if (d < best) { best = d; bestE = e; }
    }
    if (best > TOL) orphans.push({ lbl: p.lbl, edge: bestE ? `${bestE.f}→${bestE.t}` : '?', gap: Math.round(best) });
  }
  return { orphans, pills, matched: pills.filter(p => byLbl[p.lbl]).length };
}

function run(j) {
  const { orphans, pills, matched } = detect(j);
  const byLbl = {};
  for (const e of (j.edgePaths || [])) if (e.lbl) (byLbl[e.lbl] = byLbl[e.lbl] || []).push(e);

  console.log(`ORPHAN-PILL SCAN (a pill's OWN wire must run within ${TOL}px) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  pills matched to an edge label : ${matched}/${pills.length}`);

  declarePopulation({ pills: matched });
  console.log(`  orphan pills (own wire absent) : ${orphans.length}`);
  for (const o of orphans) console.log(`     ✗ pill "${o.lbl}" [${o.edge}] — own wire ${o.gap}px away (pill without its wire)`);
  console.log(`  VERDICT: ${orphans.length ? 'ORPHAN PILLS (' + orphans.length + ')' : 'NO ORPHAN PILLS — every pill sits on its own wire'}`);
  return orphans.length;
}

const arg = process.argv[2];
if (arg) process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
