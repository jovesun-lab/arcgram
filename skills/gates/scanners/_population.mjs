

const KEY_RE = /^[a-z0-9][a-z0-9-]*$/;
export const POP_LINE_RE = /^POPULATION:\s*(.*)$/m;

export function declarePopulation(pairs) {
  console.log('POPULATION: ' + formatPopulation(pairs));
}

export function formatPopulation(pairs) {
  const parts = [];
  for (const [k, v] of Object.entries(pairs)) {

    if (!KEY_RE.test(k)) throw new Error(`declarePopulation: bad key ${JSON.stringify(k)} -- lower-kebab, no spaces, no '='`);
    if (!Number.isInteger(v) || v < 0) throw new Error(`declarePopulation: ${k}=${v} -- a population is a non-negative INTEGER. If you cannot count it, do not declare it (rule 3).`);
    parts.push(`${k}=${v}`);
  }
  if (!parts.length) throw new Error('declarePopulation: nothing declared. An empty declaration is a lie in the shape of a fact -- omit the call instead, and let the gate name you.');
  return parts.join(' ');
}

export function readPopulation(out) {
  const m = POP_LINE_RE.exec(out || '');
  if (!m) return null;
  const map = {};
  for (const kv of m[1].trim().split(/\s+/)) {
    const i = kv.indexOf('=');
    if (i <= 0) continue;
    const k = kv.slice(0, i), v = kv.slice(i + 1);
    if (!KEY_RE.test(k) || !/^\d+$/.test(v)) continue;
    map[k] = +v;
  }
  return Object.keys(map).length ? map : null;
}

export function popSummary(map) {
  return map ? Object.entries(map).map(([k, v]) => `${k}:${v}`).join(',') : '?';
}

export function popTotal(map) {
  return map ? Object.values(map).reduce((a, b) => a + b, 0) : null;
}

export function popZeroKeys(map) {
  return map ? Object.entries(map).filter(([, v]) => v === 0).map(([k]) => k) : [];
}

export function verdictWithPopulation(pass, map) {
  if (!pass) return 'FAIL';
  const t = popTotal(map);
  return t === 0 ? 'N/A' : 'PASS';
}
