# rolldown-pure-set-foreach-repro

Reproduction material for [rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247).

Every claim below is backed by a real `rolldown -c <config>` CLI build that
writes actual files to `dist/` / `dist-toplevel/` -- nothing here calls the
rolldown bundler API in-process and prints a string. Build it, then open
the file yourself.

This README is also split into **what we have actually proven** and **what
we have not** -- an earlier draft blurred that line. See "What we have NOT
proven" before drawing conclusions from this repo.

## The pattern

```js
const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

allKeys.forEach((key) => {
  // ...mutate some outer variable...
});
```

Rolldown (via oxc) automatically marks `new Set(array)` as `/* @__PURE__ */`
(mirrors an esbuild optimization -- see
[esbuild CHANGELOG 2021, "Mark `Set` and `Map` with array arguments as pure"](https://github.com/evanw/esbuild/blob/main/CHANGELOG-2021.md),
[esbuild/esbuild#1791](https://github.com/evanw/esbuild/issues/1791)).
When the resulting binding is immediately chained into `.forEach(cb)`, the
annotation ends up positioned at the head of the whole chain, not just the
`new Set(...)` call.

## What we have proven

### 1. Rolldown really inserts this annotation in this exact position

```sh
npm install
npm run build
cat dist/pure-set-foreach.js
```

`rolldown.config.js` points at `src/pure-set-foreach.js` (the un-annotated
original -- no `/* @__PURE__ */` anywhere in it) and writes to `dist/`.
Actual contents of `dist/pure-set-foreach.js` after the build:

```js
function applyRestore(currentProps, targetProps, changedProps, isEqual) {
	(/* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(targetProps)])).forEach((key) => {
		if (key === "text") return;
		if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
	});
	return changedProps;
}
```

Nobody wrote that comment. Rolldown inserted it during the real CLI build
and inlined the `allKeys` binding, so the marker sits at the head of the
`.forEach(cb)` chain, not just on `new Set(...)`.

### 2. This is not a constructed toy -- it's what our real production build outputs today

`real-world-evidence/applyRestoreSnapshot.dist.js` is a **verbatim excerpt**
copied out of the actual compiled output of `packages/engine/editor` in
our private monorepo, produced by that package's own real `vite build`
script (the same command our CI runs), on commit
`75d9a29505959993f7ec815907ed82a4af6dea38` (branch `release/26.707`,
2026-07-13) -- before the fix from the linked issue was applied. Same
shape, same auto-inserted annotation, same chain position -- just with the
real field names (`currentProps`, `targetProps`, `node.setProps(...)`)
instead of our minimal repro's placeholders.

### 3. This class of PURE-chain elimination is real and rolldown itself does it, not just esbuild

```sh
npm run build:toplevel
cat dist-toplevel/toplevel-elimination.js
npm run check
```

`src/toplevel-elimination.js` defines a controlled pair at module top
level:

```js
let yes = /* @__PURE__ */ new Set([1, 2, 3]).forEach((x) => {
  globalThis.sideEffects.push(['yes', x]);   // argument: a bare function literal
});

let no = /* @__PURE__ */ new Set([4, 5, 6]).forEach(makeHandler());
                                                    // argument: the RESULT OF A CALL
```

Actual contents of `dist-toplevel/toplevel-elimination.js` after
`rolldown -c rolldown.toplevel.config.js`:

```js
globalThis.sideEffects = [];
function readSideEffects() {
	return globalThis.sideEffects;
}
export { readSideEffects };
```

Both `yes` and `no` are gone -- including `makeHandler` itself. `npm run
check` imports this real dist file (not a re-built in-memory string) and
confirms `readSideEffects()` returns `[]`: neither side effect ever ran.
(Rolldown removes `no` too, unlike the naive "argument is a call, so keep
it" heuristic esbuild uses -- rolldown's analysis apparently sees that
`makeHandler()` itself has no side effects.)

## What we have NOT proven

**The `yes`/`no` axis above (function literal vs. call result) is not
what varies in our real production code.** Every `.forEach()` callback in
our actual source (`NodeTextCommandMemento.ts`, see
`real-world-evidence/applyRestoreSnapshot.dist.js`) is a bare arrow
function literal -- we never pass a function-call result. So section 3
proves the general elimination mechanism exists and that rolldown itself
performs it, but **it does not reproduce or explain our specific
regression** on its own -- it's a real but different trigger condition
(a genuinely unused top-level binding), not the one in our code (a
`.forEach()` inside a function that is actually called, whose side
effects the caller relies on).

We tried, and failed, to get rolldown (or esbuild, or Terser with
`unsafe: true`) to eliminate the chain in the shape that actually matches
our bug -- inside a called function whose effects are used by the caller:

```js
function applyRestore(changedProps) {
  const allKeys = new Set([1, 2, 3]);
  allKeys.forEach((key) => { changedProps[key] = key * 10; });
}
const result = {};
applyRestore(result);
console.log(result); // caller actually uses the mutation
```

None of the three tools removed the `forEach` here. **Our best current
guess** is that the real regression required an extra step we have not
isolated in this repo -- most likely function inlining by a downstream
minifier (e.g. Terser, used via webpack in our actual Next.js app builds,
which unlike esbuild/rolldown's minifiers does inline single-call-site
functions under some settings) collapsing `applyRestoreSnapshot`'s body
into its call site during the final app build, at which point the
`forEach` could start looking like an eliminable, effectively-unused
statement. We have not reproduced that exact tool chain in isolation. If
anyone recognizes the actual mechanism, we'd like to know.

## What's in this repo

| File | What it is |
|---|---|
| `rolldown.config.js` | Real rolldown build config for section 1 |
| `src/pure-set-foreach.js` | Un-annotated source for section 1 |
| `real-world-evidence/applyRestoreSnapshot.dist.js` | Real compiled output copied from our private monorepo's actual build (section 2) |
| `rolldown.toplevel.config.js` | Real rolldown build config for section 3 |
| `src/toplevel-elimination.js` | Un-annotated source for section 3 |
| `scripts/check-dist.mjs` | Imports the already-built `dist-toplevel/` output and asserts on it -- does not call any bundler API |

## Run everything

```sh
npm install
npm run demo    # build, build:toplevel, then check -- all real CLI builds
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
