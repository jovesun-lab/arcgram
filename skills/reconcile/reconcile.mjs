#!/usr/bin/env node
// reconcile.mjs - Reconcile: the Arcgram code<->diagram @spec bijection validator
// Companion to Checkpoint.
//
// WHAT IT IS. A public, agent-neutral, tool-type validator. You feed it TWO things -
// one Arcgram (the diagram, treated as the spec for the numbers) and the CODE that
// implements it. It answers a single question: do the diagram's declared @spec values
// still match the same-named constants in the code? It returns typed findings. It is
// an instrument (a callable check), not the orchestrator (the loop that calls it).
//
// THE VALUE TWIN OF CHECKPOINT. Checkpoint takes ONE input (the diagram) and checks
// STRUCTURE ("is the flow well-formed/coherent"). Reconcile takes TWO inputs (diagram
// + code) and checks VALUES ("do the diagram's numbers match the code"). Together: the
// diagram is a faithful, current spec of the code.
//
// THE RED LINE (load-bearing). Reconcile reads from exactly two places: (1) the @spec
// line in each node's `desc` (regex /^@spec\s/), never the free prose, the `~ tune:`
// hint, or any structure/geometry field; (2) NAMED constants in the code text, by name
// only, reading their literal value. It never reads a coordinate, color, size, spacing,
// or interprets program behavior. The judge, one line: am I comparing a declared @spec
// literal to a same-named code literal? Yes -> in scope.
//
// OUTPUT - mark, don't block (identical to Checkpoint). Each finding is
// { id, type, severity, note }; severity is "defect" (drift / no-constant / malformed)
// or "uncovered" (no verdict: non-literal value / ambiguous / no @spec lines at all).
// The run-level attestation "self-check ran HH:MM:SS | N findings | M unchecked" is
// clean only when N=0 AND M=0, so "checked & clean" never looks like "never checked".
//
// THE ANCHOR. The bijection is anchored ON THE @spec LINE, not on the code - we iterate
// over what the diagram declares, not over every constant in the code. Drift is caught
// in both directions (change either side -> the literals differ -> spec-drift), but a
// code constant that appears on no @spec line is normal, never a finding (no false-
// positive storm).
//
// Usage:  node reconcile.mjs <diagram.html | diagram.json> <code-file> [more-code-files...] [--json]
//   import: import { reconcile } from './reconcile.mjs';  reconcile({nodes}, codeText)

import fs from 'fs';

// ---------------------------------------------------------------------------
// Value parsing + name normalization (pure helpers).
// ---------------------------------------------------------------------------

// Normalize a name to a comparison token: case-insensitive, separators dropped.
// hold_ms / HOLD_MS / holdMs / HoldMs / hold-ms all -> "holdms".
const norm = (s) => String(s).toLowerCase().replace(/[_-]/g, '');

