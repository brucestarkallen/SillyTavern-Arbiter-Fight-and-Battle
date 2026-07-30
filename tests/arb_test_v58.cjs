// v0.38 — DEEP AUDIT FIXES.
//  1. OPENINGS ARE SYMMETRIC AT EVERY SCALE. v0.30 made the opponent's
//     fail-forward opening count in DUELS; battles and wars never got it, so
//     the ally side spent openings the enemy side could only accrue. A
//     mirror-matched battle favored the player's side ~57/43.
//  2. A war can never open with zero allied formations: the collapse check
//     read an empty allied line as a broken one and injected a non-negotiable
//     round-1 defeat with no roll.
//  3. The log's wound math is arithmetically TRUE: components are the ones the
//     roll actually used (captured pre-mutation), and anything beyond
//     base−wounds (momentum, an opening) is shown, never silently swallowed.
//  4. Duel RECOVERY rows carry aR/oR/oppLabel (no "undefined vs undefined").
//  5. Reset chat data leaves no hidden state: composure and the post-fight
//     seed flag are wiped with everything else.
//  6. An estimated foe's baseline survives BATTLE teardown too, not only duels.
//  7. persistDuelEstimates rejects magic keys — the one key-injection site the
//     v0.37 hardening missed (it wrote meta.sheet.actors['__proto__']).
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq();
global.jQuery = () => {};
global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

const path = require('path');
const fs = require('fs');

