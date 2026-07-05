// v0.19.0: opt-in World Info / lorebook context for the referee.
// Accessor mirrors the Copilot extension's verified loadWorldInfo pattern; entry
// activation is done here — constant entries always, keyword/selective entries
// when their words appear in the action + recent story. Vector-only entries (no
// keys) are not activated. This suite proves the activation logic, the async
// collection (with a mocked loadWorldInfo), book resolution, and that the
// inspector reflects an activated block.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {};
let settings = { arbiter: { enabled: true, timeoutMs: 6000, toastResults: false, eventEngine: false,
  profileId: 'MAIN', autoDuel: true, mode: 'adjudicated', preset: 'realistic', tieBand: 0, duelPoise: 5,
  defaultRating: 5, ctxMsgs: 3, composure: true, composureMax: 6,
  adjIncludeMemory: false, adjIncludeCard: false, adjIncludeWorld: false, adjWorldBooks: '', adjFullChat: false, adjContextK: 40, adjIncludeHidden: false } };
// A fake lorebook the mocked loadWorldInfo will return.
const BOOK = { entries: {
  0: { comment: 'Arena', key: ['rooftop', 'arena'], content: 'The rooftop arena is rain-slicked and unstable.', order: 10 },
  1: { comment: 'World Law', constant: true, key: [], content: 'Gravity here is half Earth-normal.', order: 5 },
  2: { comment: 'Cyber', key: ['kaiser'], keysecondary: ['augment', 'implant'], selective: true, content: 'Kaiser has military-grade reflex augments.', order: 20 },
  3: { comment: 'Disabled', key: ['rooftop'], content: 'This should never appear.', disable: true, order: 1 },
  4: { comment: 'VectorOnly', key: [], vectorized: true, content: 'Semantic-only lore, no keywords.', order: 30 },
  5: { comment: 'Empty', key: ['arena'], content: '   ', order: 40 },
} };
let ctxObj = { extensionSettings: settings, chatMetadata: md, name1: 'Jovan', name2: 'Kaiser',
  loadWorldInfo: async (name) => (name === 'TestBook' ? BOOK : null),
  selected_world_info: [],
  ConnectionManagerRequestService: { sendRequest: async () => '{}' },
  setExtensionPrompt(){}, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 },
  eventSource: { on: () => {} }, event_types: {}, extensionPrompts: {} };
global.SillyTavern = { getContext: () => ctxObj };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
const I = globalThis.arbiterInterceptor;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };
const s = settings.arbiter;

(async () => {
  const entries = Object.values(BOOK.entries);

  // ── A. Pure activation ──
  let a = E.wiActivateEntries(entries, 'I climb onto the rooftop.'); // 'rooftop' hits Arena; constant World Law always
  const titles = a.map(h => h.title);
  ok('constant entry always fires', titles.includes('World Law'));
  ok('keyword entry fires when its key is in scan', titles.includes('Arena'));
  ok('disabled entry never fires', !titles.includes('Disabled'));
  ok('empty-content entry skipped', !titles.includes('Empty'));
  ok('vector-only entry (no keys) does not fire here', !titles.includes('VectorOnly'));
  ok('selective entry withheld without a secondary hit', !titles.includes('Cyber'));

  // selective now satisfied: primary (kaiser) AND a secondary (augment)
  a = E.wiActivateEntries(entries, 'Kaiser flexes his augment as he steps onto the rooftop.');
  const t2 = a.map(h => h.title);
  ok('selective entry fires when primary + secondary both hit', t2.includes('Cyber'));
  ok('activation is ordered by entry order (World Law before Arena)', t2.indexOf('World Law') < t2.indexOf('Arena'));

  // no keyword hits at all → only constant
  a = E.wiActivateEntries(entries, 'A quiet market street, nothing notable.');
  ok('with no keyword hits, only constant entries fire', a.map(h => h.title).join() === 'World Law');

  // ── B. Book resolution ──
  s.adjWorldBooks = 'TestBook';
  ok('resolveBooks honours the manual pin', E.wiResolveBooks().join() === 'TestBook');
  s.adjWorldBooks = '';
  ctxObj.selected_world_info = ['TestBook'];
  ok('resolveBooks falls back to selected_world_info', E.wiResolveBooks().includes('TestBook'));

  // ── C. Async collection ──
  s.adjIncludeWorld = false;
  ok('world OFF: collection returns empty', (await E.collectWorldInfoBlock('rooftop kaiser augment', 8000)) === '');
  s.adjIncludeWorld = true; s.adjWorldBooks = 'TestBook';
  let block = await E.collectWorldInfoBlock('I fight Kaiser on the rooftop; his augment whirs.', 8000);
  ok('world ON: <world_info> block returned', block.includes('<world_info>') && block.includes('</world_info>'));
  ok('world ON: constant + keyword + selective content present', block.includes('half Earth-normal') && block.includes('rain-slicked') && block.includes('reflex augments'));
  ok('world ON: disabled/vector/empty content absent', !block.includes('should never appear') && !block.includes('Semantic-only'));
  // budget clamp
  let tiny = await E.collectWorldInfoBlock('rooftop kaiser augment', 40);
  ok('world: respects the char budget', tiny.length <= 90);

  // ── D. Inspector reflects an activated world block through a real turn ──
  s.adjWorldBooks = 'TestBook'; s.adjIncludeWorld = true;
  md.arbiter = { sheet: { actors: { Jovan: { default: 6, domains: { melee: 7 } } } }, log: [], oneShot: 'force', cache: null };
  ctxObj.chat = [{ is_user: true, name: 'Jovan', mes: 'On the rooftop, I strike Kaiser.' }];
  ctxObj.ConnectionManagerRequestService.sendRequest = async () => JSON.stringify({ check: true, action: 'strike Kaiser', domain: 'melee', actor: 'Jovan', opposition_kind: 'actor', opposition: 'Kaiser', circumstance: 0 });
  await I([{ is_user: true, name: 'Jovan', mes: 'On the rooftop, I strike Kaiser.', send_date: 'v36' }], 0, () => {}, 'normal');
  const L = E.getLastAdj();
  ok('inspector: world flag recorded ON', !!L && L.rich && L.rich.world === true);
  ok('inspector: the prompt actually carried the <world_info> block', !!L && L.user.includes('<world_info>') && L.user.includes('rain-slicked'));
  ok('inspector: world_info sits before <recent>', !!L && L.user.indexOf('<world_info>') < L.user.indexOf('<recent>'));

  console.log(fails === 0 ? 'ALL V36 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('THREW', e); process.exit(1); });
