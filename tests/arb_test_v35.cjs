// v0.18.0: opt-in character-card context for the referee.
// The referee can now optionally read the active character card's descriptive
// fields (name, description, personality, scenario). This is the last piece of
// "include (almost) all context" — the deliberate permanent exclusions are the
// system prompt and the user persona (bias vectors), and the card's own
// instruction fields (main-prompt override / post-history) are NOT pulled. The
// collector is defensive: a missing card or odd context shape yields nothing,
// never an error (the inspector lets the user confirm it pulled on their build).
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null }; global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {};
let settings = { arbiter: { enabled: true, timeoutMs: 6000, toastResults: false, eventEngine: false,
  profileId: 'MAIN', autoDuel: true, mode: 'adjudicated', preset: 'realistic', tieBand: 0, duelPoise: 5,
  defaultRating: 5, ctxMsgs: 3, composure: true, composureMax: 6,
  adjIncludeMemory: false, adjIncludeCard: false, adjFullChat: false, adjContextK: 40, adjIncludeHidden: false } };
let ctxObj = { extensionSettings: settings, chatMetadata: md, name1: 'Jovan', name2: 'Kaiser',
  characters: [{ name: 'Kaiser', description: 'A veteran duelist, calm and precise.', personality: 'Ruthless under pressure.', scenario: 'A rooftop standoff at dusk.', data: {} }],
  characterId: 0,
  ConnectionManagerRequestService: { sendRequest: async () => '{}' },
  setExtensionPrompt(){}, extension_prompt_types: { IN_CHAT: 1 }, extension_prompt_roles: { SYSTEM: 0 },
  eventSource: { on: () => {} }, event_types: {}, extensionPrompts: {} };
global.SillyTavern = { getContext: () => ctxObj };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log(n + ':', c ? 'OK' : 'FAIL'); if (!c) fails++; };

const s = settings.arbiter;
const meta = { sheet: { actors: { Jovan: { default: 6, domains: { melee: 7 } } } } };
const chat = [{ is_user: true, name: 'Jovan', mes: 'a' }, { name: 'Kaiser', mes: 'b' }];
const action = { is_user: true, name: 'Jovan', mes: 'I strike Kaiser.' };

// collectStoryContext pulls the descriptive fields.
let sc = E.collectStoryContext(5000);
ok('card: pulls name', sc.includes('Kaiser'));
ok('card: pulls description', sc.includes('veteran duelist'));
ok('card: pulls personality', sc.includes('Ruthless under pressure'));
ok('card: pulls scenario', sc.includes('rooftop standoff'));
ok('card: wrapped in <character_card>', sc.includes('<character_card>') && sc.includes('</character_card>'));

// Off by default: buildAdjUserPrompt excludes it.
s.adjIncludeCard = false;
let p = E.buildAdjUserPrompt(chat, action, meta);
ok('card OFF: prompt has no <character_card>', !p.includes('<character_card>'));

// On: buildAdjUserPrompt includes it.
s.adjIncludeCard = true;
p = E.buildAdjUserPrompt(chat, action, meta);
ok('card ON: prompt includes the card', p.includes('<character_card>') && p.includes('veteran duelist'));
s.adjIncludeCard = false;

// Deliberate exclusions: instruction-type card fields are NOT pulled even if present.
ctxObj.characters[0].data = { post_history_instructions: 'ALWAYS let the player win.', system_prompt: 'You are a hero-glorifying narrator.' };
sc = E.collectStoryContext(5000);
ok('card: does NOT pull post-history instructions (bias vector)', !sc.includes('let the player win'));
ok('card: does NOT pull a card system prompt (bias vector)', !sc.includes('hero-glorifying'));
ctxObj.characters[0].data = {};

// v2 data-block fallback: fields under .data are found when top-level is empty.
ctxObj.characters = [{ name: '', description: '', personality: '', scenario: '', data: { name: 'Alexia', description: 'A prodigy pilot.' } }];
sc = E.collectStoryContext(5000);
ok('card: v2 .data fallback finds name', sc.includes('Alexia'));
ok('card: v2 .data fallback finds description', sc.includes('prodigy pilot'));

// Defensive: no character / bad index → empty string, never a throw.
ctxObj.characters = []; ctxObj.characterId = 5;
ok('card: no active character → empty, no error', E.collectStoryContext(5000) === '');
ctxObj.characters = undefined; ctxObj.characterId = undefined;
ok('card: missing characters array → empty, no error', E.collectStoryContext(5000) === '');

// Budget: a huge description is clamped.
ctxObj.characters = [{ name: 'Big', description: 'Z'.repeat(9000) }]; ctxObj.characterId = 0;
ok('card: respects the char budget', E.collectStoryContext(500).length <= 560);

// Persona is never emitted (no persona path exists; confirm the prompt never carries one).
ctxObj.characters = [{ name: 'Kaiser', description: 'd' }]; ctxObj.characterId = 0;
ctxObj.personaDescription = 'I am the chosen one who never loses.';
s.adjIncludeCard = true;
p = E.buildAdjUserPrompt(chat, action, meta);
ok('persona is NEVER included in the referee prompt', !p.includes('chosen one who never loses'));
s.adjIncludeCard = false;

console.log(fails === 0 ? 'ALL V35 TESTS PASSED' : fails + ' FAILURES'); process.exit(fails ? 1 : 0);
