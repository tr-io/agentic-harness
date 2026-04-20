import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_METADATA } from "../config/feature-metadata.js";
import { loadConfig } from "../config/loader.js";
import type { FeaturesConfig, HarnessConfig } from "../config/types.js";

interface ConfigureOptions {
  section?: string;
}

function featureName(description: string): string {
  return description.split(" — ")[0];
}

function getEnabledKeys(features: FeaturesConfig): string[] {
  const enabled: string[] = [];
  for (const key of Object.keys(FEATURE_METADATA)) {
    if (key === "skills") {
      if (features.skills.addTicket || features.skills.build) enabled.push(key);
    } else {
      const val = features[key as keyof FeaturesConfig];
      if (typeof val === "boolean" && val) enabled.push(key);
    }
  }
  return enabled;
}

function applySelectedFeatures(config: HarnessConfig, selected: string[]): HarnessConfig {
  const skillsWasEnabled = config.features.skills.addTicket || config.features.skills.build;
  const skillsNowEnabled = selected.includes("skills");

  const updated: FeaturesConfig = {
    ...config.features,
    adr: selected.includes("adr"),
    testingDocs: selected.includes("testingDocs"),
    linterBootstrap: selected.includes("linterBootstrap"),
    linearIntegration: selected.includes("linearIntegration"),
    dddContextMaps: selected.includes("dddContextMaps"),
    latMd: selected.includes("latMd"),
    evaluatorQA: selected.includes("evaluatorQA"),
    autoLoop: selected.includes("autoLoop"),
    keelEnforcement: selected.includes("keelEnforcement"),
    branchNamingWarning: selected.includes("branchNamingWarning"),
    artifactFreshnessCheck: selected.includes("artifactFreshnessCheck"),
    completionReminder: selected.includes("completionReminder"),
    skills: skillsNowEnabled
      ? skillsWasEnabled
        ? config.features.skills
        : { addTicket: true, build: true }
      : { addTicket: false, build: false },
  };

  return { ...config, features: updated };
}

async function configureFeaturesSection(cwd: string, config: HarnessConfig): Promise<void> {
  const { default: inquirer } = await import("inquirer");

  const feedforward = Object.entries(FEATURE_METADATA).filter(
    ([, m]) => m.controlType === "feedforward",
  );
  const feedback = Object.entries(FEATURE_METADATA).filter(([, m]) => m.controlType === "feedback");

  const currentEnabled = getEnabledKeys(config.features);

  // biome-ignore lint/suspicious/noExplicitAny: inquirer Separator type varies across versions
  const choices: any[] = [
    new inquirer.Separator("── Guides (feedforward) ──────────────────"),
    ...feedforward.map(([key, meta]) => ({
      name: `${featureName(meta.description)} [${meta.executionType}]`,
      value: key,
      checked: currentEnabled.includes(key),
    })),
    new inquirer.Separator("── Sensors (feedback) ────────────────────"),
    ...feedback.map(([key, meta]) => ({
      name: `${featureName(meta.description)} [${meta.executionType}]`,
      value: key,
      checked: currentEnabled.includes(key),
    })),
  ];

  // biome-ignore lint/suspicious/noExplicitAny: inquirer v13 prompt() type is overly strict
  const answers = await (inquirer.prompt as any)([
    {
      type: "checkbox",
      name: "features",
      message: "Toggle features (space to select, enter to confirm):",
      choices,
      pageSize: 20,
    },
  ]);

  const updated = applySelectedFeatures(config, answers.features as string[]);
  const configContent = { $schema: config.$schema, ...updated };
  writeFileSync(join(cwd, ".harness.json"), JSON.stringify(configContent, null, 2));
  console.log("\n✅ Features updated in .harness.json\n");
}

export async function runConfigure(options: ConfigureOptions): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(cwd);

  const section = options.section ?? "features";

  if (section === "features") {
    await configureFeaturesSection(cwd, config);
  } else {
    console.error(`Unknown section: "${section}". Available sections: features`);
    process.exit(1);
  }
}
