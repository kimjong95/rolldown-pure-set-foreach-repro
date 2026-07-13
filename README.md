# rolldown-pure-set-foreach-repro

Reproduction material for [rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247).

Every claim below is backed by a real `rolldown -c <config>` CLI build that
writes actual files to `dist/` / `dist-consumer/` -- nothing here calls the
rolldown bundler API in-process and prints a string. Build it, then open
the file yourself.

An earlier version of this repo included a separate `toplevel-elimination.js`
demo (a module-top-level `let x = /* @__PURE__ */ new Set(...).forEach(cb)`
that Rolldown does eliminate). That demo has been **removed** -- it doesn't
match how our real code is shaped (our function is called, not left as an
unused top-level binding), so it doesn't verify anything relevant to our
actual bug. This repo now only contains the two things that matter.

## The pattern

```js
export function applyRestore(currentProps, targetProps, changedProps, isEqual) {
  const allKeys = new Set([
    ...Object.keys(currentProps),
    ...Object.keys(targetProps),
  ]);

  allKeys.forEach((key) => {
    if (key === 'text') return;
    if (!isEqual(currentProps[key], targetProps[key])) {
      changedProps[key] = targetProps[key];
    }
  });

  return changedProps;
}
```

This is `src/pure-set-foreach.js`, a reduced version of the real function
(`applyRestoreSnapshot` in `NodeTextCommandMemento.ts`) that triggered our
production regression -- see `real-world-evidence/applyRestoreSnapshot.dist.js`
for the actual, unmodified compiled output from our private monorepo.

## 1. Rolldown auto-inserts `/* @__PURE__ */` in front of the chain -- confirmed

```sh
npm install
npm run build
cat dist/pure-set-foreach.js
```

Actual contents of `dist/pure-set-foreach.js`:

```js
function applyRestore(currentProps, targetProps, changedProps, isEqual) {
	(/* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(targetProps)])).forEach((key) => {
		if (key === "text") return;
		if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
	});
	return changedProps;
}
```

Nobody wrote that comment. Rolldown inserted it during the build and
inlined the `allKeys` binding, positioning the annotation at the head of
the whole `.forEach(cb)` chain instead of only on `new Set(...)`.

`real-world-evidence/applyRestoreSnapshot.dist.js` confirms this is not a
constructed toy: it's a verbatim excerpt from our real
`packages/engine/editor` package's actual `vite build` output (commit
`75d9a29505959993f7ec815907ed82a4af6dea38`, branch `release/26.707`,
2026-07-13) -- same annotation, same chain position, same shape, with the
real field names.

## 2. Does the chain actually disappear when called the way real code calls it? -- NOT reproduced

This is the part that would need to be true for our root-cause theory to
hold, and **we have not been able to make it happen.**

`src/consumer-unused-result.js` calls `applyRestore` exactly the way real
code calls `applyRestoreSnapshot`: as a plain call, with its return value
never captured or used.

```js
import { applyRestore } from './pure-set-foreach.js';

applyRestore(
  { boundingBox: { width: 999 }, text: 'edited' },
  { boundingBox: { width: 100 }, text: 'original' },
  {},
  isEqual
);
```

```sh
npm run build:consumer
npm run check
```

Actual contents of `dist-consumer/consumer-unused-result.js` after
`rolldown -c rolldown.consumer.config.js`:

```js
function applyRestore(currentProps, targetProps, changedProps, isEqual) {
	(/* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(targetProps)])).forEach((key) => {
		if (key === "text") return;
		if (!isEqual(currentProps[key], targetProps[key])) changedProps[key] = targetProps[key];
	});
	return changedProps;
}
function isEqual(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}
applyRestore({
	boundingBox: { width: 999 },
	text: "edited"
}, {
	boundingBox: { width: 100 },
	text: "original"
}, {}, isEqual);
```

**The whole function, including the `Set`+`forEach` chain, survives.**
Rolldown does not eliminate `applyRestore`'s body here, because the call
itself isn't annotated as pure and the function is genuinely invoked --
there is nothing in this configuration that tells Rolldown the call's
effects (mutating the `changedProps` object passed in) are unobservable.

## Where this leaves us

- **Confirmed, with real production evidence**: Rolldown auto-generates a
  `/* @__PURE__ */` annotation positioned at the head of this exact
  `Set`+`forEach` chain, in our actual codebase, today.
- **Not confirmed**: that this annotation, on its own, causes the chain to
  be silently eliminated when used the way our real code uses it (called,
  result relied upon by the caller). We could not reproduce that with
  Rolldown alone, at any build stage tested here.

Our real production regression did happen, and reverting to a plain
`for...of` loop did fix it -- but the exact tool and conditions that
eliminated the code in the original staging build remain unconfirmed. If
you can reproduce section 2 actually disappearing, or know what
additional condition (minification settings, a different downstream
bundler, module concatenation, something else) is required, please
comment on the issue.

## What's in this repo

| File | What it is |
|---|---|
| `src/pure-set-foreach.js` | The reduced real-world pattern |
| `rolldown.config.js` | Builds it standalone (section 1) |
| `real-world-evidence/applyRestoreSnapshot.dist.js` | Real compiled output from our private monorepo's actual build |
| `src/consumer-unused-result.js` | Calls `applyRestore` the way real code does -- return value unused (section 2) |
| `rolldown.consumer.config.js` | Builds the consumer together with `pure-set-foreach.js` |
| `scripts/check-consumer.mjs` | Reads the already-built `dist-consumer/` output and reports whether the chain is still present |

## Run everything

```sh
npm install
npm run demo    # build, build:consumer, then check -- all real CLI builds
```