function timestamp(now) {
  const d = now instanceof Date ? now : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Parse a raw token as a comparable LITERAL (number or quoted string), else null.
// Strips a trailing line comment (// or #) and a trailing ; or , first.
function asLiteral(raw) {
  let s = String(raw).trim();
  s = s.replace(/\s*(\/\/|#).*$/, '').trim(); // drop trailing line comment
  s = s.replace(/[;,]\s*$/, '').trim();       // drop trailing ; or ,
  if (!s) return null;
  // quoted string (single / double / backtick)
  const q = s.match(/^(["'`])((?:[^\\]|\\.)*?)\1$/);
  if (q) return { kind: 'string', value: q[2] };
  // hex (with optional sign)
  const hm = s.match(/^([+-]?)0x([0-9a-fA-F]+)$/);
  if (hm) return { kind: 'number', value: (hm[1] === '-' ? -1 : 1) * parseInt(hm[2], 16) };
  // strip a trailing C#/Java numeric suffix (0.2f, 1.5F, 800L, 3d, 2.5m, 5u) when the
  // token is otherwise a decimal/float -- so Unity tuning fields compare as numbers.
  const suf = s.match(/^([+-]?(?:\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[fFdDmMlLuU]{1,2}$/);
  if (suf) s = suf[1];
  // decimal / float / exponent, with optional _ digit separators
  if (/^[+-]?(\d[\d_]*\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s.replace(/_/g, ''));
    if (!Number.isNaN(n)) return { kind: 'number', value: n };
  }
  // booleans -> compared as strings
  if (/^(true|false)$/i.test(s)) return { kind: 'string', value: s.toLowerCase() };
  return null; // not a comparable literal (expression / call / reference)
}

// A diagram @spec value is always a value by contract: a literal, else a bare string token.
function specValue(raw) {
  return asLiteral(raw) || { kind: 'string', value: String(raw).trim() };
}

function valuesEqual(a, b) {
  if (a.kind === 'number' && b.kind === 'number') return a.value === b.value;
  return String(a.value) === String(b.value); // numeric-normalize handled above; else string-exact
}

// ---------------------------------------------------------------------------
// Diagram surface: the @spec line(s) in a node's desc.
// ---------------------------------------------------------------------------
function specPairsOf(node) {
  const desc = node && typeof node.desc === 'string' ? node.desc : '';
  const pairs = [];
  let malformed = false;
  // key=value, value = quoted (may contain spaces) or a bare non-space token
  const re = /([A-Za-z_][\w-]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|[^\s]+)/g;
  for (const rawLine of desc.split('\n')) {
    const line = rawLine.trim();
    if (!/^@spec\b/.test(line)) continue;
    const body = line.slice(5).trim(); // after "@spec"
    if (!body) continue;               // bare "@spec" with nothing -> ignore
    let m, found = 0;
    re.lastIndex = 0;
    while ((m = re.exec(body))) { pairs.push({ key: m[1], rawValue: stripQuotes(m[2]), shown: m[2] }); found++; }
    if (found === 0) malformed = true; // @spec line with content but no key=value pair
  }
  return { pairs, malformed };
}

function stripQuotes(v) {
  const q = String(v).match(/^(["'`])((?:[^\\]|\\.)*?)\1$/);
  return q ? q[2] : v;
}

// ---------------------------------------------------------------------------
// Code surface: named constants -> map(token -> entries[{name, raw, lit}]).
// Tolerant, dependency-free, language-agnostic. We only ever LOOK UP names that an
// @spec key references, so over-capturing unrelated lines is harmless; genuine
// conflicts are caught by the ambiguity guard.
// ---------------------------------------------------------------------------
function extractConstants(code) {
  const byToken = new Map();
  const record = (name, rhs) => {
    if (!name) return;
    const token = norm(name);
    const lit = asLiteral(rhs);
    const bucket = byToken.get(token) || [];
    bucket.push({ name, raw: String(rhs).trim().replace(/[;,]\s*$/, '').trim(), lit });
    byToken.set(token, bucket);
  };
  let m;
  const P1 = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;,\n]+)/g;          // JS/TS decl
  while ((m = P1.exec(code))) record(m[1], m[2]);
  const P2 = /^[ \t]*#define\s+([A-Za-z_]\w*)\s+([^\n]+)/gm;                          // C/C++ define
  while ((m = P2.exec(code))) record(m[1], m[2]);
  const P3 = /^[ \t]*([A-Za-z_$][\w$]*)\s*:?=\s*([^;,\n]+)/gm;                        // python/go/generic = and :=
  while ((m = P3.exec(code))) record(m[1], m[2]);
  const P4 = /^[ \t]*([A-Za-z_$][\w$]*)\s*:\s*([^;,\n]+)/gm;                          // object/yaml field
  while ((m = P4.exec(code))) record(m[1], m[2]);
  // C# / Java: [modifiers...] (const|readonly) TYPE NAME = value. The TYPE token before
  // the name is what distinguishes this from JS `const NAME =` (P1) — so the two never
  // double-count: P1 needs `const NAME`, P5 needs `const TYPE NAME`.
  const P5 = /^[ \t]*(?:[A-Za-z_]\w*[ \t]+)*?(?:const|readonly)[ \t]+(?:[A-Za-z_][\w.<>\[\]]*[ \t]+)+([A-Za-z_]\w*)[ \t]*=\s*([^;,\n]+)/gm;
  while ((m = P5.exec(code))) record(m[1], m[2]);
  // C# / Unity field initializer WITHOUT const/readonly (ScriptableObject tuning fields:
  // `[SerializeField] private int holdMs = 800;`). Prefix = [attrs] then access/static
  // modifiers, where AT LEAST ONE field-only marker is present (>=1 attribute OR >=1
  // modifier) -- a method-body LOCAL carries neither, so `int x = 5;` in a method is never
  // captured. TYPE token before NAME distinguishes it from JS `NAME =` (P3). `=(?![=>])`
  // skips ==, =>. Any same-name/same-value overlap with P5 dedups by distinct literal in
  // lookup() -> no double-count. readonly/const stays P5's job (excluded from the modifiers).
  const P6 = /^[ \t]*(?:(?:\[[^\]\n]*\][ \t]*)+(?:(?:public|private|protected|internal|static|volatile)[ \t]+)*|(?:\[[^\]\n]*\][ \t]*)*(?:(?:public|private|protected|internal|static|volatile)[ \t]+)+)(?:[A-Za-z_][\w.<>\[\],?\t ]*?[ \t]+)([A-Za-z_]\w*)[ \t]*=(?![=>])\s*([^;,\n]+)/gm;
  while ((m = P6.exec(code))) record(m[1], m[2]);
  return byToken;
}

// Resolve a token against the constant map. Distinct LITERAL values decide ambiguity;
// non-literal entries only matter when there is no literal at all.
function lookup(byToken, token) {
  const entries = byToken.get(token) || [];
  if (!entries.length) return { status: 'missing' };
  const lits = entries.filter((e) => e.lit);
  if (!lits.length) return { status: 'nonliteral', sample: entries[0] };
  const distinct = new Map();
  for (const e of lits) distinct.set(e.lit.kind + ':' + String(e.lit.value), e);
  if (distinct.size > 1)
    return { status: 'ambiguous', candidates: [...distinct.values()].map((e) => `${e.name}=${e.raw}`) };
  const e = lits[0];
  return { status: 'literal', lit: e.lit, name: e.name };
}

// ---------------------------------------------------------------------------
// The pure validator. Reads only the @spec line + named code constants.
// ---------------------------------------------------------------------------
export function reconcile(diagram, code, opts = {}) {
  const nodes = Array.isArray(diagram && diagram.nodes) ? diagram.nodes : [];
  const codeText = typeof code === 'string' ? code : Array.isArray(code) ? code.join('\n\n') : '';
  const consts = extractConstants(codeText);

  const findings = [];
  const add = (type, severity, id, note) => findings.push({ id: id == null ? null : id, type, severity, note });

  let specNodes = 0, specPairs = 0, malformedCount = 0;
  for (const n of nodes) {
    if (!n || n.id == null) continue;
    const { pairs, malformed } = specPairsOf(n);
    if (malformed) {
      malformedCount++;
      add('malformed-spec', 'defect', n.id,
        `node "${n.id}" has an @spec line that does not parse as key=value pairs`);
    }
    if (!pairs.length) continue;
    specNodes++;
    for (const { key, rawValue, shown } of pairs) {
      specPairs++;
      const want = specValue(rawValue);
      const token = norm(key);
      const look = lookup(consts, token);
      if (look.status === 'missing') {
        add('spec-no-constant', 'defect', n.id,
          `@spec ${key}=${shown} on node "${n.id}" has no same-named constant in the code (looked for a constant normalizing to "${token}")`);
      } else if (look.status === 'ambiguous') {
        add('ambiguous-constant', 'uncovered', n.id,
          `@spec ${key} on node "${n.id}" matches >1 distinct code constant - cannot pick: ${look.candidates.join(' ; ')}`);
      } else if (look.status === 'nonliteral') {
        add('value-uncovered', 'uncovered', n.id,
          `@spec ${key} on node "${n.id}" matches constant "${look.sample.name}" but its value "${look.sample.raw}" is not a comparable literal (computed/expression)`);
      } else if (!valuesEqual(want, look.lit)) {
        add('spec-drift', 'defect', n.id,
          `@spec ${key}=${shown} on node "${n.id}" != code ${look.name}=${look.lit.value} (diagram and code disagree)`);
      }
    }
  }

  // Anti-silent-pass: a diagram with nodes but zero @spec pins reconciled nothing.
  // Surface it as uncovered (M unchecked >= 1), never a false "clean".
  if (nodes.length && specPairs === 0 && malformedCount === 0)
    add('no-spec-lines', 'uncovered', null,
      'no @spec lines found in any node - nothing to reconcile (the diagram pins no values)');

  const defects = findings.filter((f) => f.severity === 'defect').length;
  const unchecked = findings.filter((f) => f.severity === 'uncovered').length;
  const attestation = `self-check ran ${timestamp(opts.now)} | ${defects} findings | ${unchecked} unchecked`;
  return {
    findings,
    summary: { nodes: nodes.length, specNodes, specPairs, defects, unchecked },
    attestation,
    clean: defects === 0 && unchecked === 0,
  };
}

// ---------------------------------------------------------------------------
// Input extraction (CLI only - the core above never touches a file).
// Diagram nodes are read the same way Checkpoint reads them (balanced-literal slice).
// ---------------------------------------------------------------------------
function sliceLiteral(src, declRegex, open, close) {
  const mm = declRegex.exec(src);
  if (!mm) return null;
  const start = src.indexOf(open, mm.index);
  if (start < 0) return null;
  let depth = 0, inStr = null, esc = false;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}

function parseDiagram(raw, file) {
  const looksHtml = (file && /\.html?$/i.test(file)) || /<\s*html|<\s*script|ARCGRAM_META/i.test(raw.slice(0, 4000));
  if (looksHtml) {
    const evalLit = (lit) => (lit ? Function(`"use strict"; return (${lit});`)() : null);
    const nodes = evalLit(sliceLiteral(raw, /\b(?:const|let|var)\s+nodes\s*=/, '[', ']')) || [];
    return { nodes };
  }
  const j = JSON.parse(raw);
  if (j.engine && j.engine.nodes) return { nodes: j.engine.nodes };
  return { nodes: j.nodes || [] };
}

function printReport(rep, diagFile, codeFiles) {
  console.log(`RECONCILE - code<->diagram @spec bijection (${diagFile || 'diagram'} vs ${codeFiles.join(', ')})`);
  console.log(`  nodes: ${rep.summary.nodes}  @spec nodes: ${rep.summary.specNodes}  pairs: ${rep.summary.specPairs}`);
  for (const f of rep.findings) {
    const tag = f.severity === 'defect' ? '[!]' : '[?]';
    console.log(`     ${tag} [${f.type}] ${f.id != null ? f.id : '(graph)'} - ${f.note}`);
  }
  console.log(`  ${rep.attestation}`);
  console.log(`  VERDICT: ${rep.clean ? 'CLEAN - diagram and code agree'
    : (rep.summary.defects ? 'FINDINGS (' + rep.summary.defects + ')' : '0 defects, ' + rep.summary.unchecked + ' UNCHECKED')}`);
}

const invokedDirectly = process.argv[1] && /reconcile\.mjs$/.test(process.argv[1]);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length < 2) {
    console.error('usage: node reconcile.mjs <diagram.html|json> <code-file> [more-code-files...] [--json]');
    process.exit(2);
  }
  const diagFile = files[0];
  const codeFiles = files.slice(1);
  let diagram, code;
  try { diagram = parseDiagram(fs.readFileSync(diagFile, 'utf8'), diagFile); }
  catch (e) { console.error(`reconcile: could not parse diagram - ${e.message}`); process.exit(2); }
  try { code = codeFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n\n'); }
  catch (e) { console.error(`reconcile: could not read code - ${e.message}`); process.exit(2); }
  const rep = reconcile(diagram, code);
  if (asJson) console.log(JSON.stringify(rep, null, 2));
  else printReport(rep, diagFile, codeFiles);
  process.exitCode = rep.summary.defects ? 1 : 0; // advisory (mark-don't-block)
}
