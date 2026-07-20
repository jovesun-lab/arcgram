

import fs from 'node:fs';
import { measureTextMetrics } from './_text-metrics.mjs';

export function makeStub() {
  const noop = () => {};
  const state = { font: '400 10px system-ui' };
  const ctxTarget = {
    measureText: (s) => measureTextMetrics(s, state.font),
    canvas: {},
    setLineDash: noop,
    getLineDash: () => [],
  };
  const ctx = () => new Proxy(ctxTarget, {
    get: (t, k) => (k === 'font' ? state.font : (k in t ? t[k] : noop)),
    set: (t, k, v) => { if (k === 'font') state.font = v; else t[k] = v; return true; },
  });
  const canvas = {
    getContext: ctx, width: 1200, height: 800, style: {},
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 }),
  };
  const el = () => ({
    style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop, removeChild: noop,
    setAttribute: noop, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [],
    getContext: ctx, getBoundingClientRect: canvas.getBoundingClientRect,
    textContent: '', innerHTML: '', width: 1200, height: 800, offsetWidth: 1200, offsetHeight: 800,
    children: [], firstChild: null, remove: noop, focus: noop, click: noop,
  });
  const d = {
    getElementById: () => canvas, querySelector: () => el(), querySelectorAll: () => [],
    createElement: () => el(), createElementNS: () => el(),
    addEventListener: noop, removeEventListener: noop, body: el(), documentElement: el(), head: el(),
  };
  const w = {
    requestAnimationFrame: noop, cancelAnimationFrame: noop, addEventListener: noop, removeEventListener: noop,
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  };
  return { d, w, state };
}

export function engineSource(file) {
  const html = fs.readFileSync(file, 'utf8')
    .replace(/<!--BUGMARK(?:-DATA)?:START-->[\s\S]*?<!--BUGMARK(?:-DATA)?:END-->/g, '');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) throw new Error(`_engine-load: no <script> block in ${file}`);
  return blocks[blocks.length - 1][1];
}

export function loadEngine(file, exports = []) {
  const src = engineSource(file);
  const { d, w } = makeStub();
  const noop = () => {};
  class P2D { constructor(x) { this.__pathStr = x || ''; } }
  globalThis.Path2D = P2D;
  globalThis.document = d;
  globalThis.window = w;
  globalThis.requestAnimationFrame = noop;
  globalThis.cancelAnimationFrame = noop;
  globalThis.getComputedStyle = w.getComputedStyle;
  globalThis.localStorage = w.localStorage;
  globalThis.ARCGRAM_LIVE_OK = true;
  const lift = ['nodes', 'edges', ...exports]
    .map(n => `try { globalThis.__x.${n} = ${n}; } catch (_) {}`).join('\n');
  globalThis.__x = {};
  new Function(`(function(document,window,requestAnimationFrame,cancelAnimationFrame,getComputedStyle,localStorage){
${src}
${lift}
})(document,window,requestAnimationFrame,cancelAnimationFrame,getComputedStyle,localStorage);`)();
  return globalThis.__x;
}
