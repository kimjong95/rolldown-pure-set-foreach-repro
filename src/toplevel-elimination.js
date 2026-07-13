// Minimal, self-contained analog of esbuild's own `dot_yes` / `dot_no` test
// fixtures (bundler_dce_test.go), but using `new Set(...).forEach(cb)`
// instead of a made-up `foo().dot(bar)` to show the exact real-world shape.
//
// `yes` case: the callback is a bare function literal -> the entire
// PURE-annotated chain (including the callback's side effect) is eligible
// for removal if the binding/statement result is unused.
//
// `no` case: forEach's argument is itself a function CALL (`makeHandler()`)
// so the bundler can no longer prove the argument construction is
// side-effect-free, and the chain must be kept.
globalThis.sideEffects = [];

function makeHandler() {
  return (x) => globalThis.sideEffects.push(['no', x]);
}

// yes: unused, PURE-annotated chain -> expected to be fully removed
let yes = /* @__PURE__ */ new Set([1, 2, 3]).forEach((x) => {
  globalThis.sideEffects.push(['yes', x]);
});

// no: unused, PURE-annotated chain, but forEach's argument is a call
// -> expected to survive (argument itself isn't provably side-effect-free)
let no = /* @__PURE__ */ new Set([4, 5, 6]).forEach(makeHandler());

export function readSideEffects() {
  return globalThis.sideEffects;
}
