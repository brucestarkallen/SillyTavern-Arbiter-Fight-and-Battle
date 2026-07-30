// v0.40 — RECOVERY CANNOT BE A DOMINANT OPTION.
//
// Disengaging to recover is a move the OPPONENT has no equivalent of. That
// makes it the one place in the engine where an underpriced tactic is
// automatically a strictly dominant one, so it needs two hard invariants.
//
// v0.39 measured that it had neither. On a generous circumstance grade (+2, the
// brief's "unopposed with a reliable method") a mirror duel where the player
// recovered went to a 73-82% win rate, and spamming it ran 373 rounds at a
// 100% win rate: the fight could not end and the player could not lose.
//
//  1. A foe still on their feet ALWAYS lands something. Circumstance could
//     previously ERASE the free swing outright (counter went to 0 at +2),
//     which is exactly the risk-free heal loop that counter exists to prevent.
//  2. STAMINA IS FINITE: across one fight a fighter claws back at most one
//     pool's worth of wind. This is the real fix — the defect was REPETITION,
//     not the size of any single punish, which is why flooring the counter
//     alone barely moved the win rate and made the spam case WORSE (100% over
//     373 rounds).
//  3. Behavioural: at every circumstance grade, recovering is at best
//     break-even against never recovering. It buys FIGHT LENGTH, not win
//     probability — which is both the realistic shape and the only shape that
//     isn't dominant.
//  4. It stays a real tactic, not a dead button: a recovery still restores
//     poise, and a safe grade still restores more than a desperate one.
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
const duelAt = (poise, oppRating) => {
    const m = { sheet: { actors: { P: { default: 6, poise }, O: { default: oppRating, poise } } }, log: [], threads: [] };
    E.startDuel(m, 'P', 'O', 'melee', null, 0);
    return m;
};

/** Pinned RNG. Anything that reads state AFTER an effects pass must be
 *  deterministic or it is a lottery ticket dressed as an assertion — the
 *  lesson from v0.39.1's flaky opening-consumption check. */
const withU = (u, fn) => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true,
        value: { getRandomValues: (a) => { a[0] = Math.min(0xFFFFFFFF, Math.floor(u * 4294967296)); return a; } } });
    try { return fn(); } finally {
        if (desc) Object.defineProperty(globalThis, 'crypto', desc); else delete globalThis.crypto;
    }
};

section('1. A FOE ON THEIR FEET ALWAYS LANDS SOMETHING');
{
    // A dangerous opponent (rating 6 -> base swing 1) with the most generous
    // circumstance the brief allows. u=0 forces the best possible recovery
    // tier, so any poise the player fails to keep is the punish, nothing else.
    const res = withU(0, () => {
        const m = duelAt(5, 6);
        m.duel.player.poise = 1;
        const r = E.resolveDuelExchange(m, 3, 'recover');
        return { counter: r.counter, poise: m.duel.player.poise };
    });
    ok('generous circumstance cannot erase the punish', res.counter >= 0.5);
    ok('the punish is real poise, not a label', res.poise < 1 + 2.5);

    // A genuinely feeble foe CAN be safely disengaged from — the floor keys off
    // the threat, so it must not invent a punish where there was none.
    const feeble = withU(0, () => {
        const m = duelAt(5, 1);
        m.duel.player.poise = 1;
        return E.resolveDuelExchange(m, 0, 'recover').counter;
    });
    ok('a harmless foe lands nothing (the floor is not a flat tax)', feeble === 0);
}

