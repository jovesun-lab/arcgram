

import { declarePopulation } from './_population.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { measureTextMetrics } from './_text-metrics.mjs';

const FILE = process.argv[2] || 'flow.html';
const html = fs.readFileSync(FILE, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const engineSrc = scripts[scripts.length - 1][1];

const measureText = (text, font) => measureTextMetrics(text, font);

function makeCtx() {
  const state = { font: '12px', fillStyle:'#000', strokeStyle:'#000', lineWidth:1, textAlign:'left', textBaseline:'alphabetic', lineDash:[], globalAlpha:1 };
  const noop = () => {};
  const ctx = {
    save:noop, restore:noop, setTransform:noop, translate:noop, rotate:noop, scale:noop,
    beginPath:noop, closePath:noop, moveTo:noop, lineTo:noop, arc:noop, arcTo:noop,
    quadraticCurveTo:noop, bezierCurveTo:noop, roundRect:noop, rect:noop, ellipse:noop,
    setLineDash:(a)=>{state.lineDash=a;}, getLineDash:()=>state.lineDash,
    fillRect:noop, strokeRect:noop, clearRect:noop, fill:noop, stroke:noop, clip:noop,
    fillText:noop, strokeText:noop, drawImage:noop, createLinearGradient:()=>({addColorStop:noop}),
    measureText:(t)=>measureText(t, state.font),
  };
  for (const k of ['fillStyle','strokeStyle','lineWidth','font','globalAlpha','textAlign','textBaseline','lineCap','lineJoin','miterLimit','shadowColor','shadowBlur','filter'])
    Object.defineProperty(ctx, k, { get(){return state[k];}, set(v){state[k]=v;} });
  return ctx;
}

const ctx = makeCtx();
function makeCanvas() { return { width:1600, height:1100, style:{}, getContext:()=>ctx, getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1100}), addEventListener:()=>{}, setAttribute:()=>{}, parentElement:{clientWidth:1600,clientHeight:1100} }; }
const canvas = makeCanvas();

const elProxy = new Proxy({}, { get: () => () => {} });
const doc = {
  getElementById: () => canvas,
  querySelector: () => canvas,
  querySelectorAll: () => [],
  createElement: () => makeCanvas(),
  addEventListener: () => {}, documentElement: { style:{ setProperty:()=>{}, getPropertyValue:()=>'' }, dataset:{}, setAttribute:()=>{}, classList:{ add:()=>{}, remove:()=>{}, toggle:()=>{} } },
  body: { appendChild: ()=>{}, style:{}, addEventListener:()=>{} },
};
const win = {
  devicePixelRatio: 1, innerWidth: 1600, innerHeight: 1100,
  addEventListener: () => {}, requestAnimationFrame: (f)=>{ return 0; },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  matchMedia: () => ({ matches:false, addEventListener:()=>{} }),
};

