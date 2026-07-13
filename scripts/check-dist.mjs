// This does NOT call the rolldown bundler API. It imports the already-built
// dist file produced by `npm run build:toplevel` (a real `rolldown -c
// rolldown.toplevel.config.js` CLI invocation) and just reads/executes it,
// the same way any real consumer of a built package would.
import { readSideEffects } from '../dist-toplevel/toplevel-elimination.js';

const sideEffects = readSideEffects();

console.log('sideEffects recorded after running dist-toplevel/toplevel-elimination.js:');
console.log(JSON.stringify(sideEffects, null, 2));

const yesRan = sideEffects.some(([tag]) => tag === 'yes');
const noRan = sideEffects.some(([tag]) => tag === 'no');

console.log('\n"yes" side effect ran:', yesRan, ' (expected: false)');
console.log('"no" side effect ran: ', noRan, ' (expected: false -- rolldown removes this one too, see README)');

if (yesRan || noRan) {
  console.error('\nUnexpected: a side effect ran that the current rolldown version is expected to eliminate.');
  process.exit(1);
}
