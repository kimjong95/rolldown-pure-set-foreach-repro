import { applyRestore } from './pure-set-foreach.js';

function isEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Call it the way a real caller would: result never assigned/used.
applyRestore(
  { boundingBox: { width: 999 }, text: 'edited' },
  { boundingBox: { width: 100 }, text: 'original' },
  {},
  isEqual
);
