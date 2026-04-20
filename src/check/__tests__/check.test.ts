import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Prevent process.exit from terminating the test runner
const exitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
  throw new Error(`process.exit(${_code ?? 0})`);
});

vi.spyOn(console, "log").mockImplementation(() => {});

let dir: string;
let originalCwd: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-check-unit-"));
  originalCwd = process.cwd();
  exitSpy.mockClear();
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
});

function touch(rel: string, content = ""): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function writeHarnessJson(): void {
  touch(
    ".harness.json",
    JSON.stringify({
      version: "0.1.0",
      project: {
        name: "test",
        type: "cli",
        stacks: [],
        testCommand: "npm test",
        lintCommand: "npm run lint",
        typeCheckCommand: "npx tsc --noEmit",
        buildCommand: "npm run build",
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
      },
      hooks: {},
      integrations: { linear: { enabled: false, teamKey: "" } },
    }),
  );
}

const MANDATORY_FILES = [
  "CLAUDE.md",
  ".ai/README.md",
  ".ai/agent-instructions/session-protocol.md",
  ".ai/agent-instructions/pre-plan.md",
  ".ai/agent-instructions/pre-push.md",
  ".ai/manifest.json",
  ".claude/settings.json",
  ".claude/hooks/pre-push-check.js",
  ".ai/design-docs/README.md",
  ".ai/exec-plans/README.md",
  ".ai/generated/README.md",
  ".ai/product-specs/README.md",
  ".ai/references/README.md",
  ".ai/ARCHITECTURE.md",
  ".ai/DESIGN.md",
  ".ai/PLANS.md",
  ".ai/PRODUCT_SENSE.md",
  ".ai/QUALITY_SCORE.md",
  ".ai/RELIABILITY.md",
  ".ai/SECURITY.md",
];

async function check(): Promise<void> {
  process.chdir(dir);
  const { runCheck } = await import("../index.js");
  await runCheck();
}

describe("runCheck — full structure present", () => {
  it("does not call exit when all mandatory files are present", async () => {
    writeHarnessJson();
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe("runCheck — missing .harness.json", () => {
  it("exits with 1 when .harness.json is absent", async () => {
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).rejects.toThrow("process.exit(1)");
  });
});

const NEW_TRI62_MANDATORY_DOCS = [
  ".ai/design-docs/README.md",
  ".ai/exec-plans/README.md",
  ".ai/generated/README.md",
  ".ai/product-specs/README.md",
  ".ai/references/README.md",
  ".ai/ARCHITECTURE.md",
  ".ai/DESIGN.md",
  ".ai/PLANS.md",
  ".ai/PRODUCT_SENSE.md",
  ".ai/QUALITY_SCORE.md",
  ".ai/RELIABILITY.md",
  ".ai/SECURITY.md",
];

describe("runCheck — missing new TRI-62 mandatory docs", () => {
  for (const doc of NEW_TRI62_MANDATORY_DOCS) {
    it(`exits with 1 when ${doc} is missing`, async () => {
      writeHarnessJson();
      for (const f of MANDATORY_FILES) {
        if (f !== doc) touch(f);
      }
      await expect(check()).rejects.toThrow("process.exit(1)");
    });
  }
});

// ─── CLAUDE.md line count ─────────────────────────────────────────────────────

describe("runCheck — CLAUDE.md line count", () => {
  it("passes when CLAUDE.md is <=100 lines", async () => {
    writeHarnessJson();
    for (const f of MANDATORY_FILES) {
      if (f !== "CLAUDE.md") touch(f);
    }
    touch("CLAUDE.md", Array(50).fill("line").join("\n"));
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("warns (no exit) when CLAUDE.md exceeds 100 lines", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeHarnessJson();
    for (const f of MANDATORY_FILES) {
      if (f !== "CLAUDE.md") touch(f);
    }
    touch("CLAUDE.md", Array(150).fill("line").join("\n"));
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ─── Recommended artifact warnings ───────────────────────────────────────────

function writeHarnessJsonWithFeatures(features: Record<string, unknown>): void {
  touch(
    ".harness.json",
    JSON.stringify({
      version: "0.1.0",
      project: {
        name: "test",
        type: "cli",
        stacks: [],
        testCommand: "npm test",
        lintCommand: "npm run lint",
        typeCheckCommand: "npx tsc --noEmit",
        buildCommand: "npm run build",
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
        ...features,
      },
      hooks: {},
      integrations: { linear: { enabled: false, teamKey: "" } },
    }),
  );
}

describe("runCheck — recommended artifact warnings", () => {
  it("warns (no exit) when adr enabled but .ai/adr/README.md missing", async () => {
    writeHarnessJsonWithFeatures({ adr: true });
    for (const f of MANDATORY_FILES) touch(f);
    // do not create .ai/adr/README.md
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("warns (no exit) when testingDocs enabled but .ai/testing/conventions.md missing", async () => {
    writeHarnessJsonWithFeatures({ testingDocs: true });
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

// ─── Hook script warnings ─────────────────────────────────────────────────────

describe("runCheck — hook script warnings", () => {
  it("warns (no exit) when branchNamingWarning enabled but hook missing", async () => {
    writeHarnessJsonWithFeatures({ branchNamingWarning: true });
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("warns (no exit) when completionReminder enabled but hook missing", async () => {
    writeHarnessJsonWithFeatures({ completionReminder: true });
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("warns (no exit) when artifactFreshnessCheck enabled but hook missing", async () => {
    writeHarnessJsonWithFeatures({ artifactFreshnessCheck: true });
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

// ─── Skill file failures ──────────────────────────────────────────────────────

describe("runCheck — skill file failures", () => {
  it("exits with 1 when skills.addTicket enabled but .claude/skills/add-ticket.md missing", async () => {
    writeHarnessJsonWithFeatures({ skills: { addTicket: true, build: false } });
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).rejects.toThrow("process.exit(1)");
  });
});

// ─── Command configuration warnings ──────────────────────────────────────────

describe("runCheck — command configuration warnings", () => {
  it("warns (no exit) when testCommand is empty", async () => {
    touch(
      ".harness.json",
      JSON.stringify({
        version: "0.1.0",
        project: {
          name: "test",
          type: "cli",
          stacks: [],
          testCommand: "",
          lintCommand: "npm run lint",
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
        },
        hooks: {},
        integrations: { linear: { enabled: false, teamKey: "" } },
      }),
    );
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("warns (no exit) when lintCommand is empty", async () => {
    touch(
      ".harness.json",
      JSON.stringify({
        version: "0.1.0",
        project: {
          name: "test",
          type: "cli",
          stacks: [],
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
        },
        hooks: {},
        integrations: { linear: { enabled: false, teamKey: "" } },
      }),
    );
    for (const f of MANDATORY_FILES) touch(f);
    await expect(check()).resolves.not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