let md = {};
const extSettings = { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, autoSeed: false, eventEngine: false, composure: false } };
global.SillyTavern = { getContext: () => ({
    extensionSettings: extSettings,
    chatMetadata: md,
    name1: 'Player',
    chat: [],
    generateRaw: () => '',
    setExtensionPrompt: () => {},
    extension_prompt_types: { IN_CHAT: 1 },
    extension_prompt_roles: { SYSTEM: 0 },
}) };
require(path.join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

let fails = 0;
const ok = (name, cond) => { console.log((cond ? ' OK  ' : ' FAIL ') + name); if (!cond) fails++; };
const section = (t) => console.log('\n== ' + t + ' ==');
const freshMeta = () => ({ sheet: { actors: {} }, log: [], threads: [], oneShot: null, cache: null });

section('1. OPENINGS ARE SYMMETRIC AT EVERY SCALE (duel · battle · war)');
{
    // DETERMINISTIC RNG for the unit checks below. Without it the "opening was
    // CONSUMED" assertions are FLAKY: applyExchangeEffects re-GRANTS the
    // opponent an opening on SUCCESS_COST (~18% of rolls), so a post-round read
    // cannot tell a fresh grant from an unconsumed one. Pinning u = 0.5 forces
    // a SETBACK in both branches — that grants the PLAYER the opening and
    // leaves the opponent's flag alone, so the read means what it claims.
    const cryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: (a) => { a[0] = 0x80000000; return a; } } });

    // ── Unit: the opponent's opening must lower the acting side's delta ──
    const battleDelta = (targetOpening) => {
        const m = freshMeta();
        E.startBattle(m, ['Ally'], ['Foe'], 'melee', 0, 5);
        m.battle.allies.forEach(u => { u.rating = 5; u.poise = 99; u.maxPoise = 99; u.momentum = 0; u.injuries = 0; u.opening = false; });
        m.battle.enemies.forEach(u => { u.rating = 5; u.poise = 99; u.maxPoise = 99; u.momentum = 0; u.injuries = 0; u.opening = false; });
        m.battle.enemies[0].opening = targetOpening;
        const out = E.resolveBattleRound(m, { kind: 'fight', target: 'Foe', action: 'strike', circumstance: 0 });
        return { delta: out.mcRes.delta, consumed: m.battle.enemies[0].opening === false };
    };
    const bNeutral = battleDelta(false);
    const bOpening = battleDelta(true);
    ok('battle: the enemy\'s opening lowers the player\'s delta', bOpening.delta === bNeutral.delta - 1);
    ok('battle: the enemy\'s opening is CONSUMED, not left standing', bOpening.consumed);

    const warDelta = (targetOpening) => {
        const m = freshMeta();
        E.startWar(m, ['Left Flank'], ['Iron Legion'], null, 0);
        m.battle.cmdA = 5; m.battle.cmdE = 5;
        m.battle.allies.forEach(u => { u.rating = 5; u.poise = 99; u.maxPoise = 99; u.momentum = 0; u.injuries = 0; u.opening = false; });
        m.battle.enemies.forEach(u => { u.rating = 5; u.poise = 99; u.maxPoise = 99; u.momentum = 0; u.injuries = 0; u.opening = false; });
        m.battle.enemies[0].opening = targetOpening;
        const out = E.resolveWarRound(m, { kind: 'maneuver', acting: 'Left Flank', target: 'Iron Legion', action: 'push', circumstance: 0 });
        return { delta: out.focalRes.delta, consumed: m.battle.enemies[0].opening === false };
    };
    const wNeutral = warDelta(false);
    const wOpening = warDelta(true);
    ok('war: the enemy formation\'s opening lowers the acting formation\'s delta', wOpening.delta === wNeutral.delta - 1);
    ok('war: the enemy formation\'s opening is CONSUMED', wOpening.consumed);

    const personalDelta = (targetOpening) => {
        const m = freshMeta();
        E.startWar(m, ['Left Flank'], ['Iron Legion'], null, 0);
        m.battle.cmdA = 5; m.battle.cmdE = 5;
        m.battle.allies.forEach(u => { u.rating = 5; u.poise = 99; u.maxPoise = 99; u.momentum = 0; u.injuries = 0; u.opening = false; });
        m.battle.enemies.forEach(u => { u.rating = 5; u.poise = 99; u.maxPoise = 99; u.momentum = 0; u.injuries = 0; u.opening = false; });
        m.battle.enemies[0].opening = targetOpening;
        const out = E.resolveWarRound(m, { kind: 'personal', acting: null, target: 'Iron Legion', action: 'sortie', circumstance: 0 });
        return out.focalRes.delta;
    };
    ok('war (commander sortie): the enemy\'s opening lowers the commander\'s delta', personalDelta(true) === personalDelta(false) - 1);

    // Real randomness again for the behavioural sweep below.
    if (cryptoDesc) Object.defineProperty(globalThis, 'crypto', cryptoDesc); else delete globalThis.crypto;

    // ── Behavioural: a mirror-matched battle must be a coin flip ──
    let allies = 0, enemies = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
        const m = freshMeta();
        E.startBattle(m, ['A1', 'A2'], ['E1', 'E2', 'E3'], 'melee', 0, 5);
        m.battle.allies.forEach(u => { u.rating = 5; u.poise = 5; u.maxPoise = 5; });
        m.battle.enemies.forEach(u => { u.rating = 5; u.poise = 5; u.maxPoise = 5; });
        let guard = 0;
        while (!m.battle.over && guard++ < 200) E.resolveBattleRound(m, { kind: 'fight', target: null, action: 'x', circumstance: 0 });
        if (m.battle.victor === 'allies') allies++; else if (m.battle.victor === 'enemies') enemies++;
    }
    const tot = allies + enemies;
    const pct = allies / tot * 100;
    const sigma = Math.abs(allies / tot - 0.5) / Math.sqrt(0.25 / tot);
    console.log('   [mirror battles: allies ' + pct.toFixed(2) + '% · enemies ' + (100 - pct).toFixed(2) + '% · ' + sigma.toFixed(1) + 'σ from even]');
    ok('mirror-matched battles are a coin flip (no pro-player tilt, <4σ)', sigma < 4);
}

section('2. A WAR CANNOT OPEN WITH NO ALLIED FORMATIONS');
{
    const m = freshMeta();
    ok('startWar refuses an empty allied line', E.startWar(m, [], ['Iron Legion'], null, 0) === null);
    ok('…and leaves no half-built battle behind', !m.battle);
    const m2 = freshMeta();
    ok('startWar refuses an allied line that is only the player', E.startWar(m2, ['Player'], ['Iron Legion'], null, 0) === null);
    // Positive control: a real formation still opens, and round 1 is NOT a loss.
    const m3 = freshMeta();
    const w = E.startWar(m3, ['Left Flank'], ['Iron Legion'], null, 0);
    ok('a war WITH a formation still opens', !!w);
    const out = E.resolveWarRound(m3, { kind: 'maneuver', acting: null, target: null, action: 'advance', circumstance: 0 });
    ok('round 1 of a real war is not an instant defeat', !(m3.battle.over && m3.battle.victor === 'enemies' && m3.battle.round === 1 && !out.focalRes));
}

