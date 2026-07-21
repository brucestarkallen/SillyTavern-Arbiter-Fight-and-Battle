// v0.31 — PLAYER IDENTITY: STORY NAME vs PERSONA LABEL.
// Root cause closed: the extension conflated the SillyTavern persona label
// (name1 — who is TYPING) with the player's in-story identity (who is ACTING).
// A persona "LO" playing "Jovan Oda" shares zero name tokens, so every layer
// broke at once: the referee was told the player IS "LO", sheet lookups missed
// the real entry (rating fell to default-5 forever), conditions split the
// person across two entries, and the player's own story name could be scored
// as the OPPONENT. meta.mcName (chat-scoped; UI field, /mcname, or learned by
// the seeder via player_story_name) is now the single story identity.
//   1. NEGATIVE CONTROL — the bug class, provably detected: with the story
//      name unset, a "Jovan Oda"-keyed sheet is unreachable from label "LO"
//      and the duel player is named "LO" at default rating 5.
//   2. With mcName set: duels/battles name the player by the STORY name and
//      resolve the real sheet rating; both alias forms are filtered from the
//      manual ally list (no self-duplicate).
//   3. Referee prompt: player character is the STORY name; the label is
//      declared the SAME person; unset name reproduces the legacy prompt.
//   4. normalizeAdj: actor forced to the story name; the story name, a bare
//      name fragment, and the persona label are all SELF (opponent hardening),
//      while a sibling sharing the surname stays a legitimate foe; a
//      self-opposition repaired to the 'hard' fallback resolves as a TIER
//      (7), not as an unlisted actor (trained 5).
//   5. Conditions filed under the LABEL land on the story entry (no split),
//      update the LIVE fight, and liveCombatant finds the player by alias.
//   6. reconcilePlayerEntries folds a pre-existing split (label entry with
//      conditions beside the story entry) into one; no-op when unset.
//   7. Seeder: learns player_story_name into an EMPTY mcName only, never
//      overwrites, rejects the narrator card's label, sends the label-alias
//      line in <voices>, and heals splits after every seed.
//   8. Composure penalty recognizes the actor via alias identity.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(v){return v === undefined ? '' : this;}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = () => noopJq(); global.jQuery = () => {}; global.window = global;
global.document = { getElementById: () => null };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

let md = {};
let name1 = 'LO';
let respObj = JSON.stringify({ check: false });
let lastPrompt = '';
function makeCtx() {
    return {
        name1, name2: 'Narrator',
        extensionSettings: { arbiter: { enabled: true, timeoutMs: 4000, toastResults: false, autoSeed: false, eventEngine: false, composure: true, composureMax: 6 } },
        chatMetadata: md,
        chat: [{ is_user: true, name: name1, mes: 'Jovan Oda steps onto the dueling ground.', send_date: 't1' }],
        setExtensionPrompt: () => {},
        extension_prompt_types: { IN_CHAT: 1 },
        extension_prompt_roles: { SYSTEM: 0 },
        eventSource: { on(){} }, event_types: {},
        generateRaw: async (arg) => { lastPrompt = (arg && typeof arg === 'object') ? String(arg.prompt || '') : String(arg || ''); return respObj; },
        saveMetadataDebounced: () => {}, saveSettingsDebounced: () => {},
    };
}
global.SillyTavern = { getContext: makeCtx };
require(require('path').join(__dirname, '..', 'index.js'));
const E = globalThis.ArbiterEngine;
let fails = 0; const ok = (n, c) => { console.log((c ? '  OK  ' : ' FAIL ') + n); if (!c) fails++; };
const um = (mes) => ({ is_user: true, name: name1, mes, send_date: 't' });
const freshMeta = () => { md.arbiter = { sheet: { actors: { 'Jovan Oda': { default: 7, domains: { melee: 8 } }, 'Rin': { default: 6, domains: { melee: 8 } } } }, log: [], oneShot: null, cache: null, composure: 6 }; return md.arbiter; };

