import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['src/toplevel-elimination.js'],
  bundle: true,
  write: false,
  format: 'esm',
  treeShaking: true,
});

const code = result.outputFiles[0].text;

console.log('--- esbuild bundled output (bundle:true, no minify) ---\n');
console.log(code);

console.log(
  '\n`yes` (bare function-literal callback) is gone entirely: the whole\n' +
  '`new Set([1,2,3]).forEach(cb)` chain, including its side effect, was\n' +
  'removed because the binding is unused.\n' +
  '\n`no` (callback comes from calling `makeHandler()`) survives, because\n' +
  'the *argument* to `.forEach()` is itself a call the bundler cannot\n' +
  'prove is side-effect-free.\n' +
  '\nThis is the exact mechanism from esbuild\'s own `dot_yes`/`dot_no`\n' +
  'test fixtures (bundler_dce_test.go), applied to the real `Set`+`forEach`\n' +
  'shape from our production bug instead of the made-up `foo().dot(bar)`.\n'
);
