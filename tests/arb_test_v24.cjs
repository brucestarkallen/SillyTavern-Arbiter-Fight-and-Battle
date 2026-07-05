// v0.12.0: growth-aware refresh — auto ratings rise with the story; hand-edits locked.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {}; let respObj = '{}'; let seedResp = null;
let settings = { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, eventEngine: false, profileId: 'p1', autoDuel: true, autoSeed: true, mode: 'adjudicated', preset: 'realistic', tieBand: 0, duelPoise: 5, defaultRating: 5, ctxMsgs: 6, seedMemoryK: 60, seedTranscriptK: 80, seedOutTokens: 4000, autoSeedEvery: 50 } };
let ctxObj = { extensionSettings: settings, chatMetadata: md, name1: 'Jovan', name2: 'Narrator',
  ConnectionManagerRequestService: { sendRequest: async (pid, messages) => {
    const sys = messages[0].content;
    if (/Rating guide|every named CHARACTER/i.test(sys)) return seedResp || '{"actors":{}}';
    return respObj;
  } },
  setExtensionPrompt(){}, extension_prompt_types:{IN_CHAT:1}, extension_prompt_roles:{SYSTEM:0} };
global.SillyTavern = { getContext: () => ctxObj };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// Helper: force an auto-seed refresh by ending a generation with the refresh window elapsed.
async function autoSeedNow() {
  // maybeAutoSeed runs on GENERATION_ENDED; the harness lacks the event bus, so
  // we validate the MERGE directly by requiring the module and calling seedSheet
  // through the same path the interceptor's background seed uses on an unrated duel.
}

(async () => {
  ctxObj.chat = [{is_user:false,name:'Narrator',mes:'Kael has trained relentlessly and now moves like a master.'},{is_user:true,name:'Jovan',mes:'I spar Kael.'},{is_user:false,name:'Narrator',mes:'Kael is far stronger.'},{is_user:true,name:'Jovan',mes:'Indeed.'}];

  // Character on the sheet as AUTO melee-4; a growth seed says melee-7. Refresh should RAISE it.
  md.arbiter = { sheet: { actors: { 'Kael': { default: 4, domains: { melee: 4 }, _auto: true } } }, log: [], oneShot: null, cache: null, turnCount: 60, lastAutoSeedAt: 0 };
  seedResp = '{"actors":{"Kael":{"default":7,"domains":{"melee":7}}}}';
  // Trigger the background seed via an unrated-foe duel against someone else so seedSheet runs:
  respObj = JSON.stringify({ check:true, action:'strike', domain:'melee', actor:'Jovan', opposition_kind:'actor', opposition:'Kael', circumstance:0, duel_start:'Kael', opponent_rating:null });
  // Kael IS on the sheet, so no background seed fires. Instead call the seeder path used by auto-seed:
  // We reach seedSheet by faking the GENERATION_ENDED-driven maybeAutoSeed is not exposed; so drive
  // seedSheet through the module's registered pipeline by invoking a *manual* seed (o.auto=false won't test growth).
  // Simplest robust route: temporarily rate a NEW unrated foe to force seedSheet({auto:true}) which
  // processes the WHOLE actors object including Kael's growth.
  md.arbiter.sheet.actors['Newcomer'] = undefined; delete md.arbiter.sheet.actors['Newcomer'];
  respObj = JSON.stringify({ check:true, action:'strike newcomer', domain:'melee', actor:'Jovan', opposition_kind:'actor', opposition:'Newcomer', circumstance:0, duel_start:'Newcomer', opponent_rating:null });
  seedResp = '{"actors":{"Kael":{"default":7,"domains":{"melee":7}},"Newcomer":{"default":5,"domains":{"melee":5}}}}';
  await I([{is_user:true,name:'Jovan',mes:'I attack a Newcomer', send_date:'g1'}], 0, () => {}, 'normal');
  await new Promise(r=>setTimeout(r,60)); // let background seed settle
  ok('AUTO rating RAISED by growth (Kael 4 -> 7)', md.arbiter.sheet.actors.Kael.default === 7 && md.arbiter.sheet.actors.Kael.domains.melee === 7);

  // Hand-edited entry (no _auto) must NOT be changed by a refresh, even downward or upward.
  md.arbiter = { sheet: { actors: { 'Boss': { default: 9, domains: { melee: 9 } } } }, log: [], oneShot: null, cache: null, turnCount: 60, lastAutoSeedAt: 0 };
  seedResp = '{"actors":{"Boss":{"default":3,"domains":{"melee":3}},"Foe2":{"default":5,"domains":{"melee":5}}}}';
  respObj = JSON.stringify({ check:true, action:'strike foe2', domain:'melee', actor:'Jovan', opposition_kind:'actor', opposition:'Foe2', circumstance:0, duel_start:'Foe2', opponent_rating:null });
  await I([{is_user:true,name:'Jovan',mes:'I attack Foe2', send_date:'g2'}], 0, () => {}, 'normal');
  await new Promise(r=>setTimeout(r,60));
  ok('HAND-EDITED rating LOCKED (Boss stays 9, not lowered to 3)', md.arbiter.sheet.actors.Boss.default === 9 && md.arbiter.sheet.actors.Boss.domains.melee === 9);

  // Growth never LOWERS an auto rating either (only raises).
  md.arbiter = { sheet: { actors: { 'Kael': { default: 7, domains: { melee: 7 }, _auto: true } } }, log: [], oneShot: null, cache: null, turnCount: 120, lastAutoSeedAt: 0 };
  seedResp = '{"actors":{"Kael":{"default":5,"domains":{"melee":5}},"Foe3":{"default":5,"domains":{"melee":5}}}}';
  respObj = JSON.stringify({ check:true, action:'strike foe3', domain:'melee', actor:'Jovan', opposition_kind:'actor', opposition:'Foe3', circumstance:0, duel_start:'Foe3', opponent_rating:null });
  await I([{is_user:true,name:'Jovan',mes:'I attack Foe3', send_date:'g3'}], 0, () => {}, 'normal');
  await new Promise(r=>setTimeout(r,60));
  ok('AUTO rating never lowered by refresh (Kael stays 7)', md.arbiter.sheet.actors.Kael.default === 7);

  console.log(fails === 0 ? 'ALL V24 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
