import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  // Bundle inquirer and all @inquirer/* sub-packages so they don't need
  // to be installed as node_modules (which fails on global npm install).
  // Keep commander external — it's a small CJS package that installs cleanly.
  noExternal: ["inquirer", /^@inquirer\//],
  banner: {
    js: "#!/usr/bin/env node",
  },
  sourcemap: true,
});
