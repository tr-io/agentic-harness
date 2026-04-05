import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectStack } from "../detector/index.js";
import { CONFIG_DEFAULTS } from "../config/defaults.js";
import type { HarnessConfig } from "../config/types.js";
import { scaffold } from "../scaffolder/index.js";
import type { StackReport } from "../detector/types.js";

interface InitOptions {
  dryRun?: boolean;
  interactive?: boolean; // commander --no-interactive sets this to false
}

function isGreenfield(dir: string): boolean {
  const srcExists = existsSync(join(dir, "src"));
  const hasPackageJson = existsSync(join(dir, "package.json"));
  const hasCargoToml = existsSync(join(dir, "Cargo.toml"));
  const hasGoMod = existsSync(join(dir, "go.mod"));
  // Greenfield = no source directory and no main manifest
  return !srcExists && !hasPackageJson && !hasCargoToml && !hasGoMod;
}

async function promptGreenfield(stack: StackReport): Promise<HarnessConfig> {
  const { default: inquirer } = await import("inquirer");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answers = await (inquirer.prompt as any)([
    {
      type: "input",
      name: "name",
      message: "Project name:",
      default: "my-project",
    },
    {
      type: "list",
      name: "type",
      message: "Project type:",
      choices: ["web-app", "cli", "library", "monorepo", "mobile"],
      default: stack.projectType,
    },
    {
      type: "input",
      name: "testCommand",
      message: "Test command:",
      default: stack.testFramework ? guessTestCommand(stack) : "npm test",
    },
    {
      type: "input",
      name: "lintCommand",
      message: "Lint command:",
      default: stack.existingLinters.length ? guessLintCommand(stack) : "npm run lint",
    },
    {
      type: "input",
      name: "typeCheckCommand",
      message: "Type check command:",
      default: stack.languages.includes("typescript") ? "npx tsc --noEmit" : "",
    },
    {
      type: "input",
      name: "buildCommand",
      message: "Build command:",
      default: "npm run build",
    },
    {
      type: "confirm",
      name: "linearEnabled",
      message: "Enable Linear integration?",
      default: false,
    },
    {
      type: "input",
      name: "linearTeamKey",
      message: "Linear team key (e.g. TRI):",
      default: "",
      when: (a: Record<string, unknown>) => a.linearEnabled,
    },
  ]);

  return buildConfig(answers, stack);
}

function defaultsFromStack(stack: StackReport): HarnessConfig {
  return buildConfig(
    {
      name: stack.entryPoints[0]?.split("/")[0] || "my-project",
      type: stack.projectType,
      testCommand: guessTestCommand(stack),
      lintCommand: guessLintCommand(stack),
      typeCheckCommand: stack.languages.includes("typescript") ? "npx tsc --noEmit" : "",
      buildCommand: "npm run build",
      linearEnabled: false,
      linearTeamKey: "",
    },
    stack,
  );
}

function buildConfig(
  answers: Record<string, unknown>,
  stack: StackReport,
): HarnessConfig {
  return {
    ...CONFIG_DEFAULTS,
    project: {
      name: String(answers.name ?? "my-project"),
      type: (answers.type as HarnessConfig["project"]["type"]) ?? stack.projectType,
      stacks: stack.languages,
      entryPoints: stack.entryPoints,
      testCommand: String(answers.testCommand ?? ""),
      lintCommand: String(answers.lintCommand ?? ""),
      typeCheckCommand: String(answers.typeCheckCommand ?? ""),
      buildCommand: String(answers.buildCommand ?? ""),
    },
    linear: {
      enabled: Boolean(answers.linearEnabled),
      teamKey: String(answers.linearTeamKey ?? ""),
    },
    features: CONFIG_DEFAULTS.features,
    hooks: CONFIG_DEFAULTS.hooks,
  };
}

function guessTestCommand(stack: StackReport): string {
  switch (stack.testFramework) {
    case "vitest":
    case "jest":
      return "npm test";
    case "pytest":
      return "pytest";
    case "cargo-test":
      return "cargo test";
    case "go-test":
      return "go test ./...";
    default:
      return "";
  }
}

function guessLintCommand(stack: StackReport): string {
  if (stack.existingLinters.includes("biome")) return "npx biome check .";
  if (stack.existingLinters.includes("eslint")) return "npx eslint .";
  if (stack.existingLinters.includes("ruff")) return "ruff check .";
  if (stack.existingLinters.includes("clippy")) return "cargo clippy";
  if (stack.existingLinters.includes("golangci-lint")) return "golangci-lint run";
  return "";
}

function printGithubSuggestions(): void {
  console.log(`
┌─────────────────────────────────────────────────────────┐
│  Recommended GitHub setup (configure manually):         │
│                                                         │
│  1. Branch protection on main:                          │
│     • Require pull request reviews before merging       │
│     • Require status checks to pass before merging      │
│     • Disable force push to main                        │
│                                                         │
│  2. Install the Linear GitHub app for PR auto-linking:  │
│     https://linear.app/settings/integrations/github     │
└─────────────────────────────────────────────────────────┘
`);
}

export async function runInit(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const interactive = options.interactive !== false;
  const dryRun = Boolean(options.dryRun);

  if (existsSync(join(cwd, ".harness.json")) && !dryRun) {
    console.log("⚠  .harness.json already exists. Run harness upgrade to update.");
    return;
  }

  console.log("🔍 Detecting project stack…");
  const stack = await detectStack(cwd);
  const greenfield = isGreenfield(cwd);

  if (greenfield) {
    console.log("  Detected: greenfield project");
  } else {
    const detected = [
      ...stack.languages,
      ...stack.frameworks,
    ].join(", ") || "unknown";
    console.log(`  Detected: ${detected} (${stack.projectType})`);
  }

  let config: HarnessConfig;

  if (interactive && !dryRun) {
    config = await promptGreenfield(stack);
  } else {
    config = defaultsFromStack(stack);
  }

  console.log(dryRun ? "\n📋 Files that would be created:\n" : "\n📁 Scaffolding files…\n");

  const result = scaffold(cwd, config, stack, { dryRun, skipExisting: false });

  for (const file of result.files) {
    const tier = file.tier === "mandatory" ? "" : ` (${file.tier})`;
    console.log(`  ${dryRun ? "·" : "✓"} ${file.path}${tier}`);
  }

  if (!dryRun) {
    // Write .harness.json
    const configPath = join(cwd, ".harness.json");
    const configContent = {
      $schema: "https://raw.githubusercontent.com/tr-io/agentic-harness/main/schema.json",
      ...config,
    };
    writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    console.log(`  ✓ .harness.json`);

    console.log("\n✅ Harness initialized.\n");
    printGithubSuggestions();
  } else {
    console.log(`\n  (dry run — no files written)\n`);
  }
}
