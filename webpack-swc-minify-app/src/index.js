import {
  applyRestoreSetForEach,
  applyRestoreSetForOf,
  applyRestoreArrayForEach,
} from "@repro/engine";

const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const current = { boundingBox: { width: 999 }, text: "edited" };
const target = { boundingBox: { width: 100 }, text: "original" };

// Call each variant; result is used (stringified). If a Set.forEach chain is
// dropped by DCE, that variant returns {} instead of the real diff.
const results = {
  "set+forEach": JSON.stringify(applyRestoreSetForEach(current, target, isEqual)),
  "set+for-of": JSON.stringify(applyRestoreSetForOf(current, target, isEqual)),
  "array+forEach": JSON.stringify(applyRestoreArrayForEach(current, target, isEqual)),
};

// single machine-readable line for check-apps.mjs; correct value is
// {"boundingBox":{"width":100}}, the bug is {}
console.log(JSON.stringify(results));
