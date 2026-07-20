

import { declarePopulation } from './_population.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import { measureTextMetrics } from './_text-metrics.mjs';

const MISS_TOL = 3.0;

function pathPoints(d) {
  const t = d.trim().split(/\s+/); const pts = []; let cx = 0, cy = 0, i = 0;
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M' || c === 'L') { cx = num(); cy = num(); pts.push([cx, cy]); }
    else if (c === 'H') { cx = num(); pts.push([cx, cy]); }
    else if (c === 'V') { cy = num(); pts.push([cx, cy]); }
    else if (c === 'Q') { const qx = num(), qy = num(); pts.push([qx, qy]); cx = num(); cy = num(); pts.push([cx, cy]); }

  }
  return pts;
}
const span = (pts, k) => { if (!pts.length) return 0; let lo = Infinity, hi = -Infinity; for (const p of pts) { if (p[k] < lo) lo = p[k]; if (p[k] > hi) hi = p[k]; } return hi - lo; };

function scanEdges(roundOrthoFn, edges) {
  const findings = [];
  for (const e of edges || []) {
    const p = e._path; if (!p || p.length < 2) continue;
    const pts = p.map(q => [q.x, q.y]);
    const geoW = span(pts, 0), geoH = span(pts, 1);
    let dStr; try { dStr = roundOrthoFn(pts); } catch { continue; }
    const rp = pathPoints(dStr);
    const rW = span(rp, 0), rH = span(rp, 1);
    const missX = geoW - rW, missY = geoH - rH;
    if (missX > MISS_TOL || missY > MISS_TOL) {
      findings.push({ f: e.f, t: e.t, geoW: geoW.toFixed(1), geoH: geoH.toFixed(1),
        rW: rW.toFixed(1), rH: rH.toFixed(1),
        axis: missX > MISS_TOL ? 'X' : 'Y', miss: (missX > MISS_TOL ? missX : missY).toFixed(1), render: dStr });
    }
  }
  return findings;
}

function live(file) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!scripts.length) { console.error('no <script> block'); process.exit(2); }
  const engineSrc = scripts[scripts.length - 1][1];
  const noop = () => {};

  const _cs = { font: '400 10px system-ui' };
  const ctxProxy = new Proxy({ measureText: s => measureTextMetrics(s, _cs.font),
    setLineDash: noop, getLineDash: () => [], canvas: {} },
    { get: (t, k) => (k === 'font' ? _cs.font : (k in t ? t[k] : noop)),
      set: (t, k, v) => { if (k === 'font') _cs.font = v; else t[k] = v; return true; } });
  const canvas = { width: 1600, height: 1100, style: {}, getContext: () => ctxProxy,
    getBoundingClientRect: () => ({ left:0, top:0, width:1600, height:1100 }), addEventListener: noop, setAttribute: noop,
    parentElement: { clientWidth: 1600, clientHeight: 1100 } };
  const elProxy = new Proxy({ style:{ setProperty:noop, getPropertyValue:()=>'' }, dataset:{}, classList:{ add:noop, remove:noop, toggle:noop, contains:()=>false },
    addEventListener:noop, removeEventListener:noop, appendChild:noop, removeChild:noop, setAttribute:noop, getAttribute:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], getContext:()=>ctxProxy, textContent:'', innerHTML:'', children:[], remove:noop, focus:noop, click:noop, getBoundingClientRect:canvas.getBoundingClientRect },
    { get: (t, k) => (k in t ? t[k] : noop) });
  const doc = { getElementById: () => canvas, querySelector: () => elProxy, querySelectorAll: () => [], createElement: () => elProxy,
    createElementNS: () => elProxy, addEventListener: noop, removeEventListener: noop, body: elProxy,
    documentElement: elProxy, head: elProxy };
  const win = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 1100, addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }), localStorage: { getItem: () => null, setItem: noop, removeItem: noop } };
  const sandbox = { document: doc, window: win, console: { log: noop, warn: noop, error: noop, info: noop },
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop, getComputedStyle: win.getComputedStyle, devicePixelRatio: 1,
    setTimeout: (fn) => { try { fn(); } catch {} return 0; }, clearTimeout: noop,
    Path2D: function () { return {}; }, Image: function () { return {}; }, matchMedia: win.matchMedia,
    navigator: { userAgent: 'node' }, location: { href: 'file://' }, localStorage: win.localStorage, ARCGRAM_LIVE_OK: true };
  sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  const epilogue = '\n;try{globalThis.__edges=(typeof edges!=="undefined")?edges:null;globalThis.__roundOrtho=(typeof roundOrtho!=="undefined")?roundOrtho:null;}catch(e){globalThis.__err=e.message;}';
  try { vm.runInContext(engineSrc + epilogue, sandbox, { filename: 'engine' }); }
  catch (e) { console.error('ENGINE ERROR:', e.message); process.exit(2); }

  const edges = sandbox.__edges, roundOrtho = sandbox.__roundOrtho;
  if (!roundOrtho) { console.error('no roundOrtho global (not an arcgram engine?)'); process.exit(2); }
  if (!edges) { console.error('no edges global'); process.exit(2); }

  const findings = scanEdges(roundOrtho, edges);
  const wired = edges.filter(e => e._path && e._path.length >= 2).length;
  console.log(`=== STROKE-VISIBILITY SCAN - ${file.split('/').pop()} ===`);
  console.log(`edges with a routed path : ${wired}`);
  declarePopulation({ wires: wired });
  for (const x of findings)
    console.log(`  INVISIBLE ${x.f}->${x.t} : geometry spans ${x.axis}=${x.axis === 'X' ? x.geoW : x.geoH}px but render drops ${x.miss}px  [render: ${x.render}]`);
  console.log(`invisible wires : ${findings.length}`);
  console.log(`VERDICT: ${findings.length === 0 ? 'CLEAN' : findings.length + ' INVISIBLE WIRE(S)'}`);
  process.exit(findings.length === 0 ? 0 : 1);
}

const arg = process.argv[2];
if (!arg) { console.error('usage: node stroke-visibility-scan.mjs <engine.html>'); process.exit(2); }
else live(arg);
