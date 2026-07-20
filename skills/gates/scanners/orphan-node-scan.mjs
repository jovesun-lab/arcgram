#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const STANDALONE_TYPES = new Set(['open']);
const laxFrame = process.argv.includes('--lax-frame');

function run(j) {
  const nodes = j.engine?.nodes || [];

  const deg = {};
  const bump = (id) => { if (id != null) deg[id] = (deg[id] || 0) + 1; };
  for (const e of (j.engine?.edges || [])) { bump(e.f); bump(e.t); }
  for (const e of (j.edgePaths || []))     { bump(e.f); bump(e.t); }

  const groupMembers = new Set();
  for (const b of (j.engine?.bands || [])) {
    if (b.group && Array.isArray(b.members)) for (const m of b.members) groupMembers.add(m);
  }

  const broken = [], notes = [];
  for (const n of nodes) {
    if ((deg[n.id] || 0) > 0) continue;
    const exempt = STANDALONE_TYPES.has(n.type) || groupMembers.has(n.id) || (laxFrame && n.type === 'frame');
    (exempt ? notes : broken).push(n);
  }

  console.log(`ORPHAN-NODE SCAN (every node needs ≥1 edge; type∈{${[...STANDALONE_TYPES].join(',')}} OR a group-box member exempt) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  nodes: ${nodes.length}   exempt (standalone/group-box): ${notes.length}   broken orphans: ${broken.length}`);
  declarePopulation({ nodes: nodes.length });
  for (const n of notes)  console.log(`     · ${n.id} (type=${n.type}) — ${groupMembers.has(n.id) ? 'group-box member' : 'declared standalone'}, OK`);
  for (const n of broken) console.log(`     ✗ ${n.id} (type=${n.type}, cat="${n.cat ?? ''}") — NO attached edge: chain broken`);
  console.log(`  VERDICT: ${broken.length ? 'ORPHAN NODES (' + broken.length + ')' : 'NO ORPHAN NODES — every flow node is wired'}`);
  return broken.length;
}

const fileArg = process.argv.slice(2).find(a => !a.startsWith('--'));
if (fileArg) process.exitCode = run(JSON.parse(fs.readFileSync(fileArg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
