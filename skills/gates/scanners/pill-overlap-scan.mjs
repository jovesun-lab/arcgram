#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';
import { extractPills } from './pill-lib.mjs';

const TOL_NODE = 6;
const TOL_PILL = 2;

const overlapDepth = (a, b) => Math.min(
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
  Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

function run(j) {
  const pills = extractPills(j);
  const nodes = (j.engine.nodes || []).map(n => ({ id: n.id, label: n.label, x0: n.x, y0: n.y, x1: n.x + n.w, y1: n.y + n.h }));

  const pop = { 'pill-node': 0, 'pill-pill': 0 };
  const pillNode = [];
  for (const p of pills) for (const n of nodes) {
    pop['pill-node']++;
    const d = Math.min(Math.min(p.x1, n.x1) - Math.max(p.x0, n.x0), Math.min(p.y1, n.y1) - Math.max(p.y0, n.y0));
    if (d > TOL_NODE) pillNode.push({ lbl: p.lbl, node: n.label || n.id, depth: Math.round(d) });
  }
  const pillPill = [];
  for (let a = 0; a < pills.length; a++) for (let b = a + 1; b < pills.length; b++) {
    pop['pill-pill']++;
    if (overlapDepth(pills[a], pills[b]) > TOL_PILL) pillPill.push({ a: pills[a].lbl, b: pills[b].lbl });
  }

  const total = pillNode.length + pillPill.length;
  console.log(`PILL-OVERLAP SCAN (pill↔node / pill↔pill, real drawLog boxes) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  pills: ${pills.length}   pairs examined — pill↔node ${pop['pill-node']} · pill↔pill ${pop['pill-pill']}`);
  declarePopulation(pop);
  console.log(`  pill ↔ node (>${TOL_NODE}px) : ${pillNode.length}`);
  pillNode.forEach(h => console.log(`     ✗ pill "${h.lbl}" sits on node "${h.node}" (${h.depth}px deep)`));
  console.log(`  pill ↔ pill (>${TOL_PILL}px) : ${pillPill.length}`);
  pillPill.forEach(h => console.log(`     ✗ "${h.a}" ∩ "${h.b}"`));
  console.log(`  VERDICT: ${total ? 'PILL OVERLAP (' + total + ')' : 'NO PILL OVERLAP'}`);
  return total;
}

const arg = process.argv[2];
if (arg) process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
