# Arbiter — working notes for agents

Outcome adjudication for SillyTavern roleplay. Single-file extension:
`index.js` (engine + UI), `style.css` (all styling), `manifest.json`, `tests/`.

## Gate — run ALL of it before any push

```sh
# 1. Parse as BOTH module systems. SillyTavern loads third-party extensions as
#    ES modules; `node --check` on a .js parses it as CommonJS, which silently
#    accepts things ESM rejects (e.g. duplicate `let`). Check a .mjs copy too.
node --check index.js
cp index.js /tmp/arb_gate.mjs && node --check /tmp/arb_gate.mjs

# 2. Full invariant suite (63 files, no dependencies). Exits 1 on any failure.
sh tests/run_all.sh
```

`run_all.sh` prints `ALL SUITES GREEN` and exits 0 only when every file passed.
A parse check proves nothing runs — the suite executes the engine against mocked
SillyTavern globals, so never treat step 1 as sufficient.

## Version discipline

Bump on every push, in **both** places, and they must match:

- `manifest.json` → `"version"`
- `index.js` → `const VERSION = '...'`

`tests/arb_test_v62.cjs` enforces this parity. Stamp drift is a gate failure, not
a nit. Update the README changelog in the same commit.

## The two files ship together

`index.js` and `style.css` are separate artifacts and drifted for 32 versions
once already: the tie system added `TRADE`/`STALEMATE` tiers whose badge classes
were never written, so those log rows rendered unstyled while everything else
carried colour. Nothing threw, so nothing caught it.

`arb_test_v62.cjs` now guards this. If you add a tier to `TIERS`, or any new
`arb_` class in `index.js`, add the matching rule to `style.css` or the gate
fails. Do not weaken that test to make a push go through.

## House rules

- **Root causes, not symptom patches.** One canonical fix per failure mode. A fix
  that needs a counter-rule later is the wrong fix.
- **Negative-test every new guard.** Reintroduce the defect in a scratch tree
  (`cp -r` to /tmp) and confirm the assertion fails with exit 1. A gate that has
  never failed is unproven.
- **Measure, never predict.** Counts, win rates and test tallies go in the README
  only after reading them off real output.
- **Model-agnostic always.** Presets, prompts and briefs must never hardcode a
  model identity or tune for one backend's quirks.
- **Never blame the model for an extension bug.** Read the actual code path.
- The engine is exposed as `globalThis.ArbiterEngine` for tests and console work;
  the interceptor is `globalThis.arbiterInterceptor` (named in `manifest.json`)
  and is wrapped so a throw can never block generation.

## Fairness invariants worth not breaking

The exchange economy is mirror-symmetric by construction, not by calibration:
the distribution is invariant under `(u, P) -> (1 - u, 1 - P)`, so two
identically-capable fighters are a coin flip at any fight length. Band widths,
`EXCHANGE_EFFECTS` pairs, and the combo net→tier mapping all mirror. `realistic`
is symmetric; `gritty` and `heroic` are deliberately not. Suites v58–v60 cover
this — if a change moves a mirror match off 50%, the change is wrong.
