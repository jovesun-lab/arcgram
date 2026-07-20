#!/usr/bin/env node
// validate.mjs - Validate: the combined Arcgram self-check entry.
// A thin wrapper over Checkpoint and Reconcile: one call runs both and
// returns ONE result in the SAME { findings, summary, attestation, clean } contract.
//
// WHAT IT IS. The single door for "is this diagram a faithful, current spec?" - the question
// the two siblings answer between them. Checkpoint reads the diagram alone and checks STRUCTURE
// ("is the flow well-formed / coherent"). Reconcile reads diagram + code and checks VALUES ("do
// the @spec numbers still match the code"). Validate runs both, source-tags every finding so you
// can tell which check raised it, and unions the attestation. Run it after authoring or editing a
// diagram (and its code).
//
// WHAT IT IS NOT. Not a new check - it adds ZERO validation logic of its own. It imports the two
// originals UNTOUCHED (`../checkpoint/checkpoint.mjs`, `../reconcile/reconcile.mjs`) and composes
// their pure functions. Every finding still comes from one sibling; Validate only merges and tags.
//
// CODE IS OPTIONAL. Checkpoint always runs (it needs only the diagram). Reconcile runs only when
// you supply `code` - without code there are no values to reconcile, so running it would just flag
// every @spec pin as missing. Instead the value-check is reported as an `uncovered`
// `value-check-not-run` finding, so a structure-only run is never falsely "clean" on values - the
// same anti-silent-pass rule both siblings already enforce ("checked & clean" never looks like
// "never checked").
//
// OUTPUT - mark, don't block (identical contract to both siblings). Each finding is
// { id, type, severity, note, source }; severity is "defect" or "uncovered"; source is
// "checkpoint" | "reconcile" | "validate". The run-level attestation
// "self-check ran HH:MM:SS | N findings | M unchecked" is the UNION of both sub-runs, clean only
// when N=0 AND M=0. `clean === checkpoint.clean && reconcile.clean` (a skipped value-check counts
// as not-clean). The full sub-results are returned verbatim on `.checkpoint` / `.reconcile`.
//
// LOCKED INVARIANT. `uncovered` is an independent THIRD state - it is
// NOT a pass and is NEVER folded into `clean`. A diagram-only run (no code) therefore can never
// produce an overall green clean, and it must SAY SO: the attestation appends an explicit
// "| code consistency: NOT CHECKED (no code supplied)", `summary.codeConsistency` reads
// "NOT_CHECKED", and the CLI verdict is "INCOMPLETE", never the word CLEAN. This is the exact
// silent-pass the skill family exists to prevent - claiming "checked & clean" when the code half
// was never checked.
//
// Usage:  node validate.mjs <diagram.html|json> [code-file ...] [--tier-b | --no-tier-b] [--json]
//   import: import { validate } from './validate.mjs';  validate({nodes, edges, meta}, { code })

import fs from 'fs';
import { checkpoint } from '../checkpoint/checkpoint.mjs';
import { reconcile } from '../reconcile/reconcile.mjs';

function timestamp(now) {
  const d = now instanceof Date ? now : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Is there real code to reconcile against? (string with content, or an array with >=1 such.)
function hasCode(code) {
  if (code == null) return false;
  if (typeof code === 'string') return code.trim() !== '';
  if (Array.isArray(code)) return code.some((c) => String(c).trim() !== '');
  return false;
}

// ---------------------------------------------------------------------------
// The pure wrapper. Adds NO validation logic - imports both originals untouched
// and composes their results. No I/O, no geometry, no engine.
//   validate(diagram, { code, tierB, now })
//     code  - string | string[] of code text; omit -> value-check not run
//     tierB - forwarded to checkpoint (force its justification tier on/off)
//     now   - forwarded to both for a deterministic timestamp (tests)
// ---------------------------------------------------------------------------
export function validate(diagram, opts = {}) {
  // 1. STRUCTURE - always (checkpoint needs only the diagram).
  const cp = checkpoint(diagram, { tierB: opts.tierB, now: opts.now });

  // 2. VALUES - only when code is supplied (reconcile needs diagram + code).
  const rc = hasCode(opts.code) ? reconcile(diagram, opts.code, { now: opts.now }) : null;

  // Merge, source-tagging every finding so the consumer can route it back to its check.
  const findings = [];
  for (const f of cp.findings) findings.push({ ...f, source: 'checkpoint' });
  if (rc) for (const f of rc.findings) findings.push({ ...f, source: 'reconcile' });
  // No code -> the value half never ran. Honest non-clean (M unchecked >= 1), not a silent pass.
  if (!rc)
    findings.push({
      id: null, type: 'value-check-not-run', severity: 'uncovered', source: 'validate',
      note: 'no code supplied - @spec values were not reconciled (pass { code } or a code file to check values)',
    });

  const defects = findings.filter((f) => f.severity === 'defect').length;
  const unchecked = findings.filter((f) => f.severity === 'uncovered').length;
  // clean iff BOTH sub-checks are clean - identically defects===0 && unchecked===0 (the selftest
  // asserts the equality). `uncovered` is the THIRD state and is NEVER counted as a pass: a skipped
  // value-check leaves clean false.
  const clean = cp.clean && (rc ? rc.clean : false);
  // The attestation is the UNION; when the value half did not run it must explicitly name that, so
  // a no-code run can never be misread as "code also verified, clean".
  let attestation = `self-check ran ${timestamp(opts.now)} | ${defects} findings | ${unchecked} unchecked`;
  if (!rc) attestation += ' | code consistency: NOT CHECKED (no code supplied)';

  return {
    findings,
    summary: {
      nodes: cp.summary.nodes,
      edges: cp.summary.edges,
      defects,
      unchecked,
      ran: rc ? ['checkpoint', 'reconcile'] : ['checkpoint'],
      codeConsistency: rc ? 'checked' : 'NOT_CHECKED', // explicit third-state flag for consumers
      checkpoint: cp.summary,
      reconcile: rc ? rc.summary : null,
    },
    attestation,
    clean,
    // Sub-results preserved verbatim for a caller that wants the per-check breakdown.
    checkpoint: cp,
    reconcile: rc,
  };
}

// ---------------------------------------------------------------------------
// Input extraction (CLI only - the wrapper above never touches a file).
// Same balanced-literal slice the siblings use; reads {nodes, edges, meta} (a superset:
// checkpoint uses all three, reconcile uses nodes). The originals stay untouched - this is
// CLI glue, not validation logic.
// ---------------------------------------------------------------------------
function sliceLiteral(src, declRegex, open, close) {
  const m = declRegex.exec(src);
  if (!m) return null;
  const start = src.indexOf(open, m.index);
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
    const edges = evalLit(sliceLiteral(raw, /\b(?:const|let|var)\s+edges\s*=/, '[', ']')) || [];
    const meta = evalLit(sliceLiteral(raw, /ARCGRAM_META\s*=/, '{', '}'));
    return { nodes, edges, meta };
  }
  const j = JSON.parse(raw);
  if (j.engine && (j.engine.nodes || j.engine.edges))
    return { nodes: j.engine.nodes || [], edges: j.engine.edges || [], meta: j.meta || j.ARCGRAM_META || null };
  return { nodes: j.nodes || [], edges: j.edges || [], meta: j.meta || j.ARCGRAM_META || null };
}

