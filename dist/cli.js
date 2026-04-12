#!/usr/bin/env node
import "./chunk-ZWE3DS7E.js";

// src/cli.ts
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";

// src/commands/auto.ts
function registerAuto(program2) {
  program2.command("auto <ticket-id>").description("Automated ticket implementation loop").option("--simplify", "Run /simplify on files with substantial changes (>20 lines)").action(async (ticketId, options) => {
    const { runAuto } = await import("./auto-IUIVPXJW.js");
    await runAuto(ticketId, options);
  });
}

// src/commands/check.ts
function registerCheck(program2) {
  program2.command("check").description("Validate harness health for the current project").action(async () => {
    const { runCheck } = await import("./check-X7MPRF2Y.js");
    await runCheck();
  });
}

// src/commands/init.ts
function registerInit(program2) {
  program2.command("init").description("Bootstrap agentic harness into a project").option("--dry-run", "Preview files without writing").option("--no-interactive", "Use detected defaults without prompting").action(async (options) => {
    const { runInit } = await import("./init-3ISN3QZ4.js");
    await runInit(options);
  });
}

// src/commands/lint-setup.ts
function registerLintSetup(program2) {
  program2.command("lint-setup").description("Detect stack and bootstrap linter/formatter configs if missing").action(async () => {
    const { runLintSetup } = await import("./lint-setup-YSYDLWKQ.js");
    await runLintSetup();
  });
}

// src/commands/upgrade.ts
function registerUpgrade(program2) {
  program2.command("upgrade").description("Upgrade harness templates to the latest version").option("--dry-run", "Preview changes without writing").action(async (options) => {
    const { runUpgrade } = await import("./upgrade-N3P4KRFG.js");
    await runUpgrade(options);
  });
}

// src/cli.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
var pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
var program = new Command();
program.name("harness").description("Agentic development harness for Claude Code projects").version(pkg.version, "-v, --version");
registerInit(program);
registerCheck(program);
registerUpgrade(program);
registerLintSetup(program);
registerAuto(program);
program.parse();
//# sourceMappingURL=cli.js.map