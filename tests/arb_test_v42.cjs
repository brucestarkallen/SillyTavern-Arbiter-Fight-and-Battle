// v0.25.0 AUDIT SUITE 2/3 — mass-combat termination + input robustness.
// Battles and wars must always resolve (never hang), never NaN a unit, keep
// composure bounded, and never leave a "standing" unit at zero poise. Every
// normalizer must survive arbitrary/malformed model output without throwing or
// producing NaN — the model is the untrusted boundary.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
global.SillyTavern = { getContext: () => ({ name1: 'Player', extensionSettings: { arbiter: { composure: true, composureMax: 6, preset: 'realistic', tieBand: 0.06, defaultRating: 5, duelPoise: 5 } }, chatMetadata: {}, setExtensionPrompt(){}, eventSource: { on(){} }, event_types: {} }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
const rc = () => Math.floor(Math.random() * 7) - 3;
const nan = (u) => !isFinite(u.poise) || !isFinite(u.momentum || 0) || !isFinite(u.injuries || 0) || (typeof u.composure === 'number' && !isFinite(u.composure));
const compOOB = (u) => typeof u.composure === 'number' && (u.composure < 0 || u.composure > (u.composureMax || 6) + 1e-9);

// BATTLES
let bStall = 0, bNaN = 0, bComp = 0, bStand = 0, bVictor = 0;
for (let i = 0; i < 2500; i++) {
  const meta = { sheet: { actors: {} } };
  const na = 1 + Math.floor(Math.random() * 5), ne = 1 + Math.floor(Math.random() * 5);
  const b = E.startBattle(meta, Array.from({ length: na }, (_, j) => 'Ally' + j), Array.from({ length: ne }, (_, j) => 'Foe' + j), 'melee', Math.floor(Math.random() * 9) - 4);
  if (!b) continue;
  let rounds = 0;
  while (!meta.battle.over && rounds < 250) {
    E.resolveBattleRound(meta, Math.random() < 0.4 ? { kind: 'command', circumstance: rc() } : { kind: 'attack', target: 'Foe' + Math.floor(Math.random() * ne), circumstance: rc() });
    rounds++;
    for (const u of meta.battle.allies.concat(meta.battle.enemies)) { if (nan(u)) bNaN++; if (compOOB(u)) bComp++; if (u.standing && u.poise <= 0) bStand++; }
  }
  if (rounds >= 250) bStall++;
  if (meta.battle.over && !['allies', 'enemies'].includes(meta.battle.victor)) bVictor++;
}
ok('2500 randomized battles all terminate', bStall === 0);
ok('battle units never NaN', bNaN === 0);
ok('battle composure stays in bounds', bComp === 0);
ok('no battle unit is "standing" at zero poise', bStand === 0);
ok('battles always end allies|enemies', bVictor === 0);

// WARS
let wStall = 0, wNaN = 0, wComp = 0, wVictor = 0;
for (let i = 0; i < 2500; i++) {
  const meta = { sheet: { actors: {} } };
  const na = 1 + Math.floor(Math.random() * 5), ne = 1 + Math.floor(Math.random() * 5);
  E.startWar(meta, Array.from({ length: na }, (_, j) => 'Div' + j), Array.from({ length: ne }, (_, j) => 'Horde' + j), Math.random() < 0.5 ? 'EnemyCmd' : null, Math.floor(Math.random() * 9) - 4);
  if (!meta.battle) continue;
  let rounds = 0;
  while (!meta.battle.over && rounds < 250) {
    const r = Math.random();
    const mv = r < 0.33 ? { kind: 'stratagem', action: 'feint', circumstance: rc() }
      : r < 0.66 ? { kind: 'personal', target: 'Horde' + Math.floor(Math.random() * ne), circumstance: rc() }
      : { kind: 'formation', acting: 'Div' + Math.floor(Math.random() * na), target: 'Horde' + Math.floor(Math.random() * ne), circumstance: rc() };
    E.resolveWarRound(meta, mv);
    rounds++;
    for (const u of meta.battle.allies.concat(meta.battle.enemies)) { if (nan(u)) wNaN++; if (compOOB(u)) wComp++; }
  }
  if (rounds >= 250) wStall++;
  if (meta.battle.over && !['allies', 'enemies'].includes(meta.battle.victor)) wVictor++;
}
ok('2500 randomized wars all terminate', wStall === 0);
ok('war units never NaN', wNaN === 0);
ok('war composure stays in bounds', wComp === 0);
ok('wars always end allies|enemies', wVictor === 0);

// NORMALIZERS vs garbage — never throw, never NaN.
let threw = 0, badNaN = 0;
const garbage = [null, undefined, {}, { exchange: true, circumstance: 'abc', sequence: 'nope' }, { exchange: true, sequence: [{}, { strike: null, circumstance: NaN }] }, { exchange: true, opp_composure: 'x', self_composure: {}, action: 12345 }, { kind: 'attack', target: 99, circumstance: Infinity }, { start: {}, actors: [] }, { exchange: 'yes' }, { check: 'maybe', circumstance: -Infinity }];
for (const g of garbage) {
  for (const fn of ['normalizeDuelAdj', 'normalizeBattleAdj', 'normalizeWarAdj', 'normalizeAdj']) {
    try { const a = E[fn](g); if (a && a.sequence) for (const st of a.sequence) if (!isFinite(st.circumstance)) badNaN++; if (a && a.circumstance !== undefined && !isFinite(a.circumstance)) badNaN++; }
    catch (e) { threw++; }
  }
}
ok('all normalizers survive garbage input without throwing', threw === 0);
ok('normalizers never emit NaN fields', badNaN === 0);

// JSON extraction survives adversarial model output (reasoning prefixes, fences, nesting, truncation).
const adversarial = [
  'let me think... the action is a strike {reasoning with {nested} braces} then: {"check":true,"circumstance":2}',
  '```json\n{"check":false}\n```',
  'no json here at all, just prose',
  '{"check":true,"action":"a \\"quoted\\" strike","circumstance":1}',
  '{"check":true, truncated...',
  '{"a":1}{"check":true,"circumstance":3}',
];
let extractThrew = 0;
for (const t of adversarial) { try { E.extractJsonCandidates ? E.extractJsonCandidates(t, 5) : null; } catch (e) { extractThrew++; } }
ok('JSON extraction never throws on adversarial model output', extractThrew === 0 || !E.extractJsonCandidates);

console.log(fails === 0 ? 'ALL V42 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
