

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

function run(j) {
  const nodes = j.engine?.nodes || [];
  const edges = j.engine?.edges || [];
  const byId = {}; for (const n of nodes) byId[n.id] = n;
  const isLogic = n => n && (n.kind === 'diamond' || /logic|decision|if/i.test(n.type || '') || /decision|logic/i.test(n.cat || ''));

  const viol = [];

  const pop = { edges: 0, 'rgt-exits': 0 };
  for (const e of edges) {
    pop.edges++;
    if ((e.fromPt || 'bot') !== 'rgt') continue;
    pop['rgt-exits']++;
    const src = byId[e.f];
    const lateral = e.toPt === 'lft' || e.toPt === 'rgt';
    if (lateral || isLogic(src)) continue;
    viol.push({ edge: `${e.f}→${e.t}`, toPt: e.toPt });
  }

  console.log(`ANCHOR-SIDE SCAN (rgt reserved for logic / lateral source) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  rule: a wire may exit 'rgt' only from a logic node or as a rgt→lft lateral`);
  console.log(`  wires screened : ${pop.edges}  ·  rgt-face exits examined : ${pop['rgt-exits']}`);
  declarePopulation(pop);
  if (viol.length) {
    console.log(`  VERDICT: ANCHOR-SIDE VIOLATIONS (${viol.length}) — rgt used as source on a non-logic, non-lateral node`);
    for (const v of viol) console.log(`     ✗ ${v.edge}  (fromPt:rgt → toPt:${v.toPt})`);
    process.exitCode = 1;
  } else {
    console.log(`  VERDICT: ANCHOR SIDES CLEAN — no misused rgt source`);
    process.exitCode = 0;
  }
  return viol;
}

const arg = process.argv[2];
if (arg) run(JSON.parse(fs.readFileSync(arg, 'utf8')));
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => run(JSON.parse(raw))); }
