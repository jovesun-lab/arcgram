#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'node:fs';

const TOL = +(process.env.COL_BAND_TOL || 1);
const arg = process.argv[2];
const src = (arg && fs.existsSync(arg)) ? fs.readFileSync(arg, 'utf8') : fs.readFileSync(0, 'utf8');
let a;
try { a = JSON.parse(src); } catch { console.log('col-band  SKIP — unparseable input'); process.exit(0); }

const cols = a.engine?.columns || [];
const by = {}; (a.engine?.nodes || []).forEach(n => { by[n.id] = n; });

const bands = [];
for (const c of (Array.isArray(cols) ? cols : [])) {
  const ms = (c.members || []).map(id => by[id]).filter(n => n && n.x != null && n.w != null);
  if (!ms.length) continue;
  bands.push({ id: c.id || '?', L: Math.min(...ms.map(n => n.x)), R: Math.max(...ms.map(n => n.x + n.w)) });
}

let fails = [];
for (let i = 0; i < bands.length; i++) {
  for (let j = i + 1; j < bands.length; j++) {
    const A = bands[i], B = bands[j];
    const overlap = Math.min(A.R, B.R) - Math.max(A.L, B.L);
    if (overlap > TOL)
      fails.push(`${A.id}[${Math.round(A.L)}..${Math.round(A.R)}] & ${B.id}[${Math.round(B.L)}..${Math.round(B.R)}] share ${Math.round(overlap)}px of x-band`);
  }
}

declarePopulation({ columns: bands.length, pairs: bands.length * (bands.length - 1) / 2 });
const summary = fails.length
  ? `VIOLATED — ${fails.length} column pair(s) share an x-band`
  : `CLEAN — ${bands.length} column(s) in disjoint x-bands`;
console.log(`VERDICT: ${summary}`);
console.log(`col-band  ${summary}`);
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
