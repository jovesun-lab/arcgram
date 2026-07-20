#!/usr/bin/env node
// validate-selftest.mjs - proves the combined entry composes Checkpoint + Reconcile
// faithfully: source-tags findings, unions the attestation, derives clean = cp.clean &&
// rc.clean, handles the code-omitted path honestly, and is byte-for-byte a superset of running
// the two siblings separately (parity). Pure ASCII output.
//
// Run:  node validate-selftest.mjs   (exit 0 = all pass, 1 = a failure)

import { validate } from './validate.mjs';
import { checkpoint } from '../checkpoint/checkpoint.mjs';
import { reconcile } from '../reconcile/reconcile.mjs';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log(`  FAIL: ${name}`); } };
const has = (rep, type) => rep.findings.filter((f) => f.type === type).length;
const NOW = new Date(2020, 0, 1, 9, 5, 3); // deterministic timestamp -> "09:05:03"

// Fixtures. A no-diamond goal->action flow (Tier B auto-off) with one @spec pin.
const cleanDiag = {
  meta: { version: '1' },
  nodes: [
    { id: 'G', role: 'goal', desc: 'reach the thing' },
    { id: 'A', role: 'action', desc: '@spec hold_ms=800' },
  ],
  edges: [{ f: 'G', t: 'A' }],
};
const danglingDiag = { // a checkpoint defect: edge to a non-node
  ...cleanDiag,
  edges: [{ f: 'G', t: 'A' }, { f: 'A', t: 'Z' }],
};
const codeOk = 'const HOLD_MS = 800;';
const codeDrift = 'const HOLD_MS = 999;';

// ---- 1. clean diagram + matching code -> CLEAN, both checks ran ----
{
  const r = validate(cleanDiag, { code: codeOk, now: NOW });
  ok('1 clean combined', r.clean && r.summary.defects === 0 && r.summary.unchecked === 0);
  ok('1 both checks ran', JSON.stringify(r.summary.ran) === JSON.stringify(['checkpoint', 'reconcile']));
  ok('1 sub-summaries nested', r.summary.checkpoint && r.summary.reconcile && r.summary.reconcile.specPairs === 1);
}

// ---- 2. every finding carries a source tag ----
{
  const r = validate(danglingDiag, { code: codeDrift, now: NOW });
  ok('2 all findings source-tagged', r.findings.length > 0 && r.findings.every((f) => f.source));
  ok('2 sources are from the closed set', r.findings.every((f) => ['checkpoint', 'reconcile', 'validate'].includes(f.source)));
}

// ---- 3. checkpoint defect routes to source:checkpoint ----
{
  const r = validate(danglingDiag, { code: codeOk, now: NOW });
  const d = r.findings.find((f) => f.type === 'dangling-edge');
  ok('3 dangling-edge present', !!d);
  ok('3 dangling-edge source=checkpoint', d && d.source === 'checkpoint');
  ok('3 not clean', !r.clean);
}

// ---- 4. reconcile defect routes to source:reconcile ----
{
  const r = validate(cleanDiag, { code: codeDrift, now: NOW });
  const d = r.findings.find((f) => f.type === 'spec-drift');
  ok('4 spec-drift present', !!d);
  ok('4 spec-drift source=reconcile', d && d.source === 'reconcile');
}

// ---- 5. combined defects = cp + rc (mixed: one each) ----
{
  const r = validate(danglingDiag, { code: codeDrift, now: NOW });
  ok('5 two defects (one per check)', r.summary.defects === 2);
  ok('5 one checkpoint defect', r.findings.filter((f) => f.source === 'checkpoint' && f.severity === 'defect').length === 1);
  ok('5 one reconcile defect', r.findings.filter((f) => f.source === 'reconcile' && f.severity === 'defect').length === 1);
}

// ---- 6. clean = cp.clean && rc.clean (false if EITHER dirty) ----
{
  ok('6 dirty checkpoint -> not clean', !validate(danglingDiag, { code: codeOk, now: NOW }).clean);
  ok('6 dirty reconcile -> not clean', !validate(cleanDiag, { code: codeDrift, now: NOW }).clean);
  ok('6 both clean -> clean', validate(cleanDiag, { code: codeOk, now: NOW }).clean);
}

// ---- 7. clean === (defects===0 && unchecked===0), always (internal consistency) ----
{
  for (const [d, c] of [[cleanDiag, codeOk], [danglingDiag, codeOk], [cleanDiag, codeDrift], [danglingDiag, codeDrift]]) {
    const r = validate(d, { code: c, now: NOW });
    ok(`7 clean matches attestation totals (${r.summary.defects}/${r.summary.unchecked})`,
      r.clean === (r.summary.defects === 0 && r.summary.unchecked === 0));
  }
}

// ---- 8. no code -> value-check-not-run uncovered, honest non-clean, only checkpoint ran ----
{
  const r = validate(cleanDiag, { now: NOW });
  ok('8 value-check-not-run present', has(r, 'value-check-not-run') === 1);
  ok('8 it is uncovered + source:validate', r.findings.some((f) => f.type === 'value-check-not-run' && f.severity === 'uncovered' && f.source === 'validate'));
  ok('8 not clean (values never checked)', !r.clean && r.summary.unchecked >= 1);
  ok('8 only checkpoint ran', JSON.stringify(r.summary.ran) === JSON.stringify(['checkpoint']) && r.reconcile === null);
}

