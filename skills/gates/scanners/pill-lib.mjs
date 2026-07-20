#!/usr/bin/env node

export function realPillsFromDrawLog(drawLog) {
  const rrects = [], labels = [];
  for (const d of drawLog) {
    if (d.kind === 'fill' && Array.isArray(d.path)) {
      const rr = d.path.find(p => p[0] === 'rrect');
      if (rr) { const [, x, y, w, h] = rr; if (h >= 10 && h <= 22 && w > 8) rrects.push({ x, y, w, h }); }
    } else if (d.kind === 'fillText' && /(^|\s)10px/.test(d.font || '') && d.text) {
      labels.push({ x: d.x, y: d.y, text: d.text });
    }
  }

  const seen = new Set(), pills = [];
  for (const r of rrects) {
    const k = `${Math.round(r.x / 4)},${Math.round(r.y / 4)},${Math.round(r.w / 4)}`;
    if (seen.has(k)) continue; seen.add(k);
    const lab = labels.find(l => l.x >= r.x - 1 && l.x <= r.x + r.w + 1 && l.y >= r.y - 1 && l.y <= r.y + r.h + 1);
    if (!lab) continue;
    pills.push({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h, lbl: lab.text });
  }
  return pills;
}

export function extractPills(j) {
  const fromLog = realPillsFromDrawLog(j.drawLog || []);
  if (fromLog.length) return fromLog;
  return (j.pillRects || []).map(r => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h, lbl: r.lbl }));
}

export function pathPoints(pathStr) {
  if (!pathStr) return [];
  const t = pathStr.trim().split(/\s+/); const pts = []; let x = 0, y = 0, i = 0;
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M' || c === 'L') { x = +t[i++]; y = +t[i++]; pts.push([x, y]); }
    else if (c === 'H') { x = +t[i++]; pts.push([x, y]); }
    else if (c === 'V') { y = +t[i++]; pts.push([x, y]); }
    else if (c === 'Q') { i += 2; x = +t[i++]; y = +t[i++]; pts.push([x, y]); }
  }
  return pts;
}

export function ptBox(px, py, b) {
  const dx = px < b.x0 ? b.x0 - px : px > b.x1 ? px - b.x1 : 0;
  const dy = py < b.y0 ? b.y0 - py : py > b.y1 ? py - b.y1 : 0;
  return Math.hypot(dx, dy);
}

export function polyBoxDist(pts, b) {
  let min = Infinity;
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len / 3));
    for (let s = 0; s <= steps; s++) {
      const tt = s / steps, d = ptBox(x0 + (x1 - x0) * tt, y0 + (y1 - y0) * tt, b);
      if (d < min) min = d;
    }
  }
  return min;
}
