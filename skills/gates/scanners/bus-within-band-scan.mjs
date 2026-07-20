

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const TOL = 6;

const MIN_BUS = 20;

function hSegsOf(e) {
  const pts = Array.isArray(e.pts) ? e.pts : null;
  if (!pts || pts.length < 2) return [];
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (Math.abs(b.y - a.y) < 0.5 && Math.abs(b.x - a.x) >= MIN_BUS)
      out.push({ y: b.y, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x) });
  }
  return out;
}

function pathYs(pathStr) {
  if (!pathStr) return [];
  const t = pathStr.trim().split(/\s+/); const ys = []; let x = 0, y = 0, i = 0;
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M' || c === 'L') { x = +t[i++]; y = +t[i++]; ys.push(y); }
    else if (c === 'H') { x = +t[i++]; ys.push(y); }
    else if (c === 'V') { y = +t[i++]; ys.push(y); }
  }
  return ys;
}

function run(j) {
  const nodes = j.engine?.nodes || [];
  const bands = j.engine?.bands || null;
  const eps = j.edgePaths || [];
  if (!Array.isArray(bands) || bands.length === 0) {
    console.log('BUS-WITHIN-BAND SCAN — VERDICT: N/A (V-layout, no bands) → PASS');
    declarePopulation({ bands: 0, 'same-band-buses': 0, 'cross-band-buses': 0 });
    return [];
  }
  const bandOf = {}; for (const n of nodes) bandOf[n.id] = n._band;
  const nById = {}; for (const n of nodes) nById[n.id] = n;
  const bById = {}; for (const b of bands) bById[b._membershipKey] = b;
  const blockTop = Math.min(...bands.map(b => b.y));
  const blockBot = Math.max(...bands.map(b => b.y + b.h));

  const regionOf = (id) => {

    if (bById[id] && bById[id].y != null) { const B = bById[id]; return { lo: B.y - TOL, hi: B.y + B.h + TOL, label: B.label || id }; }
    const key = bandOf[id], B = key && bById[key];
    if (B && B.y != null) return { lo: B.y - TOL, hi: B.y + B.h + TOL, label: B.label || key };
    const n = nById[id]; if (!n) return null;
    if (n.y + (n.h || 0) <= blockTop) return { lo: -Infinity, hi: blockTop - 1, label: 'the void ABOVE the bands' };
    if (n.y >= blockBot) return { lo: blockBot + 1, hi: Infinity, label: 'the void BELOW the bands' };
    return null;
  };

  const viol = [];
  let crossBuses = 0;
  for (const e of eps) {
    const sb = bandOf[e.f], tb = bandOf[e.t];

    if (sb && sb === tb) {
      const B = bById[sb]; if (!B || B.y == null) continue;
      const ys = pathYs(e.pathStr);
      if (!ys.length) continue;
      const lo = Math.min(...ys), hi = Math.max(...ys);
      const top = B.y - TOL, bot = B.y + B.h + TOL;
      if (lo < top || hi > bot) {
        const out = hi > bot ? `${Math.round(hi - (B.y + B.h))}px BELOW` : `${Math.round(B.y - lo)}px ABOVE`;
        viol.push({ edge: `${e.f}→${e.t}${e.lbl ? ' "' + e.lbl + '"' : ''}`, band: B.label || sb, out, busHi: Math.round(hi), bandBot: Math.round(B.y + B.h), kind: 'same-band' });
      }
      continue;
    }

    const rs = regionOf(e.f), rt = regionOf(e.t);
    const regions = [rs, rt].filter(Boolean);
    if (!regions.length) continue;
    for (const s of hSegsOf(e)) {
      crossBuses++;
      if (regions.some(r => s.y >= r.lo && s.y <= r.hi)) continue;
      const where = bands.find(b => s.y >= b.y && s.y <= b.y + b.h);
      viol.push({
        edge: `${e.f}→${e.t}${e.lbl ? ' "' + e.lbl + '"' : ''}`,
        band: regions.map(r => r.label).join(' | '),
        out: `bus at y=${Math.round(s.y)} (x ${Math.round(s.x0)}..${Math.round(s.x1)}) lies in ${where ? '[' + (where.label || where._membershipKey) + ']' : 'no band'}`,
        busHi: Math.round(s.y), bandBot: null, kind: 'cross-band',
      });
    }
  }
  declarePopulation({ bands: bands.length, 'same-band-buses': eps.length, 'cross-band-buses': crossBuses });

  console.log(`BUS-WITHIN-BAND SCAN (a bus belongs to a band the wire belongs to) — ${j.meta?.testFile ?? '?'}`);
  console.log(`  rule: SAME-BAND wire → its whole path stays in that band (±${TOL}) · CROSS-BAND wire → every horizontal bus (≥${MIN_BUS}px) lies in its SOURCE's or TARGET's band; vertical legs may span`);
  if (viol.length) {
    console.log(`  VERDICT: BUS-OUT-OF-BAND VIOLATIONS (${viol.length}) — reserve/pick the band lane (botLane/topLane) so the bus sits in a band the wire belongs to`);
    for (const v of viol) console.log(v.kind === 'same-band'
      ? `     ✗ [same-band] ${v.edge}  [${v.band}]  bus ${v.out} the band (busY ${v.busHi} vs band-bottom ${v.bandBot})`
      : `     ✗ [cross-band] ${v.edge}  belongs to [${v.band}] — ${v.out}`);
    process.exitCode = 1;
  } else {
    console.log(`  VERDICT: BUSES IN-BAND — every same-band lateral routes inside its own band, and every cross-band bus lies in a band its wire belongs to`);
    process.exitCode = 0;
  }
  return viol;
}

const arg = process.argv[2];
if (arg) run(JSON.parse(fs.readFileSync(arg, 'utf8')));
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => run(JSON.parse(raw))); }
