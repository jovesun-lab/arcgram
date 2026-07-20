---
name: reconcile
description: >-
  Check that an Arcgram diagram's @spec values still match the code that implements it.
  Reads each node's desc "@spec key=value" line, finds the same-named code constant
  (hold_ms <-> HOLD_MS / holdMs), diffs the literals. Typed findings: drift, missing
  constant, non-literal, ambiguous. Reads only the @spec line + named constants, never
  geometry; marks, never blocks. Run after editing a diagram or its code. Agent-neutral.
  Sibling to Checkpoint (Checkpoint = structure; Reconcile = values).
---

# Reconcile - code<->diagram @spec bijection validator

Two inputs: a **diagram** + the **code** it describes.
One question: **do the diagram's `@spec` values still equal the same-named code constants?**
Returns typed findings; marks, never blocks.

Sibling to Checkpoint: Checkpoint checks **structure** from the diagram alone; Reconcile
checks **values** across diagram + code. Run both -> the diagram is a faithful, current spec.

## Input: the `@spec` line

A node pins values on one line at the top of `desc`:

```
@spec hold_ms=800 fade_ms=200      <- Reconcile reads ONLY this line
```

- Prefix `@spec ` (ASCII). `key=value`, **key = the code constant name**.
- Match is case/separator-insensitive: `hold_ms` = `HOLD_MS` = `holdMs` = `hold-ms`.
- Value: a number (`800`, `0x320`) or a quoted string (`"left"`).
- Free prose and a `~ tune: <range>` line are for humans - never read.

Reconcile reads **only** the `@spec` line + **named** code constants. No geometry, no prose,
no program behavior.

## Findings

| finding | severity | means |
|---|---|---|
| `spec-drift` | defect | @spec value != the code constant |
| `spec-no-constant` | defect | no same-named constant in the code |
| `malformed-spec` | defect | @spec line is not `key=value` |
| `value-uncovered` | uncovered | constant is computed, not a literal - no verdict |
| `ambiguous-constant` | uncovered | two constants normalize to one name |
| `no-spec-lines` | uncovered | nothing pinned - never a false "clean" |

**Anchored on the `@spec` line** (not the code): drift is caught both ways, but a code constant
on no `@spec` line is normal, not a finding. The extractor is a tolerant, dependency-free scan of
`const/let/var =`, `NAME =`, `NAME:`, `#define`, `:=`, `[modifiers] const|readonly TYPE NAME =`, and
C#/Unity **bare field initializers** `[attr] public|private|static TYPE NAME = value` (ScriptableObject
tuning fields, no const/readonly) (JS/TS/Python/C/Go/C#/Java); numbers normalize (`800` == `800.0` ==
`0x320`, and a C#/Java numeric suffix is dropped so `0.2f` == `0.2`, `800L` == `800`). A Unity bare
field is matched only with a field-only marker (an access modifier, `[Attribute]`, or `static`), so a
method-body local (`int x = 5;`) is never captured.

## Output (same contract as Checkpoint)

```
{ findings:[{id,type,severity,note}], summary, attestation, clean }
self-check ran HH:MM:SS | N findings | M unchecked
```

**clean only when N=0 AND M=0** - "checked & clean" never looks like "never checked".
Human reads the marker; agent reads the `type`.

## Use

```sh
node reconcile.mjs diagram.html code.js [more.js ...] [--json]
```
```js
import { reconcile } from './reconcile.mjs';
reconcile({ nodes }, codeText);
```

Exit 1 on any defect (advisory - never blocks).
Verify: `node reconcile-selftest.mjs` (48 checks).
Example: `../../examples/example-workflow.html` vs `example-workflow.config.cs` (clean, reconciles 0 findings).
