// v0.20.0: (1) the Background world's encounter/world tiers now draw from a
// STORY-TAILORED pool the seeder produces (bespoke to the current scene),
// consumed once each, with the generic table only as fallback — the same
// event-driven-seeding smartness applied to the world. (2) World Info now
// prefers SillyTavern's OWN activation engine (getWorldInfoPrompt), which fires
// constant + keyword + VECTORIZED entries, falling back to manual
// constant/keyword activation when that API is absent.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let settings = { arbiter: { enabled: true, timeoutMs: 6000, toastResults: false, eventEngine: true,
  profileId: 'MAIN', autoDuel: true, mode: 'adjudicated', preset: 'realistic', tieBand: 0, duelPoise: 5,
  defaultRating: 5, ctxMsgs: 3, composure: true, composureMax: 6,
  adjIncludeMemory: false, adjIncludeCard: false, adjIncludeWorld: false, adjWorldBooks: '', adjFullChat: false, adjContextK: 40, adjIncludeHidden: false } };
let ctxObj = { extensionSettings: settings, chatMetadata: {}, name1: 'Jovan', name2: 'Kaiser',
  ConnectionManagerRequestService: { sendRequest: async () => '{}' },
  selected_world_info: [], loadWorldInfo: async () => null,
  setExtensionPrompt(){}, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 },
  eventSource: { on: () => {} }, event_types: {}, extensionPrompts: {} };
global.SillyTavern = { getContext: () => ctxObj };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
const s = settings.arbiter;
// Force a specific tier: dc=1 always fires, dc huge never fires.
const engines = (fire) => ({
  world: { dc: fire === 'world' ? 1 : 999999 },
  encounter: { dc: fire === 'encounter' ? 1 : 999999 },
  surprise: { dc: fire === 'surprise' ? 1 : 999999 },
});

(async () => {
  // ── SMART WORLD: seeded pools drive the tiers, consumed once, generic fallback ──
  let m = { tickCount: 5, threads: [], engines: engines('encounter'), encounterSeeds: ['a rain-soaked Vermillion courier with an urgent summons'], worldSeeds: [] };
  let beat = E.backgroundTick(m);
  ok('encounter tier draws the bespoke seeded hook', beat && beat.includes('Vermillion courier'));
  ok('the seeded encounter is consumed after use', m.encounterSeeds.length === 0);

  m = { tickCount: 5, threads: [], engines: engines('encounter'), encounterSeeds: [], worldSeeds: [] };
  beat = E.backgroundTick(m);
  ok('encounter falls back to the generic table when the pool is empty', beat && beat.includes('a hook fires:') && !beat.includes('Vermillion'));

  m = { tickCount: 5, threads: [], engines: engines('world'), encounterSeeds: [], worldSeeds: ['the northern front collapses and refugees flood the capital'] };
  beat = E.backgroundTick(m);
  ok('world tier draws the bespoke seeded shift', beat && beat.includes('northern front collapses'));
  ok('the seeded world event is consumed after use', m.worldSeeds.length === 0);

  m = { tickCount: 5, threads: [], engines: engines('world'), encounterSeeds: [], worldSeeds: [] };
  beat = E.backgroundTick(m);
  ok('world falls back to the generic table when the pool is empty', beat && beat.includes('seismic shift:'));

  // Nothing fires → no beat, pools untouched.
  m = { tickCount: 5, threads: [], engines: engines('none'), encounterSeeds: ['keep me'], worldSeeds: ['keep me too'] };
  beat = E.backgroundTick(m);
  ok('no tier fires → no beat and pools untouched', beat === null && m.encounterSeeds.length === 1 && m.worldSeeds.length === 1);

  // ── VECTOR: prefer ST's engine (covers vectorized entries), else manual ──
  ctxObj.getWorldInfoPrompt = async () => 'CONSTANT spine lore and a vector-matched entry.';
  ok('wiViaEngine returns ST\'s activated string', (await E.wiViaEngine('rooftop kaiser', 8000)) === 'CONSTANT spine lore and a vector-matched entry.');

  ctxObj.getWorldInfoPrompt = async () => ({ worldInfoString: 'WI-CORE', worldInfoBefore: 'BEFORE', worldInfoAfter: 'AFTER' });
  const objRes = await E.wiViaEngine('x', 8000);
  ok('wiViaEngine extracts text from the object return shape', objRes.includes('WI-CORE') && objRes.includes('BEFORE'));

  s.adjIncludeWorld = true;
  ctxObj.getWorldInfoPrompt = async () => 'ENGINE ACTIVATED LORE';
  let blk = await E.collectWorldInfoBlock('scan text', 8000);
  ok('collection prefers the engine and wraps it in <world_info>', blk.includes('<world_info>') && blk.includes('ENGINE ACTIVATED LORE'));

  // Engine yields nothing → manual fallback (constant entry).
  ctxObj.getWorldInfoPrompt = async () => '';
  ctxObj.loadWorldInfo = async (n) => (n === 'TestBook' ? { entries: { 0: { constant: true, key: [], content: 'Manual constant lore.' } } } : null);
  s.adjWorldBooks = 'TestBook';
  blk = await E.collectWorldInfoBlock('anything', 8000);
  ok('falls back to manual activation when the engine is empty', blk.includes('Manual constant lore'));

  // Engine throws → still falls back, no crash.
  ctxObj.getWorldInfoPrompt = async () => { throw new Error('boom'); };
  blk = await E.collectWorldInfoBlock('anything', 8000);
  ok('an engine error falls back to manual without crashing', blk.includes('Manual constant lore'));

  // No engine + no books → empty.
  delete ctxObj.getWorldInfoPrompt; s.adjWorldBooks = ''; ctxObj.selected_world_info = []; ctxObj.loadWorldInfo = async () => null;
  ok('no engine and no books → empty block', (await E.collectWorldInfoBlock('x', 8000)) === '');

  // World OFF short-circuits everything.
  s.adjIncludeWorld = false;
  ctxObj.getWorldInfoPrompt = async () => 'should be ignored';
  ok('world OFF → empty even if the engine would return text', (await E.collectWorldInfoBlock('x', 8000)) === '');

  console.log(fails === 0 ? 'ALL V37 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
