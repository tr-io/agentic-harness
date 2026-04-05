import type { Command } from "commander";

export function registerAuto(program: Command): void {
  program
    .command("auto <ticket-id>")
    .description("Automated ticket implementation loop")
    .option("--simplify", "Run /simplify on files with substantial changes (>20 lines)")
    .action(async (ticketId: string, options) => {
      const { runAuto } = await import("../auto/index.js");
      await runAuto(ticketId, options);
    });
}
