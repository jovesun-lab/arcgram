

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { declarePopulation } from './_population.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INTENT_DIR = path.join(HERE, 'intent');

export function isRequired(file) {
  return false;
}

export function manifestPathFor(flow) {
  const base = path.basename(String(flow || '')).replace(/\.html?$/i, '');
  return path.join(INTENT_DIR, base + '.intent.json');
}

export function inventoryFromAudit(audit) {
  const eng = (audit && audit.engine) || {};
  const nodes = (eng.nodes || []).map((n) => String(n.id));
  const edges = (eng.edges || []).map((e) => `${e.f}->${e.t}`);

  const pills = (eng.edges || []).filter((e) => e.lbl).map((e) => `${e.f}->${e.t}:${e.lbl}`);
  return { nodes, edges, pills };
}

export function diffIntent(manifest, live) {
  const miss = { nodes: [], edges: [], pills: [] };
  for (const kind of ['nodes', 'edges', 'pills']) {

    const have = new Map();
    for (const x of live[kind] || []) have.set(x, (have.get(x) || 0) + 1);
    for (const x of (manifest[kind] || [])) {
      const n = have.get(x) || 0;
      if (n <= 0) miss[kind].push(x);
      else have.set(x, n - 1);
    }
  }
  return miss;
}

export function shrinkage(oldManifest, newInv) {
  const declared = new Set((oldManifest.removed || []).map((r) => r.item));
  const lost = { nodes: [], edges: [], pills: [] };
  for (const kind of ['nodes', 'edges', 'pills']) {
    const have = new Map();
    for (const x of newInv[kind] || []) have.set(x, (have.get(x) || 0) + 1);
    for (const x of (oldManifest[kind] || [])) {
      const n = have.get(x) || 0;
      if (n <= 0) { if (!declared.has(x)) lost[kind].push(x); }
      else have.set(x, n - 1);
    }
  }
  return lost;
}

export function captureManifest(flow, prior) {
  const audit = JSON.parse(execFileSync('node', ['audit-harness.mjs', flow], {
    cwd: HERE, encoding: 'utf8', maxBuffer: 256e6,
  }));
  const inv = inventoryFromAudit(audit);
  return {
    _what: 'THE INTENT SET -- every node, wire and pill this flow MUST contain. conservation-scan.mjs asserts INTENT is a subset of the LIVE runtime graph, so content cannot be deleted to make a geometry gate go green.',
    _rule: 'TO SHRINK THIS SET, DECLARE THE REMOVAL IN `removed[]` WITH A REASON. --capture REFUSES to silently drop an item that was here before -- re-capturing to clear a red is exactly the failure this gate exists to prevent, and it is the failure a re-capture would look most like.',
    _limit: 'Records what was CAPTURED, not what the source document says: conservation cannot prove the capture was complete. And a HAND-EDIT of this file is invisible to the gate -- that hole closes with version control.',
    flow: path.basename(flow),
    capturedAt: new Date().toISOString().slice(0, 10),
    removed: (prior && prior.removed) || [],
    nodes: inv.nodes,
    edges: inv.edges,
    pills: inv.pills,
  };
}

