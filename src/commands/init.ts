import type { Command } from "commander";

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Bootstrap agentic harness into a project")
    .option("--dry-run", "Preview files without writing")
    .option("--no-interactive", "Use detected defaults without prompting")
    .option("--force", "Re-scaffold even if .harness.json already exists")
    .action(async (options) => {
      const { runInit } = await import("../init/index.js");
      await runInit(options);
    });
}
