const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };
const fresh = { arbiter: {} };
global.SillyTavern = { getContext: () => ({ extensionSettings: fresh, chatMetadata: {}, name1: 'X', setExtensionPrompt(){}, extension_prompt_types:{IN_CHAT:1}, extension_prompt_roles:{SYSTEM:0}, chat: [] }) };
require(require('path').join(__dirname, '..', 'index.js'));
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
// Force defaults to materialize by reading settings via a benign interceptor call
(async () => {
  await globalThis.arbiterInterceptor([{ is_user: true, mes: 'hello', send_date: 'x' }], 0, () => {}, 'normal');
  ok('default memory ingest is 60k (full Summaryception context)', fresh.arbiter.seedMemoryK === 60);
  ok('default transcript window is 80k', fresh.arbiter.seedTranscriptK === 80);
  ok('default seed output is 6000 tokens (large-cast headroom)', fresh.arbiter.seedOutTokens === 6000);
  console.log(fails === 0 ? 'ALL V12 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
