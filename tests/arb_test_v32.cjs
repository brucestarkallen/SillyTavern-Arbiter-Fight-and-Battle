// v0.15.1: fast-mode recovery. Fast-mode duels had no LLM classifier, so a
// disengage-to-heal was resolved as an ATTACK (incoherent; on a good roll the
// "heal" dealt free damage — a tilt toward the player). looksLikeRecovery is a
// conservative local detector; this suite proves (A) the detector both ways,
// (B) the fast-mode duel wiring routes recovery vs attack correctly, and (C)
// scale mismatch still feeds the fast-mode delta (read off the duel internally).
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {}; let lastDirective = '';
let settings = { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, eventEngine: false,
  profileId: 'MAIN', autoDuel: true, autoBattle: false, autoWar: false, autoSeed: false,
  mode: 'fast', preset: 'realistic', tieBand: 0, duelPoise: 5, defaultRating: 5, ctxMsgs: 6,
  composure: false } };
let ctxObj = { extensionSettings: settings, chatMetadata: md, name1: 'Jovan', name2: 'Narrator',
  ConnectionManagerRequestService: { sendRequest: async () => '{}' },
  setExtensionPrompt(key, text){ if (key === 'ARBITER_OUTCOME') lastDirective = text || ''; },
  extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 },
  eventSource: { on: () => {} }, event_types: {} };
global.SillyTavern = { getContext: () => ctxObj };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// Fresh, full-poise active duel so a single exchange never ends it (isolates
// first-exchange behaviour). scaleMismatch is set per-trial.
const freshDuel = (scale) => { md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
  duel: { active: true, over: false, round: 1, domain: 'melee', scaleMismatch: scale,
    player: { name: 'Jovan', rating: 5, poise: 20, maxPoise: 20, injuries: 0, momentum: 0, opening: false },
    opp:    { name: 'Kael',  rating: 5, poise: 20, maxPoise: 20, injuries: 0, momentum: 0, opening: false } } }; };

let seq = 0;
const send = async (mes) => { seq++; lastDirective = ''; await I([{ is_user: true, name: 'Jovan', mes, send_date: 'm' + seq }], 0, () => {}, 'normal'); return lastDirective; };
const isWin = (tier) => tier === 'DECISIVE' || tier === 'SUCCESS' || tier === 'SUCCESS_COST';

(async () => {
  // ── A. Detector, both directions ──
  const recover = [
    'I fall back and drink a healing potion.',
    'I disengage to catch my breath.',
    'I heal myself with a quick spell.',
    'I steady myself and regain my composure.',
    'I bandage my wound.',
    'I withdraw to a safe corner.',
    'I take a moment to recover.',
    'I quaff an elixir.',
  ];
  const attack = [
    'I slash at Kael, then fall back to breathe.',   // heal-and-strike still contests → attack
    'I retreat and fire my pistol as I go.',          // contesting → attack
    'I attack the knight.',
    'I parry and riposte.',
    'I charge in swinging.',
    'I catch my breath, filling my lungs, then strike.', // offence present → attack
    'I lunge forward.',
  ];
  let dBad = 0;
  for (const m of recover) if (!E.looksLikeRecovery(m)) { console.log('  detector MISS:', m); dBad++; }
  for (const m of attack)  if (E.looksLikeRecovery(m))  { console.log('  detector FALSEPOS:', m); dBad++; }
  ok('recovery detector correct on all cases both ways', dBad === 0);
  // Dialogue is stripped (like the gate): a spoken heal never triggers.
  ok('spoken heal in quotes does not trigger recovery', E.looksLikeRecovery('"I will heal you!" I shout, then I stab him.') === false);

  // ── B. Fast-mode duel wiring: recovery vs attack take different paths ──
  freshDuel(0);
  let dir = await send('I disengage and drink a healing potion, catching my breath.');
  ok('fast-mode recovery routes to the recovery directive', /disengages to recover/.test(dir));
  ok('fast-mode recovery is NOT an attack exchange', !/Exchange result:/.test(dir));
  // Recovery heals the player. Against a real threat the free counter can
  // outweigh a poor heal (by design — no risk-free heal loop), so to prove a
  // heal actually fires we isolate it against a weak foe (rating 2 → no
  // counter); the heal is then always a strict net gain.
  md.arbiter.duel.opp.rating = 2; md.arbiter.duel.player.poise = 3; md.arbiter.duel.round = 2;
  const before = md.arbiter.duel.player.poise;
  await send('I fall back to bind my wounds and steady myself.');
  ok('recovery raised the player\'s poise vs a weak foe (a heal happened)', md.arbiter.duel.player.poise > before);

  freshDuel(0);
  dir = await send('I strike at Kael with my blade.');
  ok('fast-mode attack routes to an exchange directive', /Exchange result:/.test(dir));
  ok('fast-mode attack is NOT a recovery', !/disengages to recover/.test(dir));

  // ── C. Scale mismatch still feeds the fast-mode delta (read off the duel) ──
  // Equal ratings; only scaleMismatch differs. At -4 the player should mostly
  // lose, at +4 mostly win — proving fast mode honours the dimension.
  const N = 400;
  let winsDown = 0, winsUp = 0;
  for (let i = 0; i < N; i++) { freshDuel(-4); await send('I strike at Kael.'); if (isWin(md.arbiter.log[0].tier)) winsDown++; }
  for (let i = 0; i < N; i++) { freshDuel(+4); await send('I strike at Kael.'); if (isWin(md.arbiter.log[0].tier)) winsUp++; }
  const rDown = winsDown / N, rUp = winsUp / N;
  console.log('  scale -4 win rate:', rDown.toFixed(3), '| scale +4 win rate:', rUp.toFixed(3));
  ok('scale mismatch -4 suppresses the player win rate in fast mode', rDown < 0.25);
  ok('scale mismatch +4 lifts the player win rate in fast mode', rUp > 0.75);
  ok('scale mismatch produces the expected large swing in fast mode', rUp - rDown > 0.55);

  // ── D. Source guarantee: composure + scale feed the shared duel delta, and
  //    fast mode routes through it (so both dimensions apply without args). ──
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
  ok('duel delta includes composure and scale mismatch', /const delta = clamp\(effP - effO \+ circumstance \+ \(duel\.scaleMismatch \|\| 0\) \+ compPen - oppCompPen \+ preset\.bonus/.test(src));
  ok('fast-mode duel routes through resolveDuelExchange with a detected moveKind', /looksLikeRecovery\(lastUser\.mes\) \? 'recover' : 'attack'[\s\S]{0,120}resolveDuelExchange\(meta, 0, mk\)/.test(src));

  console.log(fails === 0 ? 'ALL V32 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
