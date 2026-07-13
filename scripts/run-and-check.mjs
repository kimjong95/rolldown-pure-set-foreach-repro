import fs from 'node:fs';
import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['src/toplevel-elimination.js'],
  bundle: true,
  write: false,
  format: 'esm',
  treeShaking: true,
});

const code = result.outputFiles[0].text;
const distCheckPath = new URL('../.dist-check.mjs', import.meta.url);
fs.writeFileSync(distCheckPath, code);
const mod = await import(distCheckPath.href);
fs.unlinkSync(distCheckPath);

const sideEffects = mod.readSideEffects();

console.log('sideEffects recorded after running the bundled+tree-shaken code:');
console.log(JSON.stringify(sideEffects, null, 2));

const yesRan = sideEffects.some(([tag]) => tag === 'yes');
const noRan = sideEffects.some(([tag]) => tag === 'no');

console.log('\n"yes" side effect ran:', yesRan, ' (expected: false — silently eliminated)');
console.log('"no" side effect ran: ', noRan, ' (expected: true  — kept, argument is a call)');

if (yesRan) {
  console.error('\nUnexpected: the "yes" side effect ran. Environment/version mismatch?');
  process.exit(1);
}
