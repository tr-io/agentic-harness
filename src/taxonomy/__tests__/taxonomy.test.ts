import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_DEFAULTS } from "../../config/defaults.js";

let dir: string;
let originalCwd: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let capturedLines: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-taxonomy-test-"));
  originalCwd = process.cwd();
  capturedLines = [];
  consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
    capturedLines.push(args.join(" "));
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  vi.resetModules();
});

function writeHarnessConfig(overrides: object = {}) {
  const config = { ...CONFIG_DEFAULTS, ...overrides };
  writeFileSync(join(dir, ".harness.json"), JSON.stringify(config));
}

function output(): string {
  return capturedLines.join("\n");
}

describe("runTaxonomy", () => {
  it("prints header", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("Harness Feature Taxonomy");
  });

  it("prints Guides (Feedforward) section", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("Guides (Feedforward)");
  });

  it("prints Sensors (Feedback) section", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("Sensors (Feedback)");
  });

  it("shows Feature and Execution columns", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    const out = output();
    expect(out).toContain("Feature");
    expect(out).toContain("Execution");
    expect(out).toContain("Enabled");
  });

  it("shows ✓ for enabled features", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("✓");
  });

  it("shows ✗ for disabled features", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("✗");
  });

  it("prints balance summary when config present", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("Balance:");
  });

  it("warns when no feedback sensors are enabled", async () => {
    process.chdir(dir);
    const config = {
      ...CONFIG_DEFAULTS,
      features: {
        ...CONFIG_DEFAULTS.features,
        branchNamingWarning: false,
        artifactFreshnessCheck: false,
        completionReminder: false,
        autoLoop: false,
        keelEnforcement: false,
      },
    };
    writeFileSync(join(dir, ".harness.json"), JSON.stringify(config));
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("under-instrumented");
  });

  it("shows — for enabled status when no .harness.json present", async () => {
    process.chdir(dir);
    // Do not write .harness.json
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("—");
  });

  it("shows harness init hint when no .harness.json present", async () => {
    process.chdir(dir);
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    expect(output()).toContain("harness init");
  });

  it("shows feedforward entries before feedback entries", async () => {
    process.chdir(dir);
    writeHarnessConfig();
    const { runTaxonomy } = await import("../index.js");
    await runTaxonomy();
    const out = output();
    const ffIndex = out.indexOf("Guides (Feedforward)");
    const fbIndex = out.indexOf("Sensors (Feedback)");
    expect(ffIndex).toBeGreaterThanOrEqual(0);
    expect(fbIndex).toBeGreaterThan(ffIndex);
  });
});
