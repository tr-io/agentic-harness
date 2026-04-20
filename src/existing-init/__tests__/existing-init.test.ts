import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StackReport } from "../../detector/types.js";
import {
  detectExistingConfigs,
  fallbackOutput,
  gatherDirectoryTree,
  readFileHeader,
  writeSubAgentOutputs,
} from "../index.js";

let dir: string;

const emptyStack: StackReport = {
  projectType: "cli",
  languages: ["typescript"],
  frameworks: [],
  existingLinters: [],
  testFramework: null,
  buildSystem: null,
  entryPoints: ["src/index.ts"],
  isMonorepo: false,
  packageManager: null,
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-existing-init-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ─── detectExistingConfigs ────────────────────────────────────────────────────

describe("detectExistingConfigs — additional detections", () => {
  it("detects .cursorrules", () => {
    writeFileSync(join(dir, ".cursorrules"), "# rules");
    const result = detectExistingConfigs(dir);
    expect(result.cursorrules).toBe(true);
  });

  it("returns cursorrules: false when file absent", () => {
    const result = detectExistingConfigs(dir);
    expect(result.cursorrules).toBe(false);
  });

  it("detects .github/copilot-instructions.md", () => {
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, ".github", "copilot-instructions.md"), "# instructions");
    const result = detectExistingConfigs(dir);
    expect(result.copilotInstructions).toBe(true);
  });

  it("returns copilotInstructions: false when file absent", () => {
    const result = detectExistingConfigs(dir);
    expect(result.copilotInstructions).toBe(false);
  });

  it("detects .git/hooks/pre-push", () => {
    mkdirSync(join(dir, ".git", "hooks"), { recursive: true });
    writeFileSync(join(dir, ".git", "hooks", "pre-push"), "#!/bin/sh");
    const result = detectExistingConfigs(dir);
    expect(result.gitHooksPrePush).toBe(true);
  });

  it("returns gitHooksPrePush: false when file absent", () => {
    const result = detectExistingConfigs(dir);
    expect(result.gitHooksPrePush).toBe(false);
  });

  it("detects CI workflow with .yaml extension", () => {
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    writeFileSync(join(dir, ".github", "workflows", "deploy.yaml"), "name: deploy");
    const result = detectExistingConfigs(dir);
    expect(result.ciWorkflow).toBe(true);
  });

  it("returns ciWorkflow: false when workflow directory has no yml/yaml files", () => {
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    writeFileSync(join(dir, ".github", "workflows", "README.md"), "# docs");
    const result = detectExistingConfigs(dir);
    expect(result.ciWorkflow).toBe(false);
  });

  it("returns ciWorkflow: false when .github/workflows directory absent", () => {
    const result = detectExistingConfigs(dir);
    expect(result.ciWorkflow).toBe(false);
  });
});

// ─── fallbackOutput ───────────────────────────────────────────────────────────

describe("fallbackOutput", () => {
  it("produces a non-empty architectureOverview", () => {
    const output = fallbackOutput(emptyStack);
    expect(output.architectureOverview.length).toBeGreaterThan(0);
  });

  it("includes the project type in the architecture overview", () => {
    const output = fallbackOutput(emptyStack);
    expect(output.architectureOverview).toContain("cli");
  });

  it("produces at least one codebase doc in codebases map", () => {
    const output = fallbackOutput(emptyStack);
    expect(Object.keys(output.codebases).length).toBeGreaterThan(0);
  });

  it("produces manifest mappings", () => {
    const output = fallbackOutput(emptyStack);
    expect(output.manifestMappings.length).toBeGreaterThan(0);
    expect(output.manifestMappings[0].sourcePaths.length).toBeGreaterThan(0);
    expect(output.manifestMappings[0].docs.length).toBeGreaterThan(0);
  });

  it("includes language in architecture overview", () => {
    const output = fallbackOutput({ ...emptyStack, languages: ["python"] });
    expect(output.architectureOverview).toContain("python");
  });
});

// ─── writeSubAgentOutputs ─────────────────────────────────────────────────────

