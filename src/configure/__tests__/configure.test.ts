import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_DEFAULTS } from "../../config/defaults.js";
import { FEATURE_METADATA } from "../../config/feature-metadata.js";

let dir: string;
let originalCwd: string;
// biome-ignore lint/suspicious/noExplicitAny: captured inquirer argument
let capturedPromptArgs: any[];

vi.mock("inquirer", () => ({
  default: {
    Separator: class Separator {
      type = "separator";
      constructor(public line: string) {}
    },
    prompt: vi.fn().mockImplementation(async (questions: unknown[]) => {
      capturedPromptArgs = questions as unknown[];
      // Return all features selected to avoid writes failing
      const choices = (questions[0] as { choices: { value?: string }[] }).choices;
      const selected = choices.filter((c) => c.value !== undefined).map((c) => c.value as string);
      return { features: selected };
    }),
  },
}));

function writeHarnessConfig(overrides: object = {}) {
  const config = { ...CONFIG_DEFAULTS, ...overrides };
  writeFileSync(join(dir, ".harness.json"), JSON.stringify(config));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-configure-test-"));
  originalCwd = process.cwd();
  capturedPromptArgs = [];
  process.chdir(dir);
  writeHarnessConfig();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
  vi.resetModules();
  vi.clearAllMocks();
});

describe("runConfigure --section features", () => {
  it("calls inquirer.prompt with a checkbox question", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({ section: "features" });
    expect(capturedPromptArgs).toHaveLength(1);
    expect(capturedPromptArgs[0].type).toBe("checkbox");
    expect(capturedPromptArgs[0].name).toBe("features");
  });

  it("includes a feedforward separator before feedforward items", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({ section: "features" });
    const choices = capturedPromptArgs[0].choices;
    const separatorLabels = choices
      .filter((c: { type?: string; line?: string }) => c.type === "separator")
      .map((c: { line?: string }) => c.line ?? "");
    expect(separatorLabels.some((l: string) => l.toLowerCase().includes("feedforward"))).toBe(true);
  });

  it("includes a feedback separator before feedback items", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({ section: "features" });
    const choices = capturedPromptArgs[0].choices;
    const separatorLabels = choices
      .filter((c: { type?: string; line?: string }) => c.type === "separator")
      .map((c: { line?: string }) => c.line ?? "");
    expect(separatorLabels.some((l: string) => l.toLowerCase().includes("feedback"))).toBe(true);
  });

  it("feedforward separator appears before feedback separator", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({ section: "features" });
    const choices = capturedPromptArgs[0].choices as Array<{
      type?: string;
      line?: string;
      value?: string;
    }>;
    const ffSepIdx = choices.findIndex(
      (c) => c.type === "separator" && c.line?.toLowerCase().includes("feedforward"),
    );
    const fbSepIdx = choices.findIndex(
      (c) => c.type === "separator" && c.line?.toLowerCase().includes("feedback"),
    );
    expect(ffSepIdx).toBeGreaterThanOrEqual(0);
    expect(fbSepIdx).toBeGreaterThan(ffSepIdx);
  });

  it("all feedforward feature keys appear between feedforward and feedback separators", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({ section: "features" });
    const choices = capturedPromptArgs[0].choices as Array<{
      type?: string;
      line?: string;
      value?: string;
    }>;

    const ffSepIdx = choices.findIndex(
      (c) => c.type === "separator" && c.line?.toLowerCase().includes("feedforward"),
    );
    const fbSepIdx = choices.findIndex(
      (c) => c.type === "separator" && c.line?.toLowerCase().includes("feedback"),
    );

    const ffChoiceValues = choices
      .slice(ffSepIdx + 1, fbSepIdx)
      .filter((c) => c.value !== undefined)
      .map((c) => c.value as string);

    const expectedFeedforwardKeys = Object.entries(FEATURE_METADATA)
      .filter(([, m]) => m.controlType === "feedforward")
      .map(([k]) => k);

    for (const key of expectedFeedforwardKeys) {
      expect(ffChoiceValues, `expected feedforward key "${key}" between separators`).toContain(key);
    }
  });

  it("all feedback feature keys appear after the feedback separator", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({ section: "features" });
    const choices = capturedPromptArgs[0].choices as Array<{
      type?: string;
      line?: string;
      value?: string;
    }>;

    const fbSepIdx = choices.findIndex(
      (c) => c.type === "separator" && c.line?.toLowerCase().includes("feedback"),
    );

    const fbChoiceValues = choices
      .slice(fbSepIdx + 1)
      .filter((c) => c.value !== undefined)
      .map((c) => c.value as string);

    const expectedFeedbackKeys = Object.entries(FEATURE_METADATA)
      .filter(([, m]) => m.controlType === "feedback")
      .map(([k]) => k);

    for (const key of expectedFeedbackKeys) {
      expect(fbChoiceValues, `expected feedback key "${key}" after feedback separator`).toContain(
        key,
      );
    }
  });

  it("displays executionType in bracket notation for each feature", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({ section: "features" });
    const choices = capturedPromptArgs[0].choices as Array<{
      type?: string;
      name?: string;
      value?: string;
    }>;
    const featureChoices = choices.filter((c) => c.value !== undefined && c.name !== undefined);
    for (const choice of featureChoices) {
      expect(
        choice.name,
        `choice for "${choice.value}" should include execution type in brackets`,
      ).toMatch(/\[(computational|inferential)\]/);
    }
  });

  it("exits with error for unknown section", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const { runConfigure } = await import("../index.js");
    await expect(runConfigure({ section: "unknown-section" })).rejects.toThrow();
    exitSpy.mockRestore();
  });

  it("defaults to features section when no section specified", async () => {
    const { runConfigure } = await import("../index.js");
    await runConfigure({});
    expect(capturedPromptArgs).toHaveLength(1);
    expect(capturedPromptArgs[0].name).toBe("features");
  });
});
