# Arcgram extensions

Optional overlays that attach to a rendered Arcgram flow. Load one as a `<script>` **after** the
engine; it reads the engine's runtime and draws on top. Each is standalone (no dependencies, no CDN).

## arcgram-bugmarks.js — the Audit overlay

Marks bugs / logic holes / geometry defects on a flow: a pulsing ring plus a short reason tag at each
marked element, and an "Audit" findings list. It **self-hides when there are no marks**, so a clean flow
looks identical with or without it.

```html
<script src="extensions/arcgram-bugmarks.js"></script>
<script>
  ArcgramBugs.set([
    { level: 'medium', anchor: { node: 'NODE_ID' }, reason: 'short label', desc: 'what is wrong' }
  ]);
</script>
```

API: `ArcgramBugs.set([...])` / `.add(bug)` / `.clear()` / `.show()` / `.hide()` / `.toggle()` /
`.list()` / `.visible`.

This folder is the release destination: the published extension is generated at each release by the
standard build (scrubbed + attribution-checked). Do not hand-edit files here.
