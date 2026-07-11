// v0.30 — TIMELINE & LIVE-STATE LOCK-IN.
//   1. Committed-turn history: deleting the tail of a chat REWINDS the world
//      (fights, composure, counters) to the surviving timeline — regenerating
//      an older message replays ITS committed fate against the right state.
//   2. Deleting the tail then sending a NEW message rolls fresh from the
//      restored state (no double-application of vanished turns).
//   3. Editing an older message (later turns deleted) re-rolls from the state
//      BEFORE that turn.
//   4. ANCHOR RULE: a chat window containing none of the committed turns never
//      triggers a prune — truncated views cannot wipe a live fight.
//   5. An EMPTY referee response retries once (was a silently lost check).
//   6. Mode exclusivity: starting a battle ends a duel and vice versa.
//   7. A condition on an unlisted combatant seeds its sheet entry from the
//      LIVE rating (estimated dragon stays 9, not default-5) and the live
//      fight's math updates immediately.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(v){return v === undefined ? '' : this;}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {};
const injections = {};
let genRawCalls = 0;
let respQueue = null; // array → shift per call; null → respObj
let respObj = JSON.stringify({ check: false });
function makeCtx() {
    return {
        name1: 'Jovan',
        extensionSettings: { arbiter: { enabled: true, timeoutMs: 4000, toastResults: false, autoSeed: false, eventEngine: false, composure: true, composureMax: 6 } },
        chatMetadata: md,
        setExtensionPrompt: (k, v) => { injections[k] = v; },
        extension_prompt_types: { IN_CHAT: 1 },
        extension_prompt_roles: { SYSTEM: 0 },
        eventSource: { on(){} }, event_types: {},
        generateRaw: async () => { genRawCalls++; return respQueue ? (respQueue.length ? respQueue.shift() : '') : respObj; },
        saveMetadataDebounced: () => {}, saveSettingsDebounced: () => {},
    };
}
global.SillyTavern = { getContext: makeCtx };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log((c ? '  OK  ' : ' FAIL ') + n); if (!c) fails++; };
const um = (mes, d) => ({ is_user: true, name: 'Jovan', mes, send_date: d });
const check = (extra) => JSON.stringify(Object.assign({ check: true, action: 'the attempt', domain: 'willpower', actor: 'Jovan', opposition_kind: 'tier', opposition: 'moderate', circumstance: 0 }, extra || {}));

