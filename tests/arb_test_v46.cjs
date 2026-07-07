// v0.26.3 — findActor loose match must be WHOLE-WORD, never bare substring, so a
// short name resolves to the right roster entry ("Kaiser" -> "Kaiser von Adler")
// but a distinct name never grabs the wrong actor's rating ("Ana" != "Anakin").
// Also sanity-checks the max-performance default settings.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };
global.SillyTavern = { getContext: () => ({ name1: 'Jovan', extensionSettings: { arbiter: {} }, chatMetadata: {}, setExtensionPrompt(){}, eventSource: { on(){} }, event_types: {} }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log((c ? '  OK  ' : ' FAIL ') + n); if (!c) fails++; };
const meta = { sheet: { actors: {
  'Kaiser von Adler': { default: 8, domains: { melee: 8 } },
  'Anakin': { default: 6, domains: { melee: 6 } },
  'Piers Halloway': { default: 5, domains: { melee: 5 } },
} } };

ok("exact match resolves", E.findActor(meta, 'Anakin')?.default === 6);
ok("short name resolves to full name by shared word ('Kaiser' -> 'Kaiser von Adler')", E.findActor(meta, 'Kaiser')?.default === 8);
ok("full name resolves to short entry by shared word ('Piers' -> 'Piers Halloway')", E.findActor(meta, 'Piers')?.default === 5);
ok("distinct name does NOT substring-match ('Ana' must NOT return 'Anakin')", E.findActor(meta, 'Ana') === null);
ok("distinct name does NOT substring-match ('Adler' alone -> 'Kaiser von Adler' via shared word is OK)", E.findActor(meta, 'Adler')?.default === 8);
ok("unrelated name returns null ('Eugeo')", E.findActor(meta, 'Eugeo') === null);
ok("empty/garbage returns null", E.findActor(meta, '') === null && E.findActor(meta, null) === null);

// Real consequence: an unseeded 'Ana' must NOT inherit 'Anakin's sheet rating.
const m2 = { sheet: { actors: { 'Anakin': { default: 9, domains: { melee: 9 } } } } };
E.startDuel(m2, 'Jovan', 'Ana', 'melee', 4, 0); // Ana is unseeded; estimate 4
ok("unseeded 'Ana' uses its estimate (4), NOT Anakin's sheet rating (9)", m2.duel.opp.rating === 4 && m2.duel.opp.estimated === true);

// Default-settings sanity (max-performance profile).
const D = E.getDefaults();
ok("default: adjudicator reads memory", D.adjIncludeMemory === true);
ok("default: adjudicator reads character card", D.adjIncludeCard === true);
ok("default: full immediate window (ctxMsgs 10)", D.ctxMsgs === 10);
ok("default: generous check timeout (>=12s)", D.timeoutMs >= 12000);
ok("default: plug-and-play autos on", D.autoDuel && D.autoBattle && D.autoWar && D.autoSeed && D.eventEngine);
ok("default: smart adjudicated mode + fair realistic preset", D.mode === 'adjudicated' && D.preset === 'realistic');

console.log(fails === 0 ? '\nALL v46 TESTS PASSED' : '\n' + fails + ' FAILURES'); process.exit(fails ? 1 : 0);
