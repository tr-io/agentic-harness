import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_DEFAULTS } from "../../config/defaults.js";
import type { FeaturesConfig, HarnessConfig } from "../../config/types.js";
import { applySelectedFeatures, featureName, getEnabledKeys, runConfigure } from "../index.js";

// Mock inquirer for runConfigure tests
vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ features: ["adr", "testingDocs"] }),
    Separator: class {
      type = "separator";
    },
  },
}));

let dir: string;
let originalCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-configure-test-"));
  originalCwd = process.cwd();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeHarnessJson(): void {
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
      features: {
        adr: false,
        testingDocs: false,
        linterBootstrap: false,
        linearIntegration: false,
        dddContextMaps: false,
        latMd: false,
        evaluatorQA: false,
        branchNamingWarning: false,
        artifactFreshnessCheck: false,
        autoLoop: false,
        keelEnforcement: false,
        completionReminder: false,
        skills: { addTicket: false, build: false },
      },
      hooks: { prePush: { lint: true, typeCheck: true, unitTest: true } },
      integrations: { linear: { enabled: false, teamKey: "" } },
    }),
  );
}

function makeConfig(features: Partial<FeaturesConfig> = {}): HarnessConfig {
  return {
    ...CONFIG_DEFAULTS,
    features: { ...CONFIG_DEFAULTS.features, ...features },
  };
}

// ─── featureName ──────────────────────────────────────────────────────────────

describe("featureName", () => {
  it("extracts the name before ' — '", () => {
    expect(featureName("ADR docs — guide agents toward architectural intent")).toBe("ADR docs");
  });

  it("returns full string when no ' — ' separator present", () => {
    expect(featureName("some feature name")).toBe("some feature name");
  });

  it("handles empty string", () => {
    expect(featureName("")).toBe("");
  });
});

// ─── getEnabledKeys ───────────────────────────────────────────────────────────

describe("getEnabledKeys", () => {
  it("returns keys for enabled boolean features", () => {
    const features: FeaturesConfig = {
      ...CONFIG_DEFAULTS.features,
      adr: true,
      dddContextMaps: false,
    };
    const keys = getEnabledKeys(features);
    expect(keys).toContain("adr");
    expect(keys).not.toContain("dddContextMaps");
  });

  it("includes 'skills' when addTicket is true", () => {
    const features: FeaturesConfig = {
      ...CONFIG_DEFAULTS.features,
      skills: { addTicket: true, build: false },
    };
    const keys = getEnabledKeys(features);
    expect(keys).toContain("skills");
  });

  it("includes 'skills' when build is true", () => {
    const features: FeaturesConfig = {
      ...CONFIG_DEFAULTS.features,
      skills: { addTicket: false, build: true },
    };
    const keys = getEnabledKeys(features);
    expect(keys).toContain("skills");
  });

  it("excludes 'skills' when all skills are false", () => {
    const features: FeaturesConfig = {
      ...CONFIG_DEFAULTS.features,
      skills: { addTicket: false, build: false },
    };
    const keys = getEnabledKeys(features);
    expect(keys).not.toContain("skills");
  });

  it("returns empty array when all features disabled", () => {
    const features: FeaturesConfig = {
      adr: false,
      testingDocs: false,
      linterBootstrap: false,
      linearIntegration: false,
      dddContextMaps: false,
      latMd: false,
      evaluatorQA: false,
      branchNamingWarning: false,
      artifactFreshnessCheck: false,
      autoLoop: false,
      keelEnforcement: false,
      completionReminder: false,
      skills: { addTicket: false, build: false },
    };
    expect(getEnabledKeys(features)).toEqual([]);
  });
});

// ─── applySelectedFeatures ────────────────────────────────────────────────────

describe("applySelectedFeatures", () => {
  it("enables selected features", () => {
    const config = makeConfig({ adr: false, dddContextMaps: false });
    const result = applySelectedFeatures(config, ["adr", "dddContextMaps"]);
    expect(result.features.adr).toBe(true);
    expect(result.features.dddContextMaps).toBe(true);
  });

  it("disables features not in the selected list", () => {
    const config = makeConfig({ adr: true });
    const result = applySelectedFeatures(config, []);
    expect(result.features.adr).toBe(false);
  });

  it("enables both skills when 'skills' newly selected and none were previously enabled", () => {
    const config = makeConfig({ skills: { addTicket: false, build: false } });
    const result = applySelectedFeatures(config, ["skills"]);
    expect(result.features.skills.addTicket).toBe(true);
    expect(result.features.skills.build).toBe(true);
  });

  it("preserves existing skill config when 'skills' remains selected", () => {
    const config = makeConfig({ skills: { addTicket: true, build: false } });
    const result = applySelectedFeatures(config, ["skills"]);
    // Prior skill config preserved since skills were already partially enabled
    expect(result.features.skills.addTicket).toBe(true);
    expect(result.features.skills.build).toBe(false);
  });

  it("disables all skills when 'skills' is not selected", () => {
    const config = makeConfig({ skills: { addTicket: true, build: true } });
    const result = applySelectedFeatures(config, []);
    expect(result.features.skills.addTicket).toBe(false);
    expect(result.features.skills.build).toBe(false);
  });

  it("does not mutate the input config", () => {
    const config = makeConfig({ adr: false });
    applySelectedFeatures(config, ["adr"]);
    expect(config.features.adr).toBe(false);
  });

  it("returns a new config object (not the same reference)", () => {
    const config = makeConfig();
    const result = applySelectedFeatures(config, []);
    expect(result).not.toBe(config);
  });
});

// ─── runConfigure ─────────────────────────────────────────────────────────────

describe("runConfigure", () => {
  it("writes updated .harness.json when features section configured", async () => {
    writeHarnessJson();
    await runConfigure({ section: "features" });
    expect(existsSync(join(dir, ".harness.json"))).toBe(true);
    const updated = JSON.parse(readFileSync(join(dir, ".harness.json"), "utf-8"));
    // Mock returns ["adr", "testingDocs"] as selected
    expect(updated.features.adr).toBe(true);
    expect(updated.features.testingDocs).toBe(true);
  });

  it("exits with 1 for unknown section", async () => {
    writeHarnessJson();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 0})`);
    });
    await expect(runConfigure({ section: "unknown" })).rejects.toThrow("process.exit(1)");
    exitSpy.mockRestore();
  });

  it("uses 'features' section by default when no section provided", async () => {
    writeHarnessJson();
    // Should not throw — default section is "features"
    await expect(runConfigure({})).resolves.not.toThrow();
  });
});
