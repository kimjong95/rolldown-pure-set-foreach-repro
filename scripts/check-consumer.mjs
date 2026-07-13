// Reads the real dist file produced by `npm run build:consumer`
// (a real `rolldown -c rolldown.consumer.config.js` CLI build) and reports
// whether the `new Set([...]).forEach(cb)` chain from `applyRestore` is
// still present in the bundle -- i.e. whether the pattern survives when
// called exactly the way real code calls it (call site present, return
// value never captured).
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../dist-consumer/consumer-unused-result.js', import.meta.url), 'utf8');

const hasForEachChain = /new Set\(\[[^\]]*\]\)\)\.forEach/.test(code);

console.log('--- dist-consumer/consumer-unused-result.js ---\n');
console.log(code);

console.log(
  hasForEachChain
    ? '\nResult: the Set+forEach chain (and its `changedProps[key] = ...` side effect) is STILL PRESENT in this bundle.\n' +
      'In this exact configuration, the pattern is NOT silently eliminated.'
    : '\nResult: the Set+forEach chain is GONE from this bundle -- the side effect would never run.'
);
