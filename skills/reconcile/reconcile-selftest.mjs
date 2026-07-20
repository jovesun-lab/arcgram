#!/usr/bin/env node
// reconcile-selftest.mjs - proves Reconcile catches each finding class, passes the
// clean baseline, matches across naming conventions / languages, and does NOT
// false-positive on an aligned diagram/code pair. Pure ASCII output.
//
// Run:  node reconcile-selftest.mjs   (exit 0 = all pass, 1 = a failure)

import { reconcile } from './reconcile.mjs';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log(`  FAIL: ${name}`); } };

// helper: count findings of a given type
const has = (rep, type) => rep.findings.filter((f) => f.type === type).length;
const node = (id, desc, extra = {}) => ({ id, desc, ...extra });

// ---- 1. aligned pair -> CLEAN (no false positive on known-good) ----
{
  const d = { nodes: [node('DLG', '@spec hold_ms=800 fade_ms=200\nslides in, holds, fades')] };
  const code = 'const HOLD_MS = 800;\nconst FADE_MS = 200;';
  const r = reconcile(d, code);
  ok('1 aligned pair is CLEAN', r.clean && r.summary.defects === 0 && r.summary.unchecked === 0);
  ok('1 counts 1 spec node / 2 pairs', r.summary.specNodes === 1 && r.summary.specPairs === 2);
}

// ---- 2. spec-drift (diagram != code) ----
{
  const d = { nodes: [node('DLG', '@spec hold_ms=800')] };
  const r = reconcile(d, 'const HOLD_MS = 1000;');
  ok('2 spec-drift detected', has(r, 'spec-drift') === 1 && r.summary.defects === 1);
  ok('2 not clean', !r.clean);
}

// ---- 3. spec-no-constant (diagram value with no code home) ----
{
  const d = { nodes: [node('DLG', '@spec hold_ms=800')] };
  const r = reconcile(d, 'const UNRELATED = 5;');
  ok('3 spec-no-constant detected', has(r, 'spec-no-constant') === 1 && r.summary.defects === 1);
}

// ---- 4. value-uncovered (constant exists but value is not a literal) ----
{
  const d = { nodes: [node('DLG', '@spec hold_ms=800')] };
  const r = reconcile(d, 'const HOLD_MS = baseDelay * 2;');
  ok('4 value-uncovered detected', has(r, 'value-uncovered') === 1 && r.summary.unchecked === 1);
  ok('4 no false defect', r.summary.defects === 0);
}

// ---- 5. malformed-spec (@spec line with no key=value) ----
{
  const d = { nodes: [node('DLG', '@spec hold_ms\nfree prose')] };
  const r = reconcile(d, 'const HOLD_MS = 800;');
  ok('5 malformed-spec detected', has(r, 'malformed-spec') === 1 && r.summary.defects === 1);
}

// ---- 6. ambiguous-constant (two distinct same-token constants) ----
{
  const d = { nodes: [node('DLG', '@spec hold_ms=800')] };
  const r = reconcile(d, 'const HOLD_MS = 800;\nconst holdMs = 900;');
  ok('6 ambiguous-constant detected', has(r, 'ambiguous-constant') === 1 && r.summary.unchecked === 1);
}

// ---- 7. no-spec-lines (nodes but nothing pinned) -> uncovered, never clean ----
{
  const d = { nodes: [node('A', 'just prose'), node('B', '')] };
  const r = reconcile(d, 'const X = 1;');
  ok('7 no-spec-lines uncovered', has(r, 'no-spec-lines') === 1 && !r.clean);
}

// ---- 8-12. naming-convention coverage: snake key matches every convention ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  ok('8 matches SCREAMING_SNAKE', reconcile(d, 'const HOLD_MS = 800;').clean);
  ok('9 matches camelCase', reconcile(d, 'const holdMs = 800;').clean);
  ok('10 matches PascalCase', reconcile(d, 'const HoldMs = 800;').clean);
  ok('11 matches snake_case', reconcile(d, 'const hold_ms = 800;').clean);
  const dk = { nodes: [node('N', '@spec hold-ms=800')] };
  ok('12 kebab key matches', reconcile(dk, 'const HOLD_MS = 800;').clean);
}

// ---- 13-15. numeric normalization (equal numbers, different literal forms) ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  ok('13 800 == 800.0', reconcile(d, 'const HOLD_MS = 800.0;').clean);
  ok('14 800 == 0x320 (hex)', reconcile(d, 'const HOLD_MS = 0x320;').clean);
  ok('15 1000 == 1_000 (sep)', reconcile({ nodes: [node('N', '@spec n=1000')] }, 'const N = 1_000;').clean);
}

// ---- 16-17. string values ----
{
  const d = { nodes: [node('N', '@spec dir="left"')] };
  ok('16 string match clean', reconcile(d, 'const DIR = "left";').clean);
  ok('17 string drift detected', has(reconcile(d, 'const DIR = "right";'), 'spec-drift') === 1);
}

// ---- 18. quoted value containing spaces ----
{
  const d = { nodes: [node('N', '@spec label="hello world"')] };
  ok('18 quoted-with-space matches', reconcile(d, 'const LABEL = "hello world";').clean);
}

