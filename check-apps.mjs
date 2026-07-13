// Builds engine/ with rolldown, then feeds engine/dist into three real bundler
// environments. Each app runs all three memento variants and prints its results;
// this script renders the environment × variant matrix.
//
//   ✅ = {"boundingBox":{"width":100}} (correct)   ❌ = {} (Set.forEach chain dropped)
//
// Run: npm run apps
import { execSync } from "node:child_process";

const APPS = [
  { dir: "vite-app", label: "vite-app", stack: "Vite (esbuild minify)" },
  { dir: "webpack-app", label: "webpack-app", stack: "webpack + Terser" },
  { dir: "webpack-swc-minify-app", label: "webpack-swc-minify-app", stack: "webpack + swc-loader + swc minify" },
];
const VARIANTS = ["set+forEach", "set+for-of", "array+forEach"];
const CORRECT = `{"boundingBox":{"width":100}}`;

console.log("① rolldown build engine ...");
execSync("npm run build:engine", { stdio: "ignore" });

const rows = [];
for (const app of APPS) {
  process.stdout.write(`② building & running ${app.label} ...\n`);
  let results;
  try {
    const out = execSync("npm run --silent test", { cwd: app.dir, encoding: "utf8" });
    results = JSON.parse(out.trim().split("\n").pop());
  } catch (e) {
    results = null;
    rows.push({ ...app, error: String(e.message).split("\n")[0] });
    continue;
  }
  rows.push({ ...app, results });
}

const cell = (r) => (r === CORRECT ? "✅" : r === "{}" ? "❌ {}" : `? ${r}`);
const W = Math.max(...APPS.map((a) => a.label.length));
const CW = 14; // column width for each variant
console.log(`\n${"app".padEnd(W)}   ${VARIANTS.map((v) => v.padEnd(CW)).join("")}stack`);
console.log(`${"─".repeat(W)}   ${VARIANTS.map(() => "─".repeat(CW)).join("")}${"─".repeat(20)}`);
for (const r of rows) {
  if (r.error) {
    console.log(`${r.label.padEnd(W)}   (failed: ${r.error})`);
    continue;
  }
  const cells = VARIANTS.map((v) => cell(r.results[v]).padEnd(CW)).join("");
  console.log(`${r.label.padEnd(W)}   ${cells}${r.stack}`);
}
console.log(`\n✅ = ${CORRECT}   |   ❌ = {} = boundingBox restore silently lost`);
console.log(`Only webpack-swc-minify-app × set+forEach regresses — SWC hoists the pure`);
console.log(`annotation to the chain head, then DCE drops the whole \`.forEach\`.`);
