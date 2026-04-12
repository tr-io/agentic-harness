#!/usr/bin/env node
import {
  scaffold
} from "./chunk-XZYE27ZT.js";
import {
  detectStack
} from "./chunk-GE2FWTDY.js";
import {
  CONFIG_DEFAULTS
} from "./chunk-JRM7MC4Q.js";
import "./chunk-ZWE3DS7E.js";

// src/init/index.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync3 } from "fs";
import { join as join3 } from "path";

// src/ci/index.ts
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
function generateCiWorkflow(config, stack) {
  const steps = [];
  const stacks = stack.languages;
  if (stacks.includes("typescript") || stacks.includes("javascript")) {
    steps.push(
      `      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: '${stack.packageManager ?? "npm"}'`,
      `      - name: Install dependencies
        run: ${stack.packageManager === "pnpm" ? "pnpm install --frozen-lockfile" : stack.packageManager === "bun" ? "bun install" : "npm install"}`
    );
  }
  if (stacks.includes("python")) {
    steps.push(
      `      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'`,
      `      - name: Install dependencies
        run: pip install -r requirements.txt`
    );
  }
  if (stacks.includes("rust")) {
    steps.push(
      `      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable`,
      `      - name: Cache Cargo
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: \${{ runner.os }}-cargo-\${{ hashFiles('**/Cargo.lock') }}`
    );
  }
  if (stacks.includes("go")) {
    steps.push(
      `      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache: true`
    );
  }
  if (stacks.includes("java")) {
    steps.push(
      `      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: ${existsSync(join(process.cwd(), "build.gradle")) ? "gradle" : "maven"}`
    );
  }
  if (config.project.lintCommand) {
    steps.push(
      `      - name: Lint
        run: ${config.project.lintCommand}`
    );
  }
  if (config.project.typeCheckCommand) {
    steps.push(
      `      - name: Type check
        run: ${config.project.typeCheckCommand}`
    );
  }
  if (config.project.testCommand) {
    steps.push(
      `      - name: Test
        run: ${config.project.testCommand}`
    );
  }
  if (config.project.buildCommand) {
    steps.push(
      `      - name: Build
        run: ${config.project.buildCommand}`
    );
  }
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

${steps.join("\n\n")}
`;
}
function scaffoldCiWorkflow(projectDir, config, stack) {
  const workflowDir = join(projectDir, ".github", "workflows");
  if (existsSync(workflowDir)) {
    try {
      const existing = readdirSync(workflowDir).filter(
        (f) => f.endsWith(".yml") || f.endsWith(".yaml")
      );
      if (existing.length > 0) {
        return { created: false, path: join(workflowDir, existing[0]) };
      }
    } catch {
    }
  }
  const content = generateCiWorkflow(config, stack);
  mkdirSync(workflowDir, { recursive: true });
  const path = join(workflowDir, "ci.yml");
  writeFileSync(path, content, "utf-8");
  return { created: true, path };
}

// src/existing-init/index.ts
import { spawnSync } from "child_process";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync, readdirSync as readdirSync2, statSync, writeFileSync as writeFileSync2 } from "fs";
import { join as join2, relative } from "path";
function detectExistingConfigs(dir) {
  return {
    claudeMd: existsSync2(join2(dir, "CLAUDE.md")),
    claudeSettings: existsSync2(join2(dir, ".claude", "settings.json")),
    cursorrules: existsSync2(join2(dir, ".cursorrules")),
    copilotInstructions: existsSync2(join2(dir, ".github", "copilot-instructions.md")),
    gitHooksPrePush: existsSync2(join2(dir, ".git", "hooks", "pre-push")),
    ciWorkflow: detectCiWorkflow(dir)
  };
}
function detectCiWorkflow(dir) {
  const workflowDir = join2(dir, ".github", "workflows");
  if (!existsSync2(workflowDir)) return false;
  try {
    return readdirSync2(workflowDir).some((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  } catch {
    return false;
  }
}
function mergeClaudeSettings(existing, harnessSettings) {
  const merged = { ...existing };
  const existingHooks = existing.hooks ?? {};
  const harnessHooks = harnessSettings.hooks ?? {};
  const mergedHooks = { ...existingHooks };
  for (const [event, harnessEntries] of Object.entries(harnessHooks)) {
    const existing_ = mergedHooks[event] ?? [];
    const existingCommands = new Set(existing_.flatMap((e) => e.hooks ?? []).map((h) => h.command));
    const newEntries = harnessEntries.filter(
      (entry) => !(entry.hooks ?? []).every((h) => h.command && existingCommands.has(h.command))
    );
    mergedHooks[event] = [...existing_, ...newEntries];
  }
  merged.hooks = mergedHooks;
  return merged;
}
function gatherDirectoryTree(dir, maxDepth = 3, prefix = "") {
  const lines = [];
  let entries = [];
  try {
    entries = readdirSync2(dir).filter(
      (e) => !e.startsWith(".") && e !== "node_modules" && e !== "dist" && e !== "__pycache__" && e !== "target"
    );
  } catch {
    return "";
  }
  for (const entry of entries.slice(0, 30)) {
    const full = join2(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    lines.push(`${prefix}${isDir ? "\u{1F4C1}" : "\u{1F4C4}"} ${entry}`);
    if (isDir && maxDepth > 1) {
      const sub = gatherDirectoryTree(full, maxDepth - 1, `${prefix}  `);
      if (sub) lines.push(sub);
    }
  }
  return lines.join("\n");
}
function readFileHeader(filePath, lines = 30) {
  try {
    return readFileSync(filePath, "utf-8").split("\n").slice(0, lines).join("\n");
  } catch {
    return "";
  }
}
function analyzeCodebaseWithSubAgent(dir, stack) {
  const tree = gatherDirectoryTree(dir);
  const keyFiles = stack.entryPoints.slice(0, 3).map((ep) => {
    const content = readFileHeader(join2(dir, ep));
    return content ? `### ${ep}
\`\`\`
${content}
\`\`\`` : "";
  }).filter(Boolean).join("\n\n");
  const prompt = `Analyze this ${stack.projectType} codebase and generate agent navigation documentation.

## Project Structure
${tree}

## Stack: ${stack.languages.join(", ")} | Frameworks: ${stack.frameworks.join(", ") || "none"}
## Entry points: ${stack.entryPoints.join(", ") || "none"}

${keyFiles ? `## Key File Headers
${keyFiles}` : ""}

Generate a JSON response (ONLY JSON, no other text):
{
  "codebaseDocs": { "<filename>.md": "<markdown content for .ai/codebase/<filename>.md>" },
  "manifestMappings": [{ "sourcePaths": ["src/module/**"], "docs": [".ai/codebase/<filename>.md"] }]
}
Rules: 1-3 docs covering major modules, each under 80 lines, with purpose/entry-points/abstractions/constraints.`;
  const result = spawnSync(
    "claude",
    ["--model", "claude-sonnet-4-6", "--print", "--no-markdown", prompt],
    { encoding: "utf-8", cwd: dir, timeout: 6e4 }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    return fallbackOutput(stack);
  }
  try {
    const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackOutput(stack);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      codebases: parsed.codebaseDocs ?? {},
      manifestMappings: parsed.manifestMappings ?? []
    };
  } catch {
    return fallbackOutput(stack);
  }
}
function fallbackOutput(stack) {
  return {
    codebases: {
      "overview.md": `# Codebase Overview

**Stack:** ${stack.languages.join(", ")}
**Type:** ${stack.projectType}
**Entry points:** ${stack.entryPoints.join(", ") || "unknown"}

> Fill in details about your project structure, key modules, and architectural constraints.
`
    },
    manifestMappings: [{ sourcePaths: ["src/**"], docs: [".ai/codebase/overview.md"] }]
  };
}
function writeSubAgentOutputs(dir, outputs) {
  const written = [];
  for (const [filename, content] of Object.entries(outputs.codebases)) {
    const path = join2(dir, ".ai", "codebase", filename);
    mkdirSync2(join2(dir, ".ai", "codebase"), { recursive: true });
    writeFileSync2(path, content, "utf-8");
    written.push(relative(dir, path));
  }
  if (outputs.manifestMappings.length > 0) {
    const manifestPath = join2(dir, ".ai", "manifest.json");
    let manifest = { mappings: [] };
    if (existsSync2(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      } catch {
      }
    }
    manifest.mappings = outputs.manifestMappings;
    manifest.generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    writeFileSync2(manifestPath, JSON.stringify(manifest, null, 2));
  }
  return written;
}

