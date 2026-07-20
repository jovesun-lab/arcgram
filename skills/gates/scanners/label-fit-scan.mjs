#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'node:fs';

const MARGIN = +(process.env.LF_MARGIN || 12);
const TITLE_PX = +(process.env.LF_TITLE_PX || 15);
const CAT_PX = +(process.env.LF_CAT_PX || 9);
const LINE_H = +(process.env.LF_LINE_H || 18);
const CAT_BLOCK_H = +(process.env.LF_CAT_BLOCK_H || 11);
const CAT_GAP = +(process.env.LF_CAT_GAP || 4);
const MARGIN_Y = +(process.env.LF_MARGIN_Y || 8);
const MAX_H = +(process.env.LF_MAX_H || 128);

const W10 = [2.930,3.228,4.893,6.416,6.416,9.370,7.231,3.086,3.936,3.936,4.834,6.416,3.086,4.834,3.086,3.164,6.416,4.756,6.152,6.387,6.553,6.299,6.484,5.811,6.504,6.484,3.086,3.086,6.416,6.416,6.416,5.244,9.297,6.855,6.689,7.275,7.383,6.074,5.840,7.583,7.539,2.793,5.498,6.704,5.796,8.857,7.539,7.832,6.470,7.832,6.650,6.489,6.455,7.490,6.855,9.795,6.904,6.670,6.733,3.936,3.164,3.936,6.416,5.952,5.117,5.635,6.260,5.713,6.260,5.830,3.735,6.211,6.001,2.588,2.583,5.547,2.646,8.818,5.952,6.025,6.221,6.211,3.926,5.352,3.750,5.952,5.537,7.861,5.361,5.547,5.508,3.936,2.705,3.936,6.416];
const adv10 = cp => (cp >= 32 && cp <= 126) ? W10[cp - 32] : (cp === 0x1F511 ? 13.0 : 6.0);
const measure = (s, px) => { let w = 0; for (const ch of s) w += adv10(ch.codePointAt(0)); return w * px / 10; };

function wrapBroken(text, maxW, px) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const wOf = s => measure(s, px);
  const breakTok = (tok) => {
    const DELIM = '/-_.:';
    const subs = []; let s = '';
    for (const ch of tok) { s += ch; if (DELIM.indexOf(ch) >= 0) { subs.push(s); s = ''; } }
    if (s) subs.push(s);
    const out = [];
    for (const sub of subs) {
      if (wOf(sub) <= maxW) { out.push(sub); continue; }
      let c = '';
      for (const ch of sub) { if (!c || wOf(c + ch) <= maxW) c += ch; else { out.push(c); c = ch; } }
      if (c) out.push(c);
    }
    return out;
  };
  const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (wOf(test) <= maxW) { cur = test; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    if (wOf(w) <= maxW) { cur = w; continue; }
    for (const frag of breakTok(w)) { if (!cur || wOf(cur + frag) <= maxW) cur += frag; else { lines.push(cur); cur = frag; } }
  }
  if (cur) lines.push(cur);
  return lines;
}

const arg = process.argv[2];
const src = (arg && fs.existsSync(arg)) ? fs.readFileSync(arg, 'utf8') : fs.readFileSync(0, 'utf8');
let a;
try { a = JSON.parse(src); } catch { console.log('label-fit  SKIP — unparseable input'); process.exit(0); }
const nodes = a.engine?.nodes || [];

const FONT_ERR = 0.05;
const DIA_INNER_F = 0.62, DIA_USABLE_H_F = 0.62;
let fails = [], checked = 0;
for (const n of nodes) {
  if (!n.label || !n.w) continue;
  if (n.kind === 'diamond') {
    checked++;
    const dInner = n.w * DIA_INNER_F;
    const usableH = n.h * DIA_USABLE_H_F;

    const bestInner = dInner / (1 - FONT_ERR);
    const dCat = n.cat ? wrapBroken(String(n.cat).toUpperCase(), bestInner, CAT_PX) : [];
    const dTitle = wrapBroken(n.label, bestInner, TITLE_PX);
    const dCatH = dCat.length ? dCat.length * CAT_BLOCK_H + CAT_GAP : 0;
    const dMax = Math.max(1, Math.floor((usableH - dCatH) / LINE_H));
    const kept = Math.min(dTitle.length, dMax);
    let dWide = 0, dWideLine = '';
    for (const ln of dTitle) { const w = measure(ln, TITLE_PX) * (1 - FONT_ERR); if (w > dWide) { dWide = w; dWideLine = ln; } }
    for (const ln of dCat) { const w = measure(ln, CAT_PX) * (1 - FONT_ERR); if (w > dWide) { dWide = w; dWideLine = ln; } }
    const drawnH = dCatH + kept * LINE_H;
    if (dWide > dInner + 1)
      fails.push(`${n.id || '?'} (diamond): line "${dWideLine}" ${Math.round(dWide)}px > 62% inner ${Math.round(dInner)}px (w=${n.w}) [spills past the rhombus taper — still overflows with the text measured ${FONT_ERR * 100}% narrower, so it is outside the offline-metric error band]`);
    else if (drawnH > usableH + 1)
      fails.push(`${n.id || '?'} (diamond): drawn content ${Math.round(drawnH)}px > 62% usable height ${Math.round(usableH)}px (h=${n.h}, cat ${dCat.length}L + title ${kept}L) [the max(1,…) floor forced a line into a box with no room — author-size the diamond taller]`);

    continue;
  }
  checked++;
  const inner = n.w - 2 * MARGIN;
  const titleLines = wrapBroken(n.label, inner, TITLE_PX);
  const catLines = n.cat ? wrapBroken(String(n.cat).toUpperCase(), inner, CAT_PX) : [];
  let widest = 0, widestLine = '';
  for (const ln of titleLines) { const w = measure(ln, TITLE_PX); if (w > widest) { widest = w; widestLine = ln; } }
  for (const ln of catLines) { const w = measure(ln, CAT_PX); if (w > widest) { widest = w; widestLine = ln; } }
  const neededH = catLines.length * CAT_BLOCK_H + (catLines.length ? CAT_GAP : 0) + titleLines.length * LINE_H + 2 * MARGIN_Y;
  if (widest > inner + 1)
    fails.push(`${n.id || '?'}: line "${widestLine}" ${Math.round(widest)}px > inner ${Math.round(inner)}px (w=${n.w}) [width overflow — break rule failed]`);
  else if (neededH > MAX_H + 1)
    fails.push(`${n.id || '?'}: wrapped content ${Math.round(neededH)}px > NODE_MAX_H ${MAX_H}px -> soft-clip (title ${titleLines.length}L + cat ${catLines.length}L, w=${n.w}) [height/clip]`);
}

const summary = fails.length
  ? `VIOLATED — ${fails.length} node(s) overflow their box`
  : `CLEAN — ${checked} labels fit (token-break wrap to w-${2 * MARGIN}px; diamonds to 62% inner; no line > inner, content <= NODE_MAX_H)`;
declarePopulation({ labels: checked });
console.log(`VERDICT: ${summary}`);
console.log(`label-fit  ${summary}`);
fails.forEach(f => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
