// v0.35 — INJECTION PLACEMENT: depth & role, live and exact.
// The Advanced controls existed but looked dead: no semantics, and a change
// only took effect on the NEXT adjudication — the currently injected
// directive stayed at the old depth. Locked here:
//   1. setInjection/setEventInjection pass EXACTLY the configured depth and
//      role to SillyTavern (position IN_CHAT; depth 0 = injected immediately
//      AFTER the latest message, before appended post-history blocks).
//   2. Depth is clamped and NaN-safe (empty/garbage → 0; 250 → 99); an
//      unknown role falls back to system in the handler.
//   3. Role maps system→SYSTEM, user→USER, assistant→ASSISTANT constants.
//   4. reapplyInjections(): changing the setting re-places the CURRENT
//      committed directive and event beat at once — the knob works while
//      you watch, without sending a message.
//   5. Source locks: the hint documents the exact semantics (after latest
//      message, before post-history instructions), and both handlers call
//      reapplyInjections.
const fs = require('fs');
const path = require('path');
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(v){return v === undefined ? '' : this;}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {};
const calls = [];
const settings = { enabled: true, timeoutMs: 4000, toastResults: false, autoSeed: false, eventEngine: false, injectDepth: 0, injectRole: 'system' };
function makeCtx() {
    return {
        name1: 'LO', name2: 'Narrator',
        extensionSettings: { arbiter: settings },
        chatMetadata: md,
        chat: [],
        setExtensionPrompt: (...a) => { calls.push(a); },
        extension_prompt_types: { IN_CHAT: 1 },
        extension_prompt_roles: { SYSTEM: 0, USER: 1, ASSISTANT: 2 },
        eventSource: { on(){} }, event_types: {},
        generateRaw: async () => '{"check": false}',
        saveMetadataDebounced: () => {}, saveSettingsDebounced: () => {},
    };
}
global.SillyTavern = { getContext: makeCtx };
require(path.join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf-8');
let fails = 0; const ok = (n, c) => { console.log((c ? '  OK  ' : ' FAIL ') + n); if (!c) fails++; };
const last = () => calls[calls.length - 1];

(async () => {
    md.arbiter = { sheet: { actors: {} }, log: [], cache: null };

    /* ── 1+3. exact depth/role pass-through ─────────────────────────────── */
    settings.injectDepth = 0; settings.injectRole = 'system';
    E.setInjection('DIRECTIVE-A');
    let a = last();
    ok('depth 0 + system: IN_CHAT position, depth 0, SYSTEM role, text intact', a[1] === 'DIRECTIVE-A' && a[2] === 1 && a[3] === 0 && a[4] === false && a[5] === 0);
    settings.injectDepth = 3; settings.injectRole = 'user';
    E.setInjection('DIRECTIVE-B');
    a = last();
    ok('depth 3 + user honored exactly', a[3] === 3 && a[5] === 1);
    settings.injectRole = 'assistant';
    E.setInjection('DIRECTIVE-C');
    ok('assistant role maps to the ASSISTANT constant', last()[5] === 2);
    settings.injectRole = 'system';

    /* ── 2. clamped and NaN-safe ────────────────────────────────────────── */
    settings.injectDepth = 250;
    E.setInjection('X'); ok('250 clamps to the 99 ceiling', last()[3] === 99);
    settings.injectDepth = '';
    E.setInjection('X'); ok('an empty value falls to depth 0, never NaN', last()[3] === 0);
    settings.injectDepth = 'garbage';
    E.setInjection('X'); ok('garbage falls to depth 0, never NaN', last()[3] === 0);

    /* ── 1b. the event beat uses the SAME placement ─────────────────────── */
    settings.injectDepth = 5;
    E.setEventInjection('WORLD-BEAT');
    a = last();
    ok('event injection follows the same depth/role', String(a[0]).includes('_EVENT') && a[1] === 'WORLD-BEAT' && a[3] === 5);

    /* ── 4. live re-application of the committed directive ──────────────── */
    md.arbiter.cache = { key: 'k', sendDate: 'd', directive: 'COMMITTED-DIRECTIVE', tier: 'SUCCESS' };
    md.arbiter.eventCache = { key: 'k', text: 'COMMITTED-BEAT' };
    settings.injectDepth = 7;
    calls.length = 0;
    E.reapplyInjections();
    ok('reapply re-places BOTH the directive and the event beat at once', calls.length === 2 && calls[0][1] === 'COMMITTED-DIRECTIVE' && calls[1][1] === 'COMMITTED-BEAT');
    ok('reapply uses the freshly chosen depth immediately', calls.length === 2 && calls[0][3] === 7 && calls[1][3] === 7);
    settings.injectDepth = 2;
    calls.length = 0;
    E.reapplyInjections();
    ok('a second change moves the SAME committed directive again', calls.length === 2 && !!calls[0] && calls[0][3] === 2);
    md.arbiter.cache = null; md.arbiter.eventCache = null;
    calls.length = 0;
    E.reapplyInjections();
    ok('nothing committed → nothing re-injected (no phantom notes)', calls.length === 0);

    /* ── 5. source locks: semantics documented, handlers wired ──────────── */
    ok('hint documents: after your latest message, before post-history blocks', SRC.includes('immediately AFTER your latest message') && SRC.includes('before post-history instruction blocks'));
    ok('hint documents: changes apply to the current directive instantly', SRC.includes('Changes apply to the CURRENT directive instantly'));
    ok('both handlers re-apply live', (SRC.match(/saveSettings\(\); reapplyInjections\(\);/g) || []).length === 2);
    ok('unknown roles fall back to system in the handler', SRC.includes("(this.value === 'user' || this.value === 'assistant') ? this.value : 'system'"));

    console.log(fails ? 'SUITE FAILED (' + fails + ')' : 'ALL v54 INJECTION-PLACEMENT INVARIANTS GREEN');
    process.exit(fails ? 1 : 0);
})();