// src/init/index.ts
function isGreenfield(dir) {
  return !existsSync3(join3(dir, "src")) && !existsSync3(join3(dir, "package.json")) && !existsSync3(join3(dir, "Cargo.toml")) && !existsSync3(join3(dir, "go.mod")) && !existsSync3(join3(dir, "pyproject.toml")) && !existsSync3(join3(dir, "pom.xml"));
}
async function promptUser(stack) {
  const { default: inquirer } = await import("./dist-AKLBVIGZ.js");
  const answers = await inquirer.prompt([
    { type: "input", name: "name", message: "Project name:", default: "my-project" },
    {
      type: "list",
      name: "type",
      message: "Project type:",
      choices: ["web-app", "cli", "library", "monorepo", "mobile"],
      default: stack.projectType
    },
    {
      type: "input",
      name: "testCommand",
      message: "Test command:",
      default: guessTestCommand(stack)
    },
    {
      type: "input",
      name: "lintCommand",
      message: "Lint command:",
      default: guessLintCommand(stack)
    },
    {
      type: "input",
      name: "typeCheckCommand",
      message: "Type check command:",
      default: stack.languages.includes("typescript") ? "npx tsc --noEmit" : ""
    },
    { type: "input", name: "buildCommand", message: "Build command:", default: "npm run build" },
    {
      type: "confirm",
      name: "linearEnabled",
      message: "Enable Linear integration?",
      default: false
    },
    {
      type: "input",
      name: "linearTeamKey",
      message: "Linear team key (e.g. TRI):",
      default: "",
      when: (a) => a.linearEnabled
    }
  ]);
  return buildConfig(answers, stack);
}
function defaultsFromStack(stack) {
  return buildConfig(
    {
      name: stack.entryPoints[0]?.split("/")[0] || "my-project",
      type: stack.projectType,
      testCommand: guessTestCommand(stack),
      lintCommand: guessLintCommand(stack),
      typeCheckCommand: stack.languages.includes("typescript") ? "npx tsc --noEmit" : "",
      buildCommand: "npm run build",
      linearEnabled: false,
      linearTeamKey: ""
    },
    stack
  );
}
function buildConfig(answers, stack) {
  return {
    ...CONFIG_DEFAULTS,
    project: {
      name: String(answers.name ?? "my-project"),
      type: answers.type ?? stack.projectType,
      stacks: stack.languages,
      entryPoints: stack.entryPoints,
      testCommand: String(answers.testCommand ?? ""),
      lintCommand: String(answers.lintCommand ?? ""),
      typeCheckCommand: String(answers.typeCheckCommand ?? ""),
      buildCommand: String(answers.buildCommand ?? "")
    },
    linear: {
      enabled: Boolean(answers.linearEnabled),
      teamKey: String(answers.linearTeamKey ?? "")
    },
    features: CONFIG_DEFAULTS.features,
    hooks: CONFIG_DEFAULTS.hooks
  };
}
function guessTestCommand(stack) {
  const map = {
    vitest: "npm test",
    jest: "npm test",
    pytest: "pytest",
    "cargo-test": "cargo test",
    "go-test": "go test ./..."
  };
  return stack.testFramework ? map[stack.testFramework] ?? "" : "";
}
function guessLintCommand(stack) {
  if (stack.existingLinters.includes("biome")) return "npx biome check .";
  if (stack.existingLinters.includes("eslint")) return "npx eslint .";
  if (stack.existingLinters.includes("ruff")) return "ruff check .";
  if (stack.existingLinters.includes("clippy")) return "cargo clippy";
  if (stack.existingLinters.includes("golangci-lint")) return "golangci-lint run";
  return "";
}
function printGithubSuggestions() {
  console.log(`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  Recommended GitHub setup (configure manually):         \u2502
\u2502                                                         \u2502
\u2502  \u2022 Branch protection on main:                           \u2502
\u2502    - Require PR reviews before merging                  \u2502
\u2502    - Require status checks to pass                      \u2502
\u2502    - Disable force push to main                         \u2502
\u2502                                                         \u2502
\u2502  \u2022 Install the Linear GitHub app for PR auto-linking:   \u2502
\u2502    https://linear.app/settings/integrations/github      \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
`);
}
async function runInit(options) {
  const cwd = process.cwd();
  const interactive = options.interactive !== false;
  const dryRun = Boolean(options.dryRun);
  if (existsSync3(join3(cwd, ".harness.json")) && !dryRun) {
    console.log("\u26A0  .harness.json already exists. Run harness upgrade to update.");
    return;
  }
  console.log("\u{1F50D} Detecting project stack\u2026");
  const stack = await detectStack(cwd);
  const greenfield = isGreenfield(cwd);
  const existing = detectExistingConfigs(cwd);
  console.log(
    `  Type: ${stack.projectType} | Stack: ${[...stack.languages, ...stack.frameworks].join(", ") || "unknown"}`
  );
  if (!greenfield) {
    console.log("  Existing project detected.");
    if (existing.claudeMd) console.log("  \u26A0 CLAUDE.md exists \u2014 will merge if possible");
    if (existing.claudeSettings) console.log("  \u26A0 .claude/settings.json exists \u2014 will merge hooks");
  }
  let config;
  if (interactive && !dryRun) {
    config = await promptUser(stack);
  } else {
    config = defaultsFromStack(stack);
  }
  console.log(dryRun ? "\n\u{1F4CB} Files that would be created:\n" : "\n\u{1F4C1} Scaffolding files\u2026\n");
  const result = scaffold(cwd, config, stack, { dryRun, skipExisting: false });
  for (const file of result.files) {
    const tier = file.tier === "mandatory" ? "" : ` (${file.tier})`;
    console.log(`  ${dryRun ? "\xB7" : "\u2713"} ${file.path}${tier}`);
  }
  if (!dryRun) {
    if (existing.claudeSettings) {
      const settingsPath = join3(cwd, ".claude", "settings.json");
      try {
        const existingSettings = JSON.parse(readFileSync2(settingsPath, "utf-8"));
        const harnessSettings = JSON.parse(
          result.files.find((f) => f.path === ".claude/settings.json")?.content ?? "{}"
        );
        const merged = mergeClaudeSettings(existingSettings, harnessSettings);
        writeFileSync3(settingsPath, JSON.stringify(merged, null, 2));
        console.log("  \u2713 Merged .claude/settings.json");
      } catch {
      }
    }
    if (!greenfield) {
      console.log("\n\u{1F916} Analyzing codebase with sub-agent (Sonnet)\u2026");
      const analysis = analyzeCodebaseWithSubAgent(cwd, stack);
      const written = writeSubAgentOutputs(cwd, analysis);
      for (const f of written) console.log(`  \u2713 ${f} (sub-agent generated)`);
    }
    if (!existing.ciWorkflow) {
      const ci = scaffoldCiWorkflow(cwd, config, stack);
      if (ci.created) console.log("  \u2713 .github/workflows/ci.yml");
    }
    const configContent = {
      $schema: "https://raw.githubusercontent.com/tr-io/agentic-harness/main/schema.json",
      ...config
    };
    writeFileSync3(join3(cwd, ".harness.json"), JSON.stringify(configContent, null, 2));
    console.log("  \u2713 .harness.json");
    console.log("\n\u2705 Harness initialized.\n");
    printGithubSuggestions();
  } else {
    console.log("\n  (dry run \u2014 no files written)\n");
  }
}
export {
  runInit
};
//# sourceMappingURL=init-3ISN3QZ4.js.map