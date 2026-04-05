import type { Command } from "commander";

export function registerLintSetup(program: Command): void {
  program
    .command("lint-setup")
    .description("Detect stack and bootstrap linter/formatter configs if missing")
    .action(async () => {
      const { runLintSetup } = await import("../lint-setup/index.js");
      await runLintSetup();
    });
}
