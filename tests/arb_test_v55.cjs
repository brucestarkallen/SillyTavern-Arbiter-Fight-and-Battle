// v0.35.1 — TOASTS ARE PLAIN TEXT, EVERYWHERE, IN EVERY ENVIRONMENT.
// Root cause closed (the "<br><small> screenshot"): SillyTavern configures
// toastr with HTML escaping ON, so the v0.33 tier-meaning markup printed
// literally as tags ("...Reverse Infinity<br><small>fails as attempted");
// other builds leave escaping OFF, where raw strings could render as HTML
// and pre-escaped ones would double-escape ("&amp;"). One gate now closes
// the whole class:
//   1. toast() is the single sanitation point: bodies AND titles are plain
//      text — angle brackets become guillemets, so nothing can ever render
//      as markup or show as tag soup — and escaping is requested explicitly
//      for builds honoring per-call options.
//   2. No call site embeds tags or pre-escapes (escHtml belongs to real
//      innerHTML surfaces like the log/HUD, never to toasts) — locked by a
//      source scan of every toast( statement.
//   3. The tier meaning still arrives, as ' — meaning' on one line, with
//      ' · Δ...' appended when Show math is on.
//   4. E2E through the real referee: result toasts carry the meaning and
//      contain no angle bracket in body or title.
const fs = require('fs');
const path = require('path');
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(v){return v === undefined ? '' : this;}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
const shown = [];
global.toastr = {
    info: (m, t, o) => shown.push({ kind: 'info', m, t, o }),
    warning: (m, t, o) => shown.push({ kind: 'warning', m, t, o }),
    error: (m, t, o) => shown.push({ kind: 'error', m, t, o }),
    success: (m, t, o) => shown.push({ kind: 'success', m, t, o }),
};

let md = {};
let respObj = JSON.stringify({ check: false });
function makeCtx() {
    return {
        name1: 'LO', name2: 'Narrator',
        extensionSettings: { arbiter: { enabled: true, timeoutMs: 4000, toastResults: true, showMath: true, autoSeed: false, autoDuel: true, eventEngine: false, composure: true, composureMax: 6 } },
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
const noAngles = (x) => !/[<>]/.test(String(x));
const fresh = () => { md.arbiter = { sheet: { actors: { 'Jovan Oda': { default: 7, domains: { melee: 8 } }, 'Kenpachi Zaraki': { default: 9, domains: { melee: 10 } } } }, log: [], oneShot: null, cache: null, composure: 6, mcName: 'Jovan Oda' }; return md.arbiter; };

(async () => {
    /* ── 1. the wrapper is the sanitation gate ──────────────────────────── */
    shown.length = 0;
    E.toast('info', 'strike<br><small>fails as attempted</small>', 'R2 · <b>FAILURE</b>');
    let s0 = shown[0];
    ok('markup in a body can never render or print as tags', !!s0 && noAngles(s0.m) && s0.m.includes('\u2039br\u203a'));
    ok('titles are sanitized the same way', noAngles(s0.t));
    ok('escaping is requested explicitly for builds that honor it', !!s0.o && s0.o.escapeHtml === true);
    shown.length = 0;
    E.toast('info', 'Δ=-1 → P 36% → u 0.772 — fails as attempted', 'R2 · FAILURE');
    ok('plain text (arrows, deltas, dashes) passes through untouched', shown[0].m === 'Δ=-1 → P 36% → u 0.772 — fails as attempted');

    /* ── 2. no call site embeds tags or pre-escapes — source scan ───────── */
    const toastStmts = SRC.match(/toast\((?:[^;])*?\);/gs) || [];
    ok('the scan actually sees the toast call sites', toastStmts.length >= 15);
    ok('NO toast statement contains <br>/<small> markup', toastStmts.every(st => !st.includes('<br') && !st.includes('<small')));
    ok('NO toast statement pre-escapes with escHtml', toastStmts.every(st => !st.includes('escHtml(')));

    /* ── 3+4. E2E: real referee, meaning present, plain everywhere ──────── */
    let meta = fresh();
    respObj = JSON.stringify({ check: true, action: 'hurl sword through Zaraki with Reverse Infinity', domain: 'melee', actor: 'Jovan Oda', opposition_kind: 'actor', opposition: 'Kenpachi Zaraki', circumstance: 0 });
    shown.length = 0;
    await I([um('I hurl the sword through him with Reverse Infinity [roll]', 't1')], 0, () => {}, 'normal');
    const result = shown.find(x => / — /.test(String(x.m))); // result toasts carry the meaning separator
    ok('the single-check result toast fired', !!result);
    ok('it carries the plain one-line meaning (" — ...")', !!result && / — /.test(result.m));
    ok('show-math detail rides the same line, plain', !!result && / · Δ=/.test(result.m));
    ok('screenshot bug dead: no angle brackets in body or title', !!result && noAngles(result.m) && noAngles(result.t));
    ok('every toast this turn was angle-free', shown.every(x => noAngles(x.m) && noAngles(x.t)));

    meta = fresh();
    E.startDuel(meta, 'Jovan Oda', 'Kenpachi Zaraki', 'melee');
    respObj = JSON.stringify({ exchange: true, action: 'a committed diagonal cut', circumstance: 0, why: 'straight attempt' });
    shown.length = 0;
    await I([um('I cut [roll]', 't2')], 0, () => {}, 'normal');
    const duelToast = shown.find(x => /^R\d+ · /.test(String(x.t)));
    ok('the duel result toast carries the meaning, plain', !!duelToast && / — /.test(duelToast.m) && noAngles(duelToast.m) && noAngles(duelToast.t));

    console.log(fails ? 'SUITE FAILED (' + fails + ')' : 'ALL v55 TOAST-PLAINTEXT INVARIANTS GREEN');
    process.exit(fails ? 1 : 0);
})();
