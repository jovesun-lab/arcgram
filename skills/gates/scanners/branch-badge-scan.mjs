#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const TOL_NODE = 6;
const TOL_PILL = 2;

function norm(b) {
  if (!b) return null;
  if (b.x1 !== undefined && b.y1 !== undefined && b.w === undefined) return { x0: b.x0 ?? b.x, y0: b.y0 ?? b.y, x1: b.x1, y1: b.y1 };
  if (b.w !== undefined && b.h !== undefined) return { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
  return null;
}
const depth = (a, b) => Math.min(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

function run(j) {
  const edges = j.engine?.edges || [];
  const nodes = (j.engine?.nodes || []).map(n => ({ id: n.id, label: n.label, x0: n.x, y0: n.y, x1: n.x + n.w, y1: n.y + n.h }));
  const badges = edges.filter(e => e._branchBadgeBox).map(e => ({ lbl: `${e.branch || '?'} @ ${e.f}->${e.t}`, src: e.f, box: norm(e._branchBadgeBox) })).filter(b => b.box);
  const labels = edges.filter(e => e._labelBox).map(e => ({ lbl: e.lbl || e.label || `${e.f}->${e.t}`, box: norm(e._labelBox) })).filter(b => b.box);

  const hitNode = [];
  for (const b of badges) for (const n of nodes) {
    const d = depth(b.box, n);
    if (d > TOL_NODE) hitNode.push({ badge: b.lbl, node: n.label || n.id, depth: Math.round(d) });
  }
  const hitLabel = [];
  for (const b of badges) for (const l of labels) {
    const d = depth(b.box, l.box);
    if (d > TOL_PILL) hitLabel.push({ badge: b.lbl, label: l.lbl, depth: Math.round(d) });
  }
  const hitBadge = [];
  for (let a = 0; a < badges.length; a++) for (let c = a + 1; c < badges.length; c++) {
    if (depth(badges[a].box, badges[c].box) > TOL_PILL) hitBadge.push({ a: badges[a].lbl, b: badges[c].lbl });
  }

  const redundant = (edges || []).filter(e => (e.branch === 'Y' || e.branch === 'N') && e.lbl != null && String(e.lbl).trim() !== '')
    .map(e => ({ lbl: `${e.branch} @ ${e.f}->${e.t}`, text: String(e.lbl) }));

  const total = hitNode.length + hitLabel.length + hitBadge.length + redundant.length;
  console.log(`BRANCH-BADGE SCAN (badge↔node / badge↔label / badge↔badge, stamped boxes) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  badges: ${badges.length}`);
  declarePopulation({ badges: badges.length });
  console.log(`  badge ↔ node  (>${TOL_NODE}px) : ${hitNode.length}`);
  hitNode.forEach(h => console.log(`     ✗ badge [${h.badge}] sits on node "${h.node}" (${h.depth}px deep)`));
  console.log(`  badge ↔ label (>${TOL_PILL}px) : ${hitLabel.length}`);
  hitLabel.forEach(h => console.log(`     ✗ badge [${h.badge}] ∩ label "${h.label}" (${h.depth}px deep)`));
  console.log(`  badge ↔ badge (>${TOL_PILL}px) : ${hitBadge.length}`);
  hitBadge.forEach(h => console.log(`     ✗ [${h.a}] ∩ [${h.b}]`));
  console.log(`  branch ↔ redundant-label : ${redundant.length}`);
  redundant.forEach(h => console.log(`     ✗ branch [${h.lbl}] also carries text lbl "${h.text}" — drop it; the Y/N badge IS the label (use desc for a tooltip)`));
  const clean = badges.length === 0 && redundant.length === 0;
  console.log(`  VERDICT: ${clean ? 'N/A → PASS (no branch badges)' : (total ? 'BADGE OVERLAP (' + total + ')' : 'NO BADGE OVERLAP')}`);
  return total;
}

const arg = process.argv[2];
if (arg) process.exitCode = run(JSON.parse(fs.readFileSync(arg, 'utf8'))) ? 1 : 0;
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)) ? 1 : 0; }); }
