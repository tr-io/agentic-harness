import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  // CJS output: CLI tools don't need ESM, and CJS handles require() natively.
  // ESM + bundled CJS deps (like mute-stream) always has require() shim issues.
  format: ["cjs"],
  // Use .cjs extension since package.json has "type": "module"
  outExtension: () => ({ js: ".cjs" }),
  target: "node20",
  outDir: "dist",
  clean: true,
  // Bundle inquirer and its deps to avoid npm install failures with @inquirer/*
  noExternal: ["inquirer", /^@inquirer\//, "mute-stream", "ora", "cli-cursor", "cli-spinners"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  sourcemap: true,
});
