const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {};
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, eventEngine: false } }, chatMetadata: md, name1: 'Jovan', setExtensionPrompt(){}, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } }) };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
// Gate-declined turns commit a no-check cache; gate-passed turns reach the (unavailable) referee and commit nothing.
(async () => {
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null };
  await I([{ is_user: true, mes: 'I move and use my magic to explode the ground on his right', send_date: 'g1' }], 0, () => {}, 'normal');
  ok("the user's exact magic sentence passes the gate", md.arbiter.cache === null);
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null };
  await I([{ is_user: true, mes: 'I unleash a barrage at the Frame and rush to flank it', send_date: 'g2' }], 0, () => {}, 'normal');
  ok('mecha/AoE vocabulary passes the gate', md.arbiter.cache === null);
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null };
  await I([{ is_user: true, mes: 'lovely weather today, is the festival still on?', send_date: 'g3' }], 0, () => {}, 'normal');
  ok('chatter still declines (no-check verdict committed)', md.arbiter.cache && md.arbiter.cache.tier === null);
  console.log(fails === 0 ? 'ALL V8 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
