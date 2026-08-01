// v0.42 — THE SHIPPED ASSETS AGREE WITH THE CODE.
//
// index.js and style.css are separate files that ship together, and nothing
// checked that they still described the same extension. They drifted: style.css
// was last touched at v0.9.0 while index.js reached v0.41.0. In between, the tie
// system landed (tieCheck can return TRADE or STALEMATE, and tieBand defaults to
// 0.06, so both fire in ordinary play) — but no .arb_t_TRADE / .arb_t_STALEMATE
// rule was ever added. TIERS and TIER_MEANING both covered them, so nothing threw;
// the log simply rendered those rows with the bare .arb_badge rule — bold text on
// no background — while every other tier carried its colour. A .arb_dim hint had
// the same fate.
//
// Adding the three missing rules fixes today's drift. This gate is what stops the
// NEXT one: a ninth tier, or any new class, fails here instead of shipping
// invisible. The same applies to the version stamp — manifest.json and the VERSION
// const are edited by hand in two places and had no check that they matched.
//
//  1. Every TIERS key has a .arb_t_<KEY> rule (dynamic badge class is total).
//  2. Every static arb_ class referenced in index.js exists in style.css.
//  3. manifest.json version === the in-code VERSION stamp.
//  4. The tie tiers really are reachable (tieBand default > 0), so rule 1 is
//     load-bearing rather than theoretical.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

let failed = 0;
function check(label, ok, detail) {
    console.log((ok ? 'OK   ' : 'FAIL ') + label + (ok || !detail ? '' : ' — ' + detail));
    if (!ok) failed = 1;
}

/* ---- parse: classes defined in style.css ---------------------------- */
const cssClasses = new Set();
for (const m of css.matchAll(/\.([A-Za-z_][\w-]*)/g)) cssClasses.add(m[1]);

/* ---- parse: TIERS keys from index.js -------------------------------- */
const tStart = js.indexOf('const TIERS = {');
if (tStart < 0) { console.log('FAIL could not locate TIERS table in index.js'); process.exit(1); }
const tEnd = js.indexOf('\n    };', tStart);
const tierKeys = [...js.slice(tStart, tEnd).matchAll(/^\s{8}(\w+):\s*\{/gm)].map(m => m[1]);
if (tierKeys.length < 6) { console.log('FAIL TIERS parse produced too few keys: ' + tierKeys.length); process.exit(1); }

/* ---- 1. dynamic tier badge classes are total ------------------------ */
// index.js builds the badge as: class="arb_badge arb_t_' + escHtml(l.tier) + '"
// so EVERY tier that can reach meta.log needs its own rule.
const missingTier = tierKeys.filter(k => !cssClasses.has('arb_t_' + k));
check('every TIERS key has a .arb_t_<KEY> rule (' + tierKeys.length + ' tiers)',
    missingTier.length === 0, 'missing: ' + missingTier.map(k => '.arb_t_' + k).join(', '));

/* ---- 2. every static arb_ class in index.js exists in style.css ------ */
// Only LITERAL class tokens are checked. Tokens carrying a quote or + are
// concatenation fragments (the dynamic tier prefix), covered by check 1.
const usedStatic = new Map();
js.split('\n').forEach((ln, i) => {
    const n = i + 1;
    const note = (c) => {
        if (!c || !c.startsWith('arb_')) return;
        if (/['"+${}]/.test(c)) return;          // concatenation fragment, not a literal
        if (c === 'arb_t_') return;              // dynamic prefix itself
        if (!usedStatic.has(c)) usedStatic.set(c, n);
    };
    for (const m of ln.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) note(c);
    for (const m of ln.matchAll(/classList\.(?:add|remove|toggle)\(\s*'([\w-]+)'/g)) note(m[1]);
    for (const m of ln.matchAll(/querySelector(?:All)?\(\s*'\.([\w-]+)'/g)) note(m[1]);
    for (const m of ln.matchAll(/\$\(\s*'\.([\w-]+)'/g)) note(m[1]);
    for (const m of ln.matchAll(/'\s+(arb_[\w-]+)'/g)) note(m[1]);   // ' arb_low' concat
});
const missingStatic = [...usedStatic].filter(([c]) => !cssClasses.has(c));
check('every static arb_ class in index.js has a style.css rule (' + usedStatic.size + ' classes)',
    missingStatic.length === 0,
    missingStatic.map(([c, l]) => '.' + c + ' (index.js:' + l + ')').join(', '));

/* ---- 3. version stamp parity ---------------------------------------- */
const stamp = (js.match(/const VERSION = '([^']+)'/) || [])[1];
check('manifest.json version matches the in-code VERSION stamp',
    !!stamp && stamp === manifest.version,
    'manifest=' + manifest.version + ' stamp=' + stamp);

/* ---- 4. the tie tiers are actually reachable ------------------------ */
// If tieBand ever defaulted to 0, TRADE/STALEMATE would be unreachable and
// check 1 would be guarding nothing. Keep the guard load-bearing.
const tieBandDefault = Number((js.match(/tieBand:\s*([\d.]+)/) || [])[1]);
check('tieBand default > 0, so TRADE/STALEMATE are reachable in normal play',
    Number.isFinite(tieBandDefault) && tieBandDefault > 0, 'tieBand default = ' + tieBandDefault);
check('TIERS contains both tie tiers', tierKeys.includes('TRADE') && tierKeys.includes('STALEMATE'),
    'TIERS = ' + tierKeys.join(','));

if (failed) { console.log('V62 FAILED'); process.exit(1); }
console.log('ALL V62 TESTS PASSED');
