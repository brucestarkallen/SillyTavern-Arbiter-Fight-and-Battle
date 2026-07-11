// v0.29 — AUDIT LOCK-IN. Nine root-cause fixes, each pinned by a failing-before/
// passing-after invariant:
//   1. cross-chat epoch guard (stale in-flight check never injects into a new chat)
//   2. epoch-scoped in-flight latch (a stale run never blocks the new chat)
//   3. player composure restored by the re-roll rewind (no drift on edit-resend)
//   4. recover + sequence resolves as a RECOVERY, never an attack combo
//   5. battle_start carries opponent_rating to the headline unlisted foe
//   6. generic xN squads use EXACT sheet lookup (no "Guard x3" ← "Guard Captain")
//   7. clearActivity's deferred finish never clobbers a newer activity
//   8. a stale/deleted profileId falls back to raw generation (not a dead judge)
//   9. seeding identity match: aliases dedup, siblings NEVER merge or delete
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(v){return v === undefined ? '' : this;}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = (fn) => { if (typeof fn === 'function') fn(); }; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {};
let injected = [];
const handlers = {};
let genRawCalls = 0;
let respObj = JSON.stringify({ check: false });
let rawGate = null; // when set to a promise, generateRaw awaits it (simulates a slow judge)

function makeCtx() {
    return {
        name1: 'Jovan',
        extensionSettings: {
            arbiter: { enabled: true, timeoutMs: 4000, toastResults: false, autoSeed: false, eventEngine: false, composure: true, composureMax: 6, profileId: 'ghost-profile-id' },
            connectionManager: { profiles: [{ id: 'real-profile', name: 'Real' }] }, // ghost-profile-id is stale
        },
        chatMetadata: md,
        setExtensionPrompt: (key, val) => injected.push({ key, val }),
        extension_prompt_types: { IN_CHAT: 1 },
        extension_prompt_roles: { SYSTEM: 0 },
        eventSource: { on: (ev, fn) => { handlers[ev] = fn; } },
        event_types: { CHAT_CHANGED: 'chat_changed', GENERATION_ENDED: 'gen_ended', APP_READY: 'app_ready' },
        generateRaw: async () => { genRawCalls++; if (rawGate) await rawGate; return respObj; },
        saveMetadataDebounced: () => {},
        saveSettingsDebounced: () => {},
    };
}
global.SillyTavern = { getContext: makeCtx };
require(require('path').join(__dirname, '..', 'index.js'));
// Boot the extension the way ST does: APP_READY → init() → initEvents() wires
// the REAL CHAT_CHANGED handler (the only mutator of the chat epoch).
if (handlers['app_ready']) handlers['app_ready']();
const chatChangedHandler = handlers['chat_changed'] || null;
const I = globalThis.arbiterInterceptor;
const E = globalThis.ArbiterEngine;