function printReport(rep, diagFile, codeFiles) {
  console.log(`VALIDATE - combined structure + value self-check (${diagFile || 'diagram'}${codeFiles.length ? ' vs ' + codeFiles.join(', ') : ''})`);
  console.log(`  nodes: ${rep.summary.nodes}  edges: ${rep.summary.edges}  ran: ${rep.summary.ran.join(' + ')}`);
  const line = (f) => {
    const tag = f.severity === 'defect' ? '[!]' : '[?]';
    console.log(`     ${tag} [${f.type}] ${f.id != null ? f.id : '(graph)'} - ${f.note}`);
  };
  console.log(`  -- structure (checkpoint, tierB ${rep.checkpoint.summary.tierB ? 'on' : 'off'}) --`);
  const cpF = rep.findings.filter((f) => f.source === 'checkpoint');
  if (cpF.length) cpF.forEach(line); else console.log('     (none)');
  if (rep.reconcile) {
    console.log(`  -- values (reconcile, ${rep.reconcile.summary.specNodes} @spec node(s) / ${rep.reconcile.summary.specPairs} pair(s)) --`);
    const rcF = rep.findings.filter((f) => f.source === 'reconcile');
    if (rcF.length) rcF.forEach(line); else console.log('     (none)');
  } else {
    console.log('  -- values: NOT RUN (no code supplied) --');
  }
  console.log(`  ${rep.attestation}`);
  // Never print the bare word CLEAN for an incomplete run - uncovered is not a pass.
  const verdict = rep.clean
    ? 'CLEAN - well-formed, coherent, and in lockstep with code'
    : rep.summary.defects
      ? `FINDINGS (${rep.summary.defects})`
      : rep.reconcile
        ? `INCOMPLETE - 0 defects but ${rep.summary.unchecked} uncovered (NOT clean)`
        : `INCOMPLETE - structure checked; CODE CONSISTENCY NOT CHECKED - NOT clean (supply code to verify @spec values)`;
  console.log(`  VERDICT: ${verdict}`);
}

// Run as CLI only when invoked directly (not when imported).
const invokedDirectly = process.argv[1] && /validate\.mjs$/.test(process.argv[1]);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const opts = {};
  if (args.includes('--tier-b')) opts.tierB = true;          // force checkpoint Tier B on
  else if (args.includes('--no-tier-b')) opts.tierB = false; // force off (else auto-detect)
  const asJson = args.includes('--json');
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('usage: node validate.mjs <diagram.html|json> [code-file ...] [--tier-b | --no-tier-b] [--json]');
    process.exit(2);
  }
  const diagFile = files[0];
  const codeFiles = files.slice(1);
  let diagram;
  try { diagram = parseDiagram(fs.readFileSync(diagFile, 'utf8'), diagFile); }
  catch (e) { console.error(`validate: could not parse diagram - ${e.message}`); process.exit(2); }
  if (codeFiles.length) {
    try { opts.code = codeFiles.map((f) => fs.readFileSync(f, 'utf8')); }
    catch (e) { console.error(`validate: could not read code - ${e.message}`); process.exit(2); }
  }
  const rep = validate(diagram, opts);
  if (asJson) {
    // Emit the union contract (same shape as either sibling). The verbatim sub-results live on
    // the in-process return value; the nested summary already carries the per-check breakdown.
    console.log(JSON.stringify({ findings: rep.findings, summary: rep.summary, attestation: rep.attestation, clean: rep.clean }, null, 2));
  } else {
    printReport(rep, diagFile, codeFiles);
  }
  process.exitCode = rep.summary.defects ? 1 : 0; // advisory (mark-don't-block)
}
