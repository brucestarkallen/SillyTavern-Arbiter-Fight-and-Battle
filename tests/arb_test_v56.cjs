// v0.36 — DAMAGE MUST REGISTER; WOUND MATH IS AUDITABLE.
// Root cause closed (the "pristine 10" trace): two FAILUREs in a row against
// a pinned, impaled, half-dead Zaraki looked wrong — and the tell was the log
// itself: "8 vs 10" both times. The dice were honest (P 64% missed at
// u .825, P 36% at u .609 — a ~23% joint), but Zaraki carried a blade
// through his shoulder in the FICTION while remaining mechanically unwounded:
// the referee narrated lasting damage without filing condition_change, then
// partially re-awarded it as one-shot circumstance (+3, then +1 for the same
// facts). The mid-duel condition pipeline itself was proven working — the
// gap was the brief, plus zero visibility when damage silently isn't filed.
//   1. COND_RECONCILE_RULE in ALL FOUR briefs: fiction-visible persistent
//      states on EITHER fighter must be filed NOW as catch-up conditions;
//      lasting damage NEVER lives in circumstance (double-count / vanishing
//      wound both spelled out).
//   2. GUARD_RULE: a standing always-on defense REMAINS player_guard while
//      the player ATTACKS, until the fiction drops it — the missing-⛨ case.
//   3. The duel math line is auditable: a wounded side prints base−wounds=eff
//      ("10−2=8"), so a foe still showing pristine "10" is the visible
//      signal that narrated damage was never registered.
//   4. E2E: a referee condition on the opponent mid-duel drops the LIVE
//      rating on the very next exchange's math; engine-inflicted injuries
//      show the breakdown in the log line.
const fs = require('fs');
const path = require('path');
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(v){return v === undefined ? '' : this;}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {};
let respObj = JSON.stringify({ check: false });
function makeCtx() {
    return {
        name1: 'LO', name2: 'Narrator',
        extensionSettings: { arbiter: { enabled: true, timeoutMs: 4000, toastResults: false, autoSeed: false, autoDuel: true, eventEngine: false, composure: true, composureMax: 6 } },
        chatMetadata: md,
        chat: [],
        setExtensionPrompt: () => {},
        extension_prompt_types: { IN_CHAT: 1 },
        extension_prompt_roles: { SYSTEM: 0, USER: 1, ASSISTANT: 2 },
        eventSource: { on(){} }, event_types: {},
        generateRaw: async () => respObj,
        saveMetadataDebounced: () => {}, saveSettingsDebounced: () => {},
    };
}
global.SillyTavern = { getContext: makeCtx };
require(path.join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
const E = globalThis.ArbiterEngine;
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf-8');
let fails = 0; const ok = (n, c) => { console.log((c ? '  OK  ' : ' FAIL ') + n); if (!c) fails++; };
const um = (mes, d) => ({ is_user: true, name: 'LO', mes, send_date: d });
const fresh = () => { md.arbiter = { sheet: { actors: { 'Jovan Oda': { default: 7, domains: { melee: 8 } }, 'Kenpachi Zaraki': { default: 9, domains: { melee: 10 } } } }, log: [], oneShot: null, cache: null, composure: 6, mcName: 'Jovan Oda' }; return md.arbiter; };

(async () => {
    /* ── 1+2. brief locks ───────────────────────────────────────────────── */
    ok('the reconcile rule exists once and is wired into all four briefs', SRC.includes('const COND_RECONCILE_RULE =') && (SRC.match(/^\s*COND_RECONCILE_RULE,$/gm) || []).length === 4);
    ok('catch-up duty: unregistered fiction-visible damage is filed NOW', SRC.includes('file condition_change for it NOW as a catch-up'));
    ok('the vanishing-wound failure mode is spelled out', SRC.includes('leaving a half-dead foe fighting at pristine strength'));
    ok('lasting damage never lives in circumstance (no double-count)', SRC.includes('NEVER pour lasting damage into circumstance') && SRC.includes('double-counts it'));
    ok('a standing always-on guard persists through the player\'s OWN attacks', SRC.includes('REMAINS player_guard even while the player ATTACKS'));

    /* ── 3. auditable wound math (unit) ─────────────────────────────────── */
    let meta = fresh();
    E.startDuel(meta, 'Jovan Oda', 'Kenpachi Zaraki', 'melee');
    meta.duel.opp.injuries = 3; // engine-inflicted wounds
    respObj = JSON.stringify({ exchange: true, action: 'press the wounded giant', circumstance: 1, why: 'he fights on one arm' });
    await I([um('I press him [roll]', 'w1')], 0, () => {}, 'normal');
    let entry = meta.log[meta.log.length - 1];
    ok('the log entry carries the wound breakdown fields', entry.oBase === 10 && entry.oInj === 3 && entry.oR === 7);
    const line = E.mathLine(entry);
    ok('the math line prints base−wounds=eff for the wounded side', line.includes('10−3=7'));
    ok('an unwounded side still prints the plain number', entry.pInj === undefined && line.includes('(8 vs 10−3=7'));

    /* ── 4. E2E: a referee condition drops the LIVE opponent next beat ──── */
    meta = fresh();
    E.startDuel(meta, 'Jovan Oda', 'Kenpachi Zaraki', 'melee');
    respObj = JSON.stringify({ exchange: true, action: 'blade through the shoulder, twist', circumstance: 2, why: 'he is pinned mid-recovery', condition_change: { who: 'Kenpachi Zaraki', add: 'impaled shoulder', mod: -2, domain: null, gear: false, remove: null } });
    await I([um('I drive the blade through his shoulder [roll]', 'w2')], 0, () => {}, 'normal');
    ok('the catch-up condition lands on the opponent\'s sheet entry', (meta.sheet.actors['Kenpachi Zaraki'].conditions || []).some(c => c.name === 'impaled shoulder'));
    ok('the LIVE opponent rating drops immediately (10 → 8)', meta.duel.opp.rating === 8);
    respObj = JSON.stringify({ exchange: true, action: 'press before he recovers', circumstance: 1, why: 'attacking mid-recovery only — the wound is already registered' });
    await I([um('I drive the blade [roll]', 'w2'), um('I press him again [roll]', 'w3')], 0, () => {}, 'normal');
    entry = meta.log[meta.log.length - 1];
    ok('the NEXT exchange rolls against the wounded rating (oR 8, not 10)', entry.oR === 8 && entry.oBase === 8);
    ok('no pristine-10 ever again once damage is registered', meta.log.every(l => l.r < 2 || l.oR <= 8));

    console.log(fails ? 'SUITE FAILED (' + fails + ')' : 'ALL v56 REGISTERED-DAMAGE INVARIANTS GREEN');
    process.exit(fails ? 1 : 0);
})();
