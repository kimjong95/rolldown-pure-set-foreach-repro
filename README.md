# rolldown-pure-set-foreach-repro

Minimal, runnable reproduction for [rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247).

## The pattern

```js
const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

allKeys.forEach((key) => {
  // ...mutate some outer variable...
});
```

Rolldown (via oxc) automatically marks `new Set(array)` as `/* @__PURE__ */`
(this mirrors an esbuild optimization — see
[esbuild CHANGELOG 2021, "Mark `Set` and `Map` with array arguments as pure"](https://github.com/evanw/esbuild/blob/main/CHANGELOG-2021.md),
[esbuild/esbuild#1791](https://github.com/evanw/esbuild/issues/1791)).

This is safe on its own. But when the resulting binding is immediately
chained into a call whose only argument is a plain function literal (e.g.
`.forEach(cb)`), the PURE annotation ends up positioned at the head of the
**whole chain**, not just the `new Set(...)` call. If the chain's result is
unused, some bundlers/minifiers will eliminate the **entire chain —
including the callback's side effects** — because constructing a function
literal is itself provably side-effect free, even though *invoking* it
(which `.forEach` does) is exactly where the real side effect lives.

This exact composition caused a real production regression for us: an
undo/redo code path lost state after upgrading from Vite 6 (Rollup) to
Vite 8 (Rolldown).

## What's in this repo

- `src/pure-set-foreach.js` — the real-world pattern from our production
  bug, as-is.
- `scripts/build-rolldown.mjs` — bundles it with Rolldown (no minification)
  and prints the output. You'll see the auto-inserted `/* @__PURE__ */`
  sitting directly in front of `new Set([...])`, with the intermediate
  `const allKeys = ...` binding inlined so the annotation now heads the
  whole `.forEach(cb)` chain.
- `src/toplevel-elimination.js` — a self-contained analog of esbuild's own
  `dot_yes` / `dot_no` test fixtures
  ([`bundler_dce_test.go`](https://github.com/evanw/esbuild/blob/main/internal/bundler_tests/bundler_dce_test.go#L1179-L1182)),
  but using the real `new Set(...).forEach(cb)` shape instead of the
  made-up `foo().dot(bar)` from the test suite.
- `scripts/build-esbuild-toplevel.mjs` — bundles that file with esbuild
  (`bundle: true`, tree shaking on, no minification) and prints the
  output, so you can see the `yes` case (bare function-literal callback)
  disappear completely, while the `no` case (callback returned from a
  function call) survives.
- `scripts/run-and-check.mjs` — actually **executes** the bundled+tree-shaken
  output and asserts that the `yes` side effect never ran, while the `no`
  side effect did. This is the strongest form of evidence: not just "the
  code looks different," but "the side effect provably never happens."

## Run it yourself

```sh
npm install
npm run demo
```

Or individually:

```sh
npm run build:rolldown          # shows the PURE annotation + chain shape from Rolldown
npm run build:esbuild-toplevel  # shows yes/no elimination side by side
npm run run-and-check           # executes the result and asserts on side effects
```

### Expected output (abridged)

```
--- Rolldown output (no minification) ---

function applyRestore(currentProps, targetProps, changedProps, isEqual) {
	(/* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(targetProps)])).forEach((key) => {
		if (key === "text") return;
		if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
	});
	return changedProps;
}
```

```
--- esbuild bundled output (bundle:true, no minify) ---

globalThis.sideEffects = [];
function makeHandler() {
  return (x) => globalThis.sideEffects.push(["no", x]);
}
var no = /* @__PURE__ */ (/* @__PURE__ */ new Set([4, 5, 6])).forEach(makeHandler());
function readSideEffects() {
  return globalThis.sideEffects;
}
export {
  readSideEffects
};
```

Notice `yes` isn't in the output at all — the entire
`new Set([1,2,3]).forEach(cb)` statement was removed. `no` survives because
its argument (`makeHandler()`) is a call the bundler can't prove is
side-effect-free.

```
sideEffects recorded after running the bundled+tree-shaken code:
[["no",4],["no",5],["no",6]]

"yes" side effect ran: false  (expected: false — silently eliminated)
"no" side effect ran:  true   (expected: true  — kept, argument is a call)
```

## Why this is filed as a docs request, not a bug

Both individual behaviors — auto-marking known globals as pure, and PURE
extending through a chained call whose argument is provably
side-effect-free — are intentional, tested, Rollup/esbuild-compatible
behavior. See the full discussion in
[rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247)
for the complete reasoning and links.
