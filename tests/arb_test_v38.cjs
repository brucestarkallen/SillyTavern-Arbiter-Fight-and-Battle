// v0.21.0: exchange damage scales with the margin of victory.
// Before, every hit stripped a flat poise amount regardless of how lopsided the
// exchange was — so a 7-melee brawler dismantling a 5-mage only won MORE OFTEN,
// never HARDER, forcing the fiction to pretend the mage was tough ("gets up like
// a hulk"). Now a dominant blow lands proportionally harder (capped), symmetric
// for either side, and unchanged for close fights so the audited even-odds
// attrition economy is preserved.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { composure: true, composureMax: 6 } }, chatMetadata: {}, setExtensionPrompt(){}, eventSource: { on(){} }, event_types: {} }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
const oppPoiseAfter = (tier, margin, start) => E.applyExchangeEffects({ poise: start }, { poise: start }, tier, margin).opp.poise;
const selfPoiseAfter = (tier, margin, start) => E.applyExchangeEffects({ poise: start }, { poise: start }, tier, margin).player.poise;

// ── Close fights unchanged (SUCCESS = 1.5, DECISIVE = 2) ──
ok('even fight: SUCCESS still strips 1.5 (5 → 3.5)', oppPoiseAfter('SUCCESS', 0, 5) === 3.5);
ok('modest edge (margin 2): still no bonus (5 → 3.5)', oppPoiseAfter('SUCCESS', 2, 5) === 3.5);
ok('even fight: DECISIVE still strips 2 (5 → 3)', oppPoiseAfter('DECISIVE', 0, 5) === 3);

// ── Dominance hits harder ──
ok('Δ+4 SUCCESS strips 3.5 (5 → 1.5) — the mage is wrecked, not chipped', oppPoiseAfter('SUCCESS', 4, 5) === 1.5);
ok('Δ+4 DECISIVE strips 4 (5 → 1)', oppPoiseAfter('DECISIVE', 4, 5) === 1);
ok('Δ+6 SUCCESS strips 4.5 (5 → 0.5)', oppPoiseAfter('SUCCESS', 6, 5) === 0.5);
ok('bonus is capped: Δ+20 SUCCESS same as Δ+5 (both +3)', oppPoiseAfter('SUCCESS', 20, 5) === oppPoiseAfter('SUCCESS', 5, 5));

// ── A dominant decisive blow can FINISH ──
let fin = E.applyExchangeEffects({ poise: 5 }, { poise: 5 }, 'DECISIVE', 6); // 2 + cap 3 = 5
ok('Δ+6 DECISIVE breaks a fresh 5-poise foe (poise 0)', fin.opp.poise <= 0 && fin.over === true && fin.victor === 'player');

// ── Symmetric: a superior foe wrecks the player just as hard ──
ok('losing to a Δ-4 superior foe strips the PLAYER 3.5 (FAILURE 1.5 + 2)', selfPoiseAfter('FAILURE', -4, 5) === 1.5);
ok('symmetry holds: player loss at -4 mirrors opp loss at +4', selfPoiseAfter('FAILURE', -4, 5) === oppPoiseAfter('SUCCESS', 4, 5) - 0 && selfPoiseAfter('FAILURE', -4, 5) === 1.5);
ok('close loss (margin -2): no extra self damage (FAILURE = 1.5)', selfPoiseAfter('FAILURE', -2, 5) === 3.5);

// ── Ties never scale (neither side dominates) ──
let trade = E.applyExchangeEffects({ poise: 5 }, { poise: 5 }, 'TRADE', 8);
ok('TRADE ignores margin (both bleed base 1)', trade.player.poise === 4 && trade.opp.poise === 4);

// ── The winner's OWN poise is untouched by the scaling (only the loser bleeds more) ──
ok('scaling hits the loser, not the winner (player poise intact on a Δ+6 SUCCESS)', selfPoiseAfter('SUCCESS', 6, 5) === 5);

console.log(fails === 0 ? 'ALL V38 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
