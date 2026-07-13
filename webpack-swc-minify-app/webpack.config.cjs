const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
// rolldown(engine) + webpack + SWC. This mirrors the real app build:
//  - swc-loader transforms every module (INCLUDING the pre-built engine),
//    which re-emits `(/*@__PURE__*/ new Set(..)).forEach(..)` as
//    `/*@__PURE__*/ new Set(..).forEach(..)` (annotation hoisted to chain head)
//  - SWC minify then DCE-drops the now-head-annotated chain.
module.exports = {
  mode: "production",
  target: "node",
  entry: "./src/index.js",
  output: { path: path.resolve(__dirname, "dist"), filename: "main.js" },
  module: {
    rules: [
      {
        test: /\.js$/,
        // do NOT exclude node_modules: the engine must go through swc too
        use: {
          loader: "swc-loader",
          options: { jsc: { parser: { syntax: "ecmascript" }, target: "es2022" } },
        },
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({ minify: TerserPlugin.swcMinify })],
  },
};
