import type { Command } from "commander";

export function registerUpgrade(program: Command): void {
  program
    .command("upgrade")
    .description("Upgrade harness templates to the latest version")
    .option("--dry-run", "Preview changes without writing")
    .action(async (options) => {
      const { runUpgrade } = await import("../upgrade/index.js");
      await runUpgrade(options);
    });
}
