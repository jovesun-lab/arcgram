

import { declarePopulation } from './_population.mjs';

const WIRE_WIRE_MIN = Number(process.env.WIRE_WIRE_MIN) || 12;
const MIN_LEN = 24;
const OVERLAP_MIN = 8;

function segsOf(e, half) {
  const pts = e.pts && e.pts.length ? e.pts.map(p => [p.x, p.y]) : parseStr(e.pathStr);
  const H = [], V = [];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], c = pts[k];
    if (Math.abs(a[1] - c[1]) < 1 && Math.abs(a[0] - c[0]) >= MIN_LEN)
      H.push({ f: e.f, t: e.t, half, y: a[1], lo: Math.min(a[0], c[0]), hi: Math.max(a[0], c[0]) });
    else if (Math.abs(a[0] - c[0]) < 1 && Math.abs(a[1] - c[1]) >= MIN_LEN)
      V.push({ f: e.f, t: e.t, half, x: a[0], lo: Math.min(a[1], c[1]), hi: Math.max(a[1], c[1]) });
  }
  return { H, V };
}

function parseStr(d) {
  if (!d) return [];
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

function strokeHalf(e) { return ((e.style === 'bold' || e.crit) ? 2.4 : 1.5) / 2; }

function analyze(edgePaths, strokeBy, pop) {
  const H = [], V = [];
  for (const e of edgePaths) {
    const half = strokeBy(e);
    const s = segsOf(e, half);
    H.push(...s.H); V.push(...s.V);
  }
  if (pop) pop.segments = H.length + V.length;
  const sibling = (a, b) => a.f === b.f || a.t === b.t;
  const hits = [];
  const scan = (arr, axis) => {
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      if (sibling(a, b)) continue;
      if (pop) pop.pairs++;
      const centre = Math.abs(a[axis] - b[axis]);
      if (centre < 1) continue;
      const clear = centre - a.half - b.half;
      if (clear >= WIRE_WIRE_MIN) continue;
      const ov = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
      if (ov < OVERLAP_MIN) continue;
      hits.push(`${axis}=${Math.round(a[axis])}/${Math.round(b[axis])} (clear ${clear.toFixed(1)}px, centre ${centre.toFixed(0)}px): ${a.f}->${a.t} ∥ ${b.f}->${b.t} over ${Math.round(ov)}px`);
    }
  };
  scan(H, 'y'); scan(V, 'x');
  return hits;
}

function report(label, hits, pop) {
  console.log(`WIRE-WIRE CLEARANCE SCAN (distinct-source parallel wires, edge clearance < ${WIRE_WIRE_MIN}px) — ${label}`);
  if (pop) { console.log(`  legs derived : ${pop.segments}  ·  non-sibling leg pairs examined : ${pop.pairs}`); declarePopulation(pop); }
  console.log(`  too-close wire pairs : ${hits.length}`);
  hits.forEach(s => console.log('     ✗ ' + s));
  console.log(`  VERDICT: ${hits.length === 0 ? 'WIRE-WIRE CLEAN' : 'WIRE-WIRE VIOLATED (' + hits.length + ')'}`);
  return hits.length;
}

function fromJson(json) {
  const j = JSON.parse(json);
  const eps = j.edgePaths;
  if (!eps) { console.error('wire-wire-scan: audit JSON has no edgePaths (run v2-normalize / audit-harness).'); process.exit(2); }

  const strokeMap = new Map();
  for (const e of (j.engine?.edges || [])) strokeMap.set(`${e.f}->${e.t}`, strokeHalf(e));
  const strokeBy = (e) => strokeMap.get(`${e.f}->${e.t}`) ?? (1.5 / 2);
  const pop = { segments: 0, pairs: 0 };
  return report(j.meta?.testFile || j.meta?.file || '(stdin)', analyze(eps, strokeBy, pop), pop);
}

{
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => buf += d);
  process.stdin.on('end', () => {
    if (!buf.trim()) { console.error('usage: node v2-normalize.mjs <audit.json> | node wire-wire-scan.mjs'); process.exit(2); }
    const n = fromJson(buf);
    process.exit(n === 0 ? 0 : 1);
  });
}
