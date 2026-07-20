#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';

const EPS = 0.01;

function scan(engine, pop) {
  const findings = [];
  for (const e of (engine.edges || [])) {
    const p = e._path;
    if (!Array.isArray(p) || p.length < 2) continue;
    if (pop) pop.wires++;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      if (!a || !b || typeof a.x !== 'number' || typeof b.x !== 'number') continue;
      if (pop) pop.segments++;
      if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) {
        findings.push({ id: `${e.f}->${e.t}`, i, at: `(${Math.round(a.x)},${Math.round(a.y)})` });
      }
    }
  }
  return findings;
}

function live() {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => s += d);
  process.stdin.on('end', () => {
    let j; try { j = JSON.parse(s); } catch { console.error('degenerate-path-scan: no audit JSON on stdin'); process.exit(2); }
    const pop = { wires: 0, segments: 0 };
    const findings = scan(j.engine || {}, pop);
    console.log(`=== DEGENERATE PATH SCAN - ${j.meta?.file?.split('/').pop() || ''} ===`);
    for (const x of findings) console.log(`  ZERO-LENGTH SEGMENT ${x.id}: _path[${x.i}] == _path[${x.i + 1}] at ${x.at}`);
    console.log(`  segments examined : ${pop.segments}  (across ${pop.wires} wires with a 2+ point path)`);
    declarePopulation(pop);
    console.log(`  zero-length segments : ${findings.length}`);
    console.log(`  VERDICT: ${findings.length === 0 ? 'CLEAN' : 'DEGENERATE SEGMENT(S) PRESENT'}`);
    process.exit(findings.length === 0 ? 0 : 1);
  });
}

const arg = process.argv[2];
live();
