

import { declarePopulation } from './_population.mjs';
import path from 'node:path';

const NODE_CORNER_R = 7;
const NODE_MIN_H = 48;

function analyze(nodes, lats, pop) {
  const byId = {}; for (const n of nodes) byId[n.id] = n;
  const R = NODE_CORNER_R;
  const viol = [];
  const cornerDist = (node, pt, anchor) => {
    const h = node.h || NODE_MIN_H, w = node.w;
    if (pt === 'lft' || pt === 'rgt') return Math.min(anchor.y - node.y, (node.y + h) - anchor.y);
    if (pt === 'top' || pt === 'bot') return Math.min(anchor.x - node.x, (node.x + w) - anchor.x);
    return Infinity;
  };
  for (const e of lats) {
    const fn = byId[e.f], tn = byId[e.t];
    const fromPt = e.fromPt || 'bot', toPt = e.toPt || 'top';

    if (fn && e.p1 && !e._isBandSource) { if (pop) pop.anchors++; const d = cornerDist(fn, fromPt, e.p1); if (d < R - 0.5) viol.push(`${e.f}->${e.t} SOURCE @${fromPt} ${d.toFixed(1)}px from corner (min ${R})`); }
    if (tn && e.p2 && !e._isBandTarget) { if (pop) pop.anchors++; const d = cornerDist(tn, toPt, e.p2); if (d < R - 0.5) viol.push(`${e.f}->${e.t} TARGET @${toPt} ${d.toFixed(1)}px from corner (min ${R})`); }
  }
  return viol;
}

function report(label, out, pop) {
  console.log(`CORNER SAFETY SCAN (anchor ≥ NODE_CORNER_R ${NODE_CORNER_R}px off a node corner) — ${label}`);
  if (pop) { console.log(`  anchors examined : ${pop.anchors}`); declarePopulation(pop); }
  console.log(`  anchors on a corner : ${out.length}`);
  out.forEach(s => console.log('     ✗ ' + s));
  console.log(`  VERDICT: ${out.length === 0 ? 'CORNER SAFE' : 'CORNER UNSAFE (' + out.length + ')'}`);
  process.exitCode = out.length === 0 ? 0 : 1;
}

function runJson(json) {
  const j = JSON.parse(json);
  if (!j.edgePaths) { console.error('corner-safety-scan: audit JSON has no edgePaths (re-run audit-harness.mjs).'); process.exitCode = 2; return; }
  const nodes = (j.engine && j.engine.nodes) || [];
  const pop = { anchors: 0 };
  report(j.meta?.testFile || "(stdin)", analyze(nodes, j.edgePaths, pop), pop);
}

async function runRender(file) {
  const { chromium } = await import('playwright');
  const exe = process.env.PLAYWRIGHT_CHROME;
  const b = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1150 } })).newPage();
  await p.goto('file://' + path.resolve(file), { waitUntil: 'load' });
  await p.waitForTimeout(700);
  const data = await p.evaluate(() => {
    const ns = nodes.map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));
    const ls = edges.map(e => {
      let info; try { info = computeEdgePath(e); } catch (_) { info = null; }
      return { f: e.f, t: e.t, fromPt: e.fromPt, toPt: e.toPt,
               p1: info && info.p1 ? { x: info.p1.x, y: info.p1.y } : null,
               p2: info && info.p2 ? { x: info.p2.x, y: info.p2.y } : null };
    });
    return { nodes: ns, lats: ls };
  });
  await b.close();
  report(path.basename(file), analyze(data.nodes, data.lats));
}

const fileArg = process.argv[2];
if (fileArg && fileArg.endsWith('.html')) {
  await runRender(fileArg);
} else {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => raw += d).on('end', () => {
    if (!raw.trim()) { console.error('usage: node audit-harness.mjs <file.html> | node corner-safety-scan.mjs'); process.exitCode = 2; return; }
    runJson(raw);
  });
}
