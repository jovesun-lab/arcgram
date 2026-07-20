

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

function run(j) {
  const nodes = j.engine?.nodes || [];
  const edges = j.engine?.edges || [];
  const isLogic = n => n && (n.kind === 'diamond' || /logic|decision|if/i.test(n.type || '') || /decision|logic/i.test(n.cat || ''));

  const viol = [];
  for (const n of nodes) {
    if (!isLogic(n)) continue;
    const outs = edges.filter(e => e.f === n.id);
    if (outs.length > 2) {
      viol.push({ node: n.id, why: `out-degree ${outs.length} > 2 (third out-wire)`, edges: outs.map(e => `${e.f}→${e.t}`) });
    } else if (outs.length === 2) {
      const sides = outs.map(e => e.fromPt || 'bot');
      if (sides[0] === sides[1]) {
        viol.push({ node: n.id, why: `Y/N merged — both outs exit '${sides[0]}' (shared trunk)`, edges: outs.map(e => `${e.f}→${e.t}`) });
      }
    }
  }

  const nLogic = nodes.filter(isLogic).length;
  console.log(`LOGIC-OUT SCAN (decision out-degree==2, Y/N unmerged) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  rule: a logic node emits exactly 2 outs (Yes/No) on DIFFERENT sides; ${nLogic} logic node(s) seen`);
  declarePopulation({ 'logic-nodes': nLogic });
  if (viol.length) {
    console.log(`  VERDICT: LOGIC-OUT VIOLATIONS (${viol.length})`);
    for (const v of viol) console.log(`     ✗ ${v.node}: ${v.why}  [${v.edges.join(', ')}]`);
    process.exitCode = 1;
  } else {
    console.log(`  VERDICT: LOGIC OUTS CLEAN — every decision has 2 unmerged Yes/No outs`);
    process.exitCode = 0;
  }
  return viol;
}

const arg = process.argv[2];
if (arg) run(JSON.parse(fs.readFileSync(arg, 'utf8')));
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => run(JSON.parse(raw))); }
