

import fs from 'fs';
import { declarePopulation } from './_population.mjs';

const CORNER_R = 5, MICROJOG_MAX = 2 * CORNER_R;
function microJogCount(segs) {
  let n = 0, info = '';
  for (let s = 0; s + 1 < segs.length; s++) {
    const a = segs[s], b = segs[s + 1];
    if (a.axis === 'D' || b.axis === 'D' || a.axis !== b.axis || a.dir !== b.dir) continue;
    const off = Math.abs(a.fixed - b.fixed);
    if (off > 0.5 && off <= MICROJOG_MAX) { n++; if (!info) info = `${off.toFixed(1)}px ${a.axis}-step`; }
  }
  return { n, info };
}

const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const nodes = j.engine.nodes || [];
const ATTACH = 4;

const ATTACH_DIAMOND = 9;
const attach = (x, y) => {
  for (const n of nodes) {
    const A = n.kind === 'diamond' ? ATTACH_DIAMOND : ATTACH;
    const onY = y >= n.y - A && y <= n.y + n.h + A;
    const onX = x >= n.x - A && x <= n.x + n.w + A;
    if (onY && Math.abs(x - n.x) <= A) return { id: n.id, side: 'lft' };
    if (onY && Math.abs(x - (n.x + n.w)) <= A) return { id: n.id, side: 'rgt' };
    if (onX && Math.abs(y - n.y) <= A) return { id: n.id, side: 'top' };
    if (onX && Math.abs(y - (n.y + n.h)) <= A) return { id: n.id, side: 'bot' };
  }
  return null;
};

const KINK_MIN = 12;

const doglegKeys = new Set();

const aroundKeys = new Set();
const paths = [...new Set((j.drawLog || []).filter(o => o.svgPath).map(o => o.svgPath))];
const rows = [];
const pop = { wires: 0 };
for (const p of paths) {
  const toks = p.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, qCount = 0;
  const pts = [];
  const legs = [];
  const segs = [];
  const corners = [];
  const num = () => parseFloat(toks[i++]);
  const pushLeg = (d) => { if (d > 0.5) legs.push(d); };
  while (i < toks.length) {
    const c = toks[i++];
    if (c === 'M') { cx = num(); cy = num(); sx = cx; sy = cy; pts.push([cx, cy]); }
    else if (c === 'L') { const x = num(), y = num(); const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d > 0.5) { if (Math.min(Math.abs(dx), Math.abs(dy)) < 0.5) segs.push({ axis: Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V', fixed: Math.abs(dx) >= Math.abs(dy) ? cy : cx, dir: Math.sign(Math.abs(dx) >= Math.abs(dy) ? dx : dy), len: d }); else segs.push({ axis: 'D' }); } pushLeg(d); cx = x; cy = y; pts.push([cx, cy]); }
    else if (c === 'H') { const x = num(); const d = Math.abs(x - cx); if (d > 0.5) segs.push({ axis: 'H', fixed: cy, dir: Math.sign(x - cx), len: d }); pushLeg(d); cx = x; pts.push([cx, cy]); }
    else if (c === 'V') { const y = num(); const d = Math.abs(y - cy); if (d > 0.5) segs.push({ axis: 'V', fixed: cx, dir: Math.sign(y - cy), len: d }); pushLeg(d); cy = y; pts.push([cx, cy]); }
    else if (c === 'Q') { const qcx = num(), qcy = num(); corners.push({ p0: [cx, cy], c: [qcx, qcy] }); cx = num(); cy = num(); qCount++; pts.push([cx, cy]); }
  }

  let overshoot = 0;
  for (const cr of corners) {
    const k = pts.findIndex(pt => pt[0] === cr.p0[0] && pt[1] === cr.p0[1]);
    if (k < 1) continue;
    const A = pts[k - 1], p0 = cr.p0, C = cr.c;
    if (Math.abs(p0[1] - A[1]) < 0.5) {
      const dir = Math.sign(p0[0] - A[0]);
      if (dir !== 0 && Math.sign(C[0] - p0[0]) === -dir && Math.abs(C[0] - p0[0]) > 0.5) overshoot++;
    } else if (Math.abs(p0[0] - A[0]) < 0.5) {
      const dir = Math.sign(p0[1] - A[1]);
      if (dir !== 0 && Math.sign(C[1] - p0[1]) === -dir && Math.abs(C[1] - p0[1]) > 0.5) overshoot++;
    }
  }
  const aS = attach(sx, sy), aT = attach(cx, cy);
  if (!aS || !aT) continue;

  const interior = legs.slice(1, -1);
  const minInterior = interior.length ? Math.min(...interior) : Infinity;
  const nA = nodes.find(n => n.id === aS.id), nB = nodes.find(n => n.id === aT.id);
  if (!nA || !nB) continue;
  pop.wires++;

  const vert = ['top','bot'].includes(aS.side) && ['top','bot'].includes(aT.side);
  const horiz = ['lft','rgt'].includes(aS.side) && ['lft','rgt'].includes(aT.side);

  const ALIGN_TOL = 32;
  const colAligned = Math.abs((nA.x + nA.w / 2) - (nB.x + nB.w / 2)) <= ALIGN_TOL;
  const rowAligned = Math.abs((nA.y + nA.h / 2) - (nB.y + nB.h / 2)) <= ALIGN_TOL;
  const { n: microjog, info: microjogInfo } = microJogCount(segs);
  let flag = '';
  if (overshoot > 0) flag = `OVERSHOOT-HOOK corner (${overshoot}) — a leg runs PAST its turn and the curve pulls back (hvhPath within-column hook)`;
  else if (vert && colAligned && qCount > 0 && !aroundKeys.has(`${aS.id}->${aT.id}`)) flag = `COLUMN-aligned but BENT (${qCount} corners) — rule 10: should be straight`;
  else if (horiz && rowAligned && qCount > 0 && !aroundKeys.has(`${aS.id}->${aT.id}`)) flag = `ROW-aligned but BENT (${qCount} corners) — rule 9c1/10: should be straight`;
  else if (qCount >= 4 && (colAligned || rowAligned) && !doglegKeys.has(`${aS.id}->${aT.id}`) && !aroundKeys.has(`${aS.id}->${aT.id}`)) flag = `S-BEND (${qCount} corners) — double jog, likely avoidable`;
  else if (microjog) flag = `MICRO-JOG kink — ${microjogInfo} ≤ ${MICROJOG_MAX}px (sub-2R corner-on-corner step, no straight leg between two corners; invisible to short-jog + aligned checks)`;
  else if (minInterior < KINK_MIN) flag = `SHORT-JOG kink — interior run ${minInterior.toFixed(1)}px < ${KINK_MIN} (staircase step, not a real leg)`;
  if (flag) rows.push(`${aS.id}.${aS.side} → ${aT.id}.${aT.side}: ${flag}\n      ${p.slice(0,160)}`);
}
console.log(`WIRE KINK AUDIT — ${j.meta.testFile}`);
console.log(`  edges audited: ${paths.length} · wires examined (attach pair resolved): ${pop.wires} · flagged: ${rows.length}`);
declarePopulation(pop);
rows.forEach(r => console.log('   - ' + r));
if (!rows.length) console.log('   (no unnecessary kinks)');

process.exitCode = rows.length ? 1 : 0;
