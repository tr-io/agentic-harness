import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectStack } from "../detector/index.js";
import { loadConfigOrNull } from "../config/loader.js";
import { linterTemplates } from "./templates/index.js";

export async function runLintSetup(): Promise<void> {
  const cwd = process.cwd();
  const stack = await detectStack(cwd);
  const config = loadConfigOrNull(cwd);

  if (stack.existingLinters.length > 0) {
    console.log(`✓ Existing linters detected: ${stack.existingLinters.join(", ")}`);
    console.log("  Skipping — harness never overrides existing linter configs.");
    return;
  }

  const scaffolded: Array<{ file: string; lintCommand: string }> = [];

  for (const lang of stack.languages) {
    const template = linterTemplates[lang];
    if (!template) continue;

    const filePath = join(cwd, template.filename);
    if (existsSync(filePath)) {
      console.log(`  Skipping ${template.filename} — already exists`);
      continue;
    }

    writeFileSync(filePath, template.content, "utf-8");
    scaffolded.push({ file: template.filename, lintCommand: template.lintCommand });
    console.log(`✓ Created ${template.filename} (${lang})`);
  }

  if (scaffolded.length === 0) {
    console.log("  No linter configs needed.");
    return;
  }

  // Update .harness.json lintCommand if present
  if (config && existsSync(join(cwd, ".harness.json"))) {
    const lintCommands = [...new Set(scaffolded.map((s) => s.lintCommand))];
    const lintCommand = lintCommands.join(" && ");
    const updated = {
      ...config,
      project: { ...config.project, lintCommand },
    };
    writeFileSync(join(cwd, ".harness.json"), JSON.stringify(updated, null, 2));
    console.log(`✓ Updated .harness.json lintCommand: ${lintCommand}`);
  }

  console.log("\nLinter setup complete.");
}
