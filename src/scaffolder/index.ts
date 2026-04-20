import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { HarnessConfig } from "../config/types.js";
import type { StackReport } from "../detector/types.js";
import { artifactFreshnessScript } from "./hooks/artifact-freshness.js";
import { branchNamingWarnScript } from "./hooks/branch-naming-warn.js";
import { completionReminderScript } from "./hooks/completion-reminder.js";
import { prePushCheckScript } from "./hooks/pre-push-check.js";
import { harnessTaxonomy } from "./templates/docs/harness-taxonomy.js";
import { aiManifest } from "./templates/mandatory/ai-manifest.js";
import { aiReadme } from "./templates/mandatory/ai-readme.js";
import { architectureMd } from "./templates/mandatory/architecture-md.js";
import { claudeMd } from "./templates/mandatory/claude-md.js";
import { claudeSettings } from "./templates/mandatory/claude-settings.js";
import { codebaseReadme } from "./templates/mandatory/codebase-readme.js";
import { designDocsReadme } from "./templates/mandatory/design-docs-readme.js";
import { designMd } from "./templates/mandatory/design-md.js";
import { execPlansReadme } from "./templates/mandatory/exec-plans-readme.js";
import { frontendMd } from "./templates/mandatory/frontend-md.js";
import { generatedReadme } from "./templates/mandatory/generated-readme.js";
import { plansMd } from "./templates/mandatory/plans-md.js";
import { prePlan } from "./templates/mandatory/pre-plan.js";
import { prePush } from "./templates/mandatory/pre-push.js";
import { productSenseMd } from "./templates/mandatory/product-sense-md.js";
import { productSpecsReadme } from "./templates/mandatory/product-specs-readme.js";
import { qualityScoreMd } from "./templates/mandatory/quality-score-md.js";
import { referencesReadme } from "./templates/mandatory/references-readme.js";
import { reliabilityMd } from "./templates/mandatory/reliability-md.js";
import { securityMd } from "./templates/mandatory/security-md.js";
import { sessionProtocol } from "./templates/mandatory/session-protocol.js";
import { dddReadme } from "./templates/optional/ddd-readme.js";
import { adrReadme } from "./templates/recommended/adr-readme.js";
import { testingConventions } from "./templates/recommended/testing-conventions.js";
import { addTicketSkill } from "./templates/skills/add-ticket.js";
import { buildSkill } from "./templates/skills/build.js";
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
  const isFrontend = ctx.projectType === "web-app" || ctx.projectType === "mobile";

  const files: ScaffoldedFile[] = [
    {
      path: ".ai/README.md",
      content: aiReadme(ctx),
      tier: "mandatory",
      description: "index of all agent context docs",
    },
    {
      path: ".ai/agent-instructions/session-protocol.md",
      content: sessionProtocol(ctx),
      tier: "mandatory",
      description: "session protocol, pre-plan workflow, pre-push checklist",
    },
    {
      path: ".ai/agent-instructions/pre-plan.md",
      content: prePlan(ctx),
      tier: "mandatory",
    },
    {
      path: ".ai/agent-instructions/pre-push.md",
      content: prePush(ctx),
      tier: "mandatory",
    },
    {
      path: ".ai/codebase/README.md",
      content: codebaseReadme(ctx),
      tier: "mandatory",
      description: "codebase navigation maps",
    },
    {
      path: ".ai/design-docs/README.md",
      content: designDocsReadme(ctx),
      tier: "mandatory",
      description: "design documents and core beliefs",
    },
    {
      path: ".ai/exec-plans/README.md",
      content: execPlansReadme(ctx),
      tier: "mandatory",
      description: "active and completed execution plans, tech debt tracker",
    },
    {
      path: ".ai/exec-plans/active/.gitkeep",
      content: "",
      tier: "mandatory",
    },
    {
      path: ".ai/exec-plans/completed/.gitkeep",
      content: "",
      tier: "mandatory",
    },
    {
      path: ".ai/generated/README.md",
      content: generatedReadme(ctx),
      tier: "mandatory",
      description: "auto-generated artifacts (db schema, codebase analysis)",
    },
    {
      path: ".ai/product-specs/README.md",
      content: productSpecsReadme(ctx),
      tier: "mandatory",
      description: "product specifications",
    },
    {
      path: ".ai/references/README.md",
      content: referencesReadme(ctx),
      tier: "mandatory",
      description: "external references and llms.txt files",
    },
    {
      path: ".ai/ARCHITECTURE.md",
      content: architectureMd(ctx),
      tier: "mandatory",
      description: "high-level architecture overview",
    },
    {
      path: ".ai/DESIGN.md",
      content: designMd(ctx),
      tier: "mandatory",
      description: "design system and UI guidelines",
    },
    {
      path: ".ai/PLANS.md",
      content: plansMd(ctx),
      tier: "mandatory",
      description: "current project plans",
    },
    {
      path: ".ai/PRODUCT_SENSE.md",
      content: productSenseMd(ctx),
      tier: "mandatory",
      description: "product context and goals",
    },
    {
      path: ".ai/QUALITY_SCORE.md",
      content: qualityScoreMd(ctx),
      tier: "mandatory",
      description: "quality standards and scoring",
    },
    {
      path: ".ai/RELIABILITY.md",
      content: reliabilityMd(ctx),
      tier: "mandatory",
      description: "reliability and on-call guidance",
    },
    {
      path: ".ai/SECURITY.md",
      content: securityMd(ctx),
      tier: "mandatory",
      description: "security guidelines",
    },
    {
      path: ".ai/manifest.json",
      content: aiManifest(),
      tier: "mandatory",
      description: "documentation index",
    },
    {
      path: ".claude/settings.json",
      content: claudeSettings(ctx),
      tier: "mandatory",
    },
    {
      path: ".claude/hooks/pre-push-check.js",
      content: prePushCheckScript(),
      executable: true,
      tier: "mandatory",
    },
  ];

  if (isFrontend) {
    files.push({
      path: ".ai/FRONTEND.md",
      content: frontendMd(ctx),
      tier: "mandatory",
      description: "frontend-specific guidance (web/mobile only)",
    });
  }

  return files;
}

