// v0.39 — THE EXCHANGE ECONOMY IS MIRROR-SYMMETRIC.
//
// The promise: two identically-capable fighters are a coin flip, at ANY fight
// length, and skill still decides everything else.
//
// v0.38 measured that this was false. The tier-width pairs used DIFFERENT
// constants (DECISIVE 0.05/0.15 vs DISASTER 0.03/0.12; SUCCESS_COST 0.15/0.35
// vs SETBACK 0.30/0.20), so at even odds the player drew DECISIVE more often
// than DISASTER and SETBACK more often than SUCCESS_COST. Both edges COMPOUND —
// an opening is +1 on the next exchange, an injury is -1 rating forever — while
// the one offsetting term (SUCCESS_COST's 0.5 self-tax, unmirrored on SETBACK)
// is linear. So a mirror match drifted further pro-player the longer it ran:
// 51.1% at poise 5, 52.6% at 8, 54.3% at 12.
//
// The fix is structural, not a tuning nudge: each band pair now uses ONE
// formula applied to the acting side's P and the opposing side's F, and SETBACK
// is the exact mirror of SUCCESS_COST. The distribution is therefore provably
// invariant under (u, P) -> (1 - u, 1 - P), which makes a mirror match even by
// construction rather than by calibration.
//
//  1. Band widths mirror exactly: width_X(P) === width_mirror(X)(1 - P).
//  2. sliceOutcome is pointwise mirror-symmetric.
//  3. EXCHANGE_EFFECTS pairs mirror: damage, injuries, momentum, openings.
//  4. Mirror duels are a coin flip at poise 5, 8 AND 12 (no length drift).
//  5. Mirror battles and mirror wars are a coin flip.
//  6. The curve is untouched: P(win an exchange) still equals probFromDelta.
//  7. The intended skill skew survives: experts win clean and rarely botch,
//     underdogs who win, win narrow and costly, and rating still decides.
//  8. realistic is symmetric; gritty and heroic are deliberately NOT.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq();
global.jQuery = () => {};
global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

const path = require('path');
const S = { enabled: true, toastResults: false, autoSeed: false, eventEngine: false, composure: false,
    preset: 'realistic', tieBand: 0.06, fightStyle: 'tracked', duelPoise: 5, defaultRating: 5 };
