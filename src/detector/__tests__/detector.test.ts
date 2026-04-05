import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectStack } from "../index.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

describe("detectStack — languages", () => {
  it("detects TypeScript from tsconfig.json + package.json", async () => {
    write("package.json", JSON.stringify({ name: "test" }));
    write("tsconfig.json", "{}");
    const report = await detectStack(dir);
    expect(report.languages).toContain("typescript");
    expect(report.languages).not.toContain("javascript");
  });

  it("detects JavaScript when package.json exists without tsconfig", async () => {
    write("package.json", JSON.stringify({ name: "test" }));
    const report = await detectStack(dir);
    expect(report.languages).toContain("javascript");
  });

  it("detects Python from pyproject.toml", async () => {
    write("pyproject.toml", "[build-system]\n");
    const report = await detectStack(dir);
    expect(report.languages).toContain("python");
  });

  it("detects Python from requirements.txt", async () => {
    write("requirements.txt", "fastapi\n");
    const report = await detectStack(dir);
    expect(report.languages).toContain("python");
  });

  it("detects Rust from Cargo.toml", async () => {
    write("Cargo.toml", "[package]\nname = \"myapp\"\n");
    const report = await detectStack(dir);
    expect(report.languages).toContain("rust");
  });

  it("detects Go from go.mod", async () => {
    write("go.mod", "module example.com/myapp\n");
    const report = await detectStack(dir);
    expect(report.languages).toContain("go");
  });

  it("detects Java from pom.xml", async () => {
    write("pom.xml", "<project></project>");
    const report = await detectStack(dir);
    expect(report.languages).toContain("java");
  });
});

describe("detectStack — frameworks", () => {
  it("detects React from package.json dependencies", async () => {
    write("package.json", JSON.stringify({ dependencies: { react: "^18.0.0" } }));
    const report = await detectStack(dir);
    expect(report.frameworks).toContain("react");
  });

  it("detects Next.js", async () => {
    write("package.json", JSON.stringify({ dependencies: { next: "^14.0.0" } }));
    const report = await detectStack(dir);
    expect(report.frameworks).toContain("next");
  });

  it("detects FastAPI from requirements.txt", async () => {
    write("requirements.txt", "fastapi==0.100.0\nuvicorn\n");
    const report = await detectStack(dir);
    expect(report.frameworks).toContain("fastapi");
  });

  it("detects Express from devDependencies", async () => {
    write("package.json", JSON.stringify({ devDependencies: { express: "^4.0.0" } }));
    const report = await detectStack(dir);
    expect(report.frameworks).toContain("express");
  });
});

describe("detectStack — linters", () => {
  it("detects Biome from biome.json", async () => {
    write("biome.json", "{}");
    const report = await detectStack(dir);
    expect(report.existingLinters).toContain("biome");
  });

  it("detects ESLint from eslint.config.js", async () => {
    write("eslint.config.js", "export default [];");
    const report = await detectStack(dir);
    expect(report.existingLinters).toContain("eslint");
  });

  it("detects Prettier from .prettierrc", async () => {
    write(".prettierrc", "{}");
    const report = await detectStack(dir);
    expect(report.existingLinters).toContain("prettier");
  });

  it("detects Ruff from ruff.toml", async () => {
    write("ruff.toml", "[lint]\n");
    const report = await detectStack(dir);
    expect(report.existingLinters).toContain("ruff");
  });

  it("detects golangci-lint from .golangci.yml", async () => {
    write(".golangci.yml", "linters:\n  enable-all: false\n");
    const report = await detectStack(dir);
    expect(report.existingLinters).toContain("golangci-lint");
  });

  it("returns no linters for empty project", async () => {
    const report = await detectStack(dir);
    expect(report.existingLinters).toHaveLength(0);
  });
});

describe("detectStack — test framework", () => {
  it("detects vitest from vitest.config.ts", async () => {
    write("vitest.config.ts", "export default {};");
    const report = await detectStack(dir);
    expect(report.testFramework).toBe("vitest");
  });

  it("detects vitest from package.json devDependencies", async () => {
    write("package.json", JSON.stringify({ devDependencies: { vitest: "^4.0.0" } }));
    const report = await detectStack(dir);
    expect(report.testFramework).toBe("vitest");
  });

  it("detects pytest from conftest.py", async () => {
    write("conftest.py", "");
    const report = await detectStack(dir);
    expect(report.testFramework).toBe("pytest");
  });

  it("detects cargo-test for Rust projects", async () => {
    write("Cargo.toml", "[package]\nname = \"test\"\n");
    const report = await detectStack(dir);
    expect(report.testFramework).toBe("cargo-test");
  });

  it("returns null when no test framework detected", async () => {
    const report = await detectStack(dir);
    expect(report.testFramework).toBeNull();
  });
});

describe("detectStack — build system", () => {
  it("detects pnpm from pnpm-lock.yaml", async () => {
    write("pnpm-lock.yaml", "");
    write("package.json", "{}");
    const report = await detectStack(dir);
    expect(report.buildSystem).toBe("pnpm");
    expect(report.packageManager).toBe("pnpm");
  });

  it("detects cargo from Cargo.toml", async () => {
    write("Cargo.toml", "[package]\n");
    const report = await detectStack(dir);
    expect(report.buildSystem).toBe("cargo");
  });

  it("detects maven from pom.xml", async () => {
    write("pom.xml", "<project/>");
    const report = await detectStack(dir);
    expect(report.buildSystem).toBe("maven");
  });
});

describe("detectStack — monorepo", () => {
  it("detects monorepo from package.json workspaces", async () => {
    write("package.json", JSON.stringify({ workspaces: ["packages/*"] }));
    const report = await detectStack(dir);
    expect(report.isMonorepo).toBe(true);
    expect(report.projectType).toBe("monorepo");
  });

  it("detects monorepo from pnpm-workspace.yaml", async () => {
    write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    const report = await detectStack(dir);
    expect(report.isMonorepo).toBe(true);
  });
});

describe("detectStack — project type", () => {
  it("infers web-app for React projects", async () => {
    write("package.json", JSON.stringify({ dependencies: { react: "^18.0.0" } }));
    const report = await detectStack(dir);
    expect(report.projectType).toBe("web-app");
  });

  it("infers cli when bin is defined", async () => {
    write("package.json", JSON.stringify({ bin: { mytool: "./dist/cli.js" } }));
    const report = await detectStack(dir);
    expect(report.projectType).toBe("cli");
  });

  it("infers mobile for react-native projects", async () => {
    write("package.json", JSON.stringify({ dependencies: { "react-native": "^0.73.0" } }));
    const report = await detectStack(dir);
    expect(report.projectType).toBe("mobile");
  });
});
