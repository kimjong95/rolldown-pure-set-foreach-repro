const path = require("path");
// rolldown(engine) + webpack. Default minifier (Terser). No SWC anywhere.
module.exports = {
  mode: "production",
  target: "node",
  entry: "./src/index.js",
  output: { path: path.resolve(__dirname, "dist"), filename: "main.js" },
  optimization: { minimize: true },
};