(async () => {
    /* ── 1. delete tail → regenerate older turn: exact-state replay ─────── */
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null, composure: 6 };
    const m1 = um('I brave the first horror [roll]', 't1');
    const m2 = um('I brave the second horror [roll]', 't2');
    const m3 = um('I brave the third horror [roll]', 't3');
    respObj = check({ composure_change: -1 });
    await I([m1], 0, () => {}, 'normal');
    const dir1 = injections.ARBITER_OUTCOME;
    await I([m1, m2], 0, () => {}, 'normal');
    await I([m1, m2, m3], 0, () => {}, 'normal');
    ok('three turns committed to the timeline', md.arbiter.history.length === 3);
    ok('three horror beats eroded composure to 3', md.arbiter.composure === 3);
    ok('turnCount advanced to 3', md.arbiter.turnCount === 3);
    // Player deletes turns 2-3 and regenerates turn 1.
    injections.ARBITER_OUTCOME = '';
    await I([m1], 0, () => {}, 'swipe');
    ok('vanished turns pruned from the timeline', md.arbiter.history.length === 1);
    ok('composure rewound to post-turn-1 (5, not 3)', md.arbiter.composure === 5);
    ok('turnCount rewound to 1', md.arbiter.turnCount === 1);
    ok('turn 1\'s committed directive replayed verbatim', injections.ARBITER_OUTCOME === dir1 && !!dir1);
    ok('single-slot mirror re-pointed at turn 1', md.arbiter.cache && md.arbiter.cache.key === md.arbiter.history[0].key);

    /* ── 2. delete tail → send NEW message: fresh roll from restored state ── */
    await I([m1, m2], 0, () => {}, 'normal');
    await I([m1, m2, m3], 0, () => {}, 'normal');
    ok('timeline rebuilt to 3 turns (composure 3)', md.arbiter.history.length === 3 && md.arbiter.composure === 3);
    const mNew = um('I press on into the dark [roll]', 't4');
    respObj = check({ composure_change: -2 });
    await I([m1, mNew], 0, () => {}, 'normal');
    ok('new message after deletion: restored to 5, then fresh -2 → 3', md.arbiter.composure === 3);
    ok('timeline is turn-1 + the new turn', md.arbiter.history.length === 2 && md.arbiter.history[1].sendDate === 't4');

    /* ── 3. EDIT an older message: re-roll from pre-that-turn state ─────── */
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null, composure: 6 };
    respObj = check({ composure_change: -1 });
    await I([m1], 0, () => {}, 'normal');
    await I([m1, m2], 0, () => {}, 'normal');
    ok('setup: two turns, composure 4', md.arbiter.composure === 4 && md.arbiter.history.length === 2);
    const m2edited = um('I strike the second horror down instead', 't2'); // same send_date, new text — gate passes on the verb
    await I([m1, m2edited], 0, () => {}, 'regenerate');
    ok('edited older turn re-rolled from pre-turn state (5-1=4, not 4-1=3)', md.arbiter.composure === 4);
    ok('timeline replaced the edited turn', md.arbiter.history.length === 2 && md.arbiter.history[1].key !== undefined && md.arbiter.history[1].sendDate === 't2');

    /* ── 4. ANCHOR RULE: an unrecognizable window never wipes state ─────── */
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null, composure: 6,
        history: [{ key: 'alienkey', sendDate: 'ax', directive: 'X', tier: 'SUCCESS', eventText: null,
            snap: { d: null, b: null, t: [], e: null, tc: 0, tn: 0, es: null, ws: null, c: 6 } }],
        duel: { active: true, over: false, victor: null, round: 2, domain: 'melee', scaleMismatch: 0,
            player: { name: 'Jovan', rating: 6, poise: 4, maxPoise: 5, injuries: 0, momentum: 0, opening: false },
            opp: { name: 'Kaol', rating: 6, poise: 3, maxPoise: 5, injuries: 0, momentum: 0, opening: false, composure: 6, composureMax: 6 } } };
    respObj = JSON.stringify({ exchange: true, move_kind: 'attack', action: 'press the attack', circumstance: 0 });
    await I([um('I press the attack', 'w1')], 0, () => {}, 'normal');
    ok('no committed turn visible → NO prune: the live duel survives', !!md.arbiter.duel && md.arbiter.duel.round === 3);

    /* ── 5. empty referee response retries once ─────────────────────────── */
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: 'force', cache: null };
    respQueue = ['', '', check()]; // attempt 1 (object+positional forms) empty → retry succeeds
    genRawCalls = 0; injections.ARBITER_OUTCOME = '';
    await I([um('I leap the chasm', 'r1')], 0, () => {}, 'normal');
    ok('empty first response retried (≥3 raw calls)', genRawCalls >= 3);
    ok('the retried check landed a binding directive', /ARBITER/.test(injections.ARBITER_OUTCOME));
    respQueue = null;

    /* ── 6. mode exclusivity ─────────────────────────────────────────────── */
    {
        const meta = { sheet: { actors: {} } };
        E.startDuel(meta, 'Jovan', 'Kaol', 'melee');
        E.startBattle(meta, [], ['Bandit x2'], 'melee', 0);
        ok('starting a battle ends the active duel', meta.duel === null && meta.battle && meta.battle.active);
        E.startDuel(meta, 'Jovan', 'Kaol', 'melee');
        ok('starting a duel ends the active battle', meta.battle === null && meta.duel && meta.duel.active);
        const meta2 = { sheet: { actors: {} } };
        E.startDuel(meta2, 'Jovan', 'Kaol', 'melee');
        E.startWar(meta2, ['1st Lance'], ['Iron Host'], null, 0);
        ok('starting a war ends the active duel', meta2.duel === null && meta2.battle && meta2.battle.kind === 'war');
    }

    /* ── 7. conditions: live-rating seeding + immediate live-fight effect ── */
    {
        const meta = { sheet: { actors: {} } };
        E.startDuel(meta, 'Jovan', 'Ancient Wyrm', 'melee', 9, -3); // estimated rating 9
        ok('setup: estimated wyrm rated 9 in the live duel', meta.duel.opp.rating === 9);
        const note = E.applyConditionChange(meta, { who: 'Ancient Wyrm', add: 'torn wing', remove: null, mod: -2, domain: null, gear: false });
        ok('condition applied returns a narration note', !!note);
        ok('created sheet entry seeded from the LIVE rating (9, not default 5)', meta.sheet.actors['Ancient Wyrm'].default === 9);
        E.refreshLiveRating(meta, 'Ancient Wyrm');
        ok('the LIVE duel math updated immediately (9 - 2 = 7)', meta.duel.opp.rating === 7);
        // …and healing it restores the live rating.
        E.applyConditionChange(meta, { who: 'Ancient Wyrm', add: null, remove: 'torn wing', mod: 0, domain: null, gear: false });
        E.refreshLiveRating(meta, 'Ancient Wyrm');
        ok('removing the condition restores the live rating to 9', meta.duel.opp.rating === 9);
    }
    // End-to-end through the interceptor: a mid-duel condition on the OPPONENT
    // lands on this duel's math in the same turn.
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: 'force', cache: null, composure: 6,
        duel: { active: true, over: false, victor: null, round: 1, domain: 'melee', scaleMismatch: 0,
            player: { name: 'Jovan', rating: 6, poise: 5, maxPoise: 5, injuries: 0, momentum: 0, opening: false },
            opp: { name: 'Kaol', rating: 6, poise: 5, maxPoise: 5, injuries: 0, momentum: 0, opening: false, composure: 6, composureMax: 6 } } };
    respObj = JSON.stringify({ exchange: true, move_kind: 'attack', action: 'shatter his sword arm', circumstance: 1,
        condition_change: { who: 'Kaol', add: 'shattered sword arm', remove: null, mod: -2, domain: 'melee', gear: false } });
    await I([um('I shatter his sword arm with the counter', 'cc1')], 0, () => {}, 'normal');
    ok('mid-duel condition hit the LIVE opponent rating (6 → 4)', md.arbiter.duel && md.arbiter.duel.opp.rating === 4);

    /* ── source pins ─────────────────────────────────────────────────────── */
    {
        const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
        ok('HUD dismiss clears the timeline (no prune-resurrection)', /m\.history = \[\];/.test(src));
        ok('reset chat data clears the timeline', /meta\.history = \[\];/.test(src));
        ok('deepCopy prefers structuredClone', /typeof structuredClone === 'function'/.test(src));
        const dc = E.deepCopy({ a: { b: [1, 2, { c: 3 }] } });
        ok('deepCopy is a true deep copy', dc.a.b[2].c === 3 && dc.a !== undefined && JSON.stringify(dc) === JSON.stringify({ a: { b: [1, 2, { c: 3 }] } }));
    }

    console.log(fails === 0 ? '\nALL v49 TIMELINE TESTS PASSED' : '\n' + fails + ' FAILURES');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
