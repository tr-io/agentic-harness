import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerAuto } from "./commands/auto.js";
import { registerCheck } from "./commands/check.js";
import { registerInit } from "./commands/init.js";
import { registerLintSetup } from "./commands/lint-setup.js";
import { registerUpgrade } from "./commands/upgrade.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program
  .name("harness")
  .description("Agentic development harness for Claude Code projects")
  .version(pkg.version, "-v, --version");

registerInit(program);
registerCheck(program);
registerUpgrade(program);
registerLintSetup(program);
registerAuto(program);

program.parse();
