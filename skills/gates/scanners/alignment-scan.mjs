

import fs from 'fs';
import { declarePopulation } from './_population.mjs';

const TOL = 5;

function run(j) {
  const nodes = j.engine.nodes || [];
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const cols = Array.isArray(j.engine.columns) ? j.engine.columns : [];
  const _gk = new Set((Array.isArray(j.engine.bands) ? j.engine.bands : []).filter(b => b && b.group).map(b => b._membershipKey));
  const viol = [];
  let mode, groupCount;

  const pop = { groups: 0, members: 0 };

  if (cols.length) {

    mode = 'V-layout columns (center-X)'; groupCount = cols.length;
    for (const c of cols) {
      if (!Array.isArray(c.members)) continue;
      const ms = c.members.map(id => byId[id]).filter(Boolean);
      if (ms.length < 2) continue;
      pop.groups++; pop.members += ms.length;
      const cxs = ms.map(n => n.x + n.w / 2);
      const spread = Math.max(...cxs) - Math.min(...cxs);
      if (spread > TOL) {
        viol.push(`column "${c.label || c.id}": member centers span ${spread.toFixed(1)}px (>${TOL}) — ${ms.map(n => `${n.id}@${Math.round(n.x + n.w / 2)}`).join(', ')}`);
      }

      if (typeof c._x === 'number') {
        for (const n of ms) {
          const cx = n.x + n.w / 2;
          const d = Math.abs(cx - c._x);
          if (d > TOL) viol.push(`column "${c.label || c.id}": ${n.id} center=${Math.round(cx)} off column _x=${c._x} by ${d.toFixed(1)}px`);
        }
      }
    }
  } else {

    mode = 'H-layout band-rows (center-Y)';
    const FREE_ANCHOR = new Set(['session', 'sessionEnd', 'entry']);
    const bands = {};
    for (const n of nodes) {
      if (n.y == null || n._band == null) continue;
      if (_gk.has(n._band)) continue;
      if (FREE_ANCHOR.has(n.type)) continue;
      (bands[n._band] ||= []).push(n);
    }
    groupCount = Object.keys(bands).length;
    for (const [band, ms] of Object.entries(bands)) {
      if (ms.length < 2) continue;
      pop.groups++; pop.members += ms.length;
      const cys = ms.map(n => n.y + n.h / 2);
      const spread = Math.max(...cys) - Math.min(...cys);
      if (spread > TOL) {
        viol.push(`band "${band}": member centers span ${spread.toFixed(1)}px (>${TOL}) — ${ms.map(n => `${n.id}@${Math.round(n.y + n.h / 2)}`).join(', ')}`);
      }
    }
  }

  console.log(`ALIGNMENT SCAN (Gate 3, axis-agnostic) — ${j.meta.testFile}`);
  console.log(`  mode: ${mode} · groups: ${groupCount} · tolerance: ${TOL}px`);
  if (!groupCount) console.log(`  (no structural groups found — alignment N/A)`);
  console.log(`  groups measured (>=2 members) : ${pop.groups}  ·  members compared : ${pop.members}`);
  declarePopulation(pop);
  console.log(`  misalignments: ${viol.length}`);
  viol.forEach(v => console.log('   - ' + v));
  console.log(`  VERDICT: ${viol.length ? 'MISALIGNED' : 'ALIGNED'}`);
  return viol.length;
}

const arg = process.argv[2];
if (arg) {
  process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
} else {
  let raw = '';
  process.stdin.on('data', d => raw += d).on('end', () => {
    process.exitCode = run(JSON.parse(raw)) ? 1 : 0;
  });
}