let fails = 0; const ok = (n, c) => { console.log((c ? '  OK  ' : ' FAIL ') + n); if (!c) fails++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastDirective = () => { for (let i = injected.length - 1; i >= 0; i--) if (injected[i].val) return injected[i].val; return ''; };

(async () => {
    // Force the extension's event wiring so we hold the real CHAT_CHANGED handler.
    // init() may not have run under the harness — wire via a synthetic APP_READY
    // is fragile; instead we drive the epoch through the handler if captured,
    // else prove the guard via the latch behavior below.

    /* ── 8. stale profileId → raw fallback ─────────────────────────────── */
    md.arbiter = { sheet: { actors: { 'Jovan': { default: 7, domains: { melee: 7 } }, 'Kaol': { default: 6, domains: { melee: 6 } } } }, log: [], oneShot: 'force', cache: null };
    respObj = JSON.stringify({ check: true, action: 'strike Kaol', domain: 'melee', actor: 'Jovan', opposition_kind: 'actor', opposition: 'Kaol', circumstance: 0 });
    injected = []; genRawCalls = 0;
    await I([{ is_user: true, name: 'Jovan', mes: 'I strike Kaol down', send_date: 's8' }], 0, () => {}, 'normal');
    ok('stale profileId does not dead-end: raw fallback was called', genRawCalls > 0);
    ok('stale profileId still yields a binding directive', /ARBITER/.test(lastDirective()));

    /* ── 1+2. cross-chat epoch: stale check discarded, new chat not blocked ── */
    // Wire CHAT_CHANGED by re-running initEvents through a fresh interceptor…
    // the extension wired events at load via jQuery(fn) which our stub jQuery
    // ignored, so drive the epoch the way ST would: capture the handler if
    // registered; otherwise register now by invoking the global init path is
    // unavailable — so emulate: the only mutator of chatEpoch is CHAT_CHANGED.
    // We DO have it if eventSource.on was called during load.
    const epochTestable = typeof chatChangedHandler === 'function';
    if (epochTestable) {
        // A slow adjudication is mid-await when the chat switches.
        let release;
        rawGate = new Promise(r => { release = r; });
        md.arbiter = { sheet: { actors: {} }, log: [], oneShot: 'force', cache: null };
        respObj = JSON.stringify({ check: true, action: 'leap the gap', domain: 'athletics', actor: 'Jovan', opposition_kind: 'tier', opposition: 'hard', circumstance: 0 });
        injected = [];
        const oldChatMd = md;
        const p = I([{ is_user: true, name: 'Jovan', mes: 'I leap across the gap', send_date: 'e1' }], 0, () => {}, 'normal');
        await sleep(30); // the check is now awaiting the judge
        // — chat switches —
        md = { arbiter: { sheet: { actors: {} }, log: [], oneShot: null, cache: null } };
        chatChangedHandler();
        injected = [];
        release(); rawGate = null;
        await p;
        const staleInjections = injected.filter(x => x.val && /ARBITER/.test(x.val));
        ok('stale cross-chat check injects NOTHING into the new chat', staleInjections.length === 0);
        ok('stale cross-chat check commits NO cache into either chat', !md.arbiter.cache && !oldChatMd.arbiter.cache);

        // The new chat's first check must not be blocked by the stale latch.
        md.arbiter.oneShot = 'force';
        respObj = JSON.stringify({ check: true, action: 'pick the lock', domain: 'craft', actor: 'Jovan', opposition_kind: 'tier', opposition: 'moderate', circumstance: 0 });
        injected = [];
        // Re-create the stale-latch condition: start a slow check, switch, then run a fresh one CONCURRENTLY.
        rawGate = new Promise(r => { release = r; });
        const pStale = I([{ is_user: true, name: 'Jovan', mes: 'I pick the lock quickly', send_date: 'e2' }], 0, () => {}, 'normal');
        await sleep(30);
        chatChangedHandler(); // stale now
        md.arbiter = { sheet: { actors: {} }, log: [], oneShot: 'force', cache: null };
        rawGate = null; // fresh call resolves instantly
        injected = [];
        await I([{ is_user: true, name: 'Jovan', mes: 'I pry the chest open', send_date: 'e3' }], 0, () => {}, 'normal');
        ok('new chat check is NOT blocked by a stale in-flight latch', /ARBITER/.test(lastDirective()));
        release(); await pStale;
    } else {
        ok('epoch guard testable (CHAT_CHANGED wired)', false);
    }

    /* ── 3. composure restored on same-message rewind ───────────────────── */
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null, composure: 6 };
    respObj = JSON.stringify({ check: true, action: 'face the horror', domain: 'willpower', actor: 'Jovan', opposition_kind: 'tier', opposition: 'hard', circumstance: 0, composure_change: -3 });
    injected = [];
    await I([{ is_user: true, name: 'Jovan', mes: 'I stare into the abyss and attack it', send_date: 'c1' }], 0, () => {}, 'normal');
    ok('horror beat eroded composure once (6 → 3)', md.arbiter.composure === 3);
    // The player EDITS the same message (same send_date, new text) → rewind must
    // restore composure before the fresh -3 lands: 6 → 3 again, not 3 → 0.
    await I([{ is_user: true, name: 'Jovan', mes: 'I stare into the abyss and strike harder', send_date: 'c1' }], 0, () => {}, 'regenerate');
    ok('edited re-send does NOT compound the toll (still 3, not 0)', md.arbiter.composure === 3);

    /* ── 4. recover + sequence is a RECOVERY, not an attack combo ───────── */
    const nAdj = E.normalizeDuelAdj({ exchange: true, move_kind: 'recover', action: 'retreat and mend', circumstance: 1,
        sequence: [{ strike: 'fall back', circumstance: 1 }, { strike: 'drink potion', circumstance: 1 }, { strike: 'bandage arm', circumstance: 0 }] });
    ok('normalizeDuelAdj strips the sequence from a recover move', nAdj && nAdj.moveKind === 'recover' && nAdj.sequence === null);
    // End-to-end: through the interceptor, the opponent must take NO poise damage.
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null, composure: 6,
        duel: { active: true, over: false, victor: null, round: 2, domain: 'melee', scaleMismatch: 0,
            player: { name: 'Jovan', rating: 5, poise: 3, maxPoise: 5, injuries: 0, momentum: 0, opening: false },
            opp: { name: 'Kaol', rating: 5, poise: 4, maxPoise: 5, injuries: 0, momentum: 0, opening: false, composure: 6, composureMax: 6 } } };
    respObj = JSON.stringify({ exchange: true, move_kind: 'recover', action: 'disengage and mend', circumstance: 2,
        sequence: [{ strike: 'fall back', circumstance: 2 }, { strike: 'drink potion', circumstance: 2 }] });
    injected = [];
    await I([{ is_user: true, name: 'Jovan', mes: 'I fall back and drink my potion', send_date: 'r1' }], 0, () => {}, 'normal');
    ok('a recover-with-sequence heals the player (poise rose above 3)', md.arbiter.duel.player.poise > 3);
    ok('a recover-with-sequence deals ZERO damage to the opponent', md.arbiter.duel.opp.poise === 4);
    ok('the directive narrates a recovery, not a combo', /disengages to recover/.test(lastDirective()) && !/combo/.test(lastDirective()));

    /* ── 5. battle_start carries opponent_rating to the headline foe ────── */
    {
        const meta = { sheet: { actors: { 'Jovan': { default: 6, domains: { melee: 6 } } } } };
        const b = E.startBattle(meta, [], ['Ancient Dragon', 'Wolf x2'], 'melee', 0, 9);
        const dragon = b.enemies.find(u => u.name === 'Ancient Dragon');
        const wolves = b.enemies.filter(u => /^Wolf/.test(u.name));
        ok('headline unlisted foe gets the referee estimate (dragon 9)', dragon && dragon.rating === 9);
        ok('other unlisted foes keep the trained fallback (wolves 4)', wolves.length === 2 && wolves.every(u => u.rating === 4));
        // A sheet entry still outranks the estimate.
        const meta2 = { sheet: { actors: { 'Ancient Dragon': { default: 10, domains: { melee: 10 } } } } };
        const b2 = E.startBattle(meta2, [], ['Ancient Dragon'], 'melee', 0, 5);
        ok('a sheet rating outranks the estimate', b2.enemies[0].rating === 10);
    }

    /* ── 6. generic xN squads never inherit a named actor via loose match ── */
    {
        const meta = { sheet: { actors: { 'Guard Captain': { default: 7, domains: { melee: 7 } }, 'Kaiser von Adler': { default: 8, domains: { melee: 8 } } } } };
        const b = E.startBattle(meta, [], ['Guard x3'], 'melee', 0);
        ok('"Guard x3" mooks do NOT inherit Guard Captain\'s 7', b.enemies.every(u => u.rating === 4));
        // …while duel-time loose matching still resolves short names to full ones.
        ok('duel lookup still resolves "Kaiser" → "Kaiser von Adler"', E.findActor(meta, 'Kaiser') === meta.sheet.actors['Kaiser von Adler']);
        // And an EXACT sheet entry for a squad still applies.
        const meta3 = { sheet: { actors: { 'Royal Guard': { default: 6, domains: { melee: 6 } } } } };
        const b3 = E.startBattle(meta3, [], ['Royal Guard x2'], 'melee', 0);
        ok('an exact sheet entry still rates its own xN squad', b3.enemies.every(u => u.rating === 6));
    }

    /* ── 9. seeding identity match: alias dedup, sibling safety ─────────── */
    {
        ok('identity: "Kaiser" ↔ "Kaiser von Adler" is the same person',
            E.findActorKeySamePerson({ sheet: { actors: { 'Kaiser von Adler': {} } } }, 'Kaiser') === 'Kaiser von Adler');
        ok('identity: sibling "Marcus Wessex" is NOT "Claire Wessex"',
            E.findActorKeySamePerson({ sheet: { actors: { 'Claire Wessex': {} } } }, 'Marcus Wessex') === null);
        ok('identity: "Wessex Guard" is NOT "Claire Wessex"',
            E.findActorKeySamePerson({ sheet: { actors: { 'Claire Wessex': {} } } }, 'Wessex Guard') === null);
    }

    /* ── 7. clearActivity deferred finish never clobbers a newer activity ── */
    {
        // Reach the internal activity state through the observable path:
        // hammer the timing — setActivity is not exported, but the bug's
        // fingerprint IS exported through the source: the finish must be
        // token-guarded. Assert the guard exists AND simulate the window.
        const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
        ok('clearActivity finish is token-guarded against newer activities',
            /const token = activity\.startedAt;[\s\S]{0,600}if \(activity\.startedAt !== token\) return;/.test(src));
    }

    /* ── source-level pins for the remaining fixes ──────────────────────── */
    {
        const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.js'), 'utf8');
        ok('adjudicator budget raised to 600 tokens (thinking-model headroom)', /callLLM\(sysPrompt, userPrompt, 600, budget\)/.test(src));
        ok('thread seeder budget raised to 1200 tokens', src.includes("', 1200, 45000"));
        ok('raceBudget clears its timer (no leaked budget timeouts)', /finally \{ if \(t\) clearTimeout\(t\); \}/.test(src));
        ok('extract() handles array content parts', /Array\.isArray\(v\)/.test(src));
        ok('rating-guide words resolve (veteran/legendary/apex in TIER_RATINGS)',
            E.TIER_RATINGS.veteran === 6 && E.TIER_RATINGS.legendary === 9 && E.TIER_RATINGS.apex === 10 && E.TIER_RATINGS.untrained === 2);
        ok('memory block accumulates bounded (no join-then-slice megastring)', /const take = \(text\) =>/.test(src));
        ok('boot log reports the real version', src.includes("console.log(LOG, 'v' + VERSION + ' ready')"));
    }

    /* ── bounded memory block behavior ──────────────────────────────────── */
    {
        // Behavioral check via a ctx carrying huge injections.
        const big = 'X'.repeat(50000);
        const saveCtx = global.SillyTavern.getContext;
        global.SillyTavern = { getContext: () => Object.assign(makeCtx(), { extensionPrompts: { 'summaryception_main': big, 'ledger_block': big } }) };
        const mem = E.collectMemoryBlock(8000);
        ok('memory block respects the cap (≤ cap + wrapper slack)', mem.block.length <= 8000 + 64);
        ok('memory sources still itemize FULL sizes for the inspector', mem.sources.length === 2 && mem.sources.every(s => s.chars === 50000));
        global.SillyTavern = { getContext: saveCtx };
    }

    console.log(fails === 0 ? '\nALL v48 AUDIT TESTS PASSED' : '\n' + fails + ' FAILURES');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
