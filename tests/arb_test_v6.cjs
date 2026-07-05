const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {}; const injections = {}; let settings = { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, eventEngine: true } };
global.SillyTavern = { getContext: () => ({ extensionSettings: settings, chatMetadata: md, name1: 'Jovan', setExtensionPrompt(k,v){ injections[k]=v; }, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine; const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// 1. Thinking-model JSON: reasoning with stray braces before the real object
const cands = E.extractJsonCandidates('Let me think {about} this... plan: {"a":1} ok final: {"check": false}', 5);
ok('candidate scanner survives stray braces and finds all objects', cands.length === 2 && cands[1].check === false);
ok('reasoning-wrapped JSON yields a usable candidate', cands.some(c => c.check === false));

// 2. New-NPC stranger hooks exist in defaults
ok('encounter defaults include stranger/beggar spawner', E.ENCOUNTER_TYPES.some(t => /beggar/i.test(t)));

(async () => {
  // 3. Encounter fires with tone guard + no-forced-combat wording
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
    engines: { surprise: { dc: 999 }, encounter: { dc: 1 }, world: { dc: 999 } }, tickCount: 0, threads: [] };
  await I([{ is_user: true, mes: 'a slow afternoon passes', send_date: 'q1' }], 0, () => {}, 'normal');
  const hint = String(injections.ARBITER_OUTCOME_EVENT || '');
  ok('encounter hint fired', hint.includes('[ARBITER EVENT'));
  ok('hint is tone-guarded (no forced combat)', hint.includes('no forced combat'));

  // 4. Encounter table override respected
  settings.arbiter.encounterTypes = 'a quiet omen only';
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
    engines: { surprise: { dc: 999 }, encounter: { dc: 1 }, world: { dc: 999 } }, tickCount: 0, threads: [] };
  await I([{ is_user: true, mes: 'another slow afternoon', send_date: 'q2' }], 0, () => {}, 'normal');
  ok('custom encounter table is used', String(injections.ARBITER_OUTCOME_EVENT).includes('a quiet omen only'));
  settings.arbiter.encounterTypes = '';

  // 5. Turn counter increments on fresh normal turns only
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
    engines: { surprise: { dc: 999 }, encounter: { dc: 999 }, world: { dc: 999 } }, tickCount: 0, threads: [] };
  await I([{ is_user: true, mes: 'turn one', send_date: 'c1' }], 0, () => {}, 'normal');
  await I([{ is_user: true, mes: 'turn one', send_date: 'c1' }], 0, () => {}, 'swipe');
  await I([{ is_user: true, mes: 'turn two', send_date: 'c2' }], 0, () => {}, 'normal');
  ok('turnCount counts fresh normal turns, not swipes', md.arbiter.turnCount === 2);

  console.log(fails === 0 ? 'ALL V6 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
