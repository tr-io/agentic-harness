import type { Command } from "commander";

export function registerTaxonomy(program: Command): void {
  program
    .command("taxonomy")
    .description("Print a feature classification table (feedforward vs feedback, enabled status)")
    .action(async () => {
      const { runTaxonomy } = await import("../taxonomy/index.js");
      await runTaxonomy();
    });
}
