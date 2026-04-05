import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateCiWorkflow, scaffoldCiWorkflow } from "../index.js";
import { CONFIG_DEFAULTS } from "../../config/defaults.js";
import type { HarnessConfig } from "../../config/types.js";
import type { StackReport } from "../../detector/types.js";

let dir: string;

const tsStack: StackReport = {
  projectType: "web-app",
  languages: ["typescript"],
  frameworks: ["react"],
  existingLinters: ["biome"],
  testFramework: "vitest",
  buildSystem: "npm",
  entryPoints: ["src/index.ts"],
  isMonorepo: false,
  packageManager: "npm",
};

const pyStack: StackReport = {
  projectType: "web-app",
  languages: ["python"],
  frameworks: ["fastapi"],
  existingLinters: ["ruff"],
  testFramework: "pytest",
  buildSystem: null,
  entryPoints: ["main.py"],
  isMonorepo: false,
  packageManager: null,
};

const config: HarnessConfig = {
  ...CONFIG_DEFAULTS,
  project: {
    ...CONFIG_DEFAULTS.project,
    testCommand: "npm test",
    lintCommand: "npx biome check .",
    typeCheckCommand: "npx tsc --noEmit",
    buildCommand: "npm run build",
  },
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-ci-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("generateCiWorkflow", () => {
  it("includes setup-node for TypeScript project", () => {
    const yaml = generateCiWorkflow(config, tsStack);
    expect(yaml).toContain("setup-node");
    expect(yaml).toContain("node-version");
  });

  it("includes lint step when lintCommand configured", () => {
    const yaml = generateCiWorkflow(config, tsStack);
    expect(yaml).toContain("Lint");
    expect(yaml).toContain("npx biome check .");
  });

  it("includes type check step", () => {
    const yaml = generateCiWorkflow(config, tsStack);
    expect(yaml).toContain("Type check");
    expect(yaml).toContain("npx tsc --noEmit");
  });

  it("includes test step", () => {
    const yaml = generateCiWorkflow(config, tsStack);
    expect(yaml).toContain("Test");
    expect(yaml).toContain("npm test");
  });

  it("includes setup-python for Python project", () => {
    const pyConfig: HarnessConfig = {
      ...CONFIG_DEFAULTS,
      project: {
        ...CONFIG_DEFAULTS.project,
        testCommand: "pytest",
        lintCommand: "ruff check .",
        typeCheckCommand: "",
        buildCommand: "",
      },
    };
    const yaml = generateCiWorkflow(pyConfig, pyStack);
    expect(yaml).toContain("setup-python");
    expect(yaml).toContain("pytest");
  });

  it("runs on push and PR to main", () => {
    const yaml = generateCiWorkflow(config, tsStack);
    expect(yaml).toContain("branches: [main]");
    expect(yaml).toContain("push:");
    expect(yaml).toContain("pull_request:");
  });

  it("produces valid YAML structure", () => {
    const yaml = generateCiWorkflow(config, tsStack);
    expect(yaml).toContain("name: CI");
    expect(yaml).toContain("jobs:");
    expect(yaml).toContain("steps:");
    expect(yaml).toContain("uses: actions/checkout@v4");
  });
});

describe("scaffoldCiWorkflow", () => {
  it("creates ci.yml when none exists", () => {
    const result = scaffoldCiWorkflow(dir, config, tsStack);
    expect(result.created).toBe(true);
    const { existsSync } = require("node:fs");
    expect(existsSync(result.path)).toBe(true);
  });

  it("skips when ci workflow already exists", () => {
    // First scaffold
    scaffoldCiWorkflow(dir, config, tsStack);
    // Second scaffold
    const result = scaffoldCiWorkflow(dir, config, tsStack);
    expect(result.created).toBe(false);
  });
});
