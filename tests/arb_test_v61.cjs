// v61: the injection voice is UNIVERSAL — it speaks with the player's own
// persona name, whoever that is. ST's unset persona defaults ("User"/"Player")
// are role-words that read as corpo to a defensive storyteller persona, so
// they fall back to "Author's note". No name is ever hardcoded.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {}; const injections = {}; let settings = { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false, eventEngine: true } };
const ctxObj = { extensionSettings: settings, chatMetadata: md, name1: 'Jovan', setExtensionPrompt(k,v){ injections[k]=v; }, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } };
global.SillyTavern = { getContext: () => ctxObj };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

const freshEncounter = () => {
    md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null,
        engines: { surprise: { dc: 999 }, encounter: { dc: 1 }, world: { dc: 999 } }, tickCount: 0, threads: [] };
    delete injections.ARBITER_OUTCOME_EVENT;
};

(async () => {
    // 1. A real persona name → the note speaks AS that player
    ctxObj.name1 = 'Jovan';
    freshEncounter();
    await I([{ is_user: true, mes: 'a slow afternoon passes', send_date: 'n1' }], 0, () => {}, 'normal');
    ok("named persona → 'Jovan's note — …'", String(injections.ARBITER_OUTCOME_EVENT || '').startsWith("Jovan's note — "));

    // 2. A different player → THEIR name, never a leftover hardcoded one
    ctxObj.name1 = 'Lelouch';
    freshEncounter();
    await I([{ is_user: true, mes: 'another quiet hour', send_date: 'n2' }], 0, () => {}, 'normal');
    ok("second persona → 'Lelouch's note — …'", String(injections.ARBITER_OUTCOME_EVENT || '').startsWith("Lelouch's note — "));

    // 3. ST's unset defaults are role-words → the author's note, never "User's note"
    for (const unset of ['User', 'user', 'USER', 'Player', 'player', '', '   ']) {
        ctxObj.name1 = unset;
        freshEncounter();
        await I([{ is_user: true, mes: 'yet another lull', send_date: 'n3' + unset }], 0, () => {}, 'normal');
        ok(`role-word/unset persona "${unset}" → Author's note`, String(injections.ARBITER_OUTCOME_EVENT || '').startsWith("Author's note — "));
    }

    // 4. No name at all on the context → still the author's note (no throw)
    delete ctxObj.name1;
    freshEncounter();
    await I([{ is_user: true, mes: 'one more lull', send_date: 'n4' }], 0, () => {}, 'normal');
    ok('missing name1 → Author\'s note', String(injections.ARBITER_OUTCOME_EVENT || '').startsWith("Author's note — "));

    console.log(fails === 0 ? 'ALL V61 TESTS PASSED' : fails + ' FAILURES');
    process.exit(fails === 0 ? 0 : 1);
})();
