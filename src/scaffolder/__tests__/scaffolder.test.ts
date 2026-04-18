import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_DEFAULTS } from "../../config/defaults.js";
import type { HarnessConfig } from "../../config/types.js";
import type { StackReport } from "../../detector/types.js";
import { buildFileList, scaffold } from "../index.js";

let dir: string;

const baseStack: StackReport = {
  projectType: "web-app",
  languages: ["typescript"],
  frameworks: ["react"],
  existingLinters: [],
  testFramework: "vitest",
  buildSystem: "npm",
  entryPoints: ["src/index.ts"],
  isMonorepo: false,
  packageManager: "npm",
};

const baseConfig: HarnessConfig = {
  ...CONFIG_DEFAULTS,
  project: {
    ...CONFIG_DEFAULTS.project,
    name: "test-project",
    type: "web-app",
    stacks: ["typescript"],
    testCommand: "npm test",
    lintCommand: "npm run lint",
    typeCheckCommand: "npx tsc --noEmit",
    buildCommand: "npm run build",
  },
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("buildFileList", () => {
  it("always includes mandatory files", () => {
    const files = buildFileList(baseConfig, baseStack);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("CLAUDE.md");
    expect(paths).toContain(".ai/README.md");
    expect(paths).toContain(".ai/agent-instructions/session-protocol.md");
    expect(paths).toContain(".ai/agent-instructions/pre-plan.md");
    expect(paths).toContain(".ai/agent-instructions/pre-push.md");
    expect(paths).toContain(".ai/codebase/README.md");
    expect(paths).toContain(".ai/manifest.json");
    expect(paths).toContain(".claude/settings.json");
    expect(paths).toContain(".claude/hooks/pre-push-check.js");
  });

  it("includes recommended files when features enabled (default)", () => {
    const files = buildFileList(baseConfig, baseStack);
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".ai/adr/README.md");
    expect(paths).toContain(".ai/testing/conventions.md");
    expect(paths).toContain(".claude/hooks/branch-naming-warn.js");
    expect(paths).toContain(".claude/hooks/completion-reminder.js");
    expect(paths).toContain(".claude/hooks/artifact-freshness.js");
  });

  it("skips recommended files when features disabled", () => {
    const config: HarnessConfig = {
      ...baseConfig,
      features: {
        ...baseConfig.features,
        adr: false,
        testingDocs: false,
        branchNamingWarning: false,
        completionReminder: false,
        artifactFreshnessCheck: false,
      },
    };
    const files = buildFileList(config, baseStack);
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain(".ai/adr/README.md");
    expect(paths).not.toContain(".ai/testing/conventions.md");
    expect(paths).not.toContain(".claude/hooks/branch-naming-warn.js");
  });

  it("excludes optional files by default", () => {
    const files = buildFileList(baseConfig, baseStack);
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain(".ai/ddd/README.md");
  });

  it("includes optional files when enabled", () => {
    const config: HarnessConfig = {
      ...baseConfig,
      features: { ...baseConfig.features, dddContextMaps: true },
    };
    const files = buildFileList(config, baseStack);
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".ai/ddd/README.md");
  });

  it("classifies files by tier", () => {
    const files = buildFileList(baseConfig, baseStack);
    const mandatory = files.filter((f) => f.tier === "mandatory");
    const recommended = files.filter((f) => f.tier === "recommended");
    expect(mandatory.length).toBeGreaterThan(0);
    expect(recommended.length).toBeGreaterThan(0);
  });
});

describe("scaffold", () => {
  it("writes all files to target directory", () => {
    const result = scaffold(dir, baseConfig, baseStack);
    expect(result.files.length).toBeGreaterThan(0);

    for (const f of result.files) {
      expect(existsSync(join(dir, f.path))).toBe(true);
    }
  });

  it("dry-run returns file list without writing", () => {
    const result = scaffold(dir, baseConfig, baseStack, { dryRun: true });
    expect(result.files.length).toBeGreaterThan(0);

    for (const f of result.files) {
      expect(existsSync(join(dir, f.path))).toBe(false);
    }
  });

  it("skips existing files when skipExisting is true", () => {
    // First scaffold
    scaffold(dir, baseConfig, baseStack);
    // Second scaffold with skipExisting
    const result = scaffold(dir, baseConfig, baseStack, { skipExisting: true });
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.files.length).toBe(0);
  });
});

describe("template content", () => {
  it("CLAUDE.md contains project name", () => {
    const files = buildFileList(baseConfig, baseStack);
    const claudeMd = files.find((f) => f.path === "CLAUDE.md");
    expect(claudeMd?.content).toContain("test-project");
  });

  it("CLAUDE.md stays under 100 lines", () => {
    const files = buildFileList(baseConfig, baseStack);
    const claudeMd = files.find((f) => f.path === "CLAUDE.md");
    const lines = claudeMd?.content.split("\n").length ?? 0;
    expect(lines).toBeLessThanOrEqual(100);
  });

  it("CLAUDE.md contains Agent Documentation TOC with .ai/ tree", () => {
    const files = buildFileList(baseConfig, baseStack);
    const claudeMd = files.find((f) => f.path === "CLAUDE.md");
    expect(claudeMd?.content).toContain("## Agent Documentation");
    expect(claudeMd?.content).toContain(".ai/");
    expect(claudeMd?.content).toContain("agent-instructions/");
  });

  it("session-protocol contains all 6 lifecycle steps", () => {
    const files = buildFileList(baseConfig, baseStack);
    const protocol = files.find((f) => f.path === ".ai/agent-instructions/session-protocol.md");
    expect(protocol?.content).toContain("ORIENT");
    expect(protocol?.content).toContain("VERIFY BASELINE");
    expect(protocol?.content).toContain("PLAN");
    expect(protocol?.content).toContain("IMPLEMENT");
    expect(protocol?.content).toContain("TEST");
    expect(protocol?.content).toContain("FINALIZE");
  });

  it("pre-push contains self-review checklist items", () => {
    const files = buildFileList(baseConfig, baseStack);
    const prePush = files.find((f) => f.path === ".ai/agent-instructions/pre-push.md");
    expect(prePush?.content).toContain("placeholder");
    expect(prePush?.content).toContain("hardcoded secrets");
    expect(prePush?.content).toContain("conventional format");
  });

  it("manifest.json is valid JSON with empty mappings", () => {
    const files = buildFileList(baseConfig, baseStack);
    const manifest = files.find((f) => f.path === ".ai/manifest.json");
    const parsed = JSON.parse(manifest?.content ?? "{}");
    expect(parsed.mappings).toEqual([]);
  });

  it(".claude/settings.json includes pre-push hook", () => {
    const files = buildFileList(baseConfig, baseStack);
    const settings = files.find((f) => f.path === ".claude/settings.json");
    const parsed = JSON.parse(settings?.content ?? "{}");
    expect(JSON.stringify(parsed)).toContain("pre-push-check.js");
  });

  it("hook scripts use spawnSync not exec", () => {
    const files = buildFileList(baseConfig, baseStack);
    const prePushHook = files.find((f) => f.path === ".claude/hooks/pre-push-check.js");
    expect(prePushHook?.content).toContain("spawnSync");
    expect(prePushHook?.content).not.toContain("execSync");
  });
});
