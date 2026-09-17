

import { declarePopulation } from './_population.mjs';
import path from 'node:path';

const ARROW_LEN = 9, MIN_STEM = 4, FLUSH_TOL = 0.6;
const MIN_APPROACH = ARROW_LEN + MIN_STEM;

function segs(d) {
  const t = String(d).replace(/,/g, ' ').trim().split(/\s+/);
  let x = 0, y = 0, i = 0; const pts = [];
  while (i < t.length) {
    const c = t[i];
    if (c === 'M' || c === 'L') { x = +t[i + 1]; y = +t[i + 2]; i += 3; pts.push([x, y]); }
    else if (c === 'H') { x = +t[i + 1]; i += 2; pts.push([x, y]); }
    else if (c === 'V') { y = +t[i + 1]; i += 2; pts.push([x, y]); }
    else if (c === 'Q') { x = +t[i + 3]; y = +t[i + 4]; i += 5; pts.push([x, y]); }
    else i++;
  }
  return pts;
}

function analyze(lats, pop) {
  const flush = [], stem = [];
  for (const e of lats) {
    if (!e.pathStr || !e.p2) continue;
    const pts = segs(e.pathStr); const n = pts.length;
    if (n < 2) continue;
    if (pop) pop.arrivals++;
    const last = pts[n - 1], prev = pts[n - 2];
    const p2gap = Math.hypot(e.p2.x - last[0], e.p2.y - last[1]);
    const approach = Math.hypot(last[0] - prev[0], last[1] - prev[1]);
    const id = `${e.f}->${e.t}`;
    if (p2gap > FLUSH_TOL) flush.push(`${id}  arrow ${p2gap.toFixed(1)}px off wire end`);
    if (approach < MIN_APPROACH - 0.5) stem.push(`${id}  approach ${approach.toFixed(1)}px (<${MIN_APPROACH})`);
  }
  return { flush, stem };
}

function report(label, out, pop, p2Synth) {
  console.log(`ARRIVAL SCAN (arrow-flush + approach-stem) — ${label}`);
  if (pop) { console.log(`  arrivals examined : ${pop.arrivals}`); declarePopulation(pop); }
  if (p2Synth) console.log(`  (A) arrow-flush : OWNED BY seat-scan (5) — p2 is synthesized from the path end here, so asserting it would be a tautology`);
  else { console.log(`  (A) arrow NOT flush on wire end : ${out.flush.length}`); out.flush.forEach(s => console.log(`     ✗ ${s}`)); }
  console.log(`  (B) approach too short for stem : ${out.stem.length}`);
  out.stem.forEach(s => console.log(`     ✗ ${s}`));
  const bad = (p2Synth ? 0 : out.flush.length) + out.stem.length;
  console.log(`  VERDICT: ${bad === 0 ? 'ARRIVALS CLEAN' : 'ARRIVAL ANATOMY VIOLATED (' + bad + ')'}`);
  process.exitCode = bad === 0 ? 0 : 1;
}

function runJson(json) {
  const j = JSON.parse(json);
  if (!j.edgePaths) { console.error('arrival-scan: audit JSON has no edgePaths (re-run audit-harness.mjs).'); process.exitCode = 2; return; }

  const eps = j.edgePaths.map((e) => {
    if (e.p2) return e;
    const pts = e.pts || (e.pathStr ? null : null);
    const last = pts && pts.length ? pts[pts.length - 1] : null;
    return last ? { ...e, p2: { x: last.x, y: last.y }, _p2Synth: true } : e;
  });
  const pop = { arrivals: 0 };
  report(j.meta?.testFile || '(stdin)', analyze(eps, pop), pop, eps.some((e) => e._p2Synth));
}

async function runRender(file) {
  const { chromium } = await import('playwright');
  const { execSync } = await import('node:child_process');
  const exe = process.env.PLAYWRIGHT_CHROME
    || execSync('ls /sessions/*/mnt/outputs/.playwright-cache/chromium-*/chrome-linux/chrome 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1150 } })).newPage();
  await p.goto('file://' + path.resolve(file), { waitUntil: 'load' });
  await p.waitForTimeout(700);
  const lats = await p.evaluate(() => edges.map(e => {
    let info; try { info = computeEdgePath(e); } catch (_) { info = null; }
    return { f: e.f, t: e.t, pathStr: info && info.pathStr ? info.pathStr : null,
             p2: info && info.p2 ? { x: info.p2.x, y: info.p2.y } : null };
  }));
  await b.close();
  report(path.basename(file), analyze(lats));
}

const fileArg = process.argv[2];
if (fileArg && fileArg.endsWith('.html')) {
  await runRender(fileArg);
} else {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => raw += d).on('end', () => {
    if (!raw.trim()) { console.error('usage: node audit-harness.mjs <file.html> | node arrival-scan.mjs'); process.exitCode = 2; return; }
    runJson(raw);
  });
}
