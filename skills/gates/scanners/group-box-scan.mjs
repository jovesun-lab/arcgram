#!/usr/bin/env node

import fs from 'node:fs';

import { declarePopulation } from './_population.mjs';

const EDGE_TOL = 2.5;
const GBM = 20, GTAG = 28;

const OUT_HANDLE = 20, ARROW_LEN = 13, WIRE_HANDLE = 10, PILL_CLEARANCE = 12, PILL_RENDERED_H = 16;

function onBoxEdge(pt, b, tol = EDGE_TOL) {
  if (!pt || !b) return false;
  const x0 = b.x, x1 = b.x + b.w, y0 = b.y, y1 = b.y + b.h;
  const onV = (Math.abs(pt.x - x0) <= tol || Math.abs(pt.x - x1) <= tol) && pt.y >= y0 - tol && pt.y <= y1 + tol;
  const onH = (Math.abs(pt.y - y0) <= tol || Math.abs(pt.y - y1) <= tol) && pt.x >= x0 - tol && pt.x <= x1 + tol;
  return onV || onH;
}
const inBoxInterior = (pt, b, pad = 0) => !!pt && !!b &&
  pt.x > b.x + pad && pt.x < b.x + b.w - pad && pt.y > b.y + pad && pt.y < b.y + b.h - pad;

function groupBoxesOf(engine) {
  const nodes = engine.nodes || [];
  const byId = {}; for (const b of (engine.bands || [])) if (b.group && Array.isArray(b.members)) {
    const ms = nodes.filter(n => b.members.includes(n.id)); if (!ms.length) continue;
    const minX = Math.min(...ms.map(n => n.x)), minY = Math.min(...ms.map(n => n.y));
    const maxX = Math.max(...ms.map(n => n.x + n.w)), maxY = Math.max(...ms.map(n => n.y + n.h));
    byId[b._membershipKey ?? b.id] = { id: b.id, x: minX - GBM, y: minY - GBM - GTAG, w: (maxX - minX) + 2 * GBM, h: (maxY - minY) + 2 * GBM + GTAG, members: b.members };
  }
  return byId;
}

function scan(engine, pills, pop) {
  const boxes = groupBoxesOf(engine);
  if (pop) pop.boxes = Object.keys(boxes).length;
  const nodeById = {}; for (const n of (engine.nodes || [])) nodeById[n.id] = n;
  const bandOf = id => (engine.bands || []).find(b => (b._membershipKey ?? b.id) === id) || null;
  const groupOfNode = n => (n && n._band && boxes[n._band]) ? { key: n._band, box: boxes[n._band] } : null;

  const edgeFindings = [];
  for (const e of engine.edges || []) {

    if (e._isBandSource && e._path && e._path.length) {
      const box = e._srcContainer || boxes[e.f];
      if (box) {
        if (pop) pop.endpoints++;
        if (!onBoxEdge(e._path[0], box))
          edgeFindings.push({ kind: 'source-off-edge', f: e.f, t: e.t, pt: e._path[0], box });
      }
    }

    if (e._isBandTarget && bandOf(e.t) && bandOf(e.t).group) {
      const box = e._container || boxes[e.t];
      const pt = e._arrowAt || (e._path && e._path[e._path.length - 1]);
      if (box) {
        if (pop) pop.endpoints++;
        if (!onBoxEdge(pt, box))
          edgeFindings.push({ kind: 'target-off-edge', f: e.f, t: e.t, pt, box });
      }
    }

    const boxT = (e._isBandTarget && bandOf(e.t) && bandOf(e.t).group) ? (e._container || boxes[e.t]) : null;
    const boxS = (e._isBandSource && bandOf(e.f) && bandOf(e.f).group) ? (e._srcContainer || boxes[e.f]) : null;
    const box = boxT || boxS;
    if (box && e._path && e._path.length) {
      const other = nodeById[boxT ? e.f : e.t];
      const pt = boxT ? (e._arrowAt || e._path[e._path.length - 1]) : e._path[0];
      if (other && pt && !other._isGroupPseudo) {

        const near = (a, b) => Math.abs(a - b) <= EDGE_TOL;
        let face = null;
        if (near(pt.y, box.y)) face = 'top';
        else if (near(pt.y, box.y + box.h)) face = 'bot';
        else if (near(pt.x, box.x)) face = 'lft';
        else if (near(pt.x, box.x + box.w)) face = 'rgt';

        const faceOn = face && (
          face === 'top' ? other.y + other.h <= box.y + EDGE_TOL :
          face === 'bot' ? other.y >= box.y + box.h - EDGE_TOL :
          face === 'lft' ? other.x + other.w <= box.x + EDGE_TOL :
                           other.x >= box.x + box.w - EDGE_TOL);
        if (faceOn) {
          const vert = (face === 'top' || face === 'bot');

          let reserve = null, why = '';
          if (!e.lbl) reserve = ARROW_LEN + WIRE_HANDLE;
          else if (vert) reserve = ARROW_LEN + 2 * PILL_CLEARANCE + PILL_RENDERED_H;
          else if (e._labelBox && e._labelBox.w != null) reserve = ARROW_LEN + 2 * PILL_CLEARANCE + e._labelBox.w;
          else why = 'no stamped pill box on a labeled lateral wire — cannot measure its reserve';
          if (reserve != null) {
            if (pop) pop.runs++;
            const need = OUT_HANDLE + reserve;
            const run = face === 'top' ? box.y - (other.y + other.h)
                      : face === 'bot' ? other.y - (box.y + box.h)
                      : face === 'lft' ? box.x - (other.x + other.w)
                      :                  other.x - (box.x + box.w);
            if (run < need - 0.5)
              edgeFindings.push({ kind: 'run-short', f: e.f, t: e.t, face, run: +run.toFixed(1), need: +need.toFixed(1) });
          } else if (why) edgeFindings.push({ kind: 'run-unmeasurable', f: e.f, t: e.t, face, why });
        }
      }
    }
  }

  const pillFindings = [];
  for (const p of pills || []) {
    const tn = nodeById[p.t]; const tg = groupOfNode(tn); if (!tg) continue;
    const sn = nodeById[p.f]; if (sn && sn._band === tg.key) continue;
    if (pop) pop.pills++;
    const c = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
    if (inBoxInterior(c, tg.box)) pillFindings.push({ f: p.f, t: p.t, lbl: p.lbl, pill: p });
  }
  return { edgeFindings, pillFindings };
}

