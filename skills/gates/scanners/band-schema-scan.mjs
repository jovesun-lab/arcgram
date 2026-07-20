#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'node:fs';

const LEGACY = ['areaBg', 'tagFill', 'tagColor'];

const resolvable = v => typeof v === 'string' && v.trim().length > 0;

function scan(engine) {
  const findings = [];
  const bands = engine.bands;
  if (!Array.isArray(bands)) return findings;
  for (const b of bands) {
    const id = b.id || b.label || '(unnamed band)';
    const legacy = LEGACY.filter(k => b[k] !== undefined);
    if (legacy.length) {
      findings.push({ id, reason: `legacy field(s) ${legacy.join('/')} present - migrate to fill/color` });
    }
    if (!b.group) {
      if (!resolvable(b.fill))  findings.push({ id, reason: `fill missing/unresolvable (=${JSON.stringify(b.fill)}) -> transparent band` });
      if (!resolvable(b.color)) findings.push({ id, reason: `color missing/unresolvable (=${JSON.stringify(b.color)}) -> fallback chip` });
    }
  }
  return findings;
}

function live() {
  let s = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => s += d);
  process.stdin.on('end', () => {
    let j; try { j = JSON.parse(s); } catch { console.error('band-schema-scan: no audit JSON on stdin'); process.exit(2); }
    const engine = j.engine || {};
    const findings = scan(engine);
    const nBands = Array.isArray(engine.bands) ? engine.bands.length : 0;
    console.log(`=== BAND FILL/COLOR SCHEMA SCAN - ${j.meta?.file?.split('/').pop() || ''} ===`);
    for (const x of findings) console.log(`  BAND ${x.id}: ${x.reason}`);
    console.log(`  bands scanned : ${nBands}   violations : ${findings.length}`);
    declarePopulation({ bands: nBands });
    const verdict = nBands === 0 ? 'N/A (no bands) -> PASS'
                  : findings.length === 0 ? 'CLEAN (every band has fill + color, no legacy fields)'
                  : 'BAND-SCHEMA VIOLATION(S) PRESENT';
    console.log(`  VERDICT: ${verdict}`);
    process.exit(findings.length === 0 ? 0 : 1);
  });
}

const arg = process.argv[2];
live();
