const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
let md = {}; const injections = {};
let eps = {
  'summaryception': { value: 'SNIPPETS HERE' },
  'summaryception_recall': { value: 'RECALLED SCENE' },
  'cc_memory_ledger': { value: 'LEDGER STATES' },
  'cc_critique_inject': { value: 'DIRECTOR NOISE' },
};
global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { enabled: true, timeoutMs: 1600, toastResults: false } }, chatMetadata: md, extensionPrompts: eps, name1: 'Jovan', setExtensionPrompt(k,v){ injections[k]=v; }, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } }) };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine; const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

// 1. Memory collector coverage
md.note_prompt = 'AUTHORS NOTE PE FILE';
const mem = E.collectMemoryBlock(5000);
ok('collector reads Summaryception main + recall', mem.block.includes('SNIPPETS HERE') && mem.block.includes('RECALLED SCENE'));
ok('collector reads the character ledger', mem.block.includes('LEDGER STATES'));
ok("collector reads the Author's Note (PE bridge)", mem.block.includes('AUTHORS NOTE PE FILE'));
ok('collector excludes non-memory keys (director/critique)', !mem.block.includes('DIRECTOR NOISE'));
ok('sources are itemized for the inspector button', mem.sources.length === 4 && mem.sources.every(x => x.key && x.chars > 0));
delete md.note_prompt;

(async () => {
  // 2. New audited defaults take effect on a fresh store
  const fresh = { arbiter: {} };
  global.SillyTavern = { getContext: () => ({ extensionSettings: fresh, chatMetadata: md, name1: 'Jovan', setExtensionPrompt(k,v){ injections[k]=v; }, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 } }) };
  md.arbiter = { sheet: { actors: {} }, log: [], oneShot: null, cache: null };
  await I([{ is_user: true, mes: 'a calm morning at the academy', send_date: 'd1' }], 0, () => {}, 'normal');
  ok('eventEngine defaults ON (engines ticked on chatter)', md.arbiter.engines && md.arbiter.engines.surprise.dc <= 95);
  ok('ctxMsgs default is 10 (full immediate window)', fresh.arbiter.ctxMsgs === 10);
  ok('preset default realistic, mode adjudicated', fresh.arbiter.preset === 'realistic' && fresh.arbiter.mode === 'adjudicated');

  console.log(fails === 0 ? 'ALL V7 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
