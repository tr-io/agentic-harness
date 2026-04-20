import { FEATURE_METADATA } from "../config/feature-metadata.js";
import { loadConfigOrNull } from "../config/loader.js";
import type { FeaturesConfig } from "../config/types.js";

function featureName(description: string): string {
  return description.split(" — ")[0];
}

function isEnabled(features: FeaturesConfig, key: string): boolean {
  if (key === "skills") return features.skills.addTicket || features.skills.build;
  const val = features[key as keyof FeaturesConfig];
  return typeof val === "boolean" ? val : false;
}

function printSection(
  title: string,
  entries: Array<[string, (typeof FEATURE_METADATA)[string]]>,
  features: FeaturesConfig | null,
): void {
  const NAME_W = 28;
  const EXEC_W = 14;

  console.log(` ${title}\n`);
  console.log(`  ${"Feature".padEnd(NAME_W)} ${"Execution".padEnd(EXEC_W)} Enabled`);
  console.log(`  ${"-".repeat(NAME_W)} ${"-".repeat(EXEC_W)} -------`);

  for (const [key, meta] of entries) {
    const name = featureName(meta.description).padEnd(NAME_W);
    const exec = meta.executionType.padEnd(EXEC_W);
    const enabled = features ? (isEnabled(features, key) ? "  ✓" : "  ✗") : "  —";
    console.log(`  ${name} ${exec} ${enabled}`);
  }
}

export async function runTaxonomy(): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfigOrNull(cwd);
  const features = config?.features ?? null;

  const feedforward = Object.entries(FEATURE_METADATA).filter(
    ([, m]) => m.controlType === "feedforward",
  );
  const feedback = Object.entries(FEATURE_METADATA).filter(([, m]) => m.controlType === "feedback");

  console.log("\n Harness Feature Taxonomy\n");

  printSection("Guides (Feedforward)", feedforward, features);
  console.log();
  printSection("Sensors (Feedback)", feedback, features);
  console.log();

  if (!features) {
    console.log(
      '  (no .harness.json found — enabled status unavailable. Run "harness init" to set up.)\n',
    );
    return;
  }

  const ffEnabled = feedforward.filter(([k]) => isEnabled(features, k)).length;
  const fbEnabled = feedback.filter(([k]) => isEnabled(features, k)).length;
  console.log(
    ` Balance: ${ffEnabled} feedforward guide(s) / ${fbEnabled} feedback sensor(s) enabled`,
  );
  if (fbEnabled === 0) {
    console.log("  ⚠  No feedback sensors enabled — your harness may be under-instrumented.\n");
  } else {
    console.log();
  }
}
