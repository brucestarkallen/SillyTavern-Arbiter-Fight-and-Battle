// v0.25.0 AUDIT SUITE 3/3 — background event engine invariants.
// The ambient world must never break state: tick count advances by exactly one,
// every pity-timer DC stays finite and inside [5, dc0], thread rungs stay within
// their ladder, story-seeded pools are consumed exactly once (and never corrupt),
// and the pity timer GUARANTEES a fire over time (no infinite drought).
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { eventEngine: true } }, chatMetadata: {}, setExtensionPrompt(){}, eventSource: { on(){} }, event_types: {} }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
const D = E.ENGINE_DEFAULTS;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

const meta = {
  tickCount: 0,
  threads: [
    { name: 'coup', desc: '', bias: 1, pace: 2, rung: 0, maxRung: 8, lastTickAt: 0 },
    { name: 'plague', desc: '', bias: -1, pace: 3, rung: 0, maxRung: 6, lastTickAt: 0 },
    { name: 'romance', desc: '', bias: 0, pace: 1, rung: 2, maxRung: 5, lastTickAt: 0 },
  ],
  engines: { surprise: { dc: D.surprise.dc0 }, encounter: { dc: D.encounter.dc0 }, world: { dc: D.world.dc0 } },
  worldSeeds: ['bespoke world A', 'bespoke world B'],
  encounterSeeds: ['bespoke enc A', 'bespoke enc B', 'bespoke enc C'],
};
let tickBad = 0, dcBad = 0, rungBad = 0, poolBad = 0;
for (let i = 0; i < 8000; i++) {
  const before = meta.tickCount;
  E.backgroundTick(meta);
  if (meta.tickCount !== before + 1) tickBad++;
  for (const k of ['surprise', 'encounter', 'world']) { const dc = meta.engines[k].dc; if (!isFinite(dc) || dc < 5 || dc > D[k].dc0) dcBad++; }
  for (const th of meta.threads) { if (!isFinite(th.rung) || th.rung < 0 || th.rung > th.maxRung) rungBad++; }
  if (meta.worldSeeds && meta.worldSeeds.some(x => typeof x !== 'string')) poolBad++;
  if (meta.encounterSeeds && meta.encounterSeeds.some(x => typeof x !== 'string')) poolBad++;
}
ok('tickCount advances by exactly 1 per tick', tickBad === 0);
ok('every engine DC stays finite and within [5, dc0]', dcBad === 0);
ok('thread rungs stay within their ladder', rungBad === 0);
ok('story-seeded pools never corrupt', poolBad === 0);
ok('world/encounter pools are consumed to empty (once each)', meta.worldSeeds.length === 0 && meta.encounterSeeds.length === 0);

// Pity timer guarantees a fire (no infinite drought): a fresh world DC must reset within a bound.
const m2 = { tickCount: 0, threads: [], engines: { surprise: { dc: D.surprise.dc0 }, encounter: { dc: D.encounter.dc0 }, world: { dc: D.world.dc0 } } };
let firedBy = -1;
for (let i = 0; i < 5000; i++) { const dcBefore = m2.engines.world.dc; E.backgroundTick(m2); if (m2.engines.world.dc === D.world.dc0 && dcBefore !== D.world.dc0) { firedBy = i; break; } }
ok('the world pity timer is guaranteed to fire (fired within 5000 ticks)', firedBy >= 0);

console.log(fails === 0 ? 'ALL V43 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
