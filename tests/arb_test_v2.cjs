const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq();
global.jQuery = () => {};
global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {};
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false } }, chatMetadata: md, name1: 'Player', setExtensionPrompt(){}, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0;
const ok = (name, cond) => { console.log(name + ':', cond ? 'OK' : 'FAIL'); if (!cond) fails++; };

// 1. Preset structure + ordering of disaster widths at P=0.5
const anal = (P, m) => {
  const F = 1 - P;
  const dec = P * (0.05 + 0.15 * P) * m.dec;
  const cost = Math.min(P * (0.15 + 0.35 * F) * m.cost, Math.max(0, P - dec));
  const sb = F * (0.30 + 0.20 * P) * m.sb;
  const dis = Math.min(F * (0.03 + 0.12 * F) * m.dis, Math.max(0, F - sb));
  return { dec, cost, sb, dis, cleanS: P - dec - cost, cleanF: F - sb - dis };
};
const g = anal(0.5, E.PRESETS.gritty.mods), r = anal(0.5, E.PRESETS.realistic.mods), h = anal(0.5, E.PRESETS.heroic.mods);
ok('preset disaster ordering heroic<realistic<gritty', h.dis < r.dis && r.dis < g.dis);
ok('heroic player edge +1', E.PRESETS.heroic.bonus === 1);

// 2. Monte Carlo per preset: empirical matches analytic, partitions sum to 1
for (const [name, p] of Object.entries(E.PRESETS)) {
  const P = 0.64;
  const a = anal(P, p.mods);
  const c = { DECISIVE: 0, SUCCESS: 0, SUCCESS_COST: 0, SETBACK: 0, FAILURE: 0, DISASTER: 0 };
  const N = 300000;
  for (let i = 0; i < N; i++) c[E.sliceOutcome(P, Math.random(), p.mods)]++;
  const exp = { DECISIVE: a.dec, SUCCESS: a.cleanS, SUCCESS_COST: a.cost, SETBACK: a.sb, FAILURE: a.cleanF, DISASTER: a.dis };
  let good = true;
  for (const k of Object.keys(c)) if (Math.abs(c[k] / N - exp[k]) > 0.005) good = false;
  ok('preset ' + name + ' MC matches analytic', good);
}

// 3. Exchange effects
const fresh = () => ({ poise: 5, maxPoise: 5, injuries: 0, momentum: 0, opening: false });
let x = E.applyExchangeEffects(fresh(), fresh(), 'DECISIVE');
ok('DECISIVE: opp -2 + injury, self momentum', x.opp.poise === 3 && x.opp.injuries === 1 && x.player.momentum === 0.5 && !x.over);
x = E.applyExchangeEffects(fresh(), fresh(), 'SETBACK');
ok('SETBACK: self -1, opening granted, opp momentum', x.player.poise === 4 && x.player.opening === true && x.opp.momentum === 0.5 && x.player.momentum === 0);
x = E.applyExchangeEffects(fresh(), fresh(), 'SUCCESS_COST');
ok('SUCCESS_COST: opp -1, self -0.5, self momentum', x.opp.poise === 4 && x.player.poise === 4.5 && x.player.momentum === 0.5);
x = E.applyExchangeEffects({ poise: 2, maxPoise: 5, injuries: 0, momentum: 0 }, fresh(), 'DISASTER');
ok('DISASTER at low poise: self injured + defeat', x.player.poise === 0 && x.player.injuries === 1 && x.over && x.victor === 'opp');
x = E.applyExchangeEffects({ poise: 0.5, maxPoise: 5, injuries: 0, momentum: 0 }, { poise: 0.5, maxPoise: 5, injuries: 0, momentum: 0 }, 'SUCCESS_COST');
ok('double-KO tiebreak goes to exchange winner', x.over && x.victor === 'player');
// momentum cap across consecutive wins
let pl = fresh(), op = fresh();
for (let i = 0; i < 3; i++) { const y = E.applyExchangeEffects(pl, op, 'SUCCESS'); pl = y.player; op = y.opp; }
ok('momentum caps at 1', pl.momentum === 1);
ok('poiseWord bands', E.poiseWord(5,5) === 'fresh' && E.poiseWord(3,5) === 'pressed' && E.poiseWord(1.5,5) === 'staggered' && E.poiseWord(0.5,5) === 'breaking');

// 4. Interceptor: concluded duel clears on a new message (before gate)
(async () => {
  const I = globalThis.arbiterInterceptor;
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: { key: 'zzz', sendDate: 'old', directive: 'X', tier: 'SUCCESS', duelSnapshot: null },
    duel: { active: true, over: true, victor: 'player', round: 4, domain: 'melee', player: { name: 'P', rating: 5, poise: 2, maxPoise: 5, injuries: 0, momentum: 0 }, opp: { name: 'O', rating: 5, poise: 0, maxPoise: 5, injuries: 0, momentum: 0 } } };
  await I([{ is_user: true, mes: 'lovely weather today', send_date: 'new' }], 0, () => {}, 'normal');
  ok('concluded duel cleared on new message', md.arbiter.duel === null);

  // 5. Snapshot restore on same-message re-roll (edit): duel rewinds before adjudication
  const snap = { active: true, over: false, victor: null, round: 2, domain: 'melee', player: { name: 'P', rating: 6, poise: 3.5, maxPoise: 5, injuries: 0, momentum: 0.5, opening: false }, opp: { name: 'O', rating: 6, poise: 2, maxPoise: 5, injuries: 1, momentum: 0, opening: false } };
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null,
    cache: { key: 'oldkey', sendDate: 'd7', directive: 'X', tier: 'SUCCESS', duelSnapshot: JSON.parse(JSON.stringify(snap)) },
    duel: { active: true, over: false, victor: null, round: 3, domain: 'melee', player: { name: 'P', rating: 6, poise: 1, maxPoise: 5, injuries: 1, momentum: 0, opening: false }, opp: { name: 'O', rating: 6, poise: 1, maxPoise: 5, injuries: 1, momentum: 0.5, opening: false } } };
  await I([{ is_user: true, mes: 'I try a completely different feint', send_date: 'd7' }], 0, () => {}, 'regenerate');
  ok('duel rewound to snapshot on edited re-roll', md.arbiter.duel && md.arbiter.duel.round === 2 && md.arbiter.duel.player.poise === 3.5);

  console.log(fails === 0 ? 'ALL V2 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('THREW', e); process.exit(1); });
