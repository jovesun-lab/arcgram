#!/usr/bin/env node

import fs from 'node:fs';
import { declarePopulation } from './_population.mjs';

const fin = v => typeof v === 'number' && Number.isFinite(v);
const finPt = p => p && fin(p.x) && fin(p.y);

function scan(engine, pop) {
  const findings = [];
  for (const n of (engine.nodes || [])) {
    for (const k of ['x', 'y', 'w', 'h']) {
      if (n[k] === undefined) continue;
      if (pop) pop.coords++;
      if (!fin(n[k])) findings.push({ kind: 'node', id: n.id, detail: `${k}=${n[k]}` });
    }
  }
  for (const e of (engine.edges || [])) {
    const tag = `${e.f}->${e.t}`;
    const p = e._path;
    if (Array.isArray(p)) {
      p.forEach((pt, i) => { if (pop) pop.pts++; if (!finPt(pt)) findings.push({ kind: 'edge._path', id: tag, detail: `pt[${i}]=(${pt && pt.x},${pt && pt.y})` }); });
    }
    if (e._arrowAt) { if (pop) pop.pts++; if (!finPt(e._arrowAt)) findings.push({ kind: 'edge._arrowAt', id: tag, detail: `(${e._arrowAt.x},${e._arrowAt.y})` }); }
    if (e._container) { const c = e._container; for (const k of ['x', 'y', 'w', 'h']) { if (c[k] === undefined) continue; if (pop) pop.coords++; if (!fin(c[k])) findings.push({ kind: 'edge._container', id: tag, detail: `${k}=${c[k]}` }); } }
  }
  return findings;
}

function live() {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => s += d);
  process.stdin.on('end', () => {
    let j; try { j = JSON.parse(s); } catch { console.error('no-nan-coord-scan: no audit JSON on stdin'); process.exit(2); }
    const engine = j.engine || {};
    const pop = { coords: 0, pts: 0 };
    const findings = scan(engine, pop);
    console.log(`=== NO-NaN COORDINATE SCAN - ${j.meta?.file?.split('/').pop() || ''} ===`);
    for (const x of findings) console.log(`  NON-FINITE ${x.kind} ${x.id}: ${x.detail}`);
    console.log(`  coordinates examined : ${pop.coords} box fields + ${pop.pts} path points`);
    declarePopulation(pop);
    console.log(`  non-finite coordinates : ${findings.length}`);
    console.log(`  VERDICT: ${findings.length === 0 ? 'CLEAN' : 'NON-FINITE COORDINATE(S) PRESENT'}`);
    process.exit(findings.length === 0 ? 0 : 1);
  });
}

const arg = process.argv[2];
live();