function recommended(ctx: TemplateContext): ScaffoldedFile[] {
  const files: ScaffoldedFile[] = [];

  if (ctx.features.adr) {
    files.push({
      path: ".ai/adr/README.md",
      content: adrReadme(ctx),
      tier: "recommended",
      description: "architecture decision records",
    });
    files.push({
      path: "docs/design-docs/harness-taxonomy.md",
      content: harnessTaxonomy(ctx),
      tier: "recommended",
    });
  }
  if (ctx.features.testingDocs) {
    files.push({
      path: ".ai/testing/conventions.md",
      content: testingConventions(ctx),
      tier: "recommended",
      description: "testing conventions",
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
    files.push({
      path: ".ai/ddd/README.md",
      content: dddReadme(ctx),
      tier: "optional",
      description: "domain-driven design context maps",
    });
  }

  return files;
}

function skills(ctx: TemplateContext): ScaffoldedFile[] {
  const files: ScaffoldedFile[] = [];

  if (ctx.features.skills.addTicket) {
    files.push({
      path: ".claude/skills/add-ticket.md",
      content: addTicketSkill(ctx),
      tier: "optional",
    });
  }
  if (ctx.features.skills.build) {
    files.push({
      path: ".claude/skills/build.md",
      content: buildSkill(ctx),
      tier: "optional",
    });
  }

  return files;
}

export function buildFileList(config: HarnessConfig, stack: StackReport): ScaffoldedFile[] {
  const ctx = buildContext(config, stack);
  const rest = [...mandatory(ctx), ...recommended(ctx), ...optional(ctx), ...skills(ctx)];
  const claudeMdFile: ScaffoldedFile = {
    path: "CLAUDE.md",
    content: claudeMd(ctx, rest),
    tier: "mandatory",
    description: "project entry point and agent documentation index",
  };
  return [claudeMdFile, ...rest];
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
