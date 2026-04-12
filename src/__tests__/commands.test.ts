/**
 * CLI command option tests — verify all flags are registered and behave correctly.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock inquirer so interactive commands don't block
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
let originalCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-cmd-test-"));
  originalCwd = process.cwd();
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test-app" }));
  writeFileSync(join(dir, "tsconfig.json"), "{}");
  writeFileSync(join(dir, "biome.json"), "{}");
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
});

// ─── harness init ─────────────────────────────────────────────────────────────

describe("harness init", () => {
  it("--dry-run: lists files without writing any", async () => {
    const { runInit } = await import("../init/index.js");
    await runInit({ dryRun: true, interactive: false });
    expect(existsSync(join(dir, ".harness.json"))).toBe(false);
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(false);
  });

  it("--no-interactive: scaffolds with defaults, no prompts", async () => {
    const { runInit } = await import("../init/index.js");
    await runInit({ interactive: false });
    expect(existsSync(join(dir, ".harness.json"))).toBe(true);
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(true);
  });

  it("--force: re-scaffolds even when .harness.json exists", async () => {
    const { runInit } = await import("../init/index.js");
    // First init
    await runInit({ interactive: false });
    // Marker to confirm overwrite
    writeFileSync(join(dir, ".force-test"), "marker");
    // Second init with --force should succeed without early return
    await runInit({ interactive: false, force: true });
    // Core artifacts recreated
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(true);
  });

  it("without --force: exits early if .harness.json exists", async () => {
    const { runInit } = await import("../init/index.js");
    await runInit({ interactive: false });
    // Remove CLAUDE.md to detect if init ran again
    rmSync(join(dir, "CLAUDE.md"));
    await runInit({ interactive: false }); // should not re-scaffold
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(false);
  });
});

// ─── harness check ────────────────────────────────────────────────────────────

describe("harness check", () => {
  it("exits with code 1 when no .harness.json present", async () => {
    const { runCheck } = await import("../check/index.js");
    await expect(runCheck()).rejects.toThrow();
  });

  it("passes cleanly after harness init", async () => {
    const { runInit } = await import("../init/index.js");
    const { runCheck } = await import("../check/index.js");
    await runInit({ interactive: false });
    await expect(runCheck()).resolves.not.toThrow();
  });
});

// ─── harness lint-setup ───────────────────────────────────────────────────────

describe("harness lint-setup", () => {
  it("reports existing linter and skips when one is detected", async () => {
    // biome.json already exists (created in beforeEach)
    const { runLintSetup } = await import("../lint-setup/index.js");
    // Should complete without error
    await expect(runLintSetup()).resolves.not.toThrow();
  });

  it("scaffolds biome.json when no linter exists", async () => {
    rmSync(join(dir, "biome.json"));
    const { runLintSetup } = await import("../lint-setup/index.js");
    await runLintSetup();
    expect(existsSync(join(dir, "biome.json"))).toBe(true);
  });
});

// ─── harness upgrade ─────────────────────────────────────────────────────────

describe("harness upgrade", () => {
  it("--dry-run: reports changes without writing", async () => {
    const { runInit } = await import("../init/index.js");
    const { runUpgrade } = await import("../upgrade/index.js");
    await runInit({ interactive: false });
    // Should not throw even with dry-run
    await expect(runUpgrade({ dryRun: true })).resolves.not.toThrow();
  });

  it("exits early with error when no .harness.json present", async () => {
    const { runUpgrade } = await import("../upgrade/index.js");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    await expect(runUpgrade({})).rejects.toThrow();
    exitSpy.mockRestore();
  });
});

// ─── harness auto ─────────────────────────────────────────────────────────────

describe("harness auto", () => {
  it("exits with error when autoLoop feature is disabled", async () => {
    const { runInit } = await import("../init/index.js");
    await runInit({ interactive: false });
    // autoLoop is false by default
    const { runAuto } = await import("../auto/index.js");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    await expect(runAuto("TRI-1", {})).rejects.toThrow();
    exitSpy.mockRestore();
  });

  it("exits with error when no .harness.json present", async () => {
    const { runAuto } = await import("../auto/index.js");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    await expect(runAuto("TRI-1", {})).rejects.toThrow();
    exitSpy.mockRestore();
  });
});
