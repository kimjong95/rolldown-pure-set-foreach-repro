import { defineConfig } from "vite";
// SSR build so the output runs directly under node (easy result inspection).
// Vite's default minifier is esbuild; this is rolldown(engine) + Vite.
export default defineConfig({
  build: {
    ssr: "src/main.js",
    outDir: "dist",
    minify: "esbuild",
    rollupOptions: { output: { format: "es", entryFileNames: "main.js" } },
  },
});
