import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_DEFAULTS } from "../../config/defaults.js";
import type { StackReport } from "../../detector/types.js";
import {
  buildConfig,
  defaultsFromStack,
  guessLintCommand,
  guessTestCommand,
  isGreenfield,
} from "../index.js";

let dir: string;

const emptyStack: StackReport = {
  projectType: "cli",
  languages: [],
  frameworks: [],
  existingLinters: [],
  testFramework: null,
  buildSystem: null,
  entryPoints: [],
  isMonorepo: false,
  packageManager: null,
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-init-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ─── isGreenfield ─────────────────────────────────────────────────────────────

describe("isGreenfield", () => {
  it("returns true for an empty directory", () => {
    expect(isGreenfield(dir)).toBe(true);
  });

  it("returns false when package.json exists", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    expect(isGreenfield(dir)).toBe(false);
  });

  it("returns false when Cargo.toml exists", () => {
    writeFileSync(join(dir, "Cargo.toml"), "[package]");
    expect(isGreenfield(dir)).toBe(false);
  });

  it("returns false when go.mod exists", () => {
    writeFileSync(join(dir, "go.mod"), "module example.com/app");
    expect(isGreenfield(dir)).toBe(false);
  });

  it("returns false when pyproject.toml exists", () => {
    writeFileSync(join(dir, "pyproject.toml"), "[tool.poetry]");
    expect(isGreenfield(dir)).toBe(false);
  });

  it("returns false when pom.xml exists", () => {
    writeFileSync(join(dir, "pom.xml"), "<project/>");
    expect(isGreenfield(dir)).toBe(false);
  });

  it("returns false when src/ directory exists", () => {
    mkdirSync(join(dir, "src"));
    expect(isGreenfield(dir)).toBe(false);
  });
});

// ─── guessTestCommand ─────────────────────────────────────────────────────────

describe("guessTestCommand", () => {
  it("returns 'npm test' for vitest", () => {
    expect(guessTestCommand({ ...emptyStack, testFramework: "vitest" })).toBe("npm test");
  });

  it("returns 'npm test' for jest", () => {
    expect(guessTestCommand({ ...emptyStack, testFramework: "jest" })).toBe("npm test");
  });

  it("returns 'pytest' for pytest", () => {
    expect(guessTestCommand({ ...emptyStack, testFramework: "pytest" })).toBe("pytest");
  });

  it("returns 'cargo test' for cargo-test", () => {
    expect(guessTestCommand({ ...emptyStack, testFramework: "cargo-test" })).toBe("cargo test");
  });

  it("returns 'go test ./...' for go-test", () => {
    expect(guessTestCommand({ ...emptyStack, testFramework: "go-test" })).toBe("go test ./...");
  });

  it("returns empty string when testFramework is null", () => {
    expect(guessTestCommand({ ...emptyStack, testFramework: null })).toBe("");
  });
});

// ─── guessLintCommand ─────────────────────────────────────────────────────────

describe("guessLintCommand", () => {
  it("returns 'npx biome check .' for biome", () => {
    expect(guessLintCommand({ ...emptyStack, existingLinters: ["biome"] })).toBe(
      "npx biome check .",
    );
  });

  it("returns 'npx eslint .' for eslint", () => {
    expect(guessLintCommand({ ...emptyStack, existingLinters: ["eslint"] })).toBe("npx eslint .");
  });

  it("returns 'ruff check .' for ruff", () => {
    expect(guessLintCommand({ ...emptyStack, existingLinters: ["ruff"] })).toBe("ruff check .");
  });

  it("returns 'cargo clippy' for clippy", () => {
    expect(guessLintCommand({ ...emptyStack, existingLinters: ["clippy"] })).toBe("cargo clippy");
  });

  it("returns 'golangci-lint run' for golangci-lint", () => {
    expect(guessLintCommand({ ...emptyStack, existingLinters: ["golangci-lint"] })).toBe(
      "golangci-lint run",
    );
  });

  it("returns empty string when no linters detected", () => {
    expect(guessLintCommand({ ...emptyStack, existingLinters: [] })).toBe("");
  });
});

// ─── buildConfig ─────────────────────────────────────────────────────────────

describe("buildConfig", () => {
  it("produces HarnessConfig with correct project fields from answers", () => {
    const stack: StackReport = {
      ...emptyStack,
      languages: ["typescript"],
      entryPoints: ["src/index.ts"],
    };
    const answers = {
      name: "my-app",
      type: "web-app",
      testCommand: "npm test",
      lintCommand: "npx biome check .",
      typeCheckCommand: "npx tsc --noEmit",
      buildCommand: "npm run build",
      linearEnabled: false,
      linearTeamKey: "",
    };
    const config = buildConfig(answers, stack);
    expect(config.project.name).toBe("my-app");
    expect(config.project.type).toBe("web-app");
    expect(config.project.testCommand).toBe("npm test");
    expect(config.project.lintCommand).toBe("npx biome check .");
    expect(config.project.stacks).toEqual(["typescript"]);
    expect(config.integrations.linear.enabled).toBe(false);
  });

  it("uses stack.projectType as fallback when type answer missing", () => {
    const stack: StackReport = { ...emptyStack, projectType: "library" };
    const config = buildConfig({ name: "lib" }, stack);
    expect(config.project.type).toBe("library");
  });

  it("copies CONFIG_DEFAULTS features and hooks", () => {
    const config = buildConfig({ name: "x" }, emptyStack);
    expect(config.features).toEqual(CONFIG_DEFAULTS.features);
    expect(config.hooks).toEqual(CONFIG_DEFAULTS.hooks);
  });
});

// ─── defaultsFromStack ────────────────────────────────────────────────────────

describe("defaultsFromStack", () => {
  it("derives testCommand from detected test framework", () => {
    const stack: StackReport = { ...emptyStack, testFramework: "pytest" };
    const config = defaultsFromStack(stack);
    expect(config.project.testCommand).toBe("pytest");
  });

  it("derives lintCommand from existing linters", () => {
    const stack: StackReport = { ...emptyStack, existingLinters: ["eslint"] };
    const config = defaultsFromStack(stack);
    expect(config.project.lintCommand).toBe("npx eslint .");
  });

  it("uses first entryPoint segment as project name fallback", () => {
    const stack: StackReport = { ...emptyStack, entryPoints: ["my-project/index.ts"] };
    const config = defaultsFromStack(stack);
    expect(config.project.name).toBe("my-project");
  });

  it("falls back to 'my-project' name when no entryPoints", () => {
    const config = defaultsFromStack(emptyStack);
    expect(config.project.name).toBe("my-project");
  });

  it("sets typeCheckCommand to 'npx tsc --noEmit' for TypeScript projects", () => {
    const stack: StackReport = { ...emptyStack, languages: ["typescript"] };
    const config = defaultsFromStack(stack);
    expect(config.project.typeCheckCommand).toBe("npx tsc --noEmit");
  });

  it("leaves typeCheckCommand empty for non-TypeScript projects", () => {
    const stack: StackReport = { ...emptyStack, languages: ["python"] };
    const config = defaultsFromStack(stack);
    expect(config.project.typeCheckCommand).toBe("");
  });
});