(async () => {
    /* ── 1. NEGATIVE CONTROL: the bug class exists and this suite sees it ── */
    let meta = freshMeta();
    ok('unset story name falls back to the persona label', E.mcName(meta) === 'LO');
    let d = E.startDuel(meta, E.mcName(meta), 'Bandit', 'melee');
    ok('BUG CLASS DETECTED: label "LO" cannot reach the "Jovan Oda" sheet entry', d.player.name === 'LO' && d.player.rating === 5);
    E.startDuel && (meta.duel = null);

    /* ── 2. story name set: real identity, real ratings ─────────────────── */
    meta = freshMeta(); meta.mcName = 'Jovan Oda';
    ok('mcName resolves to the story name', E.mcName(meta) === 'Jovan Oda');
    d = E.startDuel(meta, E.mcName(meta), 'Bandit', 'melee');
    ok('duel player is named by the STORY, not the persona', d.player.name === 'Jovan Oda');
    ok('duel player rating comes from the real sheet entry (8, not default-5)', d.player.rating === 8);
    meta.duel = null;
    const b = E.startBattle(meta, ['Jovan Oda', 'LO', 'Stella'], ['Ogre'], 'melee');
    ok('battle MC carries the story name and rating', b.allies[0].name === 'Jovan Oda' && b.allies[0].rating === 8);
    ok('BOTH alias forms are filtered from manual allies (no self-duplicate)', b.allies.length === 2 && b.allies[1].name === 'Stella');
    meta.battle = null;

    /* ── 3. referee prompt identity ─────────────────────────────────────── */
    let prompt = E.buildAdjUserPrompt([um('I strike')], um('I strike'), meta);
    ok('prompt declares the STORY name as the player character', prompt.includes('The player character is "Jovan Oda"'));
    ok('prompt declares the label the SAME person, never the opponent', prompt.includes('labeled "LO"') && prompt.includes('SAME person as Jovan Oda'));
    delete meta.mcName;
    prompt = E.buildAdjUserPrompt([um('I strike')], um('I strike'), meta);
    ok('unset story name reproduces the legacy prompt exactly (no label note)', prompt.includes('The player character is "LO"') && !prompt.includes('SAME person'));
    meta.mcName = 'Jovan Oda';

    /* ── 4. normalizeAdj: identity + opponent hardening across aliases ──── */
    const raw = (extra) => Object.assign({ check: true, action: 'strike', domain: 'melee', actor: 'LO', opposition_kind: 'actor', opposition: 'Kaiser', circumstance: 0 }, extra || {});
    let n = E.normalizeAdj(raw(), meta);
    ok('actor is forced to the STORY name', n.actor === 'Jovan Oda');
    ok('a genuine foe passes through untouched', n.opposition === 'Kaiser' && n.kind === 'actor');
    n = E.normalizeAdj(raw({ opposition: 'Jovan Oda' }), meta);
    ok('the player\'s own STORY name can never be the opponent (repaired to tier hard=7)', n.opposition === 'hard' && n.kind === 'tier');
    n = E.normalizeAdj(raw({ opposition: 'Oda' }), meta);
    ok('a bare fragment of the story name is SELF, not a foe', n.opposition === 'hard' && n.kind === 'tier');
    n = E.normalizeAdj(raw({ opposition: 'LO' }), meta);
    ok('the persona LABEL can never be the opponent either', n.opposition === 'hard' && n.kind === 'tier');
    n = E.normalizeAdj(raw({ opposition: 'Claire Oda' }), meta);
    ok('a sibling sharing the surname stays a legitimate foe', n.opposition === 'Claire Oda' && n.kind === 'actor');
    n = E.normalizeAdj(raw({ duel_start: 'Jovan Oda' }), meta);
    ok('a self-named duel_start recovers the real foe from opposition', n.duel_start === 'Kaiser');
    const r = E.resolveAdj(E.normalizeAdj(raw({ opposition: 'Jovan Oda' }), meta), meta);
    ok('repaired self-opposition RESOLVES at hard tier 7 (was unlisted→trained 5)', r.oR === 7);

    /* ── 5. conditions via alias + live fight + liveCombatant ───────────── */
    meta = freshMeta(); meta.mcName = 'Jovan Oda';
    E.applyConditionChange(meta, { who: 'LO', add: 'broken arm', mod: -2, domain: null, gear: false, remove: null });
    ok('a condition filed under the LABEL lands on the story entry', Array.isArray(meta.sheet.actors['Jovan Oda'].conditions) && meta.sheet.actors['Jovan Oda'].conditions.some(c => c.name === 'broken arm'));
    ok('no split "LO" entry is created', meta.sheet.actors['LO'] === undefined);
    d = E.startDuel(meta, E.mcName(meta), 'Bandit', 'melee');
    ok('live rating carries the condition (8-2=6)', d.player.rating === 6);
    E.applyConditionChange(meta, { who: 'LO', add: 'sprained knee', mod: -1, domain: null, gear: false, remove: null });
    E.refreshLiveRating(meta, 'LO');
    ok('a mid-fight condition named by ALIAS updates the live player (6→5)', meta.duel.player.rating === 5);
    ok('liveCombatant finds the player by the label alias', E.liveCombatant(meta, 'LO') === meta.duel.player);
    ok('liveCombatant finds the player by a name fragment', E.liveCombatant(meta, 'Oda') === meta.duel.player);
    meta.duel = null;

    /* ── 6. reconcile: heal a pre-existing split ────────────────────────── */
    meta = freshMeta();
    meta.sheet.actors['LO'] = { default: 4, domains: { stealth: 6 }, conditions: [{ name: 'bruised', mod: -1 }], _auto: true };
    ok('no-op while the story name is unset', E.reconcilePlayerEntries(meta) === false && !!meta.sheet.actors['LO']);
    meta.mcName = 'Jovan Oda';
    ok('split heals once the identity is known', E.reconcilePlayerEntries(meta) === true);
    const merged = meta.sheet.actors['Jovan Oda'];
    ok('label entry is gone; one person remains', meta.sheet.actors['LO'] === undefined && !!merged);
    ok('story ratings win; label fills only gaps (melee 8 kept, stealth 6 gained)', merged.domains.melee === 8 && merged.domains.stealth === 6 && merged.default === 7);
    ok('label conditions survive the merge', (merged.conditions || []).some(c => c.name === 'bruised'));

    /* ── 7. seeder: learn, never overwrite, reject narrator, voices line ── */
    meta = freshMeta();
    respObj = JSON.stringify({ player_story_name: 'Jovan Oda', actors: { 'Jovan Oda': { default: 7, domains: { melee: 8 } } } });
    await E.seedSheet({});
    ok('seeder learns the story name into an EMPTY mcName', meta.mcName === 'Jovan Oda');
    respObj = JSON.stringify({ player_story_name: 'Wrong Name', actors: { 'Rin': { default: 6, domains: {} } } });
    await E.seedSheet({});
    ok('a later seed NEVER overwrites a set identity', meta.mcName === 'Jovan Oda');
    ok('seed prompt carries the label-alias line once identity is known', lastPrompt.includes('player_character: Jovan Oda') && lastPrompt.includes('player_message_label: LO'));
    meta = freshMeta();
    respObj = JSON.stringify({ player_story_name: 'Narrator', actors: { 'Rin': { default: 6, domains: {} } } });
    await E.seedSheet({});
    ok('the narrator card\'s label is rejected as the player identity', !(typeof meta.mcName === 'string' && meta.mcName.trim()));
    meta = freshMeta();
    meta.sheet.actors['LO'] = { default: 4, domains: {}, conditions: [{ name: 'winded', mod: -1 }], _auto: true };
    respObj = JSON.stringify({ player_story_name: 'Jovan Oda', actors: {} });
    await E.seedSheet({});
    ok('seeding heals a pre-existing split in the same pass', meta.sheet.actors['LO'] === undefined && (meta.sheet.actors['Jovan Oda'].conditions || []).some(c => c.name === 'winded'));

    /* ── 8. composure penalty recognizes the actor via alias identity ───── */
    meta = freshMeta(); meta.mcName = 'Jovan Oda'; meta.composure = 1;
    const adjP = { check: true, action: 'strike', domain: 'melee', actor: 'Jovan Oda', kind: 'tier', opposition: 'moderate', circumstance: 0, scale_mismatch: 0 };
    const adjN = Object.assign({}, adjP, { actor: 'Rin' });
    const rp = E.resolveAdj(adjP, meta), rn = E.resolveAdj(adjN, meta);
    ok('a strained STORY-named player suffers the composure penalty; an NPC does not', rp.delta < rn.delta);

    console.log(fails ? 'SUITE FAILED (' + fails + ')' : 'ALL v50 IDENTITY INVARIANTS GREEN');
    process.exit(fails ? 1 : 0);
})();
