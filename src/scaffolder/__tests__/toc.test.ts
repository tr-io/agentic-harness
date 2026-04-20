import { describe, expect, it } from "vitest";
import { buildToc } from "../toc.js";
import type { ScaffoldedFile } from "../types.js";

function file(path: string, description?: string): ScaffoldedFile {
  return { path, content: "", tier: "mandatory", description };
}

describe("buildToc", () => {
  it("returns .ai/ root header", () => {
    const toc = buildToc([file(".ai/README.md", "index")]);
    expect(toc).toMatch(/^\.ai\//);
  });

  it("groups subdirectory files under a single dir entry", () => {
    const files = [
      file(".ai/agent-instructions/session-protocol.md", "session protocol"),
      file(".ai/agent-instructions/pre-plan.md"),
      file(".ai/agent-instructions/pre-push.md"),
    ];
    const toc = buildToc(files);
    const lines = toc.split("\n");
    const dirLines = lines.filter((l) => l.includes("agent-instructions/"));
    expect(dirLines).toHaveLength(1);
  });

  it("shows description from first file in each group", () => {
    const files = [
      file(".ai/agent-instructions/session-protocol.md", "session protocol docs"),
      file(".ai/agent-instructions/pre-plan.md"),
    ];
    const toc = buildToc(files);
    expect(toc).toContain("← session protocol docs");
  });

  it("uses └── prefix for last entry and ├── for others", () => {
    const files = [
      file(".ai/adr/README.md", "ADRs"),
      file(".ai/testing/conventions.md", "testing"),
      file(".ai/README.md", "index"),
    ];
    const toc = buildToc(files);
    const lines = toc.split("\n").slice(1);
    expect(lines[lines.length - 1]).toMatch(/^└── /);
    for (const line of lines.slice(0, -1)) {
      expect(line).toMatch(/^├── /);
    }
  });

  it("sorts directories before root files", () => {
    const files = [
      file(".ai/README.md", "index"),
      file(".ai/manifest.json", "manifest"),
      file(".ai/agent-instructions/session-protocol.md", "session"),
    ];
    const toc = buildToc(files);
    const lines = toc.split("\n").slice(1);
    const keys = lines.map((l) => l.replace(/^[├└]── /, "").split(" ")[0]);
    expect(keys[0]).toBe("agent-instructions/");
    expect(keys[keys.length - 1]).not.toMatch(/\/$/);
  });

  it("excludes non-.ai/ files", () => {
    const files = [
      file("CLAUDE.md", "entry point"),
      file(".claude/settings.json"),
      file(".ai/README.md", "index"),
    ];
    const toc = buildToc(files);
    expect(toc).not.toContain("CLAUDE.md");
    expect(toc).not.toContain("settings.json");
    expect(toc).toContain("README.md");
  });

  it("returns only root header when no .ai/ files", () => {
    const toc = buildToc([file("CLAUDE.md")]);
    expect(toc.trim()).toBe(".ai/");
  });
});
