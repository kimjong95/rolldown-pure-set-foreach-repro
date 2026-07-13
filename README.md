# rolldown-pure-set-foreach-repro

Reproduction material for [rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247).

One config, one `rolldown -c rolldown.config.js` build, one output file --
`dist/consumer-unused-result.js`. No wrapper scripts. Build it, then open
the file yourself.

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

`src/consumer-unused-result.js` calls it exactly the way real code calls
`applyRestoreSnapshot`: a plain call, return value never captured.

```js
import { applyRestore } from './pure-set-foreach.js';

applyRestore(
  { boundingBox: { width: 999 }, text: 'edited' },
  { boundingBox: { width: 100 }, text: 'original' },
  {},
  isEqual
);
```

## Build it

```sh
npm install
npm run build
cat dist/consumer-unused-result.js
```

Actual, unmodified contents of `dist/consumer-unused-result.js`:

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

## What this shows

**Confirmed**: nobody wrote `/* @__PURE__ */` in the source. Rolldown
inserted it during this real build, inlined the `allKeys` binding, and
positioned the annotation at the head of the whole `.forEach(cb)` chain --
not just on `new Set(...)`.

`real-world-evidence/applyRestoreSnapshot.dist.js` confirms this isn't a
constructed toy: it's a verbatim excerpt from our real
`packages/engine/editor` package's actual `vite build` output (commit
`75d9a29505959993f7ec815907ed82a4af6dea38`, branch `release/26.707`,
2026-07-13) -- same annotation, same chain position, same shape, with the
real field names.

**Not confirmed**: the chain actually disappearing. As the dist output
above shows, `applyRestore`'s whole body -- including the `Set`+`forEach`
chain -- survives here. Rolldown doesn't eliminate it, because the call
itself isn't annotated as pure and the function is genuinely invoked --
nothing in this configuration tells Rolldown the call's effects (mutating
the `changedProps` object passed in) are unobservable.

## Where this leaves us

Our real production regression did happen, and reverting to a plain
`for...of` loop did fix it -- but we have not been able to reproduce the
chain actually being eliminated, with Rolldown alone, in the shape that
matches how our code is really used (called, result relied upon by the
caller). The exact tool and conditions that eliminated the code in the
original staging build remain unconfirmed. If you can get the chain above
to actually disappear, or know what additional condition (minification
settings, a different downstream bundler, module concatenation, something
else) is required, please comment on the issue.

## What's in this repo

| File | What it is |
|---|---|
| `src/pure-set-foreach.js` | The reduced real-world pattern |
| `src/consumer-unused-result.js` | Calls it the way real code does -- return value unused |
| `rolldown.config.js` | The one build config, bundling both files together |
| `real-world-evidence/applyRestoreSnapshot.dist.js` | Real compiled output from our private monorepo's actual build |
