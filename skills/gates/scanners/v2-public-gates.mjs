#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inspectToNormalized, bandSchemaFromCheckpoint } from './public-adapter.mjs';
import { loadEngine } from './_engine-load.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const GATE_ENV = { ...process.env, PILL_CLEARANCE: '12', WIRE_WIRE_MIN: '12' };
const NORM_TESTFILE = 'flow';

function resolveManifest(argv) {
  const flag = argv.indexOf('--manifest');
  if (flag !== -1 && argv[flag + 1]) return argv[flag + 1];
  const candidates = [
    path.join(HERE, 'gate-manifest.json'),
    path.join(HERE, '..', 'gate-manifest.json'),
    path.join(HERE, '..', '_gate-build', 'gate-manifest.json'),
  ];
  const hit = candidates.find(p => fs.existsSync(p));
  if (!hit) {
    console.log('REFUSING — gate-manifest.json not found beside the runner or at the bundle root. Pass --manifest <path>.');
    process.exit(2);
  }
  return hit;
}

function floorGates(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const floor = (manifest.gates || []).filter(g => g.craftLevel === 'FLOOR');
  if (!floor.length) { console.log(`REFUSING — no FLOOR gates in ${manifestPath} (a manifest with 0 FLOOR rows is a broken build).`); process.exit(2); }
  return { floor, manifest };
}

function run(cmdArgs, input) {
  try { return { out: execFileSync('node', cmdArgs, { cwd: HERE, encoding: 'utf8', input, env: GATE_ENV, maxBuffer: 64e6 }), code: 0 }; }
  catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), code: e.status ?? 1 }; }
}

function adapterInput(flow) {
  loadEngine(flow);
  const inspect = globalThis.window.__arcgramInspect({ layout: true, raw: true });
  return { adapterStr: JSON.stringify(inspectToNormalized(inspect, NORM_TESTFILE)), checkpoint: inspect.checkpoint };
}

const DEFECT_LINE = /^\s+-\s/;
const DEFECT_MARK = /\b(VIOLATION|VIOLATIONS|FAIL(ED)?|DETACHED|PENETRATION)\b|❌/;
function firstDefect(out) {
  for (const l of String(out).split('\n')) if (DEFECT_LINE.test(l) || DEFECT_MARK.test(l)) return l.trim();
  return '';
}

function runGate(g, flow, adapterStr, checkpoint, tmpFile) {
  const s = g.scanner;
  if (!s || s.startsWith('(')) return { verdict: 'INLINE', code: 0, out: '' };

  if (g.row === 'band-schema') { const c = bandSchemaFromCheckpoint(checkpoint); return { verdict: c.code === 0 ? 'PASS' : 'FAIL', code: c.code, out: c.out }; }
  let r;
  if (s === 'conservation-scan.mjs') r = run([s, flow], adapterStr);
  else if (g.mode === 'html') r = run([s, flow]);
  else if (g.mode === 'file' || g.mode === 'audit') { fs.writeFileSync(tmpFile, adapterStr); r = run([s, tmpFile]); }
  else r = run([s], adapterStr);
  return { verdict: r.code === 0 ? 'PASS' : 'FAIL', code: r.code, out: r.out };
}

function main(argv) {

  const flows = argv.filter(a => a !== '--' && a !== '--manifest' && !a.endsWith('gate-manifest.json'))
                    .map(f => path.resolve(f));
  if (!flows.length) { console.log('Usage: node v2-public-gates.mjs <flow.html> [flow.html ...] [--manifest <path>]'); process.exit(2); }
  const manifestPath = resolveManifest(argv);
  const { floor, manifest } = floorGates(manifestPath);

  const missing = flows.filter(f => !fs.existsSync(f));
  if (missing.length) { console.log(`REFUSING — flow file(s) not found: ${missing.join(', ')}`); process.exit(2); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arcgram-public-gates-'));
  const tmpFile = path.join(tmp, 'geom.json');
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {  } });

  let failedFlows = 0;
  for (const flow of flows) {
    console.log(`\n═══ PUBLIC FLOOR GATES — ${path.basename(flow)} (${floor.length} gates, engine ${manifest.engineMd5 || '?'}) ═══`);
    let adapterStr, checkpoint;
    try { ({ adapterStr, checkpoint } = adapterInput(flow)); }
    catch (e) { console.log(`  ❌ could not load the flow: ${e.message}`); failedFlows++; continue; }

    let passed = 0, failed = 0;
    for (const g of floor) {
      const res = runGate(g, flow, adapterStr, checkpoint, tmpFile);
      if (res.verdict === 'PASS') passed++;
      else if (res.verdict === 'FAIL') failed++;
      const mark = res.verdict === 'FAIL' ? '❌' : res.verdict === 'INLINE' ? '· ' : '✅';
      const note = res.verdict === 'FAIL' ? `  ${firstDefect(res.out)}` : '';
      console.log(`  ${mark} ${String(g.row).padEnd(20)} ${res.verdict}${note}`);
    }
    const flowOk = failed === 0;
    if (!flowOk) failedFlows++;
    console.log(`  — ${passed}/${floor.length} PASS · ${flowOk ? '✅ FLOOR CLEAN' : `❌ ${failed} VIOLATION(S)`}`);
  }

  console.log(`\n  OVERALL: ${failedFlows === 0 ? '✅ ALL FLOWS CLEAR THE FLOOR' : `❌ ${failedFlows}/${flows.length} FLOW(S) VIOLATE`}\n`);
  process.exit(failedFlows === 0 ? 0 : 1);
}

main(process.argv.slice(2));
