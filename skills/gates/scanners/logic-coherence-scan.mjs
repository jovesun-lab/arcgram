#!/usr/bin/env node

import { declarePopulation } from './_population.mjs';
import fs from 'fs';

const ROLES = new Set(['goal', 'constraint', 'decision', 'action', 'evidence']);

function resolveRole(n) {
  if (n.role && ROLES.has(String(n.role).toLowerCase())) return { role: String(n.role).toLowerCase(), src: 'explicit' };
  if (n.kind === 'diamond') return { role: 'decision', src: 'infer' };
  const s = ((n.type || '') + ' ' + (n.cat || '')).toLowerCase();
  if (/\bgoal\b/.test(s))                       return { role: 'goal',       src: 'infer' };
  if (/\bdecision\b|\bif\b/.test(s))            return { role: 'decision',   src: 'infer' };
  if (/\bconstraint\b|\bguard\b/.test(s))       return { role: 'constraint', src: 'infer' };
  if (/\bevidence\b|\bproof\b/.test(s))         return { role: 'evidence',   src: 'infer' };
  if (/\baction\b|\bstep\b/.test(s))            return { role: 'action',     src: 'infer' };
  return { role: null, src: 'unroled' };
}

function run(j) {
  const nodes = j.engine?.nodes || [];
  const edges = j.engine?.edges || [];
  const file = j.meta?.testFile ?? '?';

  const roleOf = {}, srcOf = {};
  let roled = 0, unroled = 0;
  for (const n of nodes) {
    const { role, src } = resolveRole(n);
    roleOf[n.id] = role; srcOf[n.id] = src;
    if (role) roled++; else unroled++;
  }
  const idsWith = r => nodes.filter(n => roleOf[n.id] === r).map(n => n.id);
  const goals = idsWith('goal'), actions = idsWith('action'), decisions = idsWith('decision');

  const fwd = {}, rev = {};
  for (const n of nodes) { fwd[n.id] = []; rev[n.id] = []; }
  for (const e of edges) { if (fwd[e.f]) fwd[e.f].push(e.t); if (rev[e.t]) rev[e.t].push(e.f); }
  const reach = (start, adj) => {
    const seen = new Set(), stk = [start];
    while (stk.length) { const x = stk.pop(); for (const y of (adj[x] || [])) if (!seen.has(y)) { seen.add(y); stk.push(y); } }
    return seen;
  };
  const backReachesAGoal = id => { for (const g of reach(id, rev)) if (roleOf[g] === 'goal') return true; return false; };
  const fwdReachesAnAction = id => { for (const a of reach(id, fwd)) if (roleOf[a] === 'action') return true; return false; };

  const header = () => {
    console.log(`LOGIC-COHERENCE SCAN (§12 — justification-graph traceability) — ${file}`);
    console.log(`  roles: goal ${goals.length} · decision ${decisions.length} · action ${actions.length} · constraint ${idsWith('constraint').length} · evidence ${idsWith('evidence').length}`);
    console.log(`  coverage: roled ${roled} / unroled ${unroled}  (of ${nodes.length} nodes)`);
    declarePopulation({ 'roled-nodes': roled });
  };

  if (!goals.length || !actions.length) {
    header();
    console.log(`  VERDICT: NOT ASSESSABLE — need ≥1 goal AND ≥1 action role-resolved (have goal ${goals.length}, action ${actions.length}); coherence not evaluated, no false fail.`);
    return 0;
  }

  const viol = [];
  for (const a of actions) if (!backReachesAGoal(a))
    viol.push({ kind: 'orphan-action', node: a, why: 'no justification chain back to any goal' });
  for (const g of goals) if (!fwdReachesAnAction(g))
    viol.push({ kind: 'dead-goal', node: g, why: 'reaches no action downstream (goal→action broken)' });
  for (const d of decisions) if (!backReachesAGoal(d))
    viol.push({ kind: 'dangling-decision', node: d, why: 'not reachable from any goal (floating decision)' });

  header();
  if (viol.length) {
    console.log(`  VERDICT: LOGIC-COHERENCE VIOLATIONS (${viol.length})`);
    for (const v of viol) console.log(`     ✗ [${v.kind}] ${v.node} — ${v.why}`);
    return 1;
  }
  console.log(`  VERDICT: LOGIC COHERENT — every action traces to a goal, every goal reaches an action, every decision is on a justification path`);
  return 0;
}

const fileArg = process.argv.slice(2).find(a => !a.startsWith('--'));
if (fileArg) process.exitCode = run(JSON.parse(fs.readFileSync(fileArg, 'utf8')));
else { let raw = ''; process.stdin.on('data', d => raw += d).on('end', () => { process.exitCode = run(JSON.parse(raw)); }); }
