import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linterTemplates } from "../templates/index.js";

let dir: string;
let originalCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-lint-setup-test-"));
  originalCwd = process.cwd();
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ─── linterTemplates data ─────────────────────────────────────────────────────

describe("linterTemplates — data validation", () => {
  it("each language has a non-empty filename", () => {
    for (const [lang, template] of Object.entries(linterTemplates)) {
      expect(template.filename, `${lang} must have filename`).toBeTruthy();
    }
  });

  it("each language has non-empty content", () => {
    for (const [lang, template] of Object.entries(linterTemplates)) {
      expect(template.content.length, `${lang} content must be non-empty`).toBeGreaterThan(0);
    }
  });

  it("each language has a non-empty lintCommand", () => {
    for (const [lang, template] of Object.entries(linterTemplates)) {
      expect(template.lintCommand, `${lang} must have lintCommand`).toBeTruthy();
    }
  });

  it("has templates for at least typescript, python, rust, go", () => {
    expect(linterTemplates.typescript).toBeDefined();
    expect(linterTemplates.python).toBeDefined();
    expect(linterTemplates.rust).toBeDefined();
    expect(linterTemplates.go).toBeDefined();
  });
});

// ─── runLintSetup — skipping ──────────────────────────────────────────────────

describe("runLintSetup — skips when linter already present", () => {
  it("does not overwrite existing biome.json", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }));
    writeFileSync(join(dir, "tsconfig.json"), "{}");
    const originalContent = '{"existing": true}';
    writeFileSync(join(dir, "biome.json"), originalContent);

    vi.resetModules();
    const { runLintSetup } = await import("../index.js");
    await runLintSetup();

    expect(readFileSync(join(dir, "biome.json"), "utf-8")).toBe(originalContent);
  });
});

// ─── runLintSetup — scaffolding ───────────────────────────────────────────────

describe("runLintSetup — scaffolds linter config", () => {
  it("creates biome.json for typescript project with no existing linter", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }));
    writeFileSync(join(dir, "tsconfig.json"), "{}");

    vi.resetModules();
    const { runLintSetup } = await import("../index.js");
    await runLintSetup();

    expect(existsSync(join(dir, "biome.json"))).toBe(true);
  });

  it("updates .harness.json lintCommand when config present", async () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }));
    writeFileSync(join(dir, "tsconfig.json"), "{}");
    writeFileSync(
      join(dir, ".harness.json"),
      JSON.stringify({
        version: "0.1.0",
        project: {
          name: "app",
          type: "cli",
          stacks: ["typescript"],
          entryPoints: [],
          testCommand: "npm test",
          lintCommand: "",
          typeCheckCommand: "",
          buildCommand: "",
        },
        features: {
          adr: false,
          testingDocs: false,
          branchNamingWarning: false,
          completionReminder: false,
          artifactFreshnessCheck: false,
          dddContextMaps: false,
          skills: { addTicket: false, build: false },
          linearIntegration: false,
          linterBootstrap: false,
          latMd: false,
          evaluatorQA: false,
          autoLoop: false,
          keelEnforcement: false,
        },
        hooks: {},
        integrations: { linear: { enabled: false, teamKey: "" } },
      }),
    );

    vi.resetModules();
    const { runLintSetup } = await import("../index.js");
    await runLintSetup();

    const config = JSON.parse(readFileSync(join(dir, ".harness.json"), "utf-8"));
    expect(config.project.lintCommand).toContain("biome");
  });

  it("does nothing when detected language has no template", async () => {
    // Create a Ruby project (ruby template exists, but with no existing linter files)
    // Actually ruby has a template, so let's test a language without one — C#
    writeFileSync(join(dir, "MyApp.csproj"), "<Project/>");

    vi.resetModules();
    const { runLintSetup } = await import("../index.js");
    // Should complete without error
    await expect(runLintSetup()).resolves.not.toThrow();
  });
});