section('2. STAMINA IS FINITE — ONE POOL PER FIGHT');
{
    // Recover repeatedly under the most favourable conditions available and
    // confirm cumulative healing is bounded by maxPoise.
    const m = duelAt(5, 1); // harmless foe: no punish, so healing is unopposed
    let healed = 0;
    for (let i = 0; i < 60; i++) {
        m.duel.player.poise = 0.5; // keep room so the pool cap never masks the budget
        const before = m.duel.player.poise;
        withU(0, () => E.resolveDuelExchange(m, 3, 'recover'));
        healed += Math.max(0, m.duel.player.poise - before);
        if (m.duel.over) break;
    }
    console.log('   [60 unopposed recovery attempts healed ' + healed + ' total against a pool of 5]');
    ok('cumulative healing never exceeds one pool', healed <= m.duel.player.maxPoise + 1e-9);
    ok('the budget is tracked on the duel so rewinds restore it', typeof m.duel.recovered === 'number');
    ok('the budget is spent, not merely capped per-attempt', m.duel.recovered >= m.duel.player.maxPoise - 1e-9);

    // Legacy duels (saved before this field existed) must not break or heal free.
    const legacy = duelAt(5, 1);
    delete legacy.duel.recovered;
    legacy.duel.player.poise = 1;
    withU(0, () => E.resolveDuelExchange(legacy, 0, 'recover'));
    ok('a duel saved without the field still works', Number.isFinite(legacy.duel.recovered) && legacy.duel.player.poise > 1);
}

section('3. RECOVERING IS NEVER BETTER THAN NOT RECOVERING');
{
    const run = (policy, recCirc, n) => {
        let pw = 0, ow = 0, rounds = 0;
        for (let i = 0; i < n; i++) {
            const m = duelAt(5, 6);
            let g = 0;
            while (!m.duel.over && g++ < 500) {
                if (policy(m.duel, g)) E.resolveDuelExchange(m, recCirc, 'recover');
                else E.resolveDuelExchange(m, 0, 'attack');
            }
            rounds += m.duel.round;
            if (m.duel.victor === 'player') pw++; else if (m.duel.victor === 'opp') ow++;
        }
        return { pct: pw / (pw + ow) * 100, rounds: rounds / n };
    };
    const N = 12000;
    const never = run(() => false, 0, N);
    ok('the no-recovery baseline is a coin flip', Math.abs(never.pct - 50) < 3);
    for (const circ of [-2, 0, 2, 3]) {
        const low = run((d) => d.player.poise <= 2, circ, N);
        const spam = run((d) => d.player.poise < d.player.maxPoise, circ, N);
        console.log('   [circ ' + (circ >= 0 ? '+' : '') + circ + ': recover-when-low ' + low.pct.toFixed(1)
            + '% (' + low.rounds.toFixed(1) + ' rounds) · spam ' + spam.pct.toFixed(1) + '% (' + spam.rounds.toFixed(1) + ' rounds)]');
        ok('circ ' + circ + ': recovering is at best break-even', low.pct <= never.pct + 3);
        ok('circ ' + circ + ': spamming recovery loses the fight', spam.pct < never.pct);
        // The 373-round stall: every fight must still terminate promptly.
        ok('circ ' + circ + ': fights still end (no heal-loop stall)', spam.rounds < 40);
    }
    console.log('   [recovery buys fight LENGTH, not win probability — the realistic shape]');
}

section('4. RECOVERY IS STILL A REAL TACTIC');
{
    const gain = (circ) => withU(0.25, () => {
        const m = duelAt(5, 4);
        m.duel.player.poise = 1;
        const before = m.duel.player.poise;
        E.resolveDuelExchange(m, circ, 'recover');
        return m.duel.player.poise - before;
    });
    const safe = gain(2), desperate = gain(-2);
    console.log('   [same roll: safe grade nets ' + safe + ' poise, desperate nets ' + desperate + ']');
    ok('a recovery restores poise', safe > 0);
    ok('a safe moment restores more than a desperate snatch', safe > desperate);
    ok('recovery still cedes the initiative', withU(0.25, () => {
        const m = duelAt(5, 6);
        E.resolveDuelExchange(m, 0, 'recover');
        return m.duel.opp.opening === true && m.duel.opp.momentum > 0 && m.duel.player.momentum === 0;
    }));
    ok('the recovery row is still auditable', withU(0.25, () => {
        const m = duelAt(5, 6);
        const r = E.resolveDuelExchange(m, 0, 'recover');
        return Number.isFinite(r.aR) && Number.isFinite(r.oR) && r.oppLabel === 'O';
    }));
}

console.log(fails === 0 ? '\nALL v60 RECOVERY-PRICING INVARIANTS GREEN' : '\n' + fails + ' FAILURES');
process.exit(fails ? 1 : 0);
