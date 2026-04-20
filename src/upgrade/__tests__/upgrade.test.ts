import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock analyzeCodebaseWithSubAgent so tests don't spawn real claude processes
vi.mock("../../existing-init/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../existing-init/index.js")>();
  return {
    ...actual,
    analyzeCodebaseWithSubAgent: vi.fn().mockReturnValue({
      architectureOverview: "# Architecture\n",
      codebases: { "overview.md": "# Overview\n" },
      manifestMappings: [{ sourcePaths: ["src/**"], docs: [".ai/generated/overview.md"] }],
    }),
  };
});

const inquirerMock = { action: "keep" };

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn().mockImplementation(() => Promise.resolve(inquirerMock)),
    Separator: class {},
  },
}));

let dir: string;
let originalCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-upgrade-test-"));
  originalCwd = process.cwd();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeHarnessJson(extras?: Record<string, unknown>): void {
  writeFileSync(
    join(dir, ".harness.json"),
    JSON.stringify({
      version: "0.1.0",
      project: {
        name: "test",
        type: "cli",
        stacks: ["typescript"],
        entryPoints: [],
        testCommand: "npm test",
        lintCommand: "npx biome check .",
        typeCheckCommand: "npx tsc --noEmit",
        buildCommand: "npm run build",
      },
      features: {
        adr: true,
        testingDocs: true,
        linterBootstrap: true,
        linearIntegration: false,
        dddContextMaps: false,
        latMd: false,
        evaluatorQA: false,
        branchNamingWarning: true,
        artifactFreshnessCheck: true,
        autoLoop: false,
        keelEnforcement: false,
        completionReminder: true,
        skills: { addTicket: false, build: false },
      },
      hooks: { prePush: { lint: true, typeCheck: true, unitTest: true } },
      integrations: { linear: { enabled: false, teamKey: "" } },
      ...extras,
    }),
  );
}

// ─── computeChecksums ─────────────────────────────────────────────────────────

describe("computeChecksums", () => {
  it("produces 32-char hex MD5 strings", async () => {
    const { computeChecksums } = await import("../index.js");
    const result = computeChecksums([{ path: "foo.txt", content: "hello" }]);
    expect(result["foo.txt"]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns empty object for empty file list", async () => {
    const { computeChecksums } = await import("../index.js");
    expect(computeChecksums([])).toEqual({});
  });

  it("produces a checksum even for empty content", async () => {
    const { computeChecksums } = await import("../index.js");
    const result = computeChecksums([{ path: "empty.txt", content: "" }]);
    expect(result["empty.txt"]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("different contents produce different checksums", async () => {
    const { computeChecksums } = await import("../index.js");
    const a = computeChecksums([{ path: "f", content: "aaa" }]);
    const b = computeChecksums([{ path: "f", content: "bbb" }]);
    expect(a.f).not.toBe(b.f);
  });

  it("same content always produces same checksum", async () => {
    const { computeChecksums } = await import("../index.js");
    const a = computeChecksums([{ path: "f", content: "hello world" }]);
    const b = computeChecksums([{ path: "f", content: "hello world" }]);
    expect(a.f).toBe(b.f);
  });
});

// ─── readChecksums ────────────────────────────────────────────────────────────

describe("readChecksums", () => {
  it("returns empty object when file does not exist", async () => {
    const { readChecksums } = await import("../index.js");
    expect(readChecksums(dir)).toEqual({});
  });

  it("returns empty object for malformed JSON", async () => {
    const { readChecksums } = await import("../index.js");
    writeFileSync(join(dir, ".harness-checksums.json"), "NOT JSON {{{");
    expect(readChecksums(dir)).toEqual({});
  });

  it("round-trips: write then read returns same data", async () => {
    const { readChecksums, writeChecksums } = await import("../index.js");
    const data = { "foo.txt": "abc123", "bar.md": "def456" };
    writeChecksums(dir, data);
    expect(readChecksums(dir)).toEqual(data);
  });
});

// ─── runUpgrade dry-run ───────────────────────────────────────────────────────

describe("runUpgrade — dry-run file classification", () => {
  it("reports already up to date immediately after init", async () => {
    vi.resetModules();
    const { runInit } = await import("../../init/index.js");
    await runInit({ interactive: false });

    vi.resetModules();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runUpgrade } = await import("../index.js");
    await runUpgrade({ dryRun: true });

    // Either "up to date" or "already up to date" — both mean no changes needed
    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput.toLowerCase()).toContain("up to date");
    logSpy.mockRestore();
  });

  it("dry-run shows new file when one was deleted after init", async () => {
    vi.resetModules();
    const { runInit } = await import("../../init/index.js");
    await runInit({ interactive: false });

    // Delete a mandatory file to create a "new" scenario in upgrade
    rmSync(join(dir, ".ai/DESIGN.md"), { force: true });

    vi.resetModules();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runUpgrade } = await import("../index.js");
    await runUpgrade({ dryRun: true });

    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain(".ai/DESIGN.md");
    logSpy.mockRestore();
  });

  it("dry-run detects customized file after init", async () => {
    vi.resetModules();
    const { runInit } = await import("../../init/index.js");
    await runInit({ interactive: false });

    // Overwrite a template file with custom content
    writeFileSync(join(dir, "CLAUDE.md"), "# My custom CLAUDE.md\n".repeat(5));

    vi.resetModules();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runUpgrade } = await import("../index.js");
    await runUpgrade({ dryRun: true });

    // The modified file should appear in the output
    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("CLAUDE.md");
    logSpy.mockRestore();
  });
});

// ─── runUpgrade non-dry-run ───────────────────────────────────────────────────

describe("runUpgrade — non-dry-run", () => {
  it("writes .harness-checksums.json after a successful upgrade", async () => {
    vi.resetModules();
    const { runInit } = await import("../../init/index.js");
    await runInit({ interactive: false });

    vi.resetModules();
    const { runUpgrade } = await import("../index.js");
    await runUpgrade({ dryRun: false });

    // Checksums file should now exist
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(dir, ".harness-checksums.json"))).toBe(true);
  });

  it("overwrites changed file when inquirer action is 'overwrite'", async () => {
    vi.resetModules();
    const { runInit } = await import("../../init/index.js");
    await runInit({ interactive: false });

    // Modify CLAUDE.md to create a diff
    const original = readFileSync(join(dir, "CLAUDE.md"), "utf-8");
    writeFileSync(join(dir, "CLAUDE.md"), `${original}\n\n<!-- custom addition -->\n`);

    // Set mock to return "overwrite" for this test
    inquirerMock.action = "overwrite";

    vi.resetModules();
    const { runUpgrade } = await import("../index.js");
    await runUpgrade({ dryRun: false });

    // Reset mock back to default
    inquirerMock.action = "keep";

    // File should be restored to template content (not contain the custom addition)
    const updated = readFileSync(join(dir, "CLAUDE.md"), "utf-8");
    expect(updated).not.toContain("custom addition");
  });
});

// ─── runUpgrade error path ────────────────────────────────────────────────────

describe("runUpgrade — missing config", () => {
  it("exits with 1 when .harness.json is absent", async () => {
    vi.resetModules();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 0})`);
    });
    const { runUpgrade } = await import("../index.js");
    await expect(runUpgrade({})).rejects.toThrow("process.exit(1)");
    exitSpy.mockRestore();
  });
});
