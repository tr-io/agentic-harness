import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_DEFAULTS } from "../../config/defaults.js";

let dir: string;
let originalCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-taxonomy-test-"));
  originalCwd = process.cwd();
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeHarnessJson(features = CONFIG_DEFAULTS.features): void {
  writeFileSync(
    join(dir, ".harness.json"),
    JSON.stringify({
      version: "0.1.0",
      project: {
        name: "test",
        type: "cli",
        stacks: [],
        entryPoints: [],
        testCommand: "npm test",
        lintCommand: "npx biome check .",
        typeCheckCommand: "npx tsc --noEmit",
        buildCommand: "npm run build",
      },
      features,
      hooks: { prePush: { lint: true, typeCheck: true, unitTest: true } },
      integrations: { linear: { enabled: false, teamKey: "" } },
    }),
  );
}

// ─── runTaxonomy ──────────────────────────────────────────────────────────────

describe("runTaxonomy", () => {
  it("completes without throwing when .harness.json exists", async () => {
    vi.resetModules();
    writeHarnessJson();
    const { runTaxonomy } = await import("../index.js");
    await expect(runTaxonomy()).resolves.not.toThrow();
  });

  it("completes without throwing when .harness.json is absent", async () => {
    vi.resetModules();
    // No .harness.json written — should still complete gracefully
    const { runTaxonomy } = await import("../index.js");
    await expect(runTaxonomy()).resolves.not.toThrow();
  });

  it("outputs 'no .harness.json' message when config absent", async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("no .harness.json");
    logSpy.mockRestore();
  });

  it("shows enabled checkmark for features that are on", async () => {
    vi.resetModules();
    writeHarnessJson({
      ...CONFIG_DEFAULTS.features,
      adr: true,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("✓");
    logSpy.mockRestore();
  });

  it("shows disabled mark for features that are off", async () => {
    vi.resetModules();
    writeHarnessJson({
      ...CONFIG_DEFAULTS.features,
      adr: false,
      testingDocs: false,
      branchNamingWarning: false,
      completionReminder: false,
      artifactFreshnessCheck: false,
      skills: { addTicket: false, build: false },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("✗");
    logSpy.mockRestore();
  });

  it("warns when no feedback sensors are enabled", async () => {
    vi.resetModules();
    writeHarnessJson({
      ...CONFIG_DEFAULTS.features,
      branchNamingWarning: false,
      completionReminder: false,
      artifactFreshnessCheck: false,
      autoLoop: false,
      keelEnforcement: false,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("under-instrumented");
    logSpy.mockRestore();
  });

  it("shows Balance line when config exists", async () => {
    vi.resetModules();
    writeHarnessJson();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("Balance:");
    logSpy.mockRestore();
  });
});
