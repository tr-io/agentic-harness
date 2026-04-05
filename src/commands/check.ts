import type { Command } from "commander";

export function registerCheck(program: Command): void {
  program
    .command("check")
    .description("Validate harness health for the current project")
    .action(async () => {
      const { runCheck } = await import("../check/index.js");
      await runCheck();
    });
}
