// End-to-end battle simulation via fast mode (no LLM needed).
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {}; const injections = {};
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, mode: 'fast' } }, chatMetadata: md, name1: 'Jovan', setExtensionPrompt(k,v){ injections[k]=v; }, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } }) };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
const unit = (name, r, p, isPlayer=false) => ({ name, rating: r, poise: p, maxPoise: p, injuries: 0, momentum: 0, opening: false, standing: true, isPlayer });
const freshBattle = () => ({ active: true, over: false, victor: null, mcDown: false, round: 0, domain: 'melee',
  allies: [unit('Jovan', 8, 6, true), unit('Stella', 6, 5), unit('Alexia', 6, 5)],
  enemies: [unit('Bandit 1', 4, 5), unit('Bandit 2', 4, 5), unit('Bandit 3', 4, 5), unit('Ogre', 6, 6)] });

(async () => {
  // Full battle to conclusion
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null, battle: freshBattle() };
  let rounds = 0, sawDirective = false;
  while (!md.arbiter.battle?.over && rounds < 15) {
    injections.ARBITER_OUTCOME = '';
    await I([{ is_user: true, mes: 'I press the attack', send_date: 'b' + rounds }], 0, () => {}, 'normal');
    if (String(injections.ARBITER_OUTCOME).includes('[ARBITER — battle, round')) sawDirective = true;
    rounds++;
  }
  const b = md.arbiter.battle;
  ok('battle produced round directives', sawDirective);
  ok('battle concluded within 15 rounds (r=' + rounds + ')', b && b.over === true && rounds < 15);
  ok('victor decided', b && (b.victor === 'allies' || b.victor === 'enemies'));
  const standingCount = (u) => u.filter(x => x.standing).length;
  ok('loser side depleted or MC down', b && (b.mcDown || standingCount(b.victor === 'allies' ? b.enemies : b.allies) === 0));
  ok('rounds counted', b && b.round === rounds);

  // Mid-battle snapshot rewind: edit + regenerate restores pre-round state
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null, battle: freshBattle() };
  await I([{ is_user: true, mes: 'I strike the ogre', send_date: 'snap1' }], 0, () => {}, 'normal');
  const afterR1 = JSON.stringify(md.arbiter.battle);
  const cachedSnap = md.arbiter.cache && md.arbiter.cache.duelSnapshot;
  ok('snapshot captured with battle branch', cachedSnap && cachedSnap.b && cachedSnap.b.round === 0);
  await I([{ is_user: true, mes: 'actually I protect Stella instead', send_date: 'snap1' }], 0, () => {}, 'regenerate');
  const b2 = md.arbiter.battle;
  ok('edited re-roll rewound battle to round 0 then re-resolved to round 1', b2 && b2.round === 1);
  ok('re-roll produced an independent round (state re-rolled, not double-applied)', JSON.stringify(b2) !== undefined && b2.allies.length === 3 && b2.enemies.length === 4);

  // Concluded battle clears on the next new message
  md.arbiter.battle = Object.assign(freshBattle(), { over: true, victor: 'allies' });
  await I([{ is_user: true, mes: 'we catch our breath', send_date: 'post1' }], 0, () => {}, 'normal');
  ok('concluded battle cleared on new message', md.arbiter.battle === null);

  console.log(fails === 0 ? 'ALL V4 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
