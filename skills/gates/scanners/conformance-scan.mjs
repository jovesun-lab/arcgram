

import { declarePopulation } from './_population.mjs';

const VTOL = 1.5;
const HTOL = 2.0;
const EPS  = 2;

const ARROW_LEN      = 9;
const PILL_CLEARANCE = 10;
const WIRE_HANDLE    = 8;
const PILL_RENDERED_H = 14;
const PILL_BUDGET    = ARROW_LEN + PILL_CLEARANCE;
const PILL_BUDGET_TOL = 1;

const ASC = 0.7, DESC = 0.2;
function fontPx(font) {
  const m = /\b(\d+(?:\.\d+)?)px\b/.exec(font || '');
  return m ? parseFloat(m[1]) : 12;
}

function textCenterY(t) {
  const fs = fontPx(t.font);
  const asc = fs * ASC, desc = fs * DESC, gh = asc + desc;
  switch (t.textBaseline) {
    case 'middle':     return t.y;
    case 'top':        return t.y + gh / 2;
    case 'bottom':     return t.y - gh / 2;
    case 'hanging':    return t.y + gh / 2;
    case 'ideographic':return t.y - gh / 2;
    default:           return t.y - (asc - desc) / 2;
  }
}
function textTopBot(t) {
  const fs = fontPx(t.font);
  const asc = fs * ASC, desc = fs * DESC;
  const c = textCenterY(t), half = (asc + desc) / 2;
  return [c - half, c + half];
}

function textCenterX(t) {
  const w = (t.text ?? '').length * fontPx(t.font) * 0.55;
  switch (t.textAlign) {
    case 'center': return t.x;
    case 'right':
    case 'end':    return t.x - w / 2;
    default:       return t.x + w / 2;
  }
}

