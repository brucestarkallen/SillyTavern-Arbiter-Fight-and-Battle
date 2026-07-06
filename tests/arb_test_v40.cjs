// v0.24.0: proportionate consequences — a SUCCESS-WITH-COST is a small tax, not
// a reversal, and must not blow a secret/cover the player deliberately protected.
// Reported symptom: on a secret power use scored SUCCESS_COST, the storyteller
// treated "attention" as license to fully expose the player's concealed ability.
// A mild win-tier should never spend the player's most valuable hidden asset;
// full exposure is a real-failure beat.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { composure: true, composureMax: 6, preset: 'realistic', tieBand: 0.06 } }, chatMetadata: {}, setExtensionPrompt(){}, eventSource: { on(){} }, event_types: {} }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// ── Tier text: proportionate + protects concealment ──
const sc = E.TIERS.SUCCESS_COST.text.toLowerCase();
ok('SUCCESS_COST frames the cost as proportionate (a tax, not a reversal)', /proportionate/.test(sc) && /reversal/.test(sc) && /small tax/.test(sc));
ok('SUCCESS_COST forbids blowing a secret/cover/concealment on a win', /secret|cover|conceal/.test(sc) && /do not/.test(sc));
ok('SUCCESS_COST routes full exposure to a worse result (setback-or-worse)', /setback/.test(sc));

// ── Duel directive carries the concealment guard on a continuing exchange ──
const mkMeta = (tier) => ({ duel: { active: true, over: false, victor: null, round: 3, domain: 'melee', scaleMismatch: 0,
  player: { name: 'Jovan', rating: 7, poise: 4, maxPoise: 5, injuries: 0, momentum: 0.5, opening: false },
  opp: { name: 'Piers', rating: 6, poise: 3, maxPoise: 5, injuries: 0, momentum: 0, opening: false } } });
const adj = { action: 'secretly disrupt his cast', circumstance: 1 };
const dir = E.buildDuelDirective(mkMeta('SUCCESS_COST'), adj, { tier: 'SUCCESS_COST', opening: false });
ok('duel directive tells the storyteller to keep consequences proportionate', /proportionate/i.test(dir));
ok('duel directive protects a secret/under-cover action from auto-exposure', /secret|under cover/i.test(dir) && /do not blow|does not automatically expose/i.test(dir));

// A clean win (no cost) still shouldn't invent exposure — the guard is present regardless of tier.
const dirWin = E.buildDuelDirective(mkMeta('SUCCESS'), adj, { tier: 'SUCCESS', opening: false });
ok('the concealment guard is present on a clean SUCCESS too', /secret|under cover/i.test(dirWin));

// ── A genuine FAILURE is still allowed to expose (we only protect wins) ──
ok('FAILURE text does NOT promise secret protection (failure can legitimately expose)', !/do not blow a secret/i.test(E.TIERS.FAILURE.text));

console.log(fails === 0 ? 'ALL V40 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
