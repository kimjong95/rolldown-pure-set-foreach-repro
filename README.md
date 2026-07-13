# rolldown-pure-set-foreach-repro

Reproduction for [rolldown/rolldown#10247](https://github.com/rolldown/rolldown/issues/10247).
Real-world regression: [miridih/miricanvas-web-2#35176](https://github.com/miridih/miricanvas-web-2/pull/35176)
(undo silently lost the `boundingBox` restore).

## What this verifies

A library (`engine/`) is built with **rolldown**. Its `new Set([...]).forEach(cb)`
(result unused) carries an auto-generated `/* @__PURE__ */`. When a downstream
bundler re-optimizes that output, does the whole chain — including the callback's
side effect (`changedProps` mutation) — get eliminated?

`engine` exports the same logic three ways:

| export | shape | isolates |
|---|---|---|
| `applyRestoreSetForEach` | `new Set(...).forEach(cb)` (result unused) | — (the reported pattern) |
| `applyRestoreSetForOf` | `new Set(...)` + `for...of` | drop only the `.forEach` chain → safe |
| `applyRestoreArrayForEach` | array `[...].forEach(cb)` | swap only `new Set` for an array → safe |

**Expected baseline:** `set+forEach` and `set+for-of` iterate the same `new Set`
and produce the same side effect — they are semantically identical, so we expect
them to behave identically. The bug is the divergence: under SWC, `set+for-of`
survives (as expected) but `set+forEach`'s chain is eliminated.

The third variant keeps the exact same `.forEach` but on an array instead of
`new Set`, and it survives — showing the trigger is the auto-pure **`new Set`**,
not `.forEach` itself. (The shipped fix in miridih/miricanvas-web-2#35176 switched
to `for...of`.)

Correct result = `{"boundingBox":{"width":100}}` / bug = `{}` (restore lost).

## Run

```sh
npm install
npm run apps      # build engine with rolldown → build & run the 3 apps → print the matrix
```

```
app                      set+forEach   set+for-of    array+forEach stack
──────────────────────   ──────────────────────────────────────────   ────────────────────────────────
vite-app                 ✅             ✅             ✅             Vite (esbuild minify)
webpack-app              ✅             ✅             ✅             webpack + Terser
webpack-swc-minify-app   ❌ {}          ✅             ✅             webpack + swc-loader + swc minify

✅ = {"boundingBox":{"width":100}}   |   ❌ = {} = boundingBox restore silently lost
```

Only the `set+forEach` cell of `webpack-swc-minify-app` reproduces: **SWC**
(`swc-loader`) re-emits `(/*@__PURE__*/ new Set(..)).forEach(..)` as
`/*@__PURE__*/ new Set(..).forEach(..)`, hoisting the annotation to the head of
the chain; the following minify (DCE) then drops the whole `.forEach`. Vite
(esbuild) and Terser leave the annotation in place, so the chain survives.

- Build outputs only: `npm run build`
- A single app: `cd webpack-swc-minify-app && npm install && npm test`

## Layout

```
engine/                     library built with rolldown (exports the three variants)
vite-app/                   Vite (esbuild)      — safe
webpack-app/                webpack + Terser    — safe
webpack-swc-minify-app/     webpack + swc       — reproduces the bug
check-apps.mjs              builds & runs engine + 3 apps, prints the matrix (npm run apps)
```
