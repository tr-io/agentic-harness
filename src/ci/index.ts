import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HarnessConfig } from "../config/types.js";
import type { StackReport } from "../detector/types.js";

export function generateCiWorkflow(config: HarnessConfig, stack: StackReport): string {
  const steps: string[] = [];
  const stacks = stack.languages;

  // Setup steps
  if (stacks.includes("typescript") || stacks.includes("javascript")) {
    steps.push(
      `      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: '${stack.packageManager ?? "npm"}'`,
      `      - name: Install dependencies
        run: ${stack.packageManager === "pnpm" ? "pnpm install --frozen-lockfile" : stack.packageManager === "bun" ? "bun install" : "npm install"}`,
    );
  }

  if (stacks.includes("python")) {
    steps.push(
      `      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'`,
      `      - name: Install dependencies
        run: pip install -r requirements.txt`,
    );
  }

  if (stacks.includes("rust")) {
    steps.push(
      `      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable`,
      `      - name: Cache Cargo
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: \${{ runner.os }}-cargo-\${{ hashFiles('**/Cargo.lock') }}`,
    );
  }

  if (stacks.includes("go")) {
    steps.push(
      `      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache: true`,
    );
  }

  if (stacks.includes("java")) {
    steps.push(
      `      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: ${existsSync(join(process.cwd(), "build.gradle")) ? "gradle" : "maven"}`,
    );
  }

  // Lint step
  if (config.project.lintCommand) {
    steps.push(
      `      - name: Lint
        run: ${config.project.lintCommand}`,
    );
  }

  // Type check step
  if (config.project.typeCheckCommand) {
    steps.push(
      `      - name: Type check
        run: ${config.project.typeCheckCommand}`,
    );
  }

  // Test step
  if (config.project.testCommand) {
    steps.push(
      `      - name: Test
        run: ${config.project.testCommand}`,
    );
  }

  // Build step
  if (config.project.buildCommand) {
    steps.push(
      `      - name: Build
        run: ${config.project.buildCommand}`,
    );
  }

  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

${steps.join("\n\n")}
`;
}

export function scaffoldCiWorkflow(
  projectDir: string,
  config: HarnessConfig,
  stack: StackReport,
): { created: boolean; path: string } {
  const workflowDir = join(projectDir, ".github", "workflows");

  // Skip if any CI workflow already exists
  if (existsSync(workflowDir)) {
    try {
      const existing = readdirSync(workflowDir).filter(
        (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
      );
      if (existing.length > 0) {
        return { created: false, path: join(workflowDir, existing[0]) };
      }
    } catch { /* continue */ }
  }

  const content = generateCiWorkflow(config, stack);
  mkdirSync(workflowDir, { recursive: true });
  const path = join(workflowDir, "ci.yml");
  writeFileSync(path, content, "utf-8");
  return { created: true, path };
}
