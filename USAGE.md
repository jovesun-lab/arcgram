# Using Arcgram with AI Agents

Arcgram is a folder of plain HTML and markdown. Any agent that can read files can use it. This guide shows how to install and invoke it across the major AI platforms — pick the one that matches your stack.

The output is always the same: a single self-contained HTML file with your diagram. The platform just changes how you get the agent to produce it.

---

## Claude Code (CLI)

Native skill support — agent auto-discovers and triggers.

**Install:**

1. Download or clone the `arcgram` repo.
2. Place the `arcgram` folder in your Claude Code skills directory (`.claude/skills/arcgram/`) — the repo is a skill folder: a `SKILL.md` plus its supporting files.
3. Restart your Claude Code session.

**Use:** Just ask in natural language. Trigger phrases include "build a topology diagram", "create an architectural diagram", "visualize this workflow", "map out how X connects to Y." Claude reads `SKILL.md` automatically and follows the 8-step workflow.

---

## Cowork (Claude Desktop)

Same skill format as Claude Code. Put the `arcgram` folder in Cowork's skill directory, restart the app. Trigger phrases above work identically.

---

## OpenAI Custom GPTs

**Setup once:**

1. Create a new Custom GPT at chat.openai.com.
2. Upload these files as Knowledge:
   - `SKILL.md`
   - `template-v2.html`
   - `schema.md`
   - `layout-tips.md`
   - `examples/example.html`
3. Paste this into the GPT's **Instructions** field:

   ```
   You are an interactive architectural diagram generator (Arcgram).

   When the user asks for a node-and-edge diagram, system architecture map,
   workflow topology, dependency graph, or similar:

   1. Read SKILL.md from your knowledge for the full workflow.
   2. Read schema.md for field details.
   3. Read layout-tips.md for positioning heuristics.
   4. Produce a complete HTML file based on template-v2.html, with the user's
      nodes[] and edges[] arrays filled in.
   5. Provide the HTML as a downloadable file or full code block.
   ```

**Use:** "Build me a diagram of [whatever]."

---

## OpenAI Assistants API

**Setup once:**

1. Create an Assistant with the model of your choice (GPT-4+ recommended).
2. Attach the same five files as File Search resources.
3. Set system instructions as in the Custom GPT section above.

**Use programmatically:**

```python
from openai import OpenAI
client = OpenAI()

thread = client.beta.threads.create()
client.beta.threads.messages.create(
    thread_id=thread.id, role="user",
    content="Build an Arcgram diagram of our auth flow: Login → Token Exchange → API Gateway → Service")

run = client.beta.threads.runs.create_and_poll(thread_id=thread.id, assistant_id="asst_xxx")
```

The assistant returns the complete HTML in its response.

---

## Cline (VS Code agent)

**Use:** Open this repo (or the `arcgram/` folder) in your project. Then ask Cline:

> Use the Arcgram skill in `./arcgram/`. Read SKILL.md, then produce a diagram of [your topic] as a new HTML file in this project.

Cline will read `SKILL.md` from the workspace and follow the workflow.

---

## Continue.dev

Add Arcgram to your Continue config as a custom prompt or context provider:

```yaml
contextProviders:
  - name: folder
    params:
      path: ./arcgram
```

Then prompt: "Using @arcgram, build a diagram of …"

---

## Cursor

Open the `arcgram/` folder as part of your workspace. In chat:

> @arcgram — read SKILL.md and produce a diagram of [topic].

Cursor's agent will pull the relevant files into context.

---

## Aider

```bash
aider --read arcgram/SKILL.md \
      --read arcgram/template-v2.html \
      --read arcgram/schema.md \
      --read arcgram/layout-tips.md
```

Then prompt: "Create a new file `auth-flow.html` based on template-v2.html, with these nodes and edges: …"

---

## Direct API use (any model)

For your own agent loops (custom Slack bots, Discord bots, internal tools):

1. Read `SKILL.md` once at startup.
2. Inject its content into your system prompt:

   ```python
   with open("arcgram/SKILL.md") as f:
       skill_prompt = f.read()

   system_prompt = f"""
   You are a diagramming agent.

   {skill_prompt}

   When the user asks for a diagram, produce a complete HTML file based on
   the template and schema described above.
   """
   ```

3. Optionally attach `template-v2.html` and `schema.md` as additional context.
4. The model generates a complete HTML file in its response. Save it, return it to the user.

Works with Claude API, OpenAI API, Gemini API, any frontier model with sufficient context window (≥ 32k tokens recommended to comfortably fit the template + schema + your conversation).

---

## Plain chat (ChatGPT / Claude.ai / Gemini)

No setup needed for a one-off diagram:

1. Open `SKILL.md` and copy its contents.
2. Paste into the chat as the first message: "I want you to act as a diagramming agent. Here are your instructions: [paste SKILL.md]"
3. Then attach `template-v2.html` (or paste it into the next message).
4. Optionally attach `schema.md` for richer schema knowledge.
5. Ask for your diagram: "Now build me a diagram of …"

The model returns a complete HTML file in its response. Copy it to a `.html` file and open in a browser.

---

## Troubleshooting

**The agent generated HTML but the diagram doesn't render.**

- Open browser DevTools console. Most likely a syntax error in the `nodes[]` or `edges[]` array — missing comma, unmatched quote.
- Run `node --check` on the JavaScript inside `<script>` to catch syntax errors quickly:
  ```bash
  awk '/<script>/{flag=1;next}/<\/script>/{flag=0}flag' your-diagram.html > /tmp/check.js
  node --check /tmp/check.js
  ```

**Edges reference nodes that don't exist.**

- The renderer silently skips edges with unknown `f` or `t`. Check spelling of node `id`s.

**Edges overlap each other or pass through nodes.**

- Read `layout-tips.md` section 6 (router selection) and the Clearance subsection — most overlap issues are fixed by switching routers or adjusting `via` Y on `3leg` edges.

**Text looks blurry on a Retina display.**

- Should already be handled (devicePixelRatio is applied). If you've forked and lost that handling: see `resizeCanvas()` in `template-v2.html` for the correct implementation.

---

## Contributing

Issues and pull requests welcome. The renderer is a single dependency-free file (no build step, no runtime) so it stays easy to fork and modify for your own visual language.
