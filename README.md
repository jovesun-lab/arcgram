<p align="center">
  <img src="assets/git_banner.png" alt="Arcgram — human-led design, AI-accelerated execution" width="100%">
</p>

<p align="center">
  <a href="https://arcgram.io"><img src="https://img.shields.io/badge/website-arcgram.io-C69A4C" alt="Website"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-6B4E3D" alt="License: Apache 2.0"></a>
  <img src="https://img.shields.io/badge/English-5A4632" alt="English">
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-lightgrey" alt="简体中文"></a>
  <a href="README.es.md"><img src="https://img.shields.io/badge/Espa%C3%B1ol-lightgrey" alt="Español"></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Fran%C3%A7ais-lightgrey" alt="Français"></a>
</p>

# Arcgram

**Arcgram turns your AI agent's plan into a diagram you can check and fix — before anything runs.**

<p align="center">
  <img src="assets/usage-workflow.svg" alt="Arcgram loop — your AI proposes, draws, checks its own work, you point at what's wrong, it fixes" width="900">
</p>

Your AI agent can hand you something that looks right — an analysis, a workflow, a plan, code — while a broken step or a bad dependency hides underneath. Even a senior developer can't catch every trap in a wall of context, and AI will make things up with a straight face, leaving you no view into how it reasoned.

Arcgram is the tool you use to direct your agent: it turns the agent's reasoning into a diagram you both can read, where a missing step dangles in space and a circular dependency is a dead loop you catch at a glance. Its built-in Audit check then marks the nodes that need work, so you fix the exact part that matters.

One skill file. Runs on Claude, GPT, and Gemini — and on DeepSeek, Kimi (Moonshot), and Zhipu GLM — in tools like Cursor, Cline, and Aider, down to mid-sized local models. The result is a single HTML file with no dependencies — about 290 KB, pan / zoom / hover / filter, opens in any browser. No build step, no npm, no CDN, nothing to run.

## Try it in 30 seconds

**Live demos** (GitHub Pages, no install) — click one, then pan / zoom / hover:

- **[Start here → a game-system flow](https://jovesun-lab.github.io/arcgram/examples/example.html)** — the canonical demo: hover tooltips, columns, critical path
- [A decision flowchart](https://jovesun-lab.github.io/arcgram/examples/example-thinkflow.html) — diamonds, Yes/No paths, feedback loops
- [How to use Arcgram](https://jovesun-lab.github.io/arcgram/examples/usage-workflow.html) — the core loop: your agent proposes → you give feedback → it fixes → you confirm
- [The self-own](https://jovesun-lab.github.io/arcgram/examples/example-audit.html) — it red-pens its own weak nodes: your agent hands you several options and you can't tell which is best or most maintainable, so it flags its own flaws right on the diagram

**Install** (Claude Code / Cowork):

```
/plugin marketplace add jovesun-lab/arcgram
/plugin install arcgram
```

That gives your agent the authoring skill plus three self-checks (Checkpoint / Reconcile / Validate). Then just ask it to *"draw this plan as an Arcgram."*

**Agents must:** read `SKILL.md`, copy `template-v2.html`, fill the data block at the top, ship the file. Leave everything below `END OF DATA SECTION` — that's the engine. One file, nothing else:

```
curl -O https://raw.githubusercontent.com/jovesun-lab/arcgram/main/template-v2.html
```

> Don't `git clone` the whole repo in CI or an agent workflow — the single file above is enough.

## Everything it does, at a glance

Every feature grouped by what it's for — read it like a one-page spec:

<p align="center">
  <img src="assets/feature-tree.svg" alt="Arcgram feature tree — every feature grouped by function" width="900">
</p>

<sub>Follow the [blog](https://arcgram.io/blog/) — we share practical tips and case studies now and then.</sub>

## Mermaid vs Arcgram

Both Mermaid and Arcgram come down to writing a spec that a machine renders — the difference isn't there, it's **who writes it, and why**: Mermaid is a diagram you write by hand, for people to read; Arcgram is one your agent writes from its own plan, for you to check. Everything else follows from that:

| | Mermaid | Arcgram |
|---|---|---|
| Who draws it | you, by hand | your agent, from its own plan |
| Layout | automatic, shifts each time | fixed positions — every node stays put and can be pointed at |
| Gaps in the plan | render fine, stay hidden | show up as a broken line you can see |
| Checks its own work | no | yes — three self-checks the agent runs before you ever see it |
| To share it | needs a renderer | one HTML file, opens anywhere |

Two things worth knowing before you start:

- **Being able to point at one node is the whole point.** Every node has a fixed name and place. When the agent gets something wrong, you don't type a paragraph describing "the spot mid-flow, just before the charge step" — you say "the 'inventory check' node has its No branch wired wrong," and it's fixed in seconds.
- **The skill gets sharper with use.** Every pitfall we hit becomes a rule in the skill file. Two edges pile up on a node so you can't tell which is which? That lesson goes in, and the next agent routes them apart on its own. The more it's used, the less it makes you redo.

## How authoring actually works

**The agent writes the data. You correct it.** You are never expected to place boxes by hand.

1. Your agent reads the skill and writes a small block of data — the boxes, the lines between them, and optional grouping — into a copy of `template-v2.html`.
2. It runs the self-checks and fixes whatever they flag.
3. You open the file, look around, and point at anything wrong — by name, in plain language.
4. The agent edits the data and you re-open. Done.

No agent handy? You can edit the data by hand too — open `template-v2.html`, the format is explained right there above the `END OF DATA SECTION` line. Everything below it is the engine; leave it alone. Full details: [`schema.md`](schema.md) · agent guide: [`USAGE.md`](USAGE.md) · layout help: [`layout-tips.md`](layout-tips.md)

## What's in this release

| File | What it is |
|---|---|
| `template-v2.html` | The engine. Copy it, let your agent fill in the data, ship the one file. |
| `examples/example.html` | **Start here.** Small game loop: group filter, columns, tooltips, critical path. |
| `examples/example-thinkflow.html` | Decision diamonds, Yes/No branches, feedback loops. |
| `examples/example-workflow.html` | A real production workflow, laid out top-to-bottom. |
| `examples/example-workflow-H.html` | The same workflow, left-to-right. |
| `examples/example-bands.html` | Horizontal "banded" layout — read this before you use bands. |
| `examples/example-audit.html` | Audit mode: red pins mark unresolved problems, with a note on hover. |
| `examples/example-harness.html` | A diagram of the self-check system itself. |
| `schema.md` | Full reference for the data format. |
| `USAGE.md` | Driving Arcgram from AI agents. |
| `layout-tips.md` | Layout and placement guidance. |
| `themes/` | The two CSS files, kept for reference and forking (the engine already includes them). |

## What's new in v2

Left-to-right layouts (not just top-to-bottom) · decision nodes for if/then flows · click a node to open a nested diagram · pin a red flag on any node to mark an unresolved problem · a top-left filter that spotlights one group at a time · tidier connector routing · built-in theming.

## License & attribution

Apache License 2.0 — use it, change it, put it in commercial products, ship it. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

Every diagram carries a small "Made with Arcgram" mark (a badge in the top bar, and a note in the file header). Keeping it is free, and it's how attribution works here (Apache §4(d)). A mark-free build is available under a separate commercial license — see [`WATERMARK-AND-COMMERCIAL-TERMS.md`](WATERMARK-AND-COMMERCIAL-TERMS.md).

"Arcgram" and the logo are trademarks of Rae Sun. Say your work is "made with Arcgram"; don't put the name or logo on your own product.

Earlier releases were MIT; that grant still holds for copies already received. Apache 2.0 applies from this release forward.
