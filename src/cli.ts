import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { registerAuto } from "./commands/auto.js";
import { registerCheck } from "./commands/check.js";
import { registerConfigure } from "./commands/configure.js";
import { registerInit } from "./commands/init.js";
import { registerLintSetup } from "./commands/lint-setup.js";
import { registerTaxonomy } from "./commands/taxonomy.js";
import { registerUpgrade } from "./commands/upgrade.js";

// Use inline version string — avoids import.meta.url / __dirname issues
// across ESM/CJS output formats. Version is injected at build time.
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program
  .name("harness")
  .description("Agentic development harness for Claude Code projects")
  .version(pkg.version, "-v, --version");

registerInit(program);
registerCheck(program);
registerConfigure(program);
registerTaxonomy(program);
registerUpgrade(program);
registerLintSetup(program);
registerAuto(program);

program.parse();
