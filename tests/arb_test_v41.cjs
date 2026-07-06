// v0.25.0 AUDIT SUITE 1/3 — core combat invariants that must hold for ALL inputs.
// Guards the fairness + safety guarantees the whole project rests on: outcome
// slices partition [0,1) with no cross-boundary leaks, exchange damage is exactly
// symmetric (no hidden pro-player tilt), nothing ever goes NaN, and every duel
// (single or combo) terminates with a valid victor.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { composure: true, composureMax: 6, preset: 'realistic', tieBand: 0.06 } }, chatMetadata: {}, setExtensionPrompt(){}, eventSource: { on(){} }, event_types: {} }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// 1) sliceOutcome partitions [0,1): win tiers ONLY for u<P, lose tiers ONLY for u>=P — every preset.
const WIN = ['DECISIVE', 'SUCCESS', 'SUCCESS_COST'], LOSE = ['SETBACK', 'FAILURE', 'DISASTER'];
let partitionBad = 0;
for (const pk of Object.keys(E.PRESETS)) {
  const mods = E.PRESETS[pk].mods;
  for (let d = -13; d <= 13; d += 1) {
    const P = E.probFromDelta(d);
    for (let k = 0; k < 400; k++) {
      const u = k / 400, t = E.sliceOutcome(P, u, mods);
      if (!WIN.includes(t) && !LOSE.includes(t)) partitionBad++;
      else if (u < P && !WIN.includes(t)) partitionBad++;
      else if (u >= P && !LOSE.includes(t)) partitionBad++;
    }
  }
}
ok('sliceOutcome partitions cleanly across all presets/deltas (no cross-boundary tier)', partitionBad === 0);

// 2) Exchange damage is exactly symmetric and never NaN / never heals the actor.
let asym = 0, nan = 0, healed = 0;
for (let m = -13; m <= 13; m++) {
  for (const st of [1, 2, 3, 5, 10]) {
    for (const tier of Object.keys(E.EXCHANGE_EFFECTS)) {
      const r = E.applyExchangeEffects({ poise: st }, { poise: st }, tier, m);
      if (!isFinite(r.player.poise) || !isFinite(r.opp.poise)) nan++;
      if (r.player.poise > st || r.opp.poise > st) healed++;
    }
    const w = E.applyExchangeEffects({ poise: st }, { poise: st }, 'SUCCESS', m);
    const l = E.applyExchangeEffects({ poise: st }, { poise: st }, 'FAILURE', -m);
    if (Math.abs((st - w.opp.poise) - (st - l.player.poise)) > 1e-9) asym++;
    const wD = E.applyExchangeEffects({ poise: st }, { poise: st }, 'DECISIVE', m);
    const lD = E.applyExchangeEffects({ poise: st }, { poise: st }, 'DISASTER', -m);
    if (Math.abs((st - wD.opp.poise) - (st - lD.player.poise)) > 1e-9) asym++;
  }
}
ok('exchange damage never NaN', nan === 0);
ok('exchange damage never heals the actor', healed === 0);
ok('exchange damage is exactly symmetric (SUCCESS@+m === FAILURE@-m, DECISIVE@+m === DISASTER@-m)', asym === 0);

// 3) Every duel (single + combo) terminates with a finite state and a valid victor.
const mkDuel = (Rp, Ro, pp, po) => ({ duel: { active: true, over: false, victor: null, round: 0, domain: 'melee', scaleMismatch: 0,
  player: { name: 'P', rating: Rp, poise: pp, maxPoise: pp, injuries: 0, momentum: 0, opening: false },
  opp: { name: 'O', rating: Ro, poise: po, maxPoise: po, injuries: 0, momentum: 0, opening: false } } });
let stalled = 0, badVictor = 0, duelNaN = 0;
for (let i = 0; i < 4000; i++) {
  const meta = mkDuel(Math.floor(Math.random() * 11), Math.floor(Math.random() * 11), [3, 5, 8][i % 3], [3, 5, 8][(i >> 1) % 3]);
  let rounds = 0;
  while (!meta.duel.over && rounds < 400) {
    if (i % 4 === 0) { const n = 2 + Math.floor(Math.random() * 4); E.resolveDuelSequence(meta, { sequence: Array.from({ length: n }, () => ({ strike: 's', circumstance: Math.floor(Math.random() * 7) - 3 })) }); }
    else E.resolveDuelExchange(meta, Math.floor(Math.random() * 7) - 3, 'attack');
    rounds++;
    if (!isFinite(meta.duel.player.poise) || !isFinite(meta.duel.opp.poise)) { duelNaN++; break; }
  }
  if (rounds >= 400) stalled++;
  if (meta.duel.over && !['player', 'opp', 'draw'].includes(meta.duel.victor)) badVictor++;
}
ok('4000 randomized duels all terminate within 400 rounds', stalled === 0);
ok('duels never produce NaN poise', duelNaN === 0);
ok('duels always end with a valid victor', badVictor === 0);

console.log(fails === 0 ? 'ALL V41 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
