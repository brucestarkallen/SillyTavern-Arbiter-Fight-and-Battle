// Flow test for the cache/edit/swipe logic with a recording setExtensionPrompt.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq();
global.jQuery = () => {};
global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

const calls = [];
let md = {};
function makeCtx() {
    return {
        extensionSettings: { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false } },
        chatMetadata: md,
        name1: 'Player',
        setExtensionPrompt: (key, val) => calls.push(val),
        extension_prompt_types: { IN_CHAT: 1 },
        extension_prompt_roles: { SYSTEM: 0 },
    };
}
global.SillyTavern = { getContext: makeCtx };
require(require('path').join(__dirname, '..', 'index.js'));
const I = globalThis.arbiterInterceptor;

// djb2 hash copied for key computation in the test
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h.toString(16);}

(async () => {
    // A) unchanged message + swipe + committed outcome => replay directive
    md.arbiter = { sheet:{actors:{}}, log:[], oneShot:null,
        cache: { key: hashStr('I attack him|d1'), directive: 'DIRECTIVE_A', tier: 'SUCCESS' } };
    calls.length = 0;
    await I([{ is_user: true, mes: 'I attack him', send_date: 'd1' }], 0, ()=>{}, 'swipe');
    console.log('A replay on swipe:', calls[calls.length-1] === 'DIRECTIVE_A' ? 'OK' : 'FAIL ' + JSON.stringify(calls));

    // B) unchanged message + swipe + committed NO-CHECK verdict => stand pat (no directive, no LLM)
    md.arbiter.cache = { key: hashStr('I attack him|d1'), directive: '', tier: null };
    calls.length = 0;
    await I([{ is_user: true, mes: 'I attack him', send_date: 'd1' }], 0, ()=>{}, 'swipe');
    console.log('B no-check stands:', calls.every(v => v === '') ? 'OK' : 'FAIL ' + JSON.stringify(calls));

    // C) EDITED message + regenerate => fresh attempt path runs (reaches the
    //    adjudicator; with no LLM route it degrades to no injection, no throw)
    md.arbiter.cache = { key: hashStr('I attack him|d1'), directive: 'DIRECTIVE_A', tier: 'SUCCESS' };
    calls.length = 0;
    await I([{ is_user: true, mes: 'I try to disarm him instead', send_date: 'd1' }], 0, ()=>{}, 'regenerate');
    const noReplay = !calls.includes('DIRECTIVE_A');
    console.log('C edited action does NOT replay old fate:', noReplay ? 'OK' : 'FAIL');

    // D) non-risky edit + swipe => gate declines, nothing injected
    calls.length = 0;
    await I([{ is_user: true, mes: 'hello there, lovely weather', send_date: 'd1' }], 0, ()=>{}, 'swipe');
    console.log('D gate declines chatter on swipe:', calls.every(v => v === '') ? 'OK' : 'FAIL');

    console.log('FLOW TESTS DONE');
})().catch(e => { console.error('THREW', e); process.exit(1); });
