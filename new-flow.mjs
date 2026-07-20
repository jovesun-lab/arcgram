#!/usr/bin/env node
// new-flow.mjs — scaffold a new Arcgram flow from the engine template into output/.
//
// Usage:  node new-flow.mjs <name>
//   -> copies template-v2.html to output/<name>.html, a blank flow ready to fill.
//
// Then fill in the `nodes` / `edges` arrays (see SKILL.md + schema.md) and open the
// file in any browser. output/ is your workspace — nothing there is shipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const raw = (process.argv[2] || '').trim();
if (!raw) { console.error('usage: node new-flow.mjs <name>'); process.exit(1); }

const name = raw.replace(/\.html$/i, '').replace(/[^A-Za-z0-9._-]/g, '-');
if (!name) { console.error('name became empty after sanitising; use letters/digits/-/_'); process.exit(1); }

const src = path.join(HERE, 'template-v2.html');
if (!fs.existsSync(src)) { console.error('template-v2.html not found next to new-flow.mjs'); process.exit(1); }

const outDir = path.join(HERE, 'output');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, name + '.html');
if (fs.existsSync(out)) { console.error('refusing to overwrite existing output/' + name + '.html'); process.exit(1); }

fs.copyFileSync(src, out);
console.log('created  output/' + name + '.html  — fill nodes/edges (see SKILL.md + schema.md), then open it in any browser.');
