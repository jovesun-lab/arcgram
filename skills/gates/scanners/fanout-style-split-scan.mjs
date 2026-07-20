

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const MIN_SPLIT = 4;
const dataClass = (st) => ((st || 'solid') === 'dashed') ? 'ref' : 'seq';
const vert = (s) => s === 'top' || s === 'bot';
const COLL = 1;

function busOf(pts, vertFace) {
  if (!pts || pts.length < 3) return null;
  const a = pts[1], b = pts[2];
  if (vertFace) {
    if (Math.abs(a.y - b.y) > COLL) return null;
    return { c: a.y, s0: Math.min(a.x, b.x), s1: Math.max(a.x, b.x) };
  }
  if (Math.abs(a.x - b.x) > COLL) return null;
  return { c: a.x, s0: Math.min(a.y, b.y), s1: Math.max(a.y, b.y) };
}
const runsOverlap = (p, q) => Math.min(p.s1, q.s1) - Math.max(p.s0, q.s0) > 0;

function scan(j) {
  const eps = j.edgePaths || [];
  const faces = {};
  for (const e of eps) {
    const sf = e.fromPt || 'bot', st = e.toPt || 'top';
    if (sf === st) continue;
    const pts = e.pts || []; if (!pts.length) continue;
    const key = e.f + '|' + sf;
    (faces[key] ||= []).push({ f: e.f, t: e.t, coord: vert(sf) ? pts[0].x : pts[0].y, cls: dataClass(e.style), bus: busOf(pts, vert(sf)) });
  }
  let facesChecked = 0;
  const viol = [];
  for (const key of Object.keys(faces)) {
    const outs = faces[key];
    const classes = new Set(outs.map(o => o.cls));
    if (outs.length < 2 || classes.size < 2) continue;
    facesChecked++;
    for (let i = 0; i < outs.length; i++) for (let k = i + 1; k < outs.length; k++) {
      if (outs[i].cls === outs[k].cls) continue;
      const A = outs[i], B = outs[k];
      if (Math.abs(A.coord - B.coord) < MIN_SPLIT)
        viol.push(`${key} : EXIT unsplit — ${A.cls}(${A.f}->${A.t}) shares the exit lane @${Math.round(A.coord)} with ${B.cls}(${B.f}->${B.t}) (< ${MIN_SPLIT}px split)`);
      if (A.bus && B.bus && Math.abs(A.bus.c - B.bus.c) < MIN_SPLIT && runsOverlap(A.bus, B.bus))
        viol.push(`${key} : BUS unsplit — ${A.cls}(${A.f}->${A.t}) and ${B.cls}(${B.f}->${B.t}) ride the SAME bus lane @${Math.round(A.bus.c)}, collinear for ${Math.round(Math.min(A.bus.s1, B.bus.s1) - Math.max(A.bus.s0, B.bus.s0))}px (a trunk is a lane in BOTH axes)`);
    }
  }
  return { facesChecked, viol };
}

function run(j) {
  const { facesChecked, viol } = scan(j);
  console.log('FAN-OUT STYLE-TRUNK SPLIT SCAN (dashed soft-ref vs sequence family, per face)');
  console.log('  mixed-data-class faces checked : ' + facesChecked);

  declarePopulation({ 'mixed-class-faces': facesChecked });
  console.log('  unsplit different-class exits (VIOLATION) : ' + viol.length);
  for (const v of viol) console.log('     - ' + v);
  console.log('  VERDICT: ' + (viol.length ? 'STYLE-SPLIT VIOLATED' : 'CLEAN'));
  return viol.length ? 1 : 0;
}

const arg = process.argv[2];
{
  let raw = '';
  if (arg && fs.existsSync(arg)) raw = fs.readFileSync(arg, 'utf8');
  else raw = fs.readFileSync(0, 'utf8');
  process.exit(run(JSON.parse(raw)));
}
