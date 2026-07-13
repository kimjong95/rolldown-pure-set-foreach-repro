// Three functionally-equivalent implementations of the real applyRestoreSnapshot
// props-restore path (packages/engine/editor/.../NodeTextCommandMemento.ts).
// In every one, `changedProps` is READ after the loop, so if the loop's writes
// are dropped, the boundingBox restore is silently lost.
//
// Only `applyRestoreSetForEach` is vulnerable: rolldown annotates `new Set(...)`
// as /* @__PURE__ */, and once a downstream SWC pass hoists that annotation to
// the head of the `.forEach` chain, any DCE removes the whole chain. The other
// two never hit that path (see README).

// ❌ reported pattern: `new Set(...)` chained into `.forEach(cb)`, result unused.
export function applyRestoreSetForEach(currentProps, targetProps, isEqual) {
  const changedProps = {};
  const allKeys = new Set([
    ...Object.keys(currentProps),
    ...Object.keys(targetProps),
  ]);

  allKeys.forEach((key) => {
    if (key === "text") return;
    if (!isEqual(currentProps[key], targetProps[key])) {
      changedProps[key] = targetProps[key];
    }
  });

  return changedProps;
}

// ✅ `new Set(...)` kept, but bound to a used const and iterated with for...of.
export function applyRestoreSetForOf(currentProps, targetProps, isEqual) {
  const changedProps = {};
  const allKeys = new Set([
    ...Object.keys(currentProps),
    ...Object.keys(targetProps),
  ]);

  for (const key of allKeys) {
    if (key === "text") continue;
    if (!isEqual(currentProps[key], targetProps[key])) {
      changedProps[key] = targetProps[key];
    }
  }

  return changedProps;
}

// ✅ SAME chained `.forEach(cb)` as the first variant, but on an array literal
// instead of `new Set(...)`. Arrays get no auto-pure annotation, so the chain
// survives — isolating that the trigger is the pure-annotated Set, not `.forEach`.
export function applyRestoreArrayForEach(currentProps, targetProps, isEqual) {
  const changedProps = {};
  const allKeys = [
    ...Object.keys(currentProps),
    ...Object.keys(targetProps),
  ];

  allKeys.forEach((key) => {
    if (key === "text") return;
    if (!isEqual(currentProps[key], targetProps[key])) {
      changedProps[key] = targetProps[key];
    }
  });

  return changedProps;
}