let raw = '';
process.stdin.on('data', d => raw += d).on('end', () => {
  const j = JSON.parse(raw);
  const log = j.drawLog || [];

  const paths = [...new Set(log.filter(o => o.svgPath).map(o => o.svgPath))];
  const segs = [];
  const pathEnds = [];
  paths.forEach((p, pi) => {
    let cx = 0, cy = 0, sx = 0, sy = 0;
    const toks = p.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    let i = 0; const num = () => parseFloat(toks[i++]);
    const push = (x1, y1, x2, y2) => {
      if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5) return;
      segs.push({ pi, x1, y1, x2, y2, vertical: Math.abs(x1 - x2) < EPS, horizontal: Math.abs(y1 - y2) < EPS });
    };
    while (i < toks.length) {
      const c = toks[i++];
      if (c === 'M') { cx = num(); cy = num(); sx = cx; sy = cy; }
      else if (c === 'L') { const x = num(), y = num(); push(cx, cy, x, y); cx = x; cy = y; }
      else if (c === 'H') { const x = num(); push(cx, cy, x, cy); cx = x; }
      else if (c === 'V') { const y = num(); push(cx, cy, cx, y); cy = y; }
      else if (c === 'Q') { num(); num(); const x = num(), y = num(); push(cx, cy, x, y); cx = x; cy = y; }
    }
    pathEnds[pi] = { sx, sy, ex: cx, ey: cy };
  });

  const edgePills = (j.engine?.edges || [])
    .filter(e => e._labelBox && e.lbl)
    .map(e => ({ id: `${e.f}→${e.t}`, lbl: e.lbl, box: e._labelBox, toPt: e.toPt || 'top' }));
  function isEdgePill(bbox) {
    return edgePills.find(p =>
      Math.abs(p.box.x - bbox.x) < 1 && Math.abs(p.box.y - bbox.y) < 1 &&
      Math.abs(p.box.w - bbox.w) < 1 && Math.abs(p.box.h - bbox.h) < 1);
  }

  const boxes = [];
  for (let k = 0; k < log.length; k++) {
    const o = log[k];
    if (o.kind !== 'fill' || !o.path) continue;
    const rr = o.path.find(p => p[0] === 'rrect');
    if (!rr) continue;
    const bbox = { x: rr[1], y: rr[2], w: rr[3], h: rr[4] };
    if (bbox.w <= 0 || bbox.h <= 0 || bbox.w > 400 || bbox.h > 400) continue;
    const texts = [];
    for (let i = k + 1; i < log.length; i++) {
      const n = log[i];
      if (n.kind === 'fill' && n.path && n.path.some(p => p[0] === 'rrect')) break;
      if (n.kind !== 'fillText') continue;
      if (!n.text || String(n.text).trim() === '') continue;
      if (n.x >= bbox.x - 3 && n.x <= bbox.x + bbox.w + 3 &&
          n.y >= bbox.y - 6 && n.y <= bbox.y + bbox.h + 6) texts.push(n);
    }
    if (!texts.length) continue;
    boxes.push({ bbox, texts, pill: isEdgePill(bbox) });
  }

  const pop = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 };

  const c1 = [];
  for (const b of boxes) {
    pop.c1++;
    const cy = b.bbox.y + b.bbox.h / 2;
    let top = Infinity, bot = -Infinity;
    for (const t of b.texts) { const [tt, tb] = textTopBot(t); top = Math.min(top, tt); bot = Math.max(bot, tb); }
    const blockCy = (top + bot) / 2;
    const dev = blockCy - cy;
    if (Math.abs(dev) > VTOL) {
      const what = b.pill ? `pill "${b.pill.lbl}"` : (b.texts.length > 1 ? `node/block "${b.texts[0].text}…"` : `box "${b.texts[0].text}"`);
      c1.push(`${what}: text vcenter ${blockCy.toFixed(1)} vs box center ${cy.toFixed(1)} (off ${dev.toFixed(1)}px)`);
    }
  }

  const c2 = [];
  let c2skip = 0;
  for (const b of boxes) {
    if (!b.pill) continue;
    if (b.pill.toPt !== 'lft' && b.pill.toPt !== 'rgt') { c2skip++; continue; }
    pop.c2++;
    const cy = b.bbox.y + b.bbox.h / 2;
    const x0 = b.bbox.x, x1 = b.bbox.x + b.bbox.w, y0 = b.bbox.y, y1 = b.bbox.y + b.bbox.h;
    let best = null, bestOv = 0;
    for (const s of segs) {
      if (!s.horizontal || s.y1 <= y0 || s.y1 >= y1) continue;
      const sa = Math.min(s.x1, s.x2), sb = Math.max(s.x1, s.x2);
      const ov = Math.min(sb, x1) - Math.max(sa, x0);
      if (ov > bestOv) { bestOv = ov; best = s.y1; }
    }
    if (best === null || bestOv < 2) continue;
    const dev = best - cy;
    if (Math.abs(dev) > VTOL)
      c2.push(`pill "${b.pill.lbl}" (${b.pill.id}): own H branch at y=${best.toFixed(1)} vs pill center ${cy.toFixed(1)} (off ${dev.toFixed(1)}px)`);
  }

  const nodeById = {};
  for (const n of (j.engine?.nodes || [])) nodeById[n.id] = n;

  const c3 = [];
  for (const e of (j.engine?.edges || [])) {
    if (!e._labelBox || !e.lbl) continue;
    pop.c3++;
    const b = e._labelBox;

    if (e._fanInBundled) {
      const sn = nodeById[e.f];
      if (!sn) continue;
      const fromPt = e.fromPt || 'bot';
      let sgap = null;
      if (fromPt === 'top')      sgap = sn.y - (b.y + b.h);
      else if (fromPt === 'bot') sgap = b.y - (sn.y + sn.h);
      else if (fromPt === 'lft') sgap = sn.x - (b.x + b.w);
      else if (fromPt === 'rgt') sgap = b.x - (sn.x + sn.w);
      if (sgap === null) continue;
      if (sgap < PILL_CLEARANCE - PILL_BUDGET_TOL)
        c3.push(`pill "${e.lbl}" (${e.f}→${e.t}, fan-in trunk, ${fromPt}): pill→SOURCE gap ${sgap.toFixed(1)}px < ${PILL_CLEARANCE} (LI-3 — a diamond fan-in pill seats on its OWN first leg, PILL_CLEARANCE off the source edge)`);
      continue;
    }

    const tn = nodeById[e.t];
    if (!tn) continue;
    const toPt = e.toPt || 'top';
    let gap = null;
    if (toPt === 'top')      gap = tn.y - (b.y + b.h);
    else if (toPt === 'bot') gap = b.y - (tn.y + tn.h);
    else if (toPt === 'lft') gap = tn.x - (b.x + b.w);
    else if (toPt === 'rgt') gap = b.x - (tn.x + tn.w);
    if (gap === null) continue;
    if (gap < PILL_BUDGET - PILL_BUDGET_TOL)
      c3.push(`pill "${e.lbl}" (${e.f}→${e.t}, ${toPt}): pill→node gap ${gap.toFixed(1)}px < ${PILL_BUDGET} (arrow ${ARROW_LEN} + handle ${PILL_CLEARANCE})`);
  }

  const nodes = j.engine?.nodes || [];
  const ATTACH_TOL = 3;
  const attach = (x, y) => {
    for (const n of nodes) {
      const onY = y >= n.y - ATTACH_TOL && y <= n.y + n.h + ATTACH_TOL;
      const onX = x >= n.x - ATTACH_TOL && x <= n.x + n.w + ATTACH_TOL;
      if (onY && Math.abs(x - n.x) <= ATTACH_TOL)        return { id: n.id, side: 'lft', coord: y };
      if (onY && Math.abs(x - (n.x + n.w)) <= ATTACH_TOL) return { id: n.id, side: 'rgt', coord: y };
      if (onX && Math.abs(y - n.y) <= ATTACH_TOL)        return { id: n.id, side: 'top', coord: x };
      if (onX && Math.abs(y - (n.y + n.h)) <= ATTACH_TOL) return { id: n.id, side: 'bot', coord: x };
    }
    return null;
  };
  const sideWires = {};
  pathEnds.forEach((pe) => {
    if (!pe) return;
    for (const [x, y, kind] of [[pe.sx, pe.sy, 'src'], [pe.ex, pe.ey, 'tgt']]) {
      const a = attach(x, y);
      if (a) (sideWires[`${a.id}|${a.side}`] ??= []).push({ coord: a.coord, kind });
    }
  });

  const edges = j.engine?.edges || [];
  const nById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const crossesNodeC = (e) => {
    const s = nById[e.f], o = nById[e.t];
    if (!s || !o) return false;
    const y0 = s.y + s.h / 2;
    const xMin = Math.min(s.x, o.x + o.w), xMax = Math.max(s.x + s.w, o.x);
    for (const m of nodes) {
      if (m === s || m === o) continue;
      if (m.x + m.w <= xMin || m.x >= xMax) continue;
      if (m.y <= y0 && m.y + m.h >= y0) return true;
    }
    return false;
  };
  const outGrp = {};
  for (const e of edges) {
    if (e.offset !== undefined) continue;
    const fp = e.fromPt, tp = e.toPt;
    const lateral  = (fp === 'lft' || fp === 'rgt') && (tp === 'lft' || tp === 'rgt');
    const vertical = (fp === 'top' || fp === 'bot') && (tp === 'top' || tp === 'bot');
    if (lateral) {
      const tn = nById[e.t];
      if (!tn || crossesNodeC(e)) continue;
      const colX = (tp === 'lft') ? tn.x : tn.x + tn.w;
      outGrp[`${e.f}|${fp}|${colX}`] = (outGrp[`${e.f}|${fp}|${colX}`] || 0) + 1;
    } else if (vertical && e._bundleVia !== undefined) {

      outGrp[`${e.f}|${fp}|v${e._bundleVia}`] = (outGrp[`${e.f}|${fp}|v${e._bundleVia}`] || 0) + 1;
    }
  }
  const bundleHost = {};
  const bundleCollapse = {};
  for (const k of Object.keys(outGrp)) {
    if (outGrp[k] < 2) continue;
    const [f, fp] = k.split('|');
    const sk = `${f}|${fp}`;
    bundleHost[sk] = true;
    bundleCollapse[sk] = (bundleCollapse[sk] || 0) + (outGrp[k] - 1);
  }

  const c4 = [];
  for (const [key, arr] of Object.entries(sideWires)) {
    if (arr.length < 2) continue;
    pop.c4++;

    if (arr.length <= 2) continue;
    const [id, side] = key.split('|');
    if (nodeById[id] && nodeById[id].kind === 'diamond') continue;

    if ((side === 'top' || side === 'bot') && arr.every(a => a.kind === 'src')) continue;

    if (bundleHost[key]) continue;

    const sorted = arr.slice().sort((a, b) => a.coord - b.coord);
    let piled = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].coord - sorted[i - 1].coord >= WIRE_HANDLE) continue;
      if ((side === 'top' || side === 'bot') && sorted[i].kind === 'src' && sorted[i - 1].kind === 'src') continue;
      piled++;
    }
    if (piled > 0) {
      c4.push(`node ${id}.${side}: ${arr.length} wires, ${piled} pair(s) within ${WIRE_HANDLE}px — piled, not spread`);
    }
  }

  const c5 = [];
  for (const [key, arr] of Object.entries(sideWires)) {
    pop.c5++;
    const [id, side] = key.split('|');

    const N = arr.length - (bundleCollapse[key] || 0);
    if (N < 2) continue;
    const n = nodeById[id];
    const lateral = (side === 'lft' || side === 'rgt');
    const extent = lateral ? n.h : n.w;
    const need = N * PILL_RENDERED_H + (N - 1) * PILL_CLEARANCE;
    if (extent + 1 < need)
      c5.push(`node ${id}.${side}: ${N} slots need ${need}px but ${lateral ? 'height' : 'width'} is ${extent}px — Rule 8 grow not applied`);
  }

  const ROW_TOL = 16;
  const KINK_TOL = 2;
  const c6 = [];
  pathEnds.forEach((pe) => {
    if (!pe) return;
    const aS = attach(pe.sx, pe.sy), aT = attach(pe.ex, pe.ey);
    if (!aS || !aT) return;
    if (aS.side !== 'lft' && aS.side !== 'rgt') return;
    if (aT.side !== 'lft' && aT.side !== 'rgt') return;
    if (aS.id === aT.id) return;
    pop.c6++;
    const ns = nodeById[aS.id], nt = nodeById[aT.id];
    if (!ns || !nt) return;
    if (Math.abs((ns.y + ns.h / 2) - (nt.y + nt.h / 2)) > ROW_TOL) return;
    const dev = Math.abs(pe.sy - pe.ey);
    if (dev > KINK_TOL)
      c6.push(`lateral ${aS.id}.${aS.side}→${aT.id}.${aT.side}: same-row wire kinked — exit y=${pe.sy.toFixed(1)} vs arrival y=${pe.ey.toFixed(1)} (jog ${dev.toFixed(1)}px > ${KINK_TOL}px); Rule 9 Case 1 ALIGN not applied / re-kinked`);
  });

  const uniq = a => [...new Set(a)];
  const C1 = uniq(c1), C2 = uniq(c2), C3 = uniq(c3), C4 = uniq(c4), C5 = uniq(c5), C6 = uniq(c6);
  console.log(`CONFORMANCE SCAN — ${j.meta.testFile}`);
  console.log(`  boxes scanned : ${boxes.length} (edge pills: ${boxes.filter(b => b.pill).length})`);
  console.log(`  examined per check — C1 ${pop.c1} boxes · C2 ${pop.c2} lateral pills · C3 ${pop.c3} labeled edges · C4 ${pop.c4} multi-wire faces · C5 ${pop.c5} faces · C6 ${pop.c6} same-row laterals`);
  declarePopulation(pop);
  console.log(`  C1 text-centered-in-box : ${C1.length}`); C1.forEach(x => console.log('     - ' + x));
  console.log(`  C2 pill-on-wire-axis    : ${C2.length} (lateral pills; ${c2skip} non-lateral skipped — axis ambiguous)`); C2.forEach(x => console.log('     - ' + x));
  console.log(`  C3 handle+pill+arrow budget : ${C3.length}`); C3.forEach(x => console.log('     - ' + x));
  console.log(`  C4 same-side spread (Rule 6): ${C4.length}`); C4.forEach(x => console.log('     - ' + x));
  console.log(`  C5 node-fit grow   (Rule 8) : ${C5.length}`); C5.forEach(x => console.log('     - ' + x));
  console.log(`  C6 wire-straightness (Rule 9 Case 1): ${C6.length}`); C6.forEach(x => console.log('     - ' + x));

  console.log(`  Known coverage gaps (NOT asserted): rule 1 bus-clearance · rule 2 grow-V · rule 3 in≠out-X · rule 5 centered-axis · rule 9 Case 2 gap-spread · JUNCTION. See wire-anatomy.md § Gate coverage map.`);
  const total = C1.length + C2.length + C3.length + C4.length + C5.length + C6.length;

  console.log(`  VERDICT: ${total === 0 ? 'C1–C6 CONFORM (asserted rules only — see coverage gaps above)' : 'CONFORMANCE VIOLATIONS (' + total + ')'}`);
});