const sandbox = { document: doc, window: win, console,
  requestAnimationFrame: (f)=>0, cancelAnimationFrame: ()=>{},
  getComputedStyle: win.getComputedStyle, devicePixelRatio: 1,
  setTimeout: (f)=>{ try{f();}catch(e){} return 0; }, clearTimeout: ()=>{},
  Path2D: function(){ return {}; }, Image: function(){ return {}; },
  matchMedia: win.matchMedia, navigator: { userAgent:'node' }, location:{href:'file://'},
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
const epilogue = '\n;try{globalThis.__nodes=(typeof nodes!=="undefined")?nodes:null;globalThis.__edges=(typeof edges!=="undefined")?edges:null;globalThis.__nodeById=(typeof nodeById!=="undefined")?nodeById:null;}catch(e){globalThis.__err=e.message;}';
try { vm.runInContext(engineSrc + epilogue, sandbox, { filename: 'V2-engine' }); }
catch (e) { console.error('ENGINE ERROR:', e.message); }

const nodes = sandbox.__nodes, edges = sandbox.__edges, nodeById = sandbox.__nodeById;
if (!nodes) { console.error('no nodes global; keys:', Object.keys(sandbox).filter(k=>!['document','window','console','globalThis','self'].includes(k)).slice(0,40)); process.exit(1); }

const NB = (id)=>nodeById[id];
console.log('\n=== NODES (id: x,y w×h  right=x+w bot=y+h) ===');
for (const n of nodes) console.log(`${n.id.padEnd(9)} x${Math.round(n.x)} y${Math.round(n.y)}  ${Math.round(n.w)}×${Math.round(n.h)}  right=${Math.round(n.x+n.w)} bot=${Math.round(n.y+n.h)}  "${n.label}"`);

const ARROW_LEN=13, PILL_CLEARANCE=12, PILL_RENDERED_H=16;
const pillWidth = sandbox.pillWidth || ((lbl)=>measureText(lbl,'600 13px').width + 16);

function distToPoly(px,py,pts){
  let best=Infinity;
  for(let i=0;i<pts.length-1;i++){
    const ax=pts[i].x,ay=pts[i].y,bx=pts[i+1].x,by=pts[i+1].y;
    const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy||1;
    let t=((px-ax)*dx+(py-ay)*dy)/L2; t=Math.max(0,Math.min(1,t));
    const cx=ax+t*dx,cy=ay+t*dy; best=Math.min(best,Math.hypot(px-cx,py-cy));
  }
  return best;
}
const EPS=1.5; let invFail=0;

const geoPop = { pills: 0, 'wire-ends': 0 };
console.log('\n=== LABELED EDGES: arrival, last leg, pill center, node-edge gap ===');
for (const e of edges) {
  if (!e.lbl || !e._path) continue;
  const p = e._path, a = p[p.length-1], b = p[p.length-2];
  const dx=a.x-b.x, dy=a.y-b.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
  const w=pillWidth(e.lbl), h=PILL_RENDERED_H;
  const along = Math.abs(dy)>Math.abs(dx)? h/2 : w/2;
  const back = ARROW_LEN+PILL_CLEARANCE+along;
  const cx=a.x-ux*back, cy=a.y-uy*back;
  const t = NB(e.t);
  if (!t) continue;

  const onR = e.toPt==='rgt', onL=e.toPt==='lft', onT=e.toPt==='top', onBo=e.toPt==='bot';
  let edgeGap='?';
  if (onR) edgeGap = (a.x-(t.x+t.w)).toFixed(1)+' past right';
  else if (onL) edgeGap = (t.x-a.x).toFixed(1)+' past left';
  else if (onT) edgeGap = (t.y-a.y).toFixed(1)+' past top';
  else if (onBo) edgeGap = (a.y-(t.y+t.h)).toFixed(1)+' past bot';
  const pillNear = onR? (cx-w/2) : onL? (cx+w/2) : null;

  const offWire = distToPoly(cx,cy,p);

  let inNode='';
  for (const nn of nodes){ if (cx+w/2>nn.x && cx-w/2<nn.x+nn.w && cy+h/2>nn.y && cy-h/2<nn.y+nn.h){ inNode='⚠IN-NODE:'+nn.id; break; } }
  const off = offWire>EPS ? `⚠OFF-WIRE ${offWire.toFixed(0)}px` : '';

  const pillReach = back + along, overshoot = pillReach - len;
  const cornerOver = overshoot > 0.5 ? `⚠CORNER-OVERSHOOT ${overshoot.toFixed(0)}px (leg ${len.toFixed(0)}<reach ${pillReach.toFixed(0)})` : '';
  geoPop.pills++;
  if (off||inNode||cornerOver) invFail++;
  console.log(`${(e.lbl).padEnd(14)} ${e.f}->${e.t} to=${e.toPt} around=${(e._around||'-').padEnd(3)} pill@(${cx.toFixed(0)},${cy.toFixed(0)}) lastLeg=${len.toFixed(0)}px  ${off} ${inNode} ${cornerOver}`);
}
console.log(`\n=== INV GATE: ${invFail===0?'✅ PASS — every labeled pill is on its wire and outside all nodes':'❌ '+invFail+' violation(s)'} (EPS=${EPS}px) ===`);

const WH=10;
const OUT_MIN=2*WH;
const A_LEN=13;
function segRectDist(x1,y1,x2,y2,r){
  let best=Infinity; const N=32;
  for(let i=0;i<=N;i++){const tt=i/N,px=x1+(x2-x1)*tt,py=y1+(y2-y1)*tt;
    const dx=Math.max(r.x-px,0,px-(r.x+r.w)), dy=Math.max(r.y-py,0,py-(r.y+r.h));
    best=Math.min(best,Math.hypot(dx,dy));}
  return best;
}
let outFail=0,busFail=0,arrowFail=0;
console.log('\n=== WIRE-OUT handle (≥13) · BARE arrow-safe (arrow+10) · BUS→node clear (≥13) ===');

const memberOfGroup = {};
for(const n of nodes) if(n._band) memberOfGroup[n.id] = n._band;
for(const e of edges){
  if(!e._path||e._path.length<2) continue;
  if(!NB(e.t) && !e._isBandTarget) continue;
  geoPop['wire-ends']++;
  const p=e._path;
  const h0=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);
  const lastLeg=Math.hypot(p[p.length-1].x-p[p.length-2].x, p[p.length-1].y-p[p.length-2].y);

  const ownGroup = e._isBandTarget ? e.t : (e._isBandSource ? e.f : null);
  let minBus=Infinity,busNode='';
  for(let i=0;i<p.length-1;i++) for(const nn of nodes){
    if(nn.id===e.f||nn.id===e.t) continue;
    if(ownGroup && memberOfGroup[nn.id]===ownGroup) continue;
    const d=segRectDist(p[i].x,p[i].y,p[i+1].x,p[i+1].y,nn);
    if(d<minBus){minBus=d;busNode=nn.id;}
  }
  const hb=(!e._isBandSource && h0<OUT_MIN-0.5)?`⚠OUT-HANDLE ${h0.toFixed(0)}`:'';
  const bb=minBus<OUT_MIN-0.5?`⚠BUS graze ${minBus.toFixed(0)}@${busNode}`:'';

  const arrowSafe = lastLeg - A_LEN;
  const ab=(!e._isBandTarget && !e.lbl && arrowSafe<WH-0.5)?`⚠ARROW-SAFE ${arrowSafe.toFixed(0)}`:'';
  if(hb)outFail++; if(bb)busFail++; if(ab)arrowFail++;
  if(hb||bb||ab) console.log(`${(e.lbl||'(bare)').padEnd(14)} ${e.f}->${e.t} to=${e.toPt} around=${e._around||'-'}  outH=${h0.toFixed(0)} arrowSafe=${arrowSafe.toFixed(0)} minBus=${minBus.toFixed(0)}  ${hb} ${ab} ${bb}`);
}
declarePopulation(geoPop);
console.log(`=== WIRE-OUT/BARE/BUS GATE: ${(outFail+busFail+arrowFail)===0?'✅ PASS':'❌ '+outFail+' out-handle + '+arrowFail+' arrow-safe + '+busFail+' bus graze'} ===`);