section('3. THE LOG\'S WOUND MATH IS ARITHMETICALLY TRUE');
{
    // side() must never print a false sum: base − wounds ± rest = effective.
    ok('plain rating prints bare', E.mathLine({ delta: 0, aR: 7, oR: 7, circ: 0, P: 50, u: 0.5 }) === 'Δ=+0 (7 vs 7, circ +0) → P 50% → u 0.5');
    const woundLine = E.mathLine({ delta: -2, aR: 8, oR: 10, circ: 0, P: 24, u: 0.5, pBase: 10, pInj: 2, oBase: 10, oInj: 0 });
    ok('a registered wound prints a TRUE subtraction (10−2=8)', woundLine.includes('10−2=8'));
    const momentumLine = E.mathLine({ delta: 0, aR: 6.5, oR: 7, circ: 0, P: 50, u: 0.5, pBase: 7, pInj: 1, oBase: 7, oInj: 0 });
    ok('momentum/opening is SHOWN, never swallowed into a false sum', momentumLine.includes('7−1+0.5=6.5') && !momentumLine.includes('7−1=6.5'));

    // The duel resolver must hand back the components the roll actually used,
    // captured BEFORE the exchange mutates them.
    let sawInjuring = false;
    for (let i = 0; i < 4000 && !sawInjuring; i++) {
        const m = freshMeta();
        m.sheet.actors = { Jovan: { default: 3 }, Kaiser: { default: 9 } };
        E.startDuel(m, 'Jovan', 'Kaiser', 'melee', null, 0);
        const res = E.resolveDuelExchange(m, 0, 'attack');
        if (res.tier !== 'DISASTER') continue;
        sawInjuring = true;
        ok('duel result carries its own pre-roll components', Number.isFinite(res.pBase) && Number.isFinite(res.pInj));
        ok('components are PRE-mutation (the new wound is not back-dated)', res.pInj === 0 && m.duel.player.injuries === 1);
        const line = E.mathLine({ delta: res.delta, aR: res.aR, oR: res.oR, circ: 0, P: 10, u: 0.9, pBase: res.pBase, pInj: res.pInj, oBase: res.oBase, oInj: res.oInj });
        const mm = line.match(/\((\S+) vs/);
        ok('the printed player side is a true sum', mm && (mm[1] === String(res.aR) || evalSide(mm[1])));
    }
    ok('a DISASTER was sampled for the pre-mutation check', sawInjuring);

    // Battle and war rows carry components too.
    {
        const m = freshMeta();
        E.startBattle(m, ['Ally'], ['Foe'], 'melee', 0, 5);
        const out = E.resolveBattleRound(m, { kind: 'fight', target: 'Foe', action: 'x', circumstance: 0 });
        ok('battle mcRes carries wound components', Number.isFinite(out.mcRes.pBase) && Number.isFinite(out.mcRes.oBase));
    }
    {
        const m = freshMeta();
        E.startWar(m, ['Left Flank'], ['Iron Legion'], null, 0);
        const out = E.resolveWarRound(m, { kind: 'maneuver', acting: 'Left Flank', target: 'Iron Legion', action: 'x', circumstance: 0 });
        ok('war focalRes carries wound components', Number.isFinite(out.focalRes.pBase) && Number.isFinite(out.focalRes.oBase));
    }
}

function evalSide(s) {
    // "10−2+0.5=8.5" → verify the arithmetic literally.
    const [lhs, rhs] = s.split('=');
    if (rhs === undefined) return true;
    const norm = lhs.replace(/−/g, '-');
    const terms = norm.match(/[+-]?\d+(?:\.\d+)?/g) || [];
    const sum = terms.reduce((t, x) => t + Number(x), 0);
    return Math.abs(sum - Number(rhs)) < 1e-9;
}

section('4. DUEL RECOVERY ROWS ARE READABLE (no "undefined vs undefined")');
{
    const m = freshMeta();
    E.startDuel(m, 'Jovan', 'Kaiser', 'melee', 7, 0);
    const res = E.resolveDuelRecovery(m, 1);
    ok('recovery result carries aR', Number.isFinite(res.aR));
    ok('recovery result carries oR', Number.isFinite(res.oR));
    ok('recovery result names the opponent', res.oppLabel === 'Kaiser');
    const line = E.mathLine({ delta: res.delta, aR: res.aR, oR: res.oR, circ: 1, P: 50, u: 0.5 });
    ok('the math line has no "undefined"', !/undefined/.test(line));
    console.log('   [recovery row: ' + line + ']');
}

section('5. RESET CHAT DATA LEAVES NO HIDDEN STATE');
{
    const fn = SRC.slice(SRC.indexOf('function resetChatData'), SRC.indexOf('function bindUI'));
    ok('reset clears the player\'s composure', /composure/.test(fn));
    ok('reset clears the post-fight seed flag', /seedDueAfterFight/.test(fn));
}

section('6. AN ESTIMATED FOE\'S BASELINE SURVIVES BATTLE TEARDOWN');
{
    const m = freshMeta();
    E.startBattle(m, [], ['Ancient Dragon'], 'melee', 0, 9);
    ok('a single unlisted foe given the referee\'s estimate is marked', m.battle.enemies[0].estimated === true);
    ok('persist writes that baseline to the sheet', E.persistDuelEstimates(m) === true && m.sheet.actors['Ancient Dragon'].default === 9);
    // An xN squad is NEVER promoted to a sheet actor.
    const m2 = freshMeta();
    E.startBattle(m2, [], ['Guard x3'], 'melee', 0, 6);
    ok('an xN squad is not marked estimated', m2.battle.enemies.every(u => !u.estimated));
    E.persistDuelEstimates(m2);
    ok('an xN squad never pollutes the sheet', Object.keys(m2.sheet.actors).length === 0);
    // A foe already on the sheet is never overwritten.
    const m3 = freshMeta();
    m3.sheet.actors = { Kaiser: { default: 8, domains: {} } };
    E.startBattle(m3, [], ['Kaiser'], 'melee', 0, 3);
    E.persistDuelEstimates(m3);
    ok('a rated foe keeps its rating', m3.sheet.actors.Kaiser.default === 8 && !m3.sheet.actors.Kaiser._estimated);
}

section('7. NO KEY-INJECTION SITE CAN TOUCH THE PROTOTYPE');
{
    const m = freshMeta();
    E.startDuel(m, 'Jovan', '__proto__', 'melee', 9, 0);
    const proto = Object.getPrototypeOf(m.sheet.actors);
    E.persistDuelEstimates(m);
    ok('persist rejects a magic-key opponent', Object.getPrototypeOf(m.sheet.actors) === proto);
    ok('…and nothing leaks through the prototype', m.sheet.actors.default === undefined);
    const m2 = freshMeta();
    E.startBattle(m2, [], ['constructor'], 'melee', 0, 9);
    const proto2 = Object.getPrototypeOf(m2.sheet.actors);
    E.persistDuelEstimates(m2);
    ok('battle persist rejects magic keys too', Object.getPrototypeOf(m2.sheet.actors) === proto2 && !Object.keys(m2.sheet.actors).length);
    // Positive control: a normal name still persists.
    const m3 = freshMeta();
    E.startDuel(m3, 'Jovan', 'Kaiser', 'melee', 9, 0);
    ok('a normal opponent name still persists', E.persistDuelEstimates(m3) === true && m3.sheet.actors.Kaiser.default === 9);
}

section('8. VERSION STAMP');
{
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
    const stamp = (SRC.match(/const VERSION = '([^']+)'/) || [])[1];
    ok('manifest and in-code version stamp match', manifest.version === stamp);
    console.log('   [v' + stamp + ']');
}

console.log(fails === 0 ? '\nALL v58 DEEP-AUDIT INVARIANTS GREEN' : '\n' + fails + ' FAILURES');
process.exit(fails ? 1 : 0);
