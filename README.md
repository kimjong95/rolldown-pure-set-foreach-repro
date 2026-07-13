# rolldown-pure-set-foreach-repro

Reproduction material for [rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247).

This README is split into **what we have actually proven** and **what we have
not** -- an earlier version of this repo blurred that line, and a later
review of our own evidence caught it. See "What we have NOT proven" below
before drawing conclusions from this repo.

## The pattern

```js
const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

allKeys.forEach((key) => {
  // ...mutate some outer variable...
});
```

Rolldown (via oxc) automatically marks `new Set(array)` as `/* @__PURE__ */`
(this mirrors an esbuild optimization -- see
[esbuild CHANGELOG 2021, "Mark `Set` and `Map` with array arguments as pure"](https://github.com/evanw/esbuild/blob/main/CHANGELOG-2021.md),
[esbuild/esbuild#1791](https://github.com/evanw/esbuild/issues/1791)).
When the resulting binding is immediately chained into `.forEach(cb)`, the
annotation ends up positioned at the head of the whole chain, not just the
`new Set(...)` call.

## What we have proven

### 1. Rolldown really does insert this annotation in this exact position -- confirmed against our real production build, not a toy example

`real-world-evidence/applyRestoreSnapshot.dist.js` is a **verbatim excerpt**
from the actual compiled output of `packages/engine/editor` in our private
monorepo, produced by running that package's real `vite build` script (the
same command our CI runs) against the pre-fix source. Nobody wrote the
`/* @__PURE__ */` comment in that file -- it isn't in
`src/pure-set-foreach.js` (the un-annotated original, reduced to a
standalone repro for this repo). Rolldown inserted it, and inlined the
`allKeys` binding so the marker sits at the head of the `.forEach(cb)`
chain.

Run it yourself against the minimal version:

```sh
npm install
npm run build:rolldown
```

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

### 2. This general shape -- PURE-annotated chain + a plain-function-literal argument -- *can* be eliminated by a mainstream bundler, side effect and all

This is a real, general capability that exists in the ecosystem, demonstrated with a controlled pair:

```js
// src/toplevel-elimination.js
let yes = /* @__PURE__ */ new Set([1, 2, 3]).forEach((x) => {
  globalThis.sideEffects.push(['yes', x]);   // argument: a bare function literal
});

let no = /* @__PURE__ */ new Set([4, 5, 6]).forEach(makeHandler());
                                                    // argument: the RESULT OF A CALL
```

Bundled and tree-shaken with esbuild (`bundle: true`, no minify), `yes` disappears entirely -- including the callback's side effect -- while `no` survives:

```sh
npm run build:esbuild-toplevel
npm run run-and-check
```

```
sideEffects recorded after running the bundled+tree-shaken code:
[["no",4],["no",5],["no",6]]

"yes" side effect ran: false  (expected: false -- silently eliminated)
"no" side effect ran:  true   (expected: true  -- kept, argument is a call)
```

Rolldown itself does this too, and even more aggressively -- bundling
`src/toplevel-elimination.js` with plain `rolldown()` (no minify flag at
all) removes **both** `yes` and `no` (rolldown's analysis is apparently
able to see that `makeHandler()` itself has no side effects, so it doesn't
need the "argument is a call" fallback esbuild relies on).

## What we have NOT proven

**The `yes`/`no` axis above (function literal vs. call result) is not
what varies in our real production code.** Every `.forEach()` callback in
our actual source (`NodeTextCommandMemento.ts`) is a bare arrow function
literal -- we never pass a function-call result. So while section 2 proves
the general elimination mechanism exists in this ecosystem, **it does not
reproduce or explain our specific regression** -- it demonstrates a real
but different trigger condition.

We also tried, and failed, to reproduce elimination in the shape that
actually matches our bug: a `Set`+`forEach` chain **inside a function that
is genuinely called, whose side effects are used by the caller** (this is
exactly `applyRestoreSnapshot`'s shape -- see
`real-world-evidence/applyRestoreSnapshot.dist.js`). Concretely:

```js
function applyRestore(changedProps) {
  const allKeys = new Set([1, 2, 3]);
  allKeys.forEach((key) => { changedProps[key] = key * 10; });
}
const result = {};
applyRestore(result);
console.log(result); // caller actually uses the mutation
```

Neither Rolldown alone, esbuild (`bundle: true`), nor Terser (including
`unsafe: true`) removes the `forEach` in this shape, in our testing. The
`.forEach(cb)` chain in section 2 above only gets removed when it is
either (a) a genuinely unused top-level module binding, or (b) inside a
bundler's own elimination of an unused variable's initializer -- neither
of which matches how `applyRestoreSnapshot` is actually used (it's called,
and its side effects on `node` are the entire point of the function).

**Our best current guess** is that the real regression required an
additional step we have not isolated here -- most likely function
inlining by a downstream minifier (e.g. Terser, which unlike
esbuild/rolldown's minifiers does inline single-call-site functions under
some settings) collapsing `applyRestoreSnapshot`'s body into its call site
during the app's final production build (Next.js/webpack), at which point
the `forEach` could start looking like an eliminable, effectively-unused
statement. We have not yet reproduced that exact chain of tools in
isolation. If anyone reading this -- rolldown maintainers or otherwise --
recognizes the actual mechanism, we'd genuinely like to know.

## What's in this repo

- `src/pure-set-foreach.js` -- a reduced, synthetic version of the real
  pattern (for the minimal Rolldown repro in section 1).
- `real-world-evidence/applyRestoreSnapshot.dist.js` -- the actual,
  unmodified compiled output from our private monorepo's real build (see
  section 1). This is the strongest evidence in this repo: not a
  constructed example, but what our real CI pipeline produces today.
- `scripts/build-rolldown.mjs` -- bundles `src/pure-set-foreach.js` with
  Rolldown and prints the output (reproduces the shape in
  `applyRestoreSnapshot.dist.js` from a minimal standalone source).
- `src/toplevel-elimination.js` + `scripts/build-esbuild-toplevel.mjs` +
  `scripts/run-and-check.mjs` -- the `yes`/`no` control pair from section 2,
  demonstrating that this class of elimination is real in this ecosystem,
  while being explicit that it does not reproduce our exact regression
  (see "What we have NOT proven").

## Run it yourself

```sh
npm install
npm run demo
```

Or individually:

```sh
npm run build:rolldown          # section 1: PURE annotation + chain shape from Rolldown
npm run build:esbuild-toplevel  # section 2: yes/no elimination side by side
npm run run-and-check           # section 2: executes the result and asserts on side effects
```

## Why this is filed as a docs request, not a bug

Both individual behaviors -- auto-marking known globals as pure, and PURE
extending through a chained call whose argument is provably
side-effect-free -- are intentional, tested, Rollup/esbuild-compatible
behavior. See the full discussion in
[rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247)
for the complete reasoning and links, including the open question of
whether the narrower composition (auto-generated annotation + mutating
chain) deserves special handling.
