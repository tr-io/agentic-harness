import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_DEFAULTS } from "../defaults.js";
import { HarnessConfigError, loadConfig, loadConfigOrNull } from "../loader.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-config-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeConfig(content: unknown) {
  writeFileSync(join(dir, ".harness.json"), JSON.stringify(content));
}

describe("loadConfig", () => {
  it("throws HarnessConfigError when .harness.json does not exist", () => {
    expect(() => loadConfig(dir)).toThrow(HarnessConfigError);
    expect(() => loadConfig(dir)).toThrow("harness init");
  });

  it("throws HarnessConfigError for invalid JSON", () => {
    writeFileSync(join(dir, ".harness.json"), "{ not valid json }");
    expect(() => loadConfig(dir)).toThrow(HarnessConfigError);
    expect(() => loadConfig(dir)).toThrow("invalid JSON");
  });

  it("throws HarnessConfigError when root is not an object", () => {
    writeFileSync(join(dir, ".harness.json"), "[]");
    expect(() => loadConfig(dir)).toThrow(HarnessConfigError);
    expect(() => loadConfig(dir)).toThrow("JSON object");
  });

  it("throws when project field is not an object", () => {
    writeConfig({ project: "bad" });
    expect(() => loadConfig(dir)).toThrow(HarnessConfigError);
  });

  it("applies defaults for all missing fields", () => {
    writeConfig({});
    const config = loadConfig(dir);
    expect(config.features.adr).toBe(true);
    expect(config.features.testingDocs).toBe(true);
    expect(config.features.dddContextMaps).toBe(false);
    expect(config.features.autoLoop).toBe(false);
    expect(config.hooks.prePush.lint).toBe(true);
    expect(config.linear.enabled).toBe(false);
  });

  it("overrides defaults with provided values", () => {
    writeConfig({
      features: { adr: false, dddContextMaps: true },
      hooks: { prePush: { lint: false } },
    });
    const config = loadConfig(dir);
    expect(config.features.adr).toBe(false);
    expect(config.features.dddContextMaps).toBe(true);
    expect(config.hooks.prePush.lint).toBe(false);
    // Other defaults preserved
    expect(config.features.testingDocs).toBe(true);
    expect(config.hooks.prePush.typeCheck).toBe(true);
  });

  it("merges project fields with defaults", () => {
    writeConfig({ project: { name: "my-app", type: "cli" } });
    const config = loadConfig(dir);
    expect(config.project.name).toBe("my-app");
    expect(config.project.type).toBe("cli");
    expect(config.project.stacks).toEqual([]); // default
  });

  it("reads linear config correctly", () => {
    writeConfig({ linear: { enabled: true, teamKey: "TRI", projectId: "abc-123" } });
    const config = loadConfig(dir);
    expect(config.linear.enabled).toBe(true);
    expect(config.linear.teamKey).toBe("TRI");
    expect(config.linear.projectId).toBe("abc-123");
  });
});

describe("loadConfigOrNull", () => {
  it("returns null when config not found", () => {
    expect(loadConfigOrNull(dir)).toBeNull();
  });

  it("returns null for invalid config", () => {
    writeFileSync(join(dir, ".harness.json"), "bad json");
    expect(loadConfigOrNull(dir)).toBeNull();
  });

  it("returns config when valid", () => {
    writeConfig({ project: { name: "test" } });
    const config = loadConfigOrNull(dir);
    expect(config).not.toBeNull();
    expect(config?.project.name).toBe("test");
  });
});

describe("CONFIG_DEFAULTS", () => {
  it("has all recommended features enabled", () => {
    expect(CONFIG_DEFAULTS.features.adr).toBe(true);
    expect(CONFIG_DEFAULTS.features.testingDocs).toBe(true);
    expect(CONFIG_DEFAULTS.features.completionReminder).toBe(true);
    expect(CONFIG_DEFAULTS.features.branchNamingWarning).toBe(true);
    expect(CONFIG_DEFAULTS.features.linterBootstrap).toBe(true);
    expect(CONFIG_DEFAULTS.features.linearIntegration).toBe(true);
    expect(CONFIG_DEFAULTS.features.artifactFreshnessCheck).toBe(true);
  });

  it("has all optional features disabled", () => {
    expect(CONFIG_DEFAULTS.features.dddContextMaps).toBe(false);
    expect(CONFIG_DEFAULTS.features.latMd).toBe(false);
    expect(CONFIG_DEFAULTS.features.evaluatorQA).toBe(false);
    expect(CONFIG_DEFAULTS.features.autoLoop).toBe(false);
    expect(CONFIG_DEFAULTS.features.keelEnforcement).toBe(false);
  });

  it("has all pre-push checks enabled by default", () => {
    expect(CONFIG_DEFAULTS.hooks.prePush.lint).toBe(true);
    expect(CONFIG_DEFAULTS.hooks.prePush.typeCheck).toBe(true);
    expect(CONFIG_DEFAULTS.hooks.prePush.unitTest).toBe(true);
  });
});
