import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  // Bundle inquirer and its deps so they don't need to be extracted into
  // node_modules during global npm install (which fails on @inquirer/* packages).
  // commander stays external — simple CJS, installs cleanly.
  noExternal: ["inquirer", /^@inquirer\//, "mute-stream", "ora", "cli-cursor", "cli-spinners"],
  // Shim require() so CJS packages bundled into ESM output work correctly
  // (e.g. mute-stream does require("stream") which fails without this)
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  sourcemap: true,
});