// ---- 19-22. language forms ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  ok('19 #define form', reconcile(d, '#define HOLD_MS 800').clean);
  ok('20 python assignment (no const)', reconcile(d, 'HOLD_MS = 800').clean);
  ok('21 go walrus :=', reconcile(d, 'holdMs := 800').clean);
  ok('22 object/field : form', reconcile(d, 'const cfg = {\n  holdMs: 800,\n};').clean);
}

// ---- 23. trailing line comment stripped ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  ok('23 comment after literal', reconcile(d, 'const HOLD_MS = 800; // milliseconds').clean);
}

// ---- 24. multiple code files (array input) ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800 fade_ms=200')] };
  const r = reconcile(d, ['const HOLD_MS = 800;', 'const FADE_MS = 200;']);
  ok('24 multi-file code clean', r.clean && r.summary.specPairs === 2);
}

// ---- 25. mixed report: one drift + one clean pair on two nodes ----
{
  const d = { nodes: [
    node('A', '@spec hold_ms=800'),
    node('B', '@spec fade_ms=200'),
  ] };
  const r = reconcile(d, 'const HOLD_MS = 999;\nconst FADE_MS = 200;');
  ok('25 exactly one drift, node A', has(r, 'spec-drift') === 1 && r.findings.some((f) => f.type === 'spec-drift' && f.id === 'A'));
}

// ---- 26. attestation honesty: clean only when N=0 AND M=0 ----
{
  const clean = reconcile({ nodes: [node('N', '@spec n=1')] }, 'const N = 1;');
  ok('26 clean attestation 0/0', /\| 0 findings \| 0 unchecked$/.test(clean.attestation) && clean.clean);
  const unc = reconcile({ nodes: [node('N', '@spec n=1')] }, 'const N = compute();');
  ok('26 uncovered -> not clean', /\| 0 findings \| 1 unchecked$/.test(unc.attestation) && !unc.clean);
}

// ---- 27. red line: a node carrying ONLY prose/geometry-ish fields is untouched ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800', { x: 10, y: 20, w: 100, h: 40, role: 'action', kind: 'diamond' })] };
  const r = reconcile(d, 'const HOLD_MS = 800;');
  ok('27 ignores x/y/w/h/role/kind, reads only @spec', r.clean);
}

// ---- 28-31. C# / Java const + readonly (declared TYPE between const and the name) ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  ok('28 C# public const int', reconcile(d, 'public const int HOLD_MS = 800;').clean);
  ok('29 C# public static readonly', reconcile(d, 'public static readonly int HOLD_MS = 800;').clean);
  ok('30 C# bare const int (no access modifier)', reconcile(d, 'const int HOLD_MS = 800;').clean);
  ok('31 C# const drift detected', has(reconcile(d, 'public const int HOLD_MS = 1200;'), 'spec-drift') === 1);
}

// ---- 32-34. P5 does not collide with JS single-token const; C# string const ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  ok('32 JS const still clean (no P5 collision)', reconcile(d, 'const HOLD_MS = 800;').clean);
  ok('33 JS const not falsely ambiguous', has(reconcile(d, 'const HOLD_MS = 800;'), 'ambiguous-constant') === 0);
  ok('34 C# string const matches', reconcile({ nodes: [node('N', '@spec dir="left"')] }, 'public const string DIR = "left";').clean);
}

// ---- 35-41. C# / Unity ScriptableObject bare field initializers (no const/readonly) ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  ok('35 [SerializeField] private field', reconcile(d, '[SerializeField] private int holdMs = 800;').clean);
  ok('36 public field (no attribute)', reconcile(d, 'public int holdMs = 800;').clean);
  // attribute present, NO access modifier (defaults to private) -> still a field
  ok('37 [SerializeField] field, no access mod', reconcile(d, '[SerializeField] int holdMs = 800;').clean);
  // float suffix: 0.2f compares equal to @spec 0.2
  ok('38 float suffix 0.2f == 0.2',
    reconcile({ nodes: [node('N', '@spec fade=0.2')] }, '[SerializeField] float fade = 0.2f;').clean);
  ok('39 long suffix 5L == 5',
    reconcile({ nodes: [node('N', '@spec count=5')] }, 'public long count = 5L;').clean);
  // Unity field drift IS detected
  ok('40 Unity field drift detected',
    has(reconcile(d, 'public int holdMs = 1000;'), 'spec-drift') === 1);
  // string Unity field
  ok('41 string Unity field matches',
    reconcile({ nodes: [node('N', '@spec anchor="left"')] }, 'public string anchor = "left";').clean);
}

// ---- 42-44. discrimination: a method-body LOCAL (no field marker) is NOT captured;
//             P5 const + P6 field do not double-count on the same line ----
{
  const d = { nodes: [node('N', '@spec hold_ms=800')] };
  // bare `int holdMs = 800;` with no modifier/attribute == a local -> intentionally
  // uncaptured -> visible spec-no-constant (never silent-wrong).
  ok('42 no-marker bare field NOT captured (spec-no-constant)',
    has(reconcile(d, 'int holdMs = 800;'), 'spec-no-constant') === 1);
  // const field: P5 and P6 both see it but dedup -> clean, not falsely ambiguous
  ok('43 public const not double-counted (clean)', reconcile(d, 'public const int HOLD_MS = 800;').clean);
  ok('44 public const not falsely ambiguous',
    has(reconcile(d, 'public const int HOLD_MS = 800;'), 'ambiguous-constant') === 0);
}

console.log(`\nreconcile-selftest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
