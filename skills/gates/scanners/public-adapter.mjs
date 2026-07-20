

const R = 4;
const EPS = 0.5;

function simplify(pts) {
  const P = (pts || []).map(p => [p.x, p.y]).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > EPS);
  if (P.length <= 2) return P;
  const out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = out[out.length - 1], b = P[i], c = P[i + 1];
    const din = [b[0] - a[0], b[1] - a[1]], dout = [c[0] - b[0], c[1] - b[1]];
    const cross = din[0] * dout[1] - din[1] * dout[0];
    const li = Math.hypot(...din) || 1, lo = Math.hypot(...dout) || 1;
    if (Math.abs(cross) / (li * lo) > 1e-3) out.push(b);
  }
  out.push(P[P.length - 1]);
  return out;
}
export function svgFromPath(rawPts) {
  const P = simplify(rawPts || []);
  if (P.length < 2) return null;
  let d = `M ${P[0][0]} ${P[0][1]}`;
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const din = [b[0] - a[0], b[1] - a[1]], dout = [c[0] - b[0], c[1] - b[1]];
    const li = Math.hypot(...din) || 1, lo = Math.hypot(...dout) || 1;
    const r = Math.min(R, li / 2, lo / 2);
    const bin = [b[0] - din[0] / li * r, b[1] - din[1] / li * r];
    const bout = [b[0] + dout[0] / lo * r, b[1] + dout[1] / lo * r];
    d += ` L ${bin[0].toFixed(2)} ${bin[1].toFixed(2)} Q ${b[0]} ${b[1]} ${bout[0].toFixed(2)} ${bout[1].toFixed(2)}`;
  }
  const last = P[P.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

export function inspectToNormalized(inspect, testFile = 'flow.html (public-adapter)') {
  const L = inspect.layout || { nodes: [], edges: [] };
  const raw = inspect.raw || { columns: [], bands: [] };
  const logic = inspect.logic || { nodes: [], edges: [] };

  const logicNodeById = new Map((logic.nodes || []).map(n => [n.id, n]));

  const bandOfNode = new Map();
  for (const b of (raw.bands || [])) for (const m of (b.members || [])) bandOfNode.set(m, b.id);

  const nodes = (L.nodes || []).map(n => {
    const box = n.box || {};
    const lg = logicNodeById.get(n.id) || {};
    const type = lg.type || 'rect';

    const kind = (lg.kind === 'diamond' || lg.role === 'decision'
                  || type === 'decision' || type === 'diamond') ? 'diamond' : 'rect';
    return {
      id: n.id,
      label: lg.label != null ? lg.label : n.id,
      type,
      kind,
      x: box.x, y: box.y, w: box.w, h: box.h,
      _band: bandOfNode.has(n.id) ? bandOfNode.get(n.id) : undefined,
      _labelBox: n.labelBox || null,
    };
  });

  const logicEdgeLbl = new Map((logic.edges || []).map(e => [`${e.from}->${e.to}`, e.label]));

  const boxById = new Map(nodes.map(n => [n.id, n]));
  const FACE_EPS = 2.5;
  const resolveFace = (pt, box, fallback) => {
    if (!pt || !box || box.x == null) return fallback;
    const d = { top: Math.abs(pt.y - box.y), bot: Math.abs(pt.y - (box.y + box.h)),
                lft: Math.abs(pt.x - box.x), rgt: Math.abs(pt.x - (box.x + box.w)) };
    let best = fallback, bv = Infinity;
    for (const k in d) if (d[k] < bv) { bv = d[k]; best = k; }
    return bv <= FACE_EPS ? best : fallback;
  };

  const GBM = 20, GTAG = 28;
  const groupContainerRect = (bandId) => {
    const b = (raw.bands || []).find(x => x.id === bandId && x.group);
    if (!b) return null;
    const ms = (b.members || []).map(id => boxById.get(id)).filter(n => n && n.x != null);
    if (!ms.length) return null;
    const minX = Math.min(...ms.map(n => n.x)), minY = Math.min(...ms.map(n => n.y));
    const maxX = Math.max(...ms.map(n => n.x + n.w)), maxY = Math.max(...ms.map(n => n.y + n.h));
    return { x: minX - GBM, y: minY - GBM - GTAG, w: (maxX - minX) + 2 * GBM, h: (maxY - minY) + 2 * GBM + GTAG };
  };

  const edges = (L.edges || []).map(e => {
    const pts = (e.path || []).map(p => ({ x: p.x, y: p.y }));
    const lbl = logicEdgeLbl.get(`${e.from}->${e.to}`);
    const bundle = e.bundle || null;
    return {
      f: e.from, t: e.to, lbl: lbl != null ? lbl : undefined,
      _path: pts,
      fromPt: resolveFace(pts[0], boxById.get(e.from), (e.source && e.source.face) || 'bot'),
      toPt: resolveFace(pts[pts.length - 1], boxById.get(e.to), (e.arrival && e.arrival.face) || 'top'),
      style: 'solid',

      _labelBox: e.pill && e.pill.box ? e.pill.box : null,
      _arrowAt: e.arrival ? e.arrival.point : undefined,
      _arrowSide: e.arrival ? e.arrival.face : undefined,
      _branchBadgeBox: e.branchBadge ? e.branchBadge.box : undefined,
      _isBandTarget: e.attachedTo != null || undefined,
      _isBandSource: e.sourceAttachedTo != null || undefined,
      _container: e.attachedTo != null ? (groupContainerRect(e.attachedTo) || e.attachedTo) : undefined,
      _srcContainer: e.sourceAttachedTo != null ? (groupContainerRect(e.sourceAttachedTo) || e.sourceAttachedTo) : undefined,
      _fanInBundled: bundle && bundle.role === 'fan-in' ? true : undefined,
      _fanOutBundled: bundle && bundle.role === 'fan-out' ? true : undefined,
    };
  });

  const j = {
    meta: { testFile },
    engine: {
      nodes,
      edges,

      columns: (raw.columns || []).map(c => ({ id: c.id, members: c.members || [] })),
      hcolumns: (raw.hcolumns || []).map(c => ({ id: c.id, members: c.members || [] })),
      bands: (raw.bands || []).map(b => ({ id: b.id, y: b.y, h: b.h, group: !!b.group, members: b.members || [], _membershipKey: b.id })),
      canvases: [],
    },
    __stDiag: [],
  };

  j.drawLogRaw = [];
  j.drawLog = edges.map(e => ({ svgPath: svgFromPath(e._path), kind: 'stroke', _edge: `${e.f}->${e.t}` }))
                   .filter(o => o.svgPath);

  j.edgePaths = edges.map(e => {
    const P = e._path || [];
    const p1 = P.length ? { x: P[0].x, y: P[0].y } : null;
    const p2 = P.length ? { x: P[P.length - 1].x, y: P[P.length - 1].y } : null;
    return {
      f: e.f, t: e.t, lbl: e.lbl, fromPt: e.fromPt, toPt: e.toPt, style: e.style,
      pathStr: svgFromPath(e._path), pts: P.map(p => ({ x: p.x, y: p.y })), p1, p2,
      _isBandTarget: e._isBandTarget, _isBandSource: e._isBandSource,
      _fanInBundled: e._fanInBundled, _fanOutBundled: e._fanOutBundled,
    };
  });

  j.pillRects = edges
    .map(e => {
      const L2 = (L.edges || []).find(x => x.from === e.f && x.to === e.t);
      const pb = L2 && L2.pill && L2.pill.box;
      return pb ? { x: pb.x, y: pb.y, w: pb.w, h: pb.h, f: e.f, t: e.t, lbl: (L2.pill.label != null ? L2.pill.label : e.lbl) } : null;
    })
    .filter(Boolean);

  return j;
}

export function bandSchemaFromCheckpoint(checkpoint) {
  const findings = (checkpoint && checkpoint.findings) || [];
  const dead = findings.filter(f => f && f.type === 'dead-band-schema');
  const out = ['=== BAND FILL/COLOR SCHEMA (via checkpoint A-5) ==='];
  for (const f of dead) out.push(`  BAND ${f.id}: ${f.note}`);
  out.push(`  band-schema violations : ${dead.length}`);
  out.push(`  VERDICT: ${dead.length === 0 ? 'CLEAN (checkpoint A-5 — every non-group band has fill + color)' : 'BAND-SCHEMA VIOLATION(S) PRESENT'}`);
  return { code: dead.length === 0 ? 0 : 1, out: out.join('\n') };
}