// ---- 8b. LOCKED INVARIANT: no-code attestation EXPLICITLY says code is NOT CHECKED ----
{
  const r = validate(cleanDiag, { now: NOW });
  ok('8b attestation names code NOT CHECKED', /code consistency: NOT CHECKED/.test(r.attestation));
  ok('8b summary.codeConsistency = NOT_CHECKED', r.summary.codeConsistency === 'NOT_CHECKED');
  // even when structure is perfectly clean, the overall result is NOT clean and NOT a green pass
  ok('8b structure-clean still not overall-clean', cleanDiag && validate(cleanDiag, { now: NOW }).checkpoint.clean === true && r.clean === false);
}

// ---- 8c. code supplied -> codeConsistency = checked, no NOT-CHECKED marker ----
{
  const r = validate(cleanDiag, { code: codeOk, now: NOW });
  ok('8c codeConsistency = checked', r.summary.codeConsistency === 'checked');
  ok('8c no NOT CHECKED marker when code given', !/NOT CHECKED/.test(r.attestation));
}

// ---- 8d. uncovered is the THIRD state: a reconcile value-uncovered never folds into clean ----
{
  // @spec matches a constant whose value is a non-literal (computed) -> reconcile value-uncovered.
  const r = validate(cleanDiag, { code: 'const HOLD_MS = base * 2;', now: NOW });
  ok('8d reconcile ran (code supplied)', r.summary.codeConsistency === 'checked');
  ok('8d value-uncovered present, 0 defects', has(r, 'value-uncovered') === 1 && r.summary.defects === 0);
  ok('8d uncovered NOT counted as pass', !r.clean && r.summary.unchecked === 1);
}

// ---- 9. empty/whitespace code is treated as no-code (not a false reconcile run) ----
{
  ok('9 empty string code -> not run', validate(cleanDiag, { code: '', now: NOW }).reconcile === null);
  ok('9 whitespace array code -> not run', validate(cleanDiag, { code: ['  ', '\n'], now: NOW }).reconcile === null);
}

// ---- 10. attestation is the union, same format, matches merged totals ----
{
  const r = validate(danglingDiag, { code: codeDrift, now: NOW });
  ok('10 attestation format + totals',
    r.attestation === `self-check ran 09:05:03 | ${r.summary.defects} findings | ${r.summary.unchecked} unchecked`);
  const clean = validate(cleanDiag, { code: codeOk, now: NOW });
  ok('10 clean attestation 0/0', clean.attestation === 'self-check ran 09:05:03 | 0 findings | 0 unchecked');
}

// ---- 11. PARITY: validate == checkpoint + reconcile run separately ----
{
  const cp = checkpoint(cleanDiag, { now: NOW });
  const rc = reconcile(cleanDiag, codeOk, { now: NOW });
  const v = validate(cleanDiag, { code: codeOk, now: NOW });
  // findings, minus the source tag, are exactly cp's then rc's, in order
  const strip = (arr) => arr.map(({ source, ...rest }) => rest);
  ok('11 findings = cp ++ rc (parity)',
    JSON.stringify(strip(v.findings)) === JSON.stringify([...cp.findings, ...rc.findings]));
  ok('11 combined defects = cp + rc', v.summary.defects === cp.summary.defects + rc.summary.defects);
  ok('11 combined unchecked = cp + rc', v.summary.unchecked === cp.summary.unchecked + rc.summary.unchecked);
  ok('11 sub-results preserved verbatim', JSON.stringify(v.checkpoint) === JSON.stringify(cp) && JSON.stringify(v.reconcile) === JSON.stringify(rc));
}

// ---- 12. parity holds on a dirty pair too ----
{
  const cp = checkpoint(danglingDiag, { now: NOW });
  const rc = reconcile(danglingDiag, codeDrift, { now: NOW });
  const v = validate(danglingDiag, { code: codeDrift, now: NOW });
  const strip = (arr) => arr.map(({ source, ...rest }) => rest);
  ok('12 dirty parity', JSON.stringify(strip(v.findings)) === JSON.stringify([...cp.findings, ...rc.findings]));
}

// ---- 13. tierB passthrough to checkpoint ----
{
  // A diagram with a diamond: Tier B auto-on. --no-tier-b must turn it off via opts.
  const diaDiag = {
    meta: { version: '1' },
    nodes: [
      { id: 'G', role: 'goal', desc: 'g' },
      { id: 'D', kind: 'diamond', role: 'decision', desc: 'd?' },
      { id: 'A', role: 'action', desc: 'a' },
    ],
    edges: [{ f: 'G', t: 'D' }, { f: 'D', t: 'A', branch: 'Y' }, { f: 'D', t: 'A', branch: 'N' }],
  };
  ok('13 tierB auto-on with diamond', validate(diaDiag, { code: '', now: NOW }).checkpoint.summary.tierB === true);
  ok('13 tierB:false forwarded', validate(diaDiag, { tierB: false, code: '', now: NOW }).checkpoint.summary.tierB === false);
}

// ---- 14. code as array (multi-file) is accepted ----
{
  const d = { meta: { version: '1' }, nodes: [{ id: 'A', role: 'action', desc: '@spec hold_ms=800 fade_ms=200' }, { id: 'G', role: 'goal', desc: 'g' }], edges: [{ f: 'G', t: 'A' }] };
  const r = validate(d, { code: ['const HOLD_MS = 800;', 'const FADE_MS = 200;'], now: NOW });
  ok('14 multi-file code clean', r.clean && r.summary.reconcile.specPairs === 2);
}

console.log(`\nvalidate-selftest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
