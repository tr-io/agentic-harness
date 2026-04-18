/**
 * Integration tests — verify harness init + check work end-to-end.
 * These exercise the full pipeline: detect → scaffold → check.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock analyzeCodebaseWithSubAgent so tests don't spawn real claude processes
vi.mock("../existing-init/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../existing-init/index.js")>();
  return {
    ...actual,
    analyzeCodebaseWithSubAgent: vi.fn().mockReturnValue({
      codebases: { "overview.md": "# Overview\n" },
      manifestMappings: [{ sourcePaths: ["src/**"], docs: [".ai/codebase/overview.md"] }],
    }),
  };
});

// Mock inquirer so init doesn't block on prompts
vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({
      name: "test-app",
      type: "web-app",
      testCommand: "npm test",
      lintCommand: "npx biome check .",
      typeCheckCommand: "npx tsc --noEmit",
      buildCommand: "npm run build",
      linearEnabled: false,
      linearTeamKey: "",
    }),
  },
}));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-integration-"));
  // Minimal greenfield project (just a tsconfig so detector picks up TypeScript)
  writeFileSync(join(dir, "tsconfig.json"), "{}");
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test-app", scripts: { test: "vitest run" } }),
  );
  writeFileSync(join(dir, "biome.json"), "{}");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ─── harness init end-to-end ──────────────────────────────────────────────────

describe("harness init (non-interactive)", () => {
  async function runInit() {
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const { runInit: init } = await import("../init/index.js");
      await init({ interactive: false, dryRun: false });
    } finally {
      process.chdir(cwd);
    }
  }

  it("creates .harness.json", async () => {
    await runInit();
    expect(existsSync(join(dir, ".harness.json"))).toBe(true);
  });

  it(".harness.json is valid JSON with expected structure", async () => {
    await runInit();
    const config = JSON.parse(readFileSync(join(dir, ".harness.json"), "utf-8"));
    expect(config.version).toBeDefined();
    expect(config.project).toBeDefined();
    expect(config.features).toBeDefined();
    expect(config.hooks).toBeDefined();
  });

  it("creates all mandatory artifacts", async () => {
    await runInit();
    const mandatory = [
      "CLAUDE.md",
      ".ai/README.md",
      ".ai/agent-instructions/session-protocol.md",
      ".ai/agent-instructions/pre-plan.md",
      ".ai/agent-instructions/pre-push.md",
      ".ai/codebase/README.md",
      ".ai/manifest.json",
      ".claude/settings.json",
      ".claude/hooks/pre-push-check.js",
    ];
    for (const path of mandatory) {
      expect(existsSync(join(dir, path)), `Missing: ${path}`).toBe(true);
    }
  });

  it("creates recommended artifacts (enabled by default)", async () => {
    await runInit();
    const recommended = [
      ".ai/adr/README.md",
      ".ai/testing/conventions.md",
      ".claude/hooks/branch-naming-warn.js",
      ".claude/hooks/completion-reminder.js",
      ".claude/hooks/artifact-freshness.js",
    ];
    for (const path of recommended) {
      expect(existsSync(join(dir, path)), `Missing: ${path}`).toBe(true);
    }
  });

  it("CLAUDE.md is ≤100 lines", async () => {
    await runInit();
    const content = readFileSync(join(dir, "CLAUDE.md"), "utf-8");
    expect(content.split("\n").length).toBeLessThanOrEqual(100);
  });

  it("session-protocol.md contains all 6 lifecycle steps", async () => {
    await runInit();
    const content = readFileSync(join(dir, ".ai/agent-instructions/session-protocol.md"), "utf-8");
    for (const step of ["ORIENT", "VERIFY BASELINE", "PLAN", "IMPLEMENT", "TEST", "FINALIZE"]) {
      expect(content).toContain(step);
    }
  });

  it(".claude/settings.json has valid hook structure", async () => {
    await runInit();
    const settings = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf-8"));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.PreToolUse).toBeDefined();
    // Pre-push hook must always be present
    const prePushHook = JSON.stringify(settings.hooks.PreToolUse);
    expect(prePushHook).toContain("pre-push-check.js");
  });

  it(".ai/manifest.json is valid JSON with mappings array", async () => {
    await runInit();
    const manifest = JSON.parse(readFileSync(join(dir, ".ai/manifest.json"), "utf-8"));
    expect(Array.isArray(manifest.mappings)).toBe(true);
  });

  it("hook scripts use spawnSync not exec", async () => {
    await runInit();
    const hook = readFileSync(join(dir, ".claude/hooks/pre-push-check.js"), "utf-8");
    expect(hook).toContain("spawnSync");
    expect(hook).not.toContain("execSync");
    expect(hook).not.toMatch(/exec\(`/);
  });

  it("generates a GitHub Actions CI workflow", async () => {
    await runInit();
    expect(existsSync(join(dir, ".github/workflows/ci.yml"))).toBe(true);
    const ci = readFileSync(join(dir, ".github/workflows/ci.yml"), "utf-8");
    expect(ci).toContain("name: CI");
    expect(ci).toContain("actions/checkout@v4");
  });

  it("does not create optional artifacts by default", async () => {
    await runInit();
    expect(existsSync(join(dir, ".ai/ddd/README.md"))).toBe(false);
  });

  it("does not overwrite if .harness.json already exists", async () => {
    await runInit();
    const firstConfig = readFileSync(join(dir, ".harness.json"), "utf-8");
    // Write a marker into the config
    const modified = JSON.parse(firstConfig);
    modified._marker = "sentinel";
    writeFileSync(join(dir, ".harness.json"), JSON.stringify(modified));

    await runInit(); // Second call
    const secondConfig = JSON.parse(readFileSync(join(dir, ".harness.json"), "utf-8"));
    expect(secondConfig._marker).toBe("sentinel"); // Not overwritten
  });
});

// ─── harness init --dry-run ───────────────────────────────────────────────────

describe("harness init --dry-run", () => {
  it("does not write any files", async () => {
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const { runInit } = await import("../init/index.js");
      await runInit({ interactive: false, dryRun: true });
    } finally {
      process.chdir(cwd);
    }
    expect(existsSync(join(dir, ".harness.json"))).toBe(false);
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(dir, ".claude/settings.json"))).toBe(false);
  });
});

// ─── harness check after init ────────────────────────────────────────────────

describe("harness check after init", () => {
  async function runInitAndCheck() {
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const { runInit } = await import("../init/index.js");
      await runInit({ interactive: false, dryRun: false });
      const { runCheck } = await import("../check/index.js");
      await runCheck();
    } finally {
      process.chdir(cwd);
    }
  }

  it("exits without error after a fresh init", async () => {
    // If runCheck throws or calls process.exit(1), the test fails
    await expect(runInitAndCheck()).resolves.not.toThrow();
  });
});

// ─── existing config merge ────────────────────────────────────────────────────

describe("mergeClaudeSettings", () => {
  it("preserves existing hooks and adds harness hooks", async () => {
    const { mergeClaudeSettings } = await import("../existing-init/index.js");

    const existing = {
      env: { MY_VAR: "value" },
      hooks: {
        PreToolUse: [
          {
            matcher: "Read",
            hooks: [{ type: "command", command: "node existing-hook.js" }],
          },
        ],
      },
    };

    const harness = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "node .claude/hooks/pre-push-check.js" }],
          },
        ],
        Stop: [
          {
            hooks: [{ type: "command", command: "node .claude/hooks/completion-reminder.js" }],
          },
        ],
      },
    };

    const merged = mergeClaudeSettings(existing, harness);

    // Preserves non-hook config
    expect((merged as Record<string, unknown>).env).toEqual({ MY_VAR: "value" });
    // Preserves existing hook
    const preTool = (merged.hooks as Record<string, unknown[]>).PreToolUse;
    expect(JSON.stringify(preTool)).toContain("existing-hook.js");
    // Adds harness hook
    expect(JSON.stringify(preTool)).toContain("pre-push-check.js");
    // Adds Stop hook
    expect(JSON.stringify((merged.hooks as Record<string, unknown[]>).Stop)).toContain(
      "completion-reminder.js",
    );
  });

  it("does not duplicate hooks on repeated merge", async () => {
    const { mergeClaudeSettings } = await import("../existing-init/index.js");

    const harness = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "node .claude/hooks/pre-push-check.js" }],
          },
        ],
      },
    };

    const first = mergeClaudeSettings({}, harness);
    const second = mergeClaudeSettings(first, harness);

    const hooks = (second.hooks as Record<string, unknown[]>).PreToolUse;
    const commands = JSON.stringify(hooks).match(/pre-push-check\.js/g) ?? [];
    expect(commands.length).toBe(1);
  });
});

// ─── upgrade checksums ────────────────────────────────────────────────────────

describe("upgrade checksums", () => {
  it("round-trips checksums through write → read", async () => {
    const { writeChecksums, readChecksums, computeChecksums } = await import("../upgrade/index.js");

    const files = [
      { path: "CLAUDE.md", content: "# My project\n" },
      { path: ".ai/README.md", content: "# AI index\n" },
    ];

    const checksums = computeChecksums(files);
    writeChecksums(dir, checksums);
    const read = readChecksums(dir);

    expect(read["CLAUDE.md"]).toBe(checksums["CLAUDE.md"]);
    expect(read[".ai/README.md"]).toBe(checksums[".ai/README.md"]);
  });

  it("returns empty object when checksums file does not exist", async () => {
    const { readChecksums } = await import("../upgrade/index.js");
    const empty = mkdtempSync(join(tmpdir(), "harness-no-checksums-"));
    try {
      expect(readChecksums(empty)).toEqual({});
    } finally {
      rmSync(empty, { recursive: true });
    }
  });

  it("same content produces same checksum (deterministic)", async () => {
    const { computeChecksums } = await import("../upgrade/index.js");
    const files = [{ path: "a.md", content: "hello world\n" }];
    const a = computeChecksums(files);
    const b = computeChecksums(files);
    expect(a["a.md"]).toBe(b["a.md"]);
  });

  it("different content produces different checksum", async () => {
    const { computeChecksums } = await import("../upgrade/index.js");
    const a = computeChecksums([{ path: "a.md", content: "version 1\n" }]);
    const b = computeChecksums([{ path: "a.md", content: "version 2\n" }]);
    expect(a["a.md"]).not.toBe(b["a.md"]);
  });
});

// ─── detectExistingConfigs ────────────────────────────────────────────────────

describe("detectExistingConfigs", () => {
  it("returns all false for empty directory", async () => {
    const { detectExistingConfigs } = await import("../existing-init/index.js");
    const empty = mkdtempSync(join(tmpdir(), "harness-empty-"));
    try {
      const result = detectExistingConfigs(empty);
      expect(result.claudeMd).toBe(false);
      expect(result.claudeSettings).toBe(false);
      expect(result.ciWorkflow).toBe(false);
    } finally {
      rmSync(empty, { recursive: true });
    }
  });

  it("detects existing CLAUDE.md", async () => {
    const { detectExistingConfigs } = await import("../existing-init/index.js");
    writeFileSync(join(dir, "CLAUDE.md"), "# existing");
    const result = detectExistingConfigs(dir);
    expect(result.claudeMd).toBe(true);
  });

  it("detects existing .claude/settings.json", async () => {
    const { detectExistingConfigs } = await import("../existing-init/index.js");
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(join(dir, ".claude/settings.json"), "{}");
    const result = detectExistingConfigs(dir);
    expect(result.claudeSettings).toBe(true);
  });

  it("detects existing GitHub Actions workflow", async () => {
    const { detectExistingConfigs } = await import("../existing-init/index.js");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/ci.yml"), "name: CI");
    const result = detectExistingConfigs(dir);
    expect(result.ciWorkflow).toBe(true);
  });
});