export function runGate(flow, audit) {
  const mf = manifestPathFor(flow);
  const required = isRequired(flow);
  const exists = fs.existsSync(mf);

  if (!exists) {
    if (required) {
      return {
        red: true, na: false, pop: { nodes: 0, edges: 0, pills: 0 },
        verdict: 'NO INTENT MANIFEST',
        notes: [
          `This flow is part of the LIVE CORPUS (the tracked corpus) and carries NO intent manifest at ${path.relative(HERE, mf)}.`,
          'A conservation gate reads a LEDGER, so "no ledger" must never mean "nothing to check" -- that would make deleting the manifest a way to switch the gate off.',
          'Capture it: node conservation-scan.mjs --capture ' + flow,
        ],
      };
    }
    return {
      red: false, na: true, pop: { nodes: 0, edges: 0, pills: 0 },
      verdict: 'N/A -- no intent manifest, and this flow does not owe one',
      notes: ['THIS ROW ASSERTS NOTHING ABOUT THIS FLOW. It is not in the live corpus (the tracked corpus), so it is not required to declare an intent set. Said out loud, because an N/A that reads like a PASS is the failure this suite keeps finding in itself.'],
    };
  }

  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const live = inventoryFromAudit(audit);
  const miss = diffIntent(manifest, live);
  const pop = {
    nodes: (manifest.nodes || []).length,
    edges: (manifest.edges || []).length,
    pills: (manifest.pills || []).length,
  };
  const total = miss.nodes.length + miss.edges.length + miss.pills.length;
  const notes = [
    `intent : ${pop.nodes} nodes . ${pop.edges} wires . ${pop.pills} pills   (${path.relative(HERE, mf)})`,
    `live   : ${live.nodes.length} nodes . ${live.edges.length} wires . ${live.pills.length} pills`,
  ];
  if (total) {
    notes.push(`MISSING (${total}) -- intended content that is NOT in the drawing:`);
    for (const x of miss.nodes) notes.push(`   - node  ${x}`);
    for (const x of miss.edges) notes.push(`   - wire  ${x}`);
    for (const x of miss.pills) notes.push(`   - pill  ${x}`);
    notes.push('RESTORE THE CONTENT -- make space, do not cut. If the removal is intentional, edit the');
    notes.push('intent manifest as a tracked diff and say why. Never ship a silent shrink.');
  }
  return {
    red: total > 0, na: false, pop, missing: total,
    verdict: total ? `CONTENT DELETED -- ${total} intended item(s) missing` : 'CONSERVED -- every intended item is in the drawing',
    notes,
  };
}

const argv = process.argv.slice(2);

if (argv[0] === '--capture') {
  const flow = argv[1];
  if (!flow) { console.error('Usage: node conservation-scan.mjs --capture <flow.html>'); process.exit(2); }
  fs.mkdirSync(INTENT_DIR, { recursive: true });
  const mf = manifestPathFor(flow);
  const existed = fs.existsSync(mf);
  const prior = existed ? JSON.parse(fs.readFileSync(mf, 'utf8')) : null;
  const manifest = captureManifest(flow, prior);

  if (prior) {
    const lost = shrinkage(prior, manifest);
    const n = lost.nodes.length + lost.edges.length + lost.pills.length;
    if (n) {
      console.error(`REFUSED -- re-capturing ${path.basename(flow)} would DROP ${n} item(s) that the intent set already contains:`);
      for (const x of lost.nodes) console.error(`   - node  ${x}`);
      for (const x of lost.edges) console.error(`   - wire  ${x}`);
      for (const x of lost.pills) console.error(`   - pill  ${x}`);
      console.error('');
      console.error('  A re-capture would make the RED disappear by rewriting the reference it is measured against.');
      console.error('  That is not a fix, it is the deletion with an extra step. Two legal moves:');
      console.error('    1. RESTORE the content in the flow (make space, do not cut), then re-capture.');
      console.error(`    2. If the removal is INTENTIONAL, declare it in ${path.relative(HERE, mf)}:`);
      console.error('         "removed": [ { "item": "<the id above>", "reason": "<why>", "session": "S<n>" } ]');
      console.error('       ...then re-capture. The removal is then a stated decision, not a silent shrink.');
      process.exit(2);
    }
  }

  fs.writeFileSync(mf, JSON.stringify(manifest, null, 1));
  console.log(`${existed ? 'RE-CAPTURED' : 'CAPTURED'}: ${path.relative(HERE, mf)}`);
  console.log(`  ${manifest.nodes.length} nodes . ${manifest.edges.length} wires . ${manifest.pills.length} pills`
    + (manifest.removed.length ? `  (+${manifest.removed.length} declared removal(s))` : ''));
  process.exit(0);
}

const flow = argv[0];
if (!flow) { console.error('Usage: node conservation-scan.mjs <flow.html>   < audit-or-normalized JSON on stdin'); process.exit(2); }

let audit;
try {
  audit = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (e) {
  console.error('conservation-scan: could not read the audit JSON on stdin -- ' + e.message);
  process.exit(2);
}

const r = runGate(flow, audit);
console.log(`CONSERVATION SCAN -- ${path.basename(flow)}`);
for (const n of r.notes) console.log('  ' + n);
console.log(`  VERDICT: ${r.verdict}`);
declarePopulation(r.pop);
process.exit(r.red ? 1 : 0);