global.SillyTavern = { getContext: () => ({
    extensionSettings: { arbiter: S }, chatMetadata: {}, name1: 'P', chat: [],
    generateRaw: () => '', setExtensionPrompt: () => {},
    extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 },
}) };
require(path.join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;

let fails = 0;
const ok = (name, cond) => { console.log((cond ? ' OK  ' : ' FAIL ') + name); if (!cond) fails++; };
const section = (t) => console.log('\n== ' + t + ' ==');
const M = E.PRESETS.realistic.mods;

/** Exhaustive band widths of the shipped slicer at 1e-6 resolution. */
function widths(P, mods) {
    const w = { DECISIVE: 0, SUCCESS: 0, SUCCESS_COST: 0, SETBACK: 0, FAILURE: 0, DISASTER: 0 };
    const STEP = 1e-6;
    for (let u = STEP / 2; u < 1; u += STEP) w[E.sliceOutcome(P, u, mods)] += STEP;
    return w;
}

section('1. BAND WIDTHS MIRROR EXACTLY');
{
    const MIRROR = { DECISIVE: 'DISASTER', SUCCESS: 'FAILURE', SUCCESS_COST: 'SETBACK',
        SETBACK: 'SUCCESS_COST', FAILURE: 'SUCCESS', DISASTER: 'DECISIVE' };
    let worst = 0, worstAt = '';
    for (const P of [0.05, 0.24, 0.4, 0.5, 0.6, 0.76, 0.909, 0.97]) {
        const a = widths(P, M), b = widths(1 - P, M);
        for (const k of Object.keys(a)) {
            const d = Math.abs(a[k] - b[MIRROR[k]]);
            if (d > worst) { worst = d; worstAt = 'P=' + P + ' ' + k; }
        }
    }
    console.log('   [largest mirror discrepancy: ' + worst.toExponential(2) + ' at ' + worstAt + ']');
    ok('every band width equals its mirror at 1-P (within grid resolution)', worst < 1e-5);

    // The even-odds mass of each pair is what the old constants' midpoints were
    // chosen to preserve, so the distribution's SHAPE is unchanged.
    const h = widths(0.5, M);
    ok('at even odds DECISIVE === DISASTER', Math.abs(h.DECISIVE - h.DISASTER) < 1e-5);
    ok('at even odds SUCCESS_COST === SETBACK', Math.abs(h.SUCCESS_COST - h.SETBACK) < 1e-5);
    ok('at even odds SUCCESS === FAILURE', Math.abs(h.SUCCESS - h.FAILURE) < 1e-5);
    ok('extremes still carry their historical mass (~10.75%)', Math.abs((h.DECISIVE + h.DISASTER) - 0.1075) < 0.002);
    ok('middles still carry their historical mass (~36.25%)', Math.abs((h.SUCCESS_COST + h.SETBACK) - 0.3625) < 0.002);
    ok('the six tiers partition [0,1) completely', Math.abs(Object.values(h).reduce((t, x) => t + x, 0) - 1) < 1e-5);
}

section('2. sliceOutcome IS POINTWISE MIRROR-SYMMETRIC');
{
    const MIRROR = { DECISIVE: 'DISASTER', SUCCESS: 'FAILURE', SUCCESS_COST: 'SETBACK',
        SETBACK: 'SUCCESS_COST', FAILURE: 'SUCCESS', DISASTER: 'DECISIVE' };
    let bad = 0, checked = 0;
    for (let P = 0.02; P <= 0.98; P += 0.005) {
        for (let u = 0.0007; u < 1; u += 0.00131) {
            checked++;
            if (MIRROR[E.sliceOutcome(P, u, M)] !== E.sliceOutcome(1 - P, 1 - u, M)) bad++;
        }
    }
    // A handful of points can land within floating-point distance of a band
    // edge, where u and 1-u round to opposite sides. Anything beyond that is a
    // real asymmetry, and the pre-fix code failed this by tens of thousands.
    console.log('   [' + checked + ' (P,u) points · mismatches: ' + bad + ']');
    ok('pointwise mirror holds everywhere but float-edge ties', bad <= checked * 1e-4);
}

section('3. EXCHANGE EFFECTS MIRROR');
{
    const FX = E.EXCHANGE_EFFECTS;
    const mirrors = (a, b) => FX[a].opp === FX[b].self && FX[a].self === FX[b].opp
        && !!FX[a].injureOpp === !!FX[b].injureSelf && !!FX[a].injureSelf === !!FX[b].injureOpp;
    ok('DECISIVE mirrors DISASTER', mirrors('DECISIVE', 'DISASTER') && FX.DECISIVE.winner === 'self' && FX.DISASTER.winner === 'opp');
    ok('SUCCESS mirrors FAILURE', mirrors('SUCCESS', 'FAILURE'));
    ok('SUCCESS_COST mirrors SETBACK', mirrors('SUCCESS_COST', 'SETBACK'));
    ok('SETBACK now taxes the opponent for the exposure it hands over', FX.SETBACK.opp === 0.5);
    ok('TRADE and STALEMATE are self-mirroring', FX.TRADE.opp === FX.TRADE.self && FX.STALEMATE.opp === FX.STALEMATE.self);

    // Applied symmetry: the same tier pair strips the same poise either way.
    const fresh = () => ({ poise: 5, maxPoise: 5, injuries: 0, momentum: 0, opening: false });
    for (const [a, b] of [['DECISIVE', 'DISASTER'], ['SUCCESS', 'FAILURE'], ['SUCCESS_COST', 'SETBACK']]) {
        const x = E.applyExchangeEffects(fresh(), fresh(), a, 0);
        const y = E.applyExchangeEffects(fresh(), fresh(), b, 0);
        ok(a + '/' + b + ': poise moved is mirrored', x.opp.poise === y.player.poise && x.player.poise === y.opp.poise);
        ok(a + '/' + b + ': the opening lands on the exposed side', !!x.opp.opening === !!y.player.opening);
    }
}

section('4. MIRROR DUELS ARE A COIN FLIP AT EVERY FIGHT LENGTH');
{
    const mirrorDuel = (n, poise) => {
        let pw = 0, ow = 0, rounds = 0;
        for (let i = 0; i < n; i++) {
            const m = { sheet: { actors: { P: { default: 6, poise }, O: { default: 6, poise } } }, log: [], threads: [] };
            E.startDuel(m, 'P', 'O', 'melee', null, 0);
            let g = 0;
            while (!m.duel.over && g++ < 300) E.resolveDuelExchange(m, 0, 'attack');
            rounds += m.duel.round;
            if (m.duel.victor === 'player') pw++; else if (m.duel.victor === 'opp') ow++;
        }
        const t = pw + ow;
        return { pct: pw / t * 100, sigma: Math.abs(pw / t - 0.5) / Math.sqrt(0.25 / t), rounds: rounds / n };
    };
    // The length sweep is the regression guard: the pre-fix drift GREW with the
    // poise pool (51.1% -> 52.6% -> 54.3%), so a single short-fight sample
    // would not have caught it.
    for (const poise of [5, 8, 12]) {
        const r = mirrorDuel(40000, poise);
        console.log('   [poise ' + poise + ': player ' + r.pct.toFixed(2) + '% · ' + r.sigma.toFixed(1) + 'σ · ' + r.rounds.toFixed(1) + ' rounds]');
        ok('poise ' + poise + ' mirror duel is even (<4σ)', r.sigma < 4);
    }
}

section('5. MIRROR BATTLES AND WARS ARE A COIN FLIP');
{
    const run = (kind, n) => {
        let al = 0, en = 0;
        for (let i = 0; i < n; i++) {
            const m = { sheet: { actors: {} }, log: [], threads: [] };
            if (kind === 'battle') E.startBattle(m, ['A1', 'A2'], ['E1', 'E2', 'E3'], 'melee', 0, 5);
            else { E.startWar(m, ['F1', 'F2'], ['G1', 'G2'], null, 0); m.battle.cmdA = 5; m.battle.cmdE = 5; }
            const p = kind === 'war' ? 10 : 5;
            m.battle.allies.forEach(u => { u.rating = 5; u.poise = p; u.maxPoise = p; });
            m.battle.enemies.forEach(u => { u.rating = 5; u.poise = p; u.maxPoise = p; });
            let g = 0;
            while (!m.battle.over && g++ < 300) {
                if (kind === 'battle') E.resolveBattleRound(m, { kind: 'fight', target: null, action: 'x', circumstance: 0 });
                else E.resolveWarRound(m, { kind: 'maneuver', acting: null, target: null, action: 'x', circumstance: 0 });
            }
            if (m.battle.victor === 'allies') al++; else if (m.battle.victor === 'enemies') en++;
        }
        const t = al + en;
        return { pct: al / t * 100, sigma: Math.abs(al / t - 0.5) / Math.sqrt(0.25 / t) };
    };
    for (const kind of ['battle', 'war']) {
        const r = run(kind, 4000);
        console.log('   [mirror ' + kind + ': player side ' + r.pct.toFixed(2) + '% · ' + r.sigma.toFixed(1) + 'σ]');
        ok('mirror ' + kind + ' is even (<4σ)', r.sigma < 4);
    }
}

section('6. THE CURVE IS UNTOUCHED');
{
    for (const d of [0, 2, 4, -4]) {
        const P = E.probFromDelta(d);
        let w = 0;
        const N = 300000;
        for (let i = 0; i < N; i++) {
            const t = E.sliceOutcome(P, Math.random(), M);
            if (t === 'DECISIVE' || t === 'SUCCESS' || t === 'SUCCESS_COST') w++;
        }
        ok('delta ' + d + ': exchange win rate still equals the logistic', Math.abs(w / N - P) < 0.005);
    }
}

section('7. SKILL STILL DECIDES, AND THE SKEW SURVIVES');
{
    const hi = widths(0.909, M), lo = widths(0.03, M);
    ok('an expert still almost never botches (DISASTER < 1% at P=0.91)', hi.DISASTER < 0.01);
    ok('an expert mostly wins CLEAN (SUCCESS is the modal win)', hi.SUCCESS > hi.SUCCESS_COST && hi.SUCCESS > hi.DECISIVE);
    const costlyShare = lo.SUCCESS_COST / (lo.DECISIVE + lo.SUCCESS + lo.SUCCESS_COST);
    ok('an underdog who wins, wins narrow and costly (>40% of wins)', costlyShare > 0.4);
    ok('near the threshold, failure is fail-forward (SETBACK is the modal loss at even odds)',
        widths(0.5, M).SETBACK > widths(0.5, M).DISASTER);

    const duel = (a, b) => {
        let pw = 0, ow = 0;
        for (let i = 0; i < 20000; i++) {
            const m = { sheet: { actors: { P: { default: a }, O: { default: b } } }, log: [], threads: [] };
            E.startDuel(m, 'P', 'O', 'melee', null, 0);
            let g = 0;
            while (!m.duel.over && g++ < 300) E.resolveDuelExchange(m, 0, 'attack');
            if (m.duel.victor === 'player') pw++; else if (m.duel.victor === 'opp') ow++;
        }
        return pw / (pw + ow) * 100;
    };
    const up = duel(8, 6), down = duel(6, 8);
    console.log('   [rating 8 vs 6: ' + up.toFixed(1) + '% · rating 6 vs 8: ' + down.toFixed(1) + '%]');
    ok('two rating points is decisive', up > 85);
    ok('…and symmetrically so when the player is outclassed', down < 15);
    ok('being outclassed is the mirror of outclassing', Math.abs(up - (100 - down)) < 3);
}

section('8. PRESETS: realistic IS SYMMETRIC, gritty/heroic DELIBERATELY ARE NOT');
{
    const r = E.PRESETS.realistic.mods;
    ok('realistic mods are all neutral', r.dec === 1 && r.cost === 1 && r.sb === 1 && r.dis === 1);
    ok('realistic carries no flat player edge', E.PRESETS.realistic.bonus === 0);
    const g = widths(0.5, E.PRESETS.gritty.mods), h = widths(0.5, E.PRESETS.heroic.mods);
    ok('gritty is harsher on the player than realistic', g.DISASTER > widths(0.5, r).DISASTER);
    ok('heroic is gentler on the player than realistic', h.DISASTER < widths(0.5, r).DISASTER);
    ok('heroic keeps its flat +1 edge', E.PRESETS.heroic.bonus === 1);
}

console.log(fails === 0 ? '\nALL v59 MIRROR-SYMMETRY INVARIANTS GREEN' : '\n' + fails + ' FAILURES');
process.exit(fails ? 1 : 0);
