# output/ — your generated flows

This is the default destination for Arcgram flows you generate with the engine.

Files you put here are **yours**: they are **not** part of the published release — they
are not leak-scanned, not derived, and not shipped. Generate freely.

## Scaffold a new flow

From the engine folder (the parent of this one):

    node new-flow.mjs my-flow        # -> output/my-flow.html

Then fill in the `nodes` / `edges` arrays (see `../SKILL.md` and `../schema.md`) and open
the file in any browser. No build step, no install.