function live() {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => s += d);
  process.stdin.on('end', () => {
    let j; try { j = JSON.parse(s); } catch { console.error('group-box-scan: no audit JSON on stdin'); process.exit(2); }
    const engine = j.engine || {};
    const pills = j.pillRects || [];
    const groupBands = (engine.bands || []).filter(b => b.group);
    const pop = { boxes: 0, endpoints: 0, runs: 0, pills: 0 };
    const { edgeFindings, pillFindings } = scan(engine, pills, pop);
    console.log(`=== NODE GROUP BOX SCAN - ${j.meta?.file?.split('/').pop() || ''} ===`);
    console.log(`  group bands : ${groupBands.length}`);
    console.log(`  boxes ${pop.boxes} · box endpoints checked ${pop.endpoints} · run budgets measured ${pop.runs} · pills tested ${pop.pills}`);
    declarePopulation(pop);
    for (const x of edgeFindings) {
      if (x.kind === 'run-short')
        console.log(`  RUN-SHORT ${x.f}->${x.t} (${x.face} face): the wire has ${x.run}px from the node face to the BOX BORDER, its own budget is ${x.need}px (OUT_HANDLE + approachReserve) — groupBoxRadar${x.face === 'top' || x.face === 'bot' ? 'V' : ''} must size this gap to the BORDER, not to the member edge`);
      else if (x.kind === 'run-unmeasurable')
        console.log(`  RUN-UNMEASURABLE ${x.f}->${x.t} (${x.face} face): ${x.why}`);
      else
        console.log(`  OFF-EDGE ${x.kind} ${x.f}->${x.t}: endpoint (${x.pt?.x?.toFixed?.(1)},${x.pt?.y?.toFixed?.(1)}) not on box [${x.box?.x?.toFixed?.(1)},${x.box?.y?.toFixed?.(1)},${x.box?.w?.toFixed?.(1)},${x.box?.h?.toFixed?.(1)}]`);
    }
    for (const x of pillFindings)
      console.log(`  PILL-INSIDE-BOX ${x.f}->${x.t} "${x.lbl}": pill center is inside the group box (must seat outside)`);
    const total = edgeFindings.length + pillFindings.length;
    console.log(`  group endpoint/ pill violations : ${total}`);
    console.log(`  VERDICT: ${total === 0 ? 'CLEAN' : 'GROUP BOX VIOLATED'}`);
    process.exit(total === 0 ? 0 : 1);
  });
}

const arg = process.argv[2];
live();