const TOTAL = invFail + outFail + busFail + arrowFail;
console.log(`\n=== V2 WIRE-ANATOMY GATE: ${TOTAL===0?'✅ ALL PASS':'❌ '+TOTAL+' violation(s)'} ===`);
process.exitCode = TOTAL > 0 ? 1 : 0;

const prim = { nodes:[], polylines:[], arrows:[], pills:[] };
for (const n of nodes) prim.nodes.push({ x:n.x, y:n.y, w:n.w, h:n.h, label:n.label, cat:n.cat||'', type:n.type||'doc' });
const eCol = (e)=> e.crit ? '#ff6b6b' : (e.style==='dashed' ? '#7d8196' : '#9aa0bf');
for (const e of edges) {
  if (!e._path) continue;
  prim.polylines.push({ pts: e._path.map(p=>[p.x,p.y]), color:eCol(e), dashed: e.style==='dashed', width:(e.style==='bold'||e.crit)?2.4:1.5 });
  if (e._arrowAt) prim.arrows.push({ x:e._arrowAt.x, y:e._arrowAt.y, side:e._arrowSide, color:eCol(e) });
  if (e.lbl) {
    const p=e._path, a=p[p.length-1], b=p[p.length-2];
    const dx=a.x-b.x, dy=a.y-b.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
    const w=pillWidth(e.lbl), h=PILL_RENDERED_H, along=Math.abs(dy)>Math.abs(dx)?h/2:w/2, back=ARROW_LEN+PILL_CLEARANCE+along;
    prim.pills.push({ cx:a.x-ux*back, cy:a.y-uy*back, w, h, label:e.lbl, crit:!!e.crit, f:e.f, t:e.t });
  }
}

if (process.argv[3]) {
  fs.writeFileSync(process.argv[3], JSON.stringify(prim));
  console.log('\nwrote primitives ->', process.argv[3], `(${prim.nodes.length} nodes, ${prim.polylines.length} wires, ${prim.pills.length} pills)`);
} else {

  console.log(`\n(no output path given -> primitives not written)`);
}
