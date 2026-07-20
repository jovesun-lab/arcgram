---
name: validate
description: >-
  Run both Arcgram self-checks in one call. A thin wrapper over Checkpoint (structure)
  and Reconcile (values): validate(diagram,{code}) runs Checkpoint always and Reconcile
  when code is supplied, then merges into one source-tagged result in the same
  {findings,summary,attestation,clean} contract. clean = checkpoint.clean && reconcile.clean.
  Adds no new check; marks, never blocks. Run after authoring or editing a diagram and its
  code. Agent-neutral. The single door over its two siblings.
---

# Validate - the combined Arcgram self-check entry

One call. Two questions answered between the siblings:
**is the flow well-formed and coherent, AND do its `@spec` values still match the code?**

Validate is a **thin wrapper**, not a new check. It imports
[Checkpoint](../checkpoint/SKILL.md) and [Reconcile](../reconcile/SKILL.md) **untouched** and
composes their pure functions:

- **Checkpoint** (one input: the diagram) checks **structure** - well-formed, coherent.
- **Reconcile** (two inputs: diagram + code) checks **values** - `@spec` literals == code constants.

Run both -> the diagram is a faithful, current spec. Every finding still comes from one sibling;
Validate only **merges, source-tags, and unions the attestation**.

## Code is optional

| input | what runs | clean possible? |
|---|---|---|
| `validate(diagram, { code })` | Checkpoint **and** Reconcile | yes |
| `validate(diagram)` (no code) | Checkpoint only | no - values unchecked |

Without code there is nothing to reconcile, so Reconcile is **not run** (running it would just flag
every `@spec` pin as missing). Instead the value half is reported as one `uncovered`
`value-check-not-run` finding, so a structure-only run is never falsely "clean" on values - the same
anti-silent-pass rule both siblings enforce.

**Locked invariant - `uncovered` is a third state, never a pass.** A diagram-only run (no code) can
**never** produce an overall green clean, even when the structure is perfect. The attestation
explicitly appends `| code consistency: NOT CHECKED (no code supplied)`, `summary.codeConsistency`
reads `"NOT_CHECKED"`, and the CLI verdict is `INCOMPLETE`, never the word CLEAN. This guards the
exact silent-pass the family exists to prevent: claiming "checked & clean" while the code half was
never checked.

## Output (same contract as both siblings, plus `source`)

```
{ findings:[{id,type,severity,note,source}], summary, attestation, clean }
self-check ran HH:MM:SS | N findings | M unchecked
```

- **`source`** is `"checkpoint"` | `"reconcile"` | `"validate"` - so you can route a finding back
  to the check that raised it. Everything else (`id`, `type`, `severity`, `note`) is verbatim from
  the sibling.
- **`attestation`** is the **union**: N and M are the combined defect / uncovered totals. When the
  value half did not run it appends an explicit `| code consistency: NOT CHECKED (no code supplied)`.
- **`clean === checkpoint.clean && reconcile.clean`** (identically `N=0 && M=0`); `uncovered` is a
  third state and is never folded into `clean`, so a skipped value-check is not clean.
- **`summary`** nests each sibling's own summary under `.checkpoint` / `.reconcile`, plus `ran` and
  `codeConsistency` (`"checked"` | `"NOT_CHECKED"`).
- The full sub-results are returned verbatim on `.checkpoint` / `.reconcile` for a caller that wants
  the per-check breakdown.

Human reads the marker; agent reads the `type` (and `source`).

## Use

```sh
node validate.mjs <diagram.html | diagram.json> [code-file ...] [--tier-b | --no-tier-b] [--json]
```
```js
import { validate } from './validate.mjs';
validate({ nodes, edges, meta }, { code });   // code: string | string[]; omit -> structure only
```

`--tier-b` / `--no-tier-b` forward to Checkpoint's justification tier (else auto-detected by a
decision diamond). Exit 1 on any defect (advisory - never blocks; an uncovered value-check is not a
defect).

Verify: `node validate-selftest.mjs` (36 checks - source tags, union attestation, clean rule, the
code-omitted path, and byte parity with running the two siblings separately).
Example: `arcgram-v2/public/examples/example-workflow.html` vs `example-workflow.config.cs` (clean).
