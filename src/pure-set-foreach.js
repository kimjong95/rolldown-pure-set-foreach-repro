// This is the real-world pattern that triggered our production bug
// (undo/redo losing state after a Vite 6 -> 8 / Rollup -> Rolldown upgrade).
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
