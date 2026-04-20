import { spawnSync } from "node:child_process";
/**
 * TRI-45: Sub-agent codebase analysis for existing projects
 * TRI-46: Existing config detection, preservation, and merge
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { HarnessConfig } from "../config/types.js";
import type { StackReport } from "../detector/types.js";

export interface ExistingConfigs {
  claudeMd: boolean;
  claudeSettings: boolean;
  cursorrules: boolean;
  copilotInstructions: boolean;
  gitHooksPrePush: boolean;
  ciWorkflow: boolean;
}

export function detectExistingConfigs(dir: string): ExistingConfigs {
  return {
    claudeMd: existsSync(join(dir, "CLAUDE.md")),
    claudeSettings: existsSync(join(dir, ".claude", "settings.json")),
    cursorrules: existsSync(join(dir, ".cursorrules")),
    copilotInstructions: existsSync(join(dir, ".github", "copilot-instructions.md")),
    gitHooksPrePush: existsSync(join(dir, ".git", "hooks", "pre-push")),
    ciWorkflow: detectCiWorkflow(dir),
  };
}

function detectCiWorkflow(dir: string): boolean {
  const workflowDir = join(dir, ".github", "workflows");
  if (!existsSync(workflowDir)) return false;
  try {
    return readdirSync(workflowDir).some((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  } catch {
    return false;
  }
}

/** Merge harness hooks into an existing .claude/settings.json without losing user config */
export function mergeClaudeSettings(
  existing: Record<string, unknown>,
  harnessSettings: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  const existingHooks = (existing.hooks as Record<string, unknown[]>) ?? {};
  const harnessHooks = (harnessSettings.hooks as Record<string, unknown[]>) ?? {};

  const mergedHooks: Record<string, unknown[]> = { ...existingHooks };
  for (const [event, harnessEntries] of Object.entries(harnessHooks)) {
    const existing_ = (mergedHooks[event] ?? []) as Array<{
      hooks?: Array<{ command?: string }>;
    }>;
    const existingCommands = new Set(existing_.flatMap((e) => e.hooks ?? []).map((h) => h.command));
    const newEntries = (harnessEntries as Array<{ hooks?: Array<{ command?: string }> }>).filter(
      (entry) => !(entry.hooks ?? []).every((h) => h.command && existingCommands.has(h.command)),
    );
    mergedHooks[event] = [...existing_, ...newEntries];
  }

  merged.hooks = mergedHooks;
  return merged;
}

/** Gather directory tree for sub-agent context (token-efficient: structure only) */
function gatherDirectoryTree(dir: string, maxDepth = 3, prefix = ""): string {
  const lines: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir).filter(
      (e) =>
        !e.startsWith(".") &&
        e !== "node_modules" &&
        e !== "dist" &&
        e !== "__pycache__" &&
        e !== "target",
    );
  } catch {
    return "";
  }

  for (const entry of entries.slice(0, 30)) {
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    lines.push(`${prefix}${isDir ? "📁" : "📄"} ${entry}`);
    if (isDir && maxDepth > 1) {
      const sub = gatherDirectoryTree(full, maxDepth - 1, `${prefix}  `);
      if (sub) lines.push(sub);
    }
  }
  return lines.join("\n");
}

function readFileHeader(filePath: string, lines = 30): string {
  try {
    return readFileSync(filePath, "utf-8").split("\n").slice(0, lines).join("\n");
  } catch {
    return "";
  }
}

interface SubAgentOutput {
  architectureOverview: string;
  codebases: Record<string, string>;
  manifestMappings: Array<{ sourcePaths: string[]; docs: string[] }>;
}

/** Run claude CLI as sub-agent (Sonnet — never Opus) for codebase analysis */
export function analyzeCodebaseWithSubAgent(dir: string, stack: StackReport): SubAgentOutput {
  const tree = gatherDirectoryTree(dir);
  const keyFiles = stack.entryPoints
    .slice(0, 3)
    .map((ep) => {
      const content = readFileHeader(join(dir, ep));
      return content ? `### ${ep}\n\`\`\`\n${content}\n\`\`\`` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const prompt = `Analyze this ${stack.projectType} codebase and generate agent navigation documentation.

## Project Structure
${tree}

## Stack: ${stack.languages.join(", ")} | Frameworks: ${stack.frameworks.join(", ") || "none"}
## Entry points: ${stack.entryPoints.join(", ") || "none"}

${keyFiles ? `## Key File Headers\n${keyFiles}` : ""}

Generate a JSON response (ONLY JSON, no other text):
{
  "architectureOverview": "<markdown content for .ai/ARCHITECTURE.md — high-level overview: system purpose, key components, data flow, constraints>",
  "codebaseDocs": { "<filename>.md": "<markdown content for .ai/generated/<filename>.md>" },
  "manifestMappings": [{ "sourcePaths": ["src/module/**"], "docs": [".ai/generated/<filename>.md"] }]
}
Rules: architectureOverview under 60 lines; 1-3 codebaseDocs covering major modules, each under 80 lines, with purpose/entry-points/abstractions/constraints.`;

  const result = spawnSync("claude", ["--model", "claude-sonnet-4-6", "--print", prompt], {
    encoding: "utf-8",
    cwd: dir,
    timeout: 60_000,
  });

  if (result.status !== 0 || !result.stdout?.trim()) {
    return fallbackOutput(stack);
  }

  try {
    const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackOutput(stack);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      architectureOverview: parsed.architectureOverview ?? "",
      codebases: parsed.codebaseDocs ?? {},
      manifestMappings: parsed.manifestMappings ?? [],
    };
  } catch {
    return fallbackOutput(stack);
  }
}

function fallbackOutput(stack: StackReport): SubAgentOutput {
  return {
    architectureOverview: `# Architecture Overview\n\n**Stack:** ${stack.languages.join(", ")}\n**Type:** ${stack.projectType}\n**Entry points:** ${stack.entryPoints.join(", ") || "unknown"}\n\n> Fill in details about your system's high-level architecture, key components, and constraints.\n`,
    codebases: {
      "overview.md": `# Codebase Overview\n\n**Stack:** ${stack.languages.join(", ")}\n**Type:** ${stack.projectType}\n**Entry points:** ${stack.entryPoints.join(", ") || "unknown"}\n\n> Fill in details about your project structure, key modules, and architectural constraints.\n`,
    },
    manifestMappings: [{ sourcePaths: ["src/**"], docs: [".ai/generated/overview.md"] }],
  };
}

export function writeSubAgentOutputs(dir: string, outputs: SubAgentOutput): string[] {
  const written: string[] = [];

  if (outputs.architectureOverview) {
    const archPath = join(dir, ".ai", "ARCHITECTURE.md");
    mkdirSync(join(dir, ".ai"), { recursive: true });
    writeFileSync(archPath, outputs.architectureOverview, "utf-8");
    written.push(relative(dir, archPath));
  }

  for (const [filename, content] of Object.entries(outputs.codebases)) {
    const path = join(dir, ".ai", "generated", filename);
    mkdirSync(join(dir, ".ai", "generated"), { recursive: true });
    writeFileSync(path, content as string, "utf-8");
    written.push(relative(dir, path));
  }

  if (outputs.manifestMappings.length > 0) {
    const manifestPath = join(dir, ".ai", "manifest.json");
    let manifest: { mappings: unknown[]; generatedAt?: string } = { mappings: [] };
    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      } catch {
        /* use default */
      }
    }
    manifest.mappings = outputs.manifestMappings;
    manifest.generatedAt = new Date().toISOString();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  return written;
}

// Re-export for use in init command
export type { HarnessConfig };
