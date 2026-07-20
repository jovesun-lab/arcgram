

import fs from 'fs';
import { declarePopulation } from './_population.mjs';

const HUB_DEG    = 4;
const NODE_MIN_W = 176;
const NODE_MIN_H = 48;
const TOL        = 2;

function run(j) {
  const nodes = j.engine.nodes || [];
  const edges = j.engine.edges || [];
  const out = {}, inn = {};
  for (const e of edges) { out[e.f] = (out[e.f] || 0) + 1; inn[e.t] = (inn[e.t] || 0) + 1; }

  const areas = nodes.map(n => n.w * n.h).sort((a, b) => a - b);
  const median = areas.length ? areas[Math.floor(areas.length / 2)] : 0;

  const rows = nodes.map(n => ({
    id: n.id, w: n.w, h: n.h, out: out[n.id] || 0, in: inn[n.id] || 0,
    deg: (out[n.id] || 0) + (inn[n.id] || 0),
  })).sort((a, b) => b.deg - a.deg);

  const sideNeedsGrow = {};
  for (const n of nodes) {
    const sides = { lft:{s:0,t:0}, rgt:{s:0,t:0}, top:{s:0,t:0}, bot:{s:0,t:0} };
    for (const e of edges) {
      if (e.f === n.id) { const k = e.fromPt || 'bot'; if (sides[k]) sides[k].s++; }
      if (e.t === n.id) { const k = e.toPt   || 'top'; if (sides[k]) sides[k].t++; }
    }
    let needs = false;
    for (const [side, c] of Object.entries(sides)) {
      if (c.s + c.t <= 2) continue;
      const sharedTrunk = (side === 'top' || side === 'bot') && c.t === 0;
      if (!sharedTrunk) needs = true;
    }
    sideNeedsGrow[n.id] = needs;
  }

  const hubs = rows.filter(r => r.deg >= HUB_DEG);
  const buried = hubs.filter(r =>
    r.w <= NODE_MIN_W + TOL && r.h <= NODE_MIN_H + TOL
    && sideNeedsGrow[r.id]
  );

  console.log(`HUB-READABILITY SCAN (Gate 6) — ${j.meta.testFile}`);
  console.log(`  hub threshold: degree >= ${HUB_DEG} · floor: ${NODE_MIN_W}x${NODE_MIN_H} · median area: ${median}`);

  console.log(`  nodes screened : ${nodes.length}  ·  hubs examined : ${hubs.length}`);
  declarePopulation({ nodes: nodes.length, hubs: hubs.length });
  console.log(`  hubs found: ${hubs.length}`);
  hubs.forEach(r => {
    const floorSized = r.w <= NODE_MIN_W + TOL && r.h <= NODE_MIN_H + TOL;
    const tag = buried.includes(r) ? '  ⚠ BURIED (floor-sized, a side >2 wires)' :
                (floorSized ? '  · floor but legible (bundle / ≤2-wire sides — no grow needed)' :
                 r.w * r.h <= median ? '  · grown but <= median' : '  · prominent');
    const kind = r.out >= 3 && r.in >= 3 ? 'hub+gate' : r.out >= 3 ? 'fan-out hub' : r.in >= 3 ? 'fan-in gate' : 'hub';
    console.log(`     - ${r.id.padEnd(9)} deg ${r.deg} (out ${r.out}/in ${r.in}) ${r.w}x${r.h}  [${kind}]${tag}`);
  });
  console.log(`  buried hubs: ${buried.length}`);
  console.log(`  VERDICT: ${buried.length ? 'HUBS BURIED' : 'HUBS LEGIBLE'}`);
  return buried.length;
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
