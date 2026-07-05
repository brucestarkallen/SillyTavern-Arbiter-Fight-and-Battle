const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {}; let injected = ''; let capturedUser = '';
let respObj = '{"check":false}';
let settings = { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, eventEngine: false, profileId: 'p1', autoDuel: true, autoBattle: true, mode: 'adjudicated' } };
let ctxObj = { extensionSettings: settings, chatMetadata: md, name1: 'Jovan', name2: 'Aurelius',
  ConnectionManagerRequestService: { sendRequest: async (pid, messages) => { capturedUser = messages[1].content; return respObj; } },
  setExtensionPrompt(k,v){ if(k==='ARBITER_OUTCOME') injected = v; }, extension_prompt_types:{IN_CHAT:1}, extension_prompt_roles:{SYSTEM:0} };
global.SillyTavern = { getContext: () => ctxObj };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
const sheet = { actors: { 'Aurelius': { default: 2, domains: {} }, 'Jovan': { default: 8, domains: { ice: 10 } }, 'Dawnshield': { default: 8, domains: { flame: 9 } } } };
(async () => {
  // A) FULLY INVERTED referee output (the live bug): actor=Aurelius, duel_start=Jovan.
  md.arbiter = { sheet: JSON.parse(JSON.stringify(sheet)), log: [], oneShot: null, cache: null };
  respObj = '{"check":true,"action":"order conjured ice-flowers to swarm and cut the opponent","domain":"ice","actor":"Aurelius","opposition_kind":"actor","opposition":"Jovan","circumstance":1,"duel_start":"Jovan"}';
  await I([{ is_user: true, mes: 'You attack, point your sword at him and order the flowers to cut him', send_date: 's1' }], 0, () => {}, 'normal');
  const d = md.arbiter.duel;
  ok('player side is FORCED to the persona (Jovan)', d && d.player.name === 'Jovan');
  ok('player fights with his OWN stats (ice 10)', d && d.player.rating === 10);
  ok('model\'s bogus actor becomes the opponent (Aurelius)', d && d.opp.name === 'Aurelius');
  ok('log actor is the player, not the card', md.arbiter.log.length && md.arbiter.log[0].actor === 'Jovan');
  ok('the referee prompt declares the player identity', capturedUser.includes('<player>') && capturedUser.includes('The player character is "Jovan"'));

  // B) Inverted battle roster: player listed among enemies gets stripped.
  md.arbiter = { sheet: JSON.parse(JSON.stringify(sheet)), log: [], oneShot: null, cache: null };
  respObj = '{"check":true,"action":"sweep the line","domain":"ice","actor":"Jovan","opposition_kind":"tier","opposition":"trained","circumstance":0,"battle_start":{"allies":[],"enemies":["Jovan","Guard x2"]}}';
  await I([{ is_user: true, mes: 'I sweep my vines across the line of guards', send_date: 's2' }], 0, () => {}, 'normal');
  ok('player stripped from enemy roster (2 guards remain)', md.arbiter.battle && md.arbiter.battle.enemies.length === 2 && md.arbiter.battle.enemies.every(u => u.name !== 'Jovan'));

  // C) Correct output is untouched: Dawnshield duel opens normally.
  md.arbiter = { sheet: JSON.parse(JSON.stringify(sheet)), log: [], oneShot: null, cache: null };
  respObj = '{"check":true,"action":"cut Dawnshield with ice roses","domain":"ice","actor":"Jovan","opposition_kind":"actor","opposition":"Dawnshield","circumstance":1,"duel_start":"Dawnshield"}';
  await I([{ is_user: true, mes: 'I command the roses to cut Dawnshield', send_date: 's3' }], 0, () => {}, 'normal');
  ok('normal path unaffected (Jovan vs Dawnshield)', md.arbiter.duel && md.arbiter.duel.player.name === 'Jovan' && md.arbiter.duel.opp.name === 'Dawnshield');

  // D) Seeder source carries the voices block (structural: seedSheet is not
  //    exported, so assert the shipped code builds and instructs it).
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
  ok('seed prompt builds a <voices> block with the storyteller label', src.includes("'<voices>\\n" + "player_character: '") && src.includes('storyteller_label: '));
  ok('seeder is told not to rate the narrator label as an actor', src.includes('Do NOT create an actor entry for it unless'));
  console.log(fails === 0 ? 'ALL V18 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
