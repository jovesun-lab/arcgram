# Arcgram — Attribution Watermark & Commercial Terms

> **STATUS: DRAFT (2026-06-24) — not executed, pending a professional legal review.**
> This document is **not legal advice.** It states the *intended* open-core terms in plain language so a
> lawyer (EU / EUIPO venue — Rae Sun is in Spain) can turn it into enforceable text before publication.
> It is deliberately kept **separate from `LICENSE`**: the engine is Apache-2.0 (a standard open-source
> license whose text must not be modified), and these commercial terms sit *on top of* it, not inside it.

---

## 1. The model in one paragraph

The **Arcgram engine is free and open** under the Apache License 2.0 — use it, modify it, embed it in
commercial products, ship it. In return, the output it produces carries a **"Made with Arcgram"
attribution mark**, on by default. **Keeping the mark is free. Removing it requires a paid commercial
license.** That is the entire open-core boundary: the code is free; an *unbranded* build is the paid
product, alongside support, indemnity, and the commercial-scale arrangements below.

## 2. The two attribution marks (one per layer)

Arcgram is one artifact with two separable layers (visual ↔ logic), so attribution rides in two places:

1. **Visual watermark** — a small "Made with Arcgram" badge in the rendered HTML output,
   linking to the project home. This is the human-facing mark on the *visual layer*.
2. **Code declaration** — a license + copyright header comment in the engine file and
   every export, plus provenance metadata in the emitted logic (`meta: { version, license, url }`). This
   is the machine-readable mark on the *logic/code layer*.

> **Implementation note (forward-looking).** Both marks are produced by the **V2 engine** as part of the
> §7 attribution mechanism (Track B). Until V2 ships them, these terms are written conditionally — they
> apply to "any Arcgram attribution mark present in the output," so they are valid now and take effect
> automatically once the marks exist. No retroactive edit needed.

## 3. Free use (no payment)

You may use, modify, redistribute, and commercially deploy the Arcgram engine at no cost, provided you:

- keep the **`NOTICE`** file intact in redistributions and derivative works (Apache §4(d)); and
- retain **both attribution marks** (visual badge + code declaration) in the output your distribution
  generates, i.e. do not disable, strip, or obscure them.

The marks are intentionally **not DRM** — they are technically removable. Retaining them is a license
condition and a courtesy that keeps the project's attribution funnel alive, not a technical lock.

## 4. Commercial license (paid) — what it grants

A separate commercial license grants one or more of:

- **Unbranded / no-attribution build** — the right to turn off the visual badge and/or the code
  declaration (the engine exposes a documented toggle, e.g. `attribution:false` / `brand:false`; the
  toggle is *licensed*, not free).
- **Org-branded mode** — replace the Arcgram badge with your own brand.
- **Warranty / indemnity / priority support and SLAs** (the §9 Apache "additional liability" any
  redistributor may offer for a fee).
- **Commercial-scale / hosted use** of the logic-layer product (see the business plan's §13 server &
  cross-agent contract tiers), where applicable.

Contact for commercial licensing: **licensing@arcgram.io** *(placeholder — Rae Sun to confirm the address /
domain before publication).*

## 5. How this is actually enforced (honest framing)

Because the engine is Apache-2.0, the *code* may be freely modified — so the binding levers here are
**not** the code license. They are, in order of strength:

1. **Trademark.** "Arcgram" and the logo are trademarks of Rae Sun (™ asserted; EUIPO filing planned).
   Trademark law — not the code license — governs use of the *name and logo* in the mark. You may remove
   the mark, but you may not use the Arcgram name/logo to brand your own product or imply endorsement.
2. **Commercial agreement.** The official *unbranded build* and its support/indemnity are delivered under
   a signed commercial contract. Shipping a no-attribution build without that contract forfeits any
   official-build warranty and the liability shield in §6.
3. **License Evidence + provenance.** Because retaining the marks is a stated, documented condition,
   stripping them is a **knowing, deliberate** act — which turns a vague "are they using it
   commercially?" question into clear, provable evidence, usually resolved by a letter rather than
   litigation. To make a casual delete miss one, the declaration is repeated across a few code sites.

This is **detection + evidence + brand control, not technical prevention** — consistent with the
"protection = license + attribution + brand, NOT DRM" principle the whole plan is built on.

## 6. Official build & liability shield

Each official release is published with an integrity fingerprint (**SHA-256 + a signed manifest**) at
`arcgram.io`. Combined with the Apache "AS IS" warranty disclaimer, this lets the genuine build be
distinguished from a tampered or pirated one: *a copy whose fingerprint does not match the published
value is not an official Arcgram build, carries no warranty, and the author is not responsible for its
behavior.* The binding shield is the **license text**; the fingerprint is the **evidence**. *(A
disclaimer reduces, not perfectly eliminates, liability — jurisdiction-dependent; have it reviewed.)*

## 7. Pointers

- Full rationale and the dated decision record (license = Apache-2.0, locked 2026-06-24;
  the two-layer watermark and License-Evidence fingerprint design) are maintained by the
  author and available on request.
