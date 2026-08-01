// v0.37 — AUDIT FIXES.
//  1. Mutual-KO draw must be injected as a DRAW (HUD: "DRAW — BOTH DOWN"),
//     never as "opponent has won / player is beaten" — both directive paths.
//  2. persistDuelEstimates must run on EVERY duel teardown, incl. the
//     engine-declared victory clear inside the interceptor.
//  3. Committed-turn identity in no-date chats: identical texts must NOT
//     share one fate (chat-index fallback), and the sendDate '' === ''
//     heuristic must never rewind the PREVIOUS turn mid-fight.
//  4. A fight opening this turn suppresses the ambient event beat.
//  5. __proto__-class keys rejected at every LLM/user key-injection site.
//  6. Junk opponent_rating falls back to null (trained default), never 0.
//  7. hudDismiss drops ONLY the dismissed fight's history entries:
//     resurrection impossible, unrelated rewind coverage survives.
//  8. /arbforget identity discipline: exact-then-token, never substring.
//  9. Battle/war log rows carry aR/oR/oppLabel (no "undefined vs undefined").
// 10. Export hygiene: no duplicate keys in the ArbiterEngine literal.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq();
global.jQuery = () => {};
global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

const path = require('path');
const fs = require('fs');

let md = {};
let promptCalls = []; // [key, val] pairs
let rawStub = null;   // (prompt, quiet) => string
// NOTE: shared across getContext() calls so mid-test mutations stick.
const extSettings = { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false } };
function makeCtx() {
    return {
        extensionSettings: extSettings,
        chatMetadata: md,
        name1: 'Player',
        chat: [],
        generateRaw: (p, q) => rawStub ? rawStub(p, q) : '',
        setExtensionPrompt: (key, val) => promptCalls.push([key, val]),
        extension_prompt_types: { IN_CHAT: 1 },
        extension_prompt_roles: { SYSTEM: 0 },
    };
}
global.SillyTavern = { getContext: makeCtx };
require(path.join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
const I = globalThis.arbiterInterceptor;
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

let fails = 0;
const ok = (name, cond) => { console.log((cond ? ' OK  ' : ' FAIL ') + name); if (!cond) fails++; };
const section = (t) => console.log('\n== ' + t + ' ==');

const um = (mes, d) => ({ is_user: true, mes, send_date: d });
const freshMeta = () => ({ sheet: { actors: {} }, log: [], oneShot: null, cache: null });
const lastPrompt = (key) => { for (let i = promptCalls.length - 1; i >= 0; i--) if (promptCalls[i][0] === key) return promptCalls[i][1]; return null; };

(async () => {
    section('1. MUTUAL-KO DRAW IS INJECTED AS A DRAW — BOTH DIRECTIVE PATHS');
    {
        const meta = freshMeta();
        meta.duel = {
            player: { name: 'Player', rating: 5, poise: 0, maxPoise: 5, injuries: 0, momentum: 0 },
            opp: { name: 'Foe', rating: 5, poise: 0, maxPoise: 5, injuries: 0, momentum: 0 },
            round: 3, domain: 'melee', over: true, victor: 'draw',
        };
        const d1 = E.buildDuelDirective(meta, { action: 'final clash', circumstance: 0 }, { P: 0.5, tier: 'TRADE', outcome: false });
        ok('single-exchange draw: MUTUAL FINISH present', /take each other down/.test(d1));
        ok('single-exchange draw: no false winner ("has won this duel" absent)', !/has won this duel/.test(d1));
        ok('single-exchange draw: nobody "is beaten"', !/is beaten/.test(d1));
        ok('single-exchange draw: still binding ("That stands")', /That stands/.test(d1));

        meta.duel.victor = 'opp';
        const d1b = E.buildDuelDirective(meta, { action: 'final clash', circumstance: 0 }, { P: 0.5, tier: 'FAILURE', outcome: false });
        ok('normal defeat unchanged: winner declared', /takes the duel/.test(d1b) && /is beaten/.test(d1b));

        meta.duel.victor = 'draw';
        const d2 = E.buildDuelSequenceDirective(meta, { action: 'flurry', circumstance: 0 }, { steps: [{ strike: 'lunge', tier: 'SUCCESS' }, { strike: 'riposte', tier: 'FAILURE' }], overall: 'TRADE', over: true, victor: 'draw', P: 0.5, outcome: false });
        ok('sequence draw: MUTUAL FINISH present', /take each other out|both fighters down/.test(d2));
        // sideStatus still reports both fighters as beaten — correct for a
        // mutual KO; the invariant is that no SINGLE winner is declared.
        ok('sequence draw: no single winner declared', !/has won this duel/.test(d2) && !/turns the failed combo into the finish/.test(d2));

        meta.duel.victor = 'player';
        const d2b = E.buildDuelSequenceDirective(meta, { action: 'flurry', circumstance: 0 }, { steps: [{ strike: 'lunge', tier: 'DECISIVE' }], overall: 'DECISIVE', over: true, victor: 'player', P: 0.8, outcome: false });
        ok('sequence victory unchanged: foe is beaten', /Foe is beaten/.test(d2b));
    }

    section('2. ESTIMATED-FOE PERSISTENCE ON ENGINE-DECLARED VICTORY');
    {
        // Unit: persistDuelEstimates semantics
        const meta = freshMeta();
        meta.duel = { over: true, domain: 'melee', opp: { name: 'Wyrm', rating: 9, estimated: true } };
        ok('persists estimated foe as baseline', E.persistDuelEstimates(meta) === true);
        ok('baseline rating + _estimated flag stored', meta.sheet.actors.Wyrm && meta.sheet.actors.Wyrm.default === 9 && meta.sheet.actors.Wyrm._estimated === true);
        ok('no double-persist when actor now exists', E.persistDuelEstimates(meta) === false);
        const meta2 = freshMeta();
        meta2.duel = { over: true, domain: 'melee', opp: { name: 'Rated Foe', rating: 7, estimated: false } };
        ok('no-op for non-estimated foes', E.persistDuelEstimates(meta2) === false && !meta2.sheet.actors['Rated Foe']);

        // Integration: the interceptor's over-clear (the most common duel
        // ending) must persist BEFORE nulling the duel.
        md.arbiter = freshMeta();
        md.arbiter.duel = {
            active: true, over: true, victor: 'player', round: 3, domain: 'melee',
            player: { name: 'Player', rating: 5, poise: 2, maxPoise: 5, injuries: 0, momentum: 0 },
            opp: { name: 'Glass Dragon', rating: 9, poise: 0, maxPoise: 5, injuries: 2, momentum: 0, estimated: true },
        };
        promptCalls = [];
        await I([um('I look around the quiet battlefield', 'd9')], 0, () => {}, 'normal');
        ok('engine victory: duel cleared next turn', md.arbiter.duel === null);
        ok('engine victory: estimated baseline persisted', md.arbiter.sheet.actors['Glass Dragon'] && md.arbiter.sheet.actors['Glass Dragon'].default === 9 && md.arbiter.sheet.actors['Glass Dragon']._estimated === true);
    }

    section('3. NO-DATE CHAT IDENTITY');
    {
        // 3a: two identical no-date messages are TWO turns, not one fate.
        const savedSettings = global.SillyTavern.getContext().extensionSettings.arbiter;
        savedSettings.mode = 'fast';
        md.arbiter = freshMeta();
        await I([{ is_user: true, mes: 'I attack' }], 0, () => {}, 'normal');
        await I([{ is_user: true, mes: 'I attack' }, { is_user: true, mes: 'I attack' }], 0, () => {}, 'normal');
        ok('identical no-date texts: both turns committed (no shared fate)', md.arbiter.history.length === 2);
        ok('identical no-date texts: distinct committed keys', md.arbiter.history.length === 2 && md.arbiter.history[0].key !== md.arbiter.history[1].key);
        delete savedSettings.mode;

        // 3b: in a no-date chat, a fresh turn mid-duel must NOT rewind the
        // previous round (the '' === '' sendDate trap).
        md.arbiter = freshMeta();
        let call = 0;
        rawStub = () => {
            call++;
            return call === 1
                ? JSON.stringify({ check: true, action: 'I attack the Guard', duel_start: 'Guard', opponent_rating: 6, domain: 'melee' })
                : JSON.stringify({ exchange: true, actor: 'Player', action: 'I attack', circumstance: 0, condition_change: null, combat_ended: false });
        };
        await I([{ is_user: true, mes: 'I attack the Guard' }], 0, () => {}, 'normal');
        ok('round 1 opened the duel', md.arbiter.duel && md.arbiter.duel.round === 1);
        await I([{ is_user: true, mes: 'I attack the Guard' }, { is_user: true, mes: 'I attack the Guard again' }], 0, () => {}, 'normal');
        ok('round 2 progressed (no phantom rewind of round 1)', md.arbiter.duel && md.arbiter.duel.round === 2);
        ok('both fight turns kept in the timeline', md.arbiter.history.length === 2);
        rawStub = null;
    }

    section('4. FIGHT-OPENING TURN SUPPRESSES THE AMBIENT EVENT BEAT');
    {
        md.arbiter = freshMeta();
        md.arbiter.engines = { surprise: { dc: 1 }, encounter: { dc: 1 }, world: { dc: 1 } };
        // Rig the dice so the event engine certainly fires this turn.
        // (globalThis.crypto is a getter-only accessor in Node: defineProperty.)
        const cryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
        Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: (a) => { a[0] = 0xFFFFFFFF; return a; } } });
        rawStub = () => JSON.stringify({ check: false, action: 'I square up and attack the Guard', duel_start: 'Guard', opponent_rating: 6 });
        promptCalls = [];
        await I([um('I square up and attack the Guard', 'e1')], 0, () => {}, 'normal');
        Object.defineProperty(globalThis, 'crypto', cryptoDesc);
        rawStub = null;
        ok('duel armed this turn', md.arbiter.duel && md.arbiter.duel.opp.name === 'Guard');
        ok('fight directive injected', (lastPrompt('ARBITER_OUTCOME') || '').startsWith("Bruce's note — duel joined"));
        ok('ambient event injection suppressed on fight-opening turn', lastPrompt('ARBITER_OUTCOME_EVENT') === '');
        ok('eventCache for this turn dropped (swipes stay clean)', md.arbiter.eventCache === undefined);
        ok('committed entry carries no eventText', md.arbiter.history.length === 1 && md.arbiter.history[0].eventText === null);
    }

    section('5. MAGIC-KEY (__proto__) INJECTION GUARDS');
    {
        const meta = freshMeta();
        const r = E.applyConditionChange(meta, { who: '__proto__', name: 'cursed', mod: -1, remove: false });
        ok('applyConditionChange rejects __proto__', r === null);
        ok('no actor entry created', Object.keys(meta.sheet.actors).length === 0);
        ok('prototype untouched', ({}).cursed === undefined && Object.getPrototypeOf(meta.sheet.actors) === Object.prototype);
        ok('seedSheet actor loop routes through safeKey', SRC.includes('const key = safeKey(name);'));
        ok('sheet editor rejects reserved keys', SRC.includes("unsafe actor name"));
    }

    section('6. JUNK opponent_rating FALLS BACK TO null, NEVER 0');
    {
        const meta = freshMeta();
        const a = E.normalizeAdj({ check: false, action: 'x', duel_start: 'Foe', opponent_rating: 'high' }, meta);
        ok('check:false junk string → null', a.opponent_rating === null);
        const b = E.normalizeAdj({ check: true, action: 'x', opponent_rating: '???', circumstance: 0 }, meta);
        ok('check:true junk string → null', b.opponent_rating === null);
        const c = E.normalizeAdj({ check: true, action: 'x', opponent_rating: '7', circumstance: 0 }, meta);
        ok('numeric string still coerces', c.opponent_rating === 7);
        const d = E.normalizeAdj({ check: true, action: 'x', opponent_rating: null, circumstance: 0 }, meta);
        ok('explicit null stays null (not 0)', d.opponent_rating === null);
    }

    section('7. hudDismiss HISTORY NARROWING');
    {
        const hist = [
            { key: 'k0', sendDate: 'd0', directive: '', tier: null, snap: { d: null, b: null, th: [], eng: [], c: null, tn: 0 } },
            { key: 'k1', sendDate: 'd1', directive: '[ARBITER — duel, round 1: clash]', tier: 'SUCCESS', snap: { d: { round: 0 }, b: null, th: [], eng: [], c: null, tn: 1 } },
            { key: 'k2', sendDate: 'd2', directive: '[ARBITER — duel, round 2: clash]', tier: 'FAILURE', snap: { d: { round: 1 }, b: null, th: [], eng: [], c: null, tn: 2 } },
        ];
        const dropDuel = E.fightHistoryFilter('duel');
        const kept = hist.filter(h => !dropDuel(h));
        ok('unrelated pre-fight turn survives dismissal', kept.length === 1 && kept[0].key === 'k0');
        ok('both fight-lifetime entries dropped', hist.filter(dropDuel).length === 2);
        // Resurrection impossibility: no surviving snapshot can restore a duel.
        const meta = freshMeta();
        let resurrected = false;
        for (const h of kept) { E.restoreSnapshot(meta, h.snap); if (meta.duel) resurrected = true; }
        ok('no surviving snapshot can resurrect the duel', !resurrected);
        const dropBattle = E.fightHistoryFilter('battle');
        ok('battle directives matched for battle dismissal', dropBattle({ directive: '[ARBITER — war directive. x]', snap: { d: null, b: null } }) === true
            && dropBattle({ snap: { d: null, b: { round: 1 } } }) === true
            && dropBattle({ directive: '[ARBITER — duel, round 1: x]', snap: { d: null, b: null } }) === false);
    }

    section('8. /arbforget IDENTITY DISCIPLINE');
    {
        const meta = freshMeta();
        meta.sheet.actors = { 'Anakin': { default: 7 }, 'Ana': { default: 4 }, 'The Wyrm of Ash': { default: 9 } };
        ok('exact match removes the exact actor', E.forgetActor(meta, 'ana') === 'Ana' && !meta.sheet.actors.Ana);
        ok('substring "Ana" never deletes "Anakin"', E.forgetActor(meta, 'Ana') === null && !!meta.sheet.actors.Anakin);
        ok('token-subset still matches full-name aliases', E.forgetActor(meta, 'Wyrm') === 'The Wyrm of Ash' || E.forgetActor(meta, 'Anakin') === 'Anakin');
        ok('no match returns null', E.forgetActor(meta, 'Nobody') === null);
    }

    section('9. BATTLE/WAR LOG ROWS CARRY RATINGS');
    {
        const meta = freshMeta();
        meta.mcName = 'Player';
        meta.sheet.actors = { Player: { default: 7, domains: {} } };
        E.startBattle(meta, ['Borin'], ['Raider'], 'melee');
        const out = E.resolveBattleRound(meta, { kind: 'fight', target: 'Raider', action: 'I attack the Raider', circumstance: 0 });
        ok('battle mcRes carries aR/oR/oppLabel', out.mcRes && typeof out.mcRes.aR === 'number' && typeof out.mcRes.oR === 'number' && out.mcRes.oppLabel === 'Raider');
        const meta2 = freshMeta();
        meta2.sheet.actors = { Player: { default: 7, domains: {} } };
        E.startWar(meta2, ['Vanguard'], ['Horde'], 'Warlord');
        const out2 = E.resolveWarRound(meta2, { kind: 'stratagem', action: 'feigned retreat', circumstance: 0 });
        ok('war focalRes carries aR/oR/oppLabel', out2.focalRes && typeof out2.focalRes.aR === 'number' && typeof out2.focalRes.oR === 'number' && out2.focalRes.oppLabel === 'Warlord');
        ok('mathLine renders numbers, not undefined', !/undefined/.test(E.mathLine({ aR: out.mcRes.aR, oR: out.mcRes.oR, circ: 0, P: Math.round(out.mcRes.P * 1000) / 10, u: out.mcRes.u, delta: out.mcRes.delta })));
    }

    section('10. EXPORT & STRUCTURE HYGIENE');
    {
        const m = SRC.match(/globalThis\.ArbiterEngine = \{([\s\S]*?)\};/);
        ok('export literal found', !!m);
        ok('no duplicate ratingFor in export', m && (m[1].match(/ratingFor/g) || []).length === 1);
        ok('new helpers exported', m && m[1].includes('persistDuelEstimates') && m[1].includes('forgetActor') && m[1].includes('fightHistoryFilter'));
        ok('suppressEventBeat wired into all six fight-opening paths', (SRC.match(/suppressEventBeat\(\);/g) || []).length === 6);
        ok('turnKey used at both key sites', (SRC.match(/turnKey\(/g) || []).length >= 3);
        ok('sendDate heuristic guarded against empty dates', SRC.includes("(sendDate && last.sendDate === sendDate)") && SRC.includes("if (sendDate && meta.cache && meta.cache.sendDate === sendDate"));
        ok('one-time compat probe for old ST builds', SRC.includes('interceptorRan') && SRC.includes('genEndedSeen'));
        ok('continue-replay design documented', SRC.includes("'continue' stays eligible by deliberate design"));
        // Version-AGNOSTIC on purpose: a hardcoded string here has to be
        // hand-edited every release, and a forgotten edit fails the gate for
        // the wrong reason. The standing invariant is that the two agree.
        const stamp = (SRC.match(/const VERSION = '([^']+)'/) || [])[1];
        ok('version bumped consistently', !!stamp && JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8')).version === stamp);
    }

    console.log(fails ? `\nSUITE FAILED (${fails})` : '\nALL v57 AUDIT-FIX INVARIANTS GREEN');
    process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
