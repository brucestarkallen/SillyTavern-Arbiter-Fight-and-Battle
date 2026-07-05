// Stub browser/ST environment, then load the extension and test the engine.
const noopJq = () => ({ length: 0, append(){return this;}, on(){return this;}, val(){return '';}, prop(){return this;}, html(){return this;}, empty(){return this;}, find(){return this;} });
global.$ = (sel) => noopJq();
global.jQuery = (fn) => {}; // don't run init in tests
global.window = global;
global.document = { getElementById: () => null };
global.SillyTavern = { getContext: () => ({ extensionSettings: {}, chatMetadata: {}, name1: 'Player' }) };
global.toastr = { info(){}, warning(){}, error(){}, success(){} };

require(require('path').join(__dirname, '..', 'index.js'));

const E = globalThis.ArbiterEngine;
if (!E) { console.error('ENGINE NOT EXPOSED'); process.exit(1); }

// 1. Curve matches the promised table
const table = [[0,50],[1,64],[2,76],[4,91],[6,97],[8,99]];
for (const [d, pct] of table) {
    const got = Math.round(E.probFromDelta(d) * 100);
    console.log(`delta ${d}: P=${(E.probFromDelta(d)*100).toFixed(2)}% (expect ~${pct}%)`, Math.abs(got - pct) <= 1 ? 'OK' : 'FAIL');
    if (Math.abs(got - pct) > 1) process.exit(1);
}

// 2. Tier slicing: analytic widths vs Monte Carlo, plus promised properties
function analytic(P) {
    const F = 1 - P;
    const dec = P * (0.05 + 0.15 * P), cost = P * (0.15 + 0.35 * F);
    const sb = F * (0.30 + 0.20 * P), dis = F * (0.03 + 0.12 * F);
    return { DECISIVE: dec, SUCCESS: P - dec - cost, SUCCESS_COST: cost, SETBACK: sb, FAILURE: F - sb - dis, DISASTER: dis };
}
for (const P of [0.909, 0.76, 0.5, 0.24, 0.03]) {
    const counts = { DECISIVE:0, SUCCESS:0, SUCCESS_COST:0, SETBACK:0, FAILURE:0, DISASTER:0 };
    const N = 400000;
    for (let i = 0; i < N; i++) counts[E.sliceOutcome(P, Math.random())]++;
    const an = analytic(P);
    let ok = true;
    for (const k of Object.keys(counts)) {
        const emp = counts[k] / N;
        if (Math.abs(emp - an[k]) > 0.004) { ok = false; console.error(`P=${P} tier ${k}: emp ${emp.toFixed(4)} vs analytic ${an[k].toFixed(4)}`); }
    }
    const succTotal = (counts.DECISIVE + counts.SUCCESS + counts.SUCCESS_COST) / N;
    console.log(`P=${P}: MC success ${(succTotal*100).toFixed(2)}% | disaster ${(counts.DISASTER/N*100).toFixed(2)}% | costly share of wins ${((counts.SUCCESS_COST)/(counts.DECISIVE+counts.SUCCESS+counts.SUCCESS_COST)*100).toFixed(1)}%`, ok && Math.abs(succTotal - P) < 0.004 ? 'OK' : 'FAIL');
    if (!ok || Math.abs(succTotal - P) > 0.004) process.exit(1);
}

// 3. Promised realism properties
const expert = analytic(0.909), novice = analytic(0.24);
console.log('expert disaster', (expert.DISASTER*100).toFixed(2) + '% (<1% expected)', expert.DISASTER < 0.01 ? 'OK' : 'FAIL');
const underdog = analytic(0.24);
const costlyShareU = underdog.SUCCESS_COST / (underdog.DECISIVE + underdog.SUCCESS + underdog.SUCCESS_COST);
const costlyShareE = expert.SUCCESS_COST / (expert.DECISIVE + expert.SUCCESS + expert.SUCCESS_COST);
console.log(`costly-win share: underdog ${(costlyShareU*100).toFixed(1)}% > expert ${(costlyShareE*100).toFixed(1)}%`, costlyShareU > costlyShareE ? 'OK' : 'FAIL');
if (expert.DISASTER >= 0.01 || costlyShareU <= costlyShareE) process.exit(1);

// 4. Interceptor never throws, even with hostile input
(async () => {
    const I = globalThis.arbiterInterceptor;
    await I(null, 0, () => {}, 'quiet');
    await I([], 0, () => {}, 'normal');
    await I([{ is_user: true, mes: 'I attack the guard', send_date: 'x' }], 0, () => {}, 'impersonate');
    // 'normal' with a risky message but no LLM route: must degrade silently
    global.SillyTavern = { getContext: () => ({ extensionSettings: { arbiter: { enabled: true, timeoutMs: 1600 } }, chatMetadata: {}, name1: 'Player' }) };
    await I([{ is_user: true, mes: 'I try to attack the guard', send_date: 'y' }], 0, () => {}, 'normal');
    console.log('interceptor hostile-input tests OK');
    console.log('ALL TESTS PASSED');
})().catch(e => { console.error('INTERCEPTOR THREW', e); process.exit(1); });
