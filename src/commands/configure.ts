import type { Command } from "commander";

export function registerConfigure(program: Command): void {
  program
    .command("configure")
    .description("Interactively configure harness settings")
    .option("--section <name>", "Section to configure (features)", "features")
    .action(async (options) => {
      const { runConfigure } = await import("../configure/index.js");
      await runConfigure(options);
    });
}
