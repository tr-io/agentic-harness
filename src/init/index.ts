import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scaffoldCiWorkflow } from "../ci/index.js";
import { CONFIG_DEFAULTS } from "../config/defaults.js";
import type { HarnessConfig } from "../config/types.js";
import { detectStack } from "../detector/index.js";
import type { StackReport } from "../detector/types.js";
import {
  analyzeCodebaseWithSubAgent,
  detectExistingConfigs,
  mergeClaudeSettings,
  writeSubAgentOutputs,
} from "../existing-init/index.js";
import { scaffold } from "../scaffolder/index.js";

interface InitOptions {
  dryRun?: boolean;
  interactive?: boolean;
  force?: boolean;
}

/** @internal */
export function isGreenfield(dir: string): boolean {
  return (
    !existsSync(join(dir, "src")) &&
    !existsSync(join(dir, "package.json")) &&
    !existsSync(join(dir, "Cargo.toml")) &&
    !existsSync(join(dir, "go.mod")) &&
    !existsSync(join(dir, "pyproject.toml")) &&
    !existsSync(join(dir, "pom.xml"))
  );
}

async function promptUser(stack: StackReport): Promise<HarnessConfig> {
  const { default: inquirer } = await import("inquirer");
  // biome-ignore lint/suspicious/noExplicitAny: inquirer v13 prompt() type is overly strict
  const answers = await (inquirer.prompt as any)([
    { type: "input", name: "name", message: "Project name:", default: "my-project" },
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
      default: guessTestCommand(stack),
    },
    {
      type: "input",
      name: "lintCommand",
      message: "Lint command:",
      default: guessLintCommand(stack),
    },
    {
      type: "input",
      name: "typeCheckCommand",
      message: "Type check command:",
      default: stack.languages.includes("typescript") ? "npx tsc --noEmit" : "",
    },
    { type: "input", name: "buildCommand", message: "Build command:", default: "npm run build" },
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

/** @internal */
export function defaultsFromStack(stack: StackReport): HarnessConfig {
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

/** @internal */
export function buildConfig(answers: Record<string, unknown>, stack: StackReport): HarnessConfig {
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
    integrations: {
      linear: {
        enabled: Boolean(answers.linearEnabled),
        teamKey: String(answers.linearTeamKey ?? ""),
      },
    },
    features: CONFIG_DEFAULTS.features,
    hooks: CONFIG_DEFAULTS.hooks,
  };
}

/** @internal */
export function guessTestCommand(stack: StackReport): string {
  const map: Record<string, string> = {
    vitest: "npm test",
    jest: "npm test",
    pytest: "pytest",
    "cargo-test": "cargo test",
    "go-test": "go test ./...",
  };
  return stack.testFramework ? (map[stack.testFramework] ?? "") : "";
}

/** @internal */
export function guessLintCommand(stack: StackReport): string {
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
│  • Branch protection on main:                           │
│    - Require PR reviews before merging                  │
│    - Require status checks to pass                      │
│    - Disable force push to main                         │
│                                                         │
│  • Install the Linear GitHub app for PR auto-linking:   │
│    https://linear.app/settings/integrations/github      │
└─────────────────────────────────────────────────────────┘
`);
}

export async function runInit(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const interactive = options.interactive !== false;
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);

  if (existsSync(join(cwd, ".harness.json")) && !dryRun && !force) {
    console.log(
      "⚠  .harness.json already exists. Run harness upgrade to update, or harness init --force to re-scaffold.",
    );
    return;
  }

  console.log("🔍 Detecting project stack…");
  const stack = await detectStack(cwd);
  const greenfield = isGreenfield(cwd);
  const existing = detectExistingConfigs(cwd);

  console.log(
    `  Type: ${stack.projectType} | Stack: ${[...stack.languages, ...stack.frameworks].join(", ") || "unknown"}`,
  );

  if (!greenfield) {
    console.log("  Existing project detected.");
    if (existing.claudeMd) console.log("  ⚠ CLAUDE.md exists — will merge if possible");
    if (existing.claudeSettings) console.log("  ⚠ .claude/settings.json exists — will merge hooks");
  }

  let config: HarnessConfig;
  if (interactive && !dryRun) {
    config = await promptUser(stack);
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
    // Merge .claude/settings.json if it existed before
    if (existing.claudeSettings) {
      const settingsPath = join(cwd, ".claude", "settings.json");
      try {
        const existingSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
        const harnessSettings = JSON.parse(
          result.files.find((f) => f.path === ".claude/settings.json")?.content ?? "{}",
        );
        const merged = mergeClaudeSettings(existingSettings, harnessSettings);
        writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
        console.log("  ✓ Merged .claude/settings.json");
      } catch {
        /* use scaffolded version */
      }
    }

    // Sub-agent analysis for existing projects
    if (!greenfield) {
      console.log("\n🤖 Analyzing codebase with sub-agent (Sonnet)…");
      const analysis = analyzeCodebaseWithSubAgent(cwd, stack);
      const written = writeSubAgentOutputs(cwd, analysis);
      for (const f of written) console.log(`  ✓ ${f} (sub-agent generated)`);
    }

    // Scaffold CI workflow if none exists
    if (!existing.ciWorkflow) {
      const ci = scaffoldCiWorkflow(cwd, config, stack);
      if (ci.created) console.log("  ✓ .github/workflows/ci.yml");
    }

    // Write .harness.json
    const configContent = {
      $schema: "https://raw.githubusercontent.com/tr-io/agentic-harness/main/schema.json",
      ...config,
    };
    writeFileSync(join(cwd, ".harness.json"), JSON.stringify(configContent, null, 2));
    console.log("  ✓ .harness.json");

    console.log("\n✅ Harness initialized.\n");
    printGithubSuggestions();
  } else {
    console.log("\n  (dry run — no files written)\n");
  }
}
