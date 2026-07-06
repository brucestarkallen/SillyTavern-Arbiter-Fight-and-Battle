// v0.23.0: multi-strike COMBO resolution.
// A player message that chains 2+ offensive sub-actions ("disrupt his spell,
// then a groin kick, then an elbow, then a neck punch") resolves each strike on
// its own footing, producing per-strike outcomes for rich prose — then the whole
// chain collapses to ONE overall exchange (one exchange's worth of poise), so a
// combo is HIGH-VARIANCE but not a win-more button. These tests lock the parsing,
// the one-exchange economy, the balance (combo win% ~= single at equal odds), and
// the anti-sycophancy property (a weaker fighter's combo BACKFIRES).
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { composure: true, composureMax: 6, preset: 'realistic', tieBand: 0.06 } }, chatMetadata: {}, setExtensionPrompt(){}, eventSource: { on(){} }, event_types: {} }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// ── Parsing ──
const p2 = E.normalizeDuelAdj({ exchange: true, action: 'combo', circumstance: 1, sequence: [{ strike: 'disrupt spell', circumstance: 2 }, { strike: 'groin kick', circumstance: 1 }] });
ok('2-strike combo parses into a sequence', Array.isArray(p2.sequence) && p2.sequence.length === 2 && p2.sequence[0].strike === 'disrupt spell');
ok('per-strike circumstance is clamped to -3..3', E.normalizeDuelAdj({ exchange: true, sequence: [{ strike: 'a', circumstance: 9 }, { strike: 'b', circumstance: -9 }] }).sequence[0].circumstance === 3);
ok('a lone strike is NOT a combo (sequence null)', E.normalizeDuelAdj({ exchange: true, sequence: [{ strike: 'only one' }] }).sequence === null);
ok('no sequence field → null', E.normalizeDuelAdj({ exchange: true, action: 'x', circumstance: 0 }).sequence === null);
ok('sequence capped at 5 strikes', E.normalizeDuelAdj({ exchange: true, sequence: Array.from({ length: 9 }, (_, i) => ({ strike: 's' + i, circumstance: 0 })) }).sequence.length === 5);
ok('accepts "step" as an alias for "strike"', E.normalizeDuelAdj({ exchange: true, sequence: [{ step: 'one', circumstance: 0 }, { step: 'two', circumstance: 0 }] }).sequence[0].strike === 'one');

// ── Resolution shape ──
const mkMeta = (Rp, Ro) => ({ duel: { active: true, over: false, victor: null, round: 0, domain: 'melee', scaleMismatch: 0,
  player: { name: 'P', rating: Rp, poise: 5, maxPoise: 5, injuries: 0, momentum: 0, opening: false },
  opp: { name: 'O', rating: Ro, poise: 5, maxPoise: 5, injuries: 0, momentum: 0, opening: false } } });
const seq = (n, c) => Array.from({ length: n }, () => ({ strike: 's', circumstance: c }));
let m = mkMeta(7, 5); const r = E.resolveDuelSequence(m, { sequence: seq(4, 1) });
ok('every strike gets its own outcome tier', r.steps.length === 4 && r.steps.every(s => typeof s.tier === 'string'));
ok('resolver flags combo and returns an overall tier', r.combo === true && typeof r.overall === 'string');
ok('the round advances exactly once for the whole combo', m.duel.round === 1);

// A combo deals ONE exchange of poise, never n separate hits: even a 5-strike
// combo cannot strip more than a single DECISIVE-scaled exchange could.
let maxOppLoss = 0;
for (let i = 0; i < 4000; i++) { const mm = mkMeta(7, 3); const res = E.resolveDuelSequence(mm, { sequence: seq(5, 3) }); maxOppLoss = Math.max(maxOppLoss, 5 - mm.duel.opp.poise); }
ok('a 5-strike combo never exceeds one exchange of poise (<= 5)', maxOppLoss <= 5);

// ── The player CAN lose a combo (it flips to the opponent) ──
// A single combo is one exchange, so it can only finish a player already on the
// ropes — start the MC at low poise against a stronger foe and confirm a failed
// chain gets turned into the finish.
let mcLostACombo = false;
for (let i = 0; i < 3000 && !mcLostACombo; i++) { const mm = mkMeta(4, 7); mm.duel.player.poise = 1.5; const res = E.resolveDuelSequence(mm, { sequence: seq(3, -1) }); if (res.over && res.victor === 'opp') mcLostACombo = true; }
ok('a fumbled combo by an on-the-ropes MC is turned into the finish (MC loses)', mcLostACombo);

// ── BALANCE: combo win% ~= single win% at equal odds ──
function fullDuel(Rp, Ro, circ, nStrikes) {
  const mm = mkMeta(Rp, Ro);
  for (let i = 0; i < 80 && !mm.duel.over; i++) {
    if (nStrikes) E.resolveDuelSequence(mm, { sequence: seq(nStrikes, circ) });
    else E.resolveDuelExchange(mm, circ, 'attack');
  }
  return mm.duel.over ? mm.duel.victor : (mm.duel.player.poise >= mm.duel.opp.poise ? 'player' : 'opp');
}
const winRate = (Rp, Ro, circ, nStrikes, N) => { let w = 0; for (let i = 0; i < N; i++) if (fullDuel(Rp, Ro, circ, nStrikes) === 'player') w++; return w / N; };
const N = 4000;
const singleEqual = winRate(5, 5, 0, 0, N);
const comboEqual = winRate(5, 5, 0, 3, N);
console.log(`  [equal odds] single ${(singleEqual*100).toFixed(1)}% vs combo ${(comboEqual*100).toFixed(1)}%`);
ok('combo is NOT a win-more button at equal odds (within 6%)', Math.abs(comboEqual - singleEqual) < 0.06);

// ── ANTI-SYCOPHANCY: a weaker fighter's combo BACKFIRES (wins less than single) ──
const singleWeak = winRate(5, 7, 0, 0, N);
const comboWeak = winRate(5, 7, 0, 3, N);
console.log(`  [MC weaker] single ${(singleWeak*100).toFixed(1)}% vs combo ${(comboWeak*100).toFixed(1)}%`);
ok('an outmatched MC gains NOTHING from comboing — it backfires', comboWeak <= singleWeak + 0.005);

console.log(fails === 0 ? 'ALL V39 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
