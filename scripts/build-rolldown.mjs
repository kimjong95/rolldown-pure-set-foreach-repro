import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'src/pure-set-foreach.js' });
const { output } = await bundle.generate({ format: 'es' });

console.log('--- Rolldown output (no minification) ---\n');
console.log(output[0].code);

console.log(
  '\nNotice the auto-inserted `/* @__PURE__ */` sits directly in front of\n' +
  '`new Set([...])`, and the `const allKeys = ...` binding has been inlined\n' +
  'so the PURE comment is now positioned at the head of the whole\n' +
  '`.forEach(cb)` chain rather than on an isolated statement.\n'
);
