// v0.4: three-tier engines + World Threads, end-to-end through the interceptor.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {}; const injections = {};
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, eventEngine: true } }, chatMetadata: md, name1: 'Jovan', setExtensionPrompt(k,v){ injections[k]=v; }, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine; const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// 1. Generic tier roller at NE-P numbers
let t = E.rollTier(498, 500, 2, 498, () => 0.999);
ok('world tier fires at d500 threshold', t.fired && t.nextDC === 498);
t = E.rollTier(498, 500, 2, 498, () => 0.0);
ok('world tier decays -2', !t.fired && t.nextDC === 496);
t = E.rollTier(198, 200, 2, 198, () => 0.0);
ok('encounter tier decays -2', !t.fired && t.nextDC === 196);
ok('engine defaults match NE-P', E.ENGINE_DEFAULTS.surprise.dc0 === 95 && E.ENGINE_DEFAULTS.encounter.dc0 === 198 && E.ENGINE_DEFAULTS.world.dc0 === 498);

// 2. Thread heartbeat math
ok('thread tick advances on good roll', E.tickThread(13, () => 0.5) >= 1);
ok('thread tick can regress on disaster', E.tickThread(-13, () => 0.9999) === -1);
ok('thread tick stalls midzone', E.tickThread(0, () => 0.65) === 0);

(async () => {
  // 3. Threads heartbeat + completion through the interceptor (chatter turns)
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
    engines: { surprise: { dc: 999 }, encounter: { dc: 999 }, world: { dc: 999 } }, // engines silenced
    tickCount: 0,
    threads: [{ name: 'Kaiser trains a counter', desc: 'a counter to Jovan', rung: 0, maxRung: 5, bias: 13, pace: 1, lastTickAt: 0, done: false }] };
  let hints = 0, completed = false;
  for (let i = 0; i < 12 && !completed; i++) {
    injections.ARBITER_OUTCOME_EVENT = '';
    await I([{ is_user: true, mes: 'we talk about homework', send_date: 't' + i }], 0, () => {}, 'normal');
    if (injections.ARBITER_OUTCOME_EVENT) hints++;
    completed = md.arbiter.threads[0].done === true;
  }
  ok('thread climbed its ladder to completion (bias +13, pace 1)', completed);
  ok('background hints were injected along the way', hints >= 2);
  ok('completion hint mentions coming to a head', completed && Object.values(injections).join(' ').includes('comes to a head'));

  // 4. Tick suppressed on swipe; replay identical
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
    engines: { surprise: { dc: 1 }, encounter: { dc: 999 }, world: { dc: 999 } }, tickCount: 0, threads: [] };
  await I([{ is_user: true, mes: 'quiet evening', send_date: 's1' }], 0, () => {}, 'normal');
  const surpriseDCAfter = md.arbiter.engines.surprise.dc;
  const text1 = injections.ARBITER_OUTCOME_EVENT;
  await I([{ is_user: true, mes: 'quiet evening', send_date: 's1' }], 0, () => {}, 'swipe');
  ok('swipe does not re-tick engines', md.arbiter.engines.surprise.dc === surpriseDCAfter);
  ok('swipe replays the same background beat', !!text1 && injections.ARBITER_OUTCOME_EVENT === text1);

  // 5. Edited resend rewinds world state then re-ticks exactly once
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
    engines: { surprise: { dc: 999 }, encounter: { dc: 999 }, world: { dc: 999 } }, tickCount: 0,
    threads: [{ name: 'X', desc: '', rung: 0, maxRung: 8, bias: 13, pace: 1, lastTickAt: 0, done: false }] };
  await I([{ is_user: true, mes: 'I wander the market', send_date: 'w1' }], 0, () => {}, 'normal');
  const r1 = md.arbiter.threads[0].rung;
  ok('first tick advanced (1-2 rungs)', r1 >= 1 && r1 <= 2);
  await I([{ is_user: true, mes: 'I wander the docks instead', send_date: 'w1' }], 0, () => {}, 'normal');
  const r2 = md.arbiter.threads[0].rung;
  ok('edited resend rewound then re-ticked once (no stacking)', r2 >= 1 && r2 <= 2 && md.arbiter.tickCount === 1);

  console.log(fails === 0 ? 'ALL V5 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