describe("writeSubAgentOutputs", () => {
  it("writes .ai/ARCHITECTURE.md when architectureOverview provided", () => {
    writeSubAgentOutputs(dir, {
      architectureOverview: "# Architecture\n\nDetails here.\n",
      codebases: {},
      manifestMappings: [],
    });
    expect(existsSync(join(dir, ".ai", "ARCHITECTURE.md"))).toBe(true);
  });

  it("writes generated codebase docs to .ai/generated/", () => {
    writeSubAgentOutputs(dir, {
      architectureOverview: "",
      codebases: {
        "overview.md": "# Overview\n",
        "auth.md": "# Auth\n",
      },
      manifestMappings: [],
    });
    expect(existsSync(join(dir, ".ai", "generated", "overview.md"))).toBe(true);
    expect(existsSync(join(dir, ".ai", "generated", "auth.md"))).toBe(true);
  });

  it("returns relative paths of written files", () => {
    const written = writeSubAgentOutputs(dir, {
      architectureOverview: "# Architecture\n",
      codebases: { "overview.md": "# Overview\n" },
      manifestMappings: [],
    });
    expect(written).toContain(".ai/ARCHITECTURE.md");
    expect(written.some((p) => p.includes("overview.md"))).toBe(true);
  });

  it("writes manifest mappings to .ai/manifest.json", () => {
    writeSubAgentOutputs(dir, {
      architectureOverview: "",
      codebases: {},
      manifestMappings: [{ sourcePaths: ["src/**"], docs: [".ai/generated/overview.md"] }],
    });
    const manifest = JSON.parse(readFileSync(join(dir, ".ai", "manifest.json"), "utf-8"));
    expect(manifest.mappings).toHaveLength(1);
    expect(manifest.mappings[0].sourcePaths).toEqual(["src/**"]);
  });

  it("adds generatedAt timestamp to manifest.json", () => {
    writeSubAgentOutputs(dir, {
      architectureOverview: "",
      codebases: {},
      manifestMappings: [{ sourcePaths: ["src/**"], docs: [".ai/overview.md"] }],
    });
    const manifest = JSON.parse(readFileSync(join(dir, ".ai", "manifest.json"), "utf-8"));
    expect(manifest.generatedAt).toBeTruthy();
  });

  it("does not write ARCHITECTURE.md when architectureOverview is empty", () => {
    writeSubAgentOutputs(dir, {
      architectureOverview: "",
      codebases: {},
      manifestMappings: [],
    });
    expect(existsSync(join(dir, ".ai", "ARCHITECTURE.md"))).toBe(false);
  });
});

// ─── gatherDirectoryTree ──────────────────────────────────────────────────────

describe("gatherDirectoryTree", () => {
  it("returns empty string for an empty directory", () => {
    const result = gatherDirectoryTree(dir);
    expect(result).toBe("");
  });

  it("lists files in the directory", () => {
    writeFileSync(join(dir, "README.md"), "# Readme");
    writeFileSync(join(dir, "package.json"), "{}");
    const result = gatherDirectoryTree(dir);
    expect(result).toContain("README.md");
    expect(result).toContain("package.json");
  });

  it("recursively lists subdirectories", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "index.ts"), "");
    const result = gatherDirectoryTree(dir);
    expect(result).toContain("src");
    expect(result).toContain("index.ts");
  });

  it("respects maxDepth limit", () => {
    mkdirSync(join(dir, "a", "b", "c"), { recursive: true });
    writeFileSync(join(dir, "a", "b", "c", "deep.ts"), "");
    // maxDepth=1: only top-level entries, no recursion into children
    const result = gatherDirectoryTree(dir, 1);
    expect(result).toContain("a");
    expect(result).not.toContain("deep.ts");
  });

  it("excludes node_modules, dist, __pycache__, target", () => {
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "src.ts"), "");
    const result = gatherDirectoryTree(dir);
    expect(result).not.toContain("node_modules");
    expect(result).not.toContain("dist");
    expect(result).toContain("src.ts");
  });

  it("excludes hidden files (starting with .)", () => {
    writeFileSync(join(dir, ".gitignore"), "");
    writeFileSync(join(dir, "visible.ts"), "");
    const result = gatherDirectoryTree(dir);
    expect(result).not.toContain(".gitignore");
    expect(result).toContain("visible.ts");
  });

  it("returns empty string for a non-existent directory", () => {
    const result = gatherDirectoryTree(join(dir, "nonexistent-12345"));
    expect(result).toBe("");
  });
});

// ─── readFileHeader ───────────────────────────────────────────────────────────

describe("readFileHeader", () => {
  it("returns the first N lines of a file", () => {
    const content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n");
    writeFileSync(join(dir, "bigfile.txt"), content);
    const result = readFileHeader(join(dir, "bigfile.txt"), 10);
    const lines = result.split("\n");
    expect(lines.length).toBe(10);
    expect(lines[0]).toBe("line 1");
    expect(lines[9]).toBe("line 10");
  });

  it("returns empty string for a non-existent file", () => {
    expect(readFileHeader(join(dir, "nonexistent.txt"))).toBe("");
  });

  it("returns entire file when it has fewer lines than requested", () => {
    writeFileSync(join(dir, "small.txt"), "one\ntwo\nthree");
    const result = readFileHeader(join(dir, "small.txt"), 100);
    expect(result).toBe("one\ntwo\nthree");
  });
});
