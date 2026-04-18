import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { HarnessConfig } from "../config/types.js";
import type { StackReport } from "../detector/types.js";
import { artifactFreshnessScript } from "./hooks/artifact-freshness.js";
import { branchNamingWarnScript } from "./hooks/branch-naming-warn.js";
import { completionReminderScript } from "./hooks/completion-reminder.js";
import { prePushCheckScript } from "./hooks/pre-push-check.js";
import { aiManifest } from "./templates/mandatory/ai-manifest.js";
import { aiReadme } from "./templates/mandatory/ai-readme.js";
import { claudeMd } from "./templates/mandatory/claude-md.js";
import { claudeSettings } from "./templates/mandatory/claude-settings.js";
import { codebaseReadme } from "./templates/mandatory/codebase-readme.js";
import { prePlan } from "./templates/mandatory/pre-plan.js";
import { prePush } from "./templates/mandatory/pre-push.js";
import { sessionProtocol } from "./templates/mandatory/session-protocol.js";
import { dddReadme } from "./templates/optional/ddd-readme.js";
import { adrReadme } from "./templates/recommended/adr-readme.js";
import { testingConventions } from "./templates/recommended/testing-conventions.js";
import type { ScaffoldResult, ScaffoldedFile, TemplateContext } from "./types.js";

export type { TemplateContext, ScaffoldedFile, ScaffoldResult };

function buildContext(config: HarnessConfig, stack: StackReport): TemplateContext {
  return {
    projectName: config.project.name || stack.entryPoints[0] || "my-project",
    projectType: config.project.type,
    stacks: config.project.stacks.length ? config.project.stacks : stack.languages,
    testCommand: config.project.testCommand,
    lintCommand: config.project.lintCommand,
    typeCheckCommand: config.project.typeCheckCommand,
    buildCommand: config.project.buildCommand,
    linearEnabled: config.integrations.linear.enabled,
    linearTeamKey: config.integrations.linear.teamKey,
    features: config.features,
  };
}

function mandatory(ctx: TemplateContext): ScaffoldedFile[] {
  const files: ScaffoldedFile[] = [
    { path: "CLAUDE.md", content: claudeMd(ctx), tier: "mandatory" },
    { path: ".ai/README.md", content: aiReadme(ctx), tier: "mandatory" },
    {
      path: ".ai/agent-instructions/session-protocol.md",
      content: sessionProtocol(ctx),
      tier: "mandatory",
    },
    { path: ".ai/agent-instructions/pre-plan.md", content: prePlan(ctx), tier: "mandatory" },
    { path: ".ai/agent-instructions/pre-push.md", content: prePush(ctx), tier: "mandatory" },
    { path: ".ai/codebase/README.md", content: codebaseReadme(ctx), tier: "mandatory" },
    { path: ".ai/manifest.json", content: aiManifest(), tier: "mandatory" },
    { path: ".claude/settings.json", content: claudeSettings(ctx), tier: "mandatory" },
    // Hook scripts
    {
      path: ".claude/hooks/pre-push-check.js",
      content: prePushCheckScript(),
      executable: true,
      tier: "mandatory",
    },
  ];
  return files;
}

function recommended(ctx: TemplateContext): ScaffoldedFile[] {
  const files: ScaffoldedFile[] = [];

  if (ctx.features.adr) {
    files.push({ path: ".ai/adr/README.md", content: adrReadme(ctx), tier: "recommended" });
  }
  if (ctx.features.testingDocs) {
    files.push({
      path: ".ai/testing/conventions.md",
      content: testingConventions(ctx),
      tier: "recommended",
    });
  }
  if (ctx.features.branchNamingWarning) {
    files.push({
      path: ".claude/hooks/branch-naming-warn.js",
      content: branchNamingWarnScript(),
      executable: true,
      tier: "recommended",
    });
  }
  if (ctx.features.completionReminder) {
    files.push({
      path: ".claude/hooks/completion-reminder.js",
      content: completionReminderScript(),
      executable: true,
      tier: "recommended",
    });
  }
  if (ctx.features.artifactFreshnessCheck) {
    files.push({
      path: ".claude/hooks/artifact-freshness.js",
      content: artifactFreshnessScript(),
      executable: true,
      tier: "recommended",
    });
  }

  return files;
}

function optional(ctx: TemplateContext): ScaffoldedFile[] {
  const files: ScaffoldedFile[] = [];

  if (ctx.features.dddContextMaps) {
    files.push({ path: ".ai/ddd/README.md", content: dddReadme(ctx), tier: "optional" });
  }

  return files;
}

export function buildFileList(config: HarnessConfig, stack: StackReport): ScaffoldedFile[] {
  const ctx = buildContext(config, stack);
  return [...mandatory(ctx), ...recommended(ctx), ...optional(ctx)];
}

export function scaffold(
  projectDir: string,
  config: HarnessConfig,
  stack: StackReport,
  opts: { dryRun?: boolean; skipExisting?: boolean } = {},
): ScaffoldResult {
  const files = buildFileList(config, stack);
  const written: ScaffoldedFile[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const fullPath = join(projectDir, file.path);
    if (opts.skipExisting && existsSync(fullPath)) {
      skipped.push(file.path);
      continue;
    }
    if (!opts.dryRun) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, "utf-8");
    }
    written.push(file);
  }

  return { files: written, skipped };
}
