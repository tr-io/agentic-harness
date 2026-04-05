#!/usr/bin/env node

// src/detector/index.ts
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
function fileExists(dir, ...parts) {
  return existsSync(join(dir, ...parts));
}
function readJson(dir, ...parts) {
  const path = join(dir, ...parts);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
function listDir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
function detectLanguages(dir) {
  const langs = /* @__PURE__ */ new Set();
  if (fileExists(dir, "package.json")) {
    const pkg = readJson(dir, "package.json");
    if (fileExists(dir, "tsconfig.json") || pkg?.devDependencies?.typescript || pkg?.dependencies?.typescript) {
      langs.add("typescript");
    } else {
      langs.add("javascript");
    }
  }
  if (fileExists(dir, "Cargo.toml")) langs.add("rust");
  if (fileExists(dir, "go.mod")) langs.add("go");
  if (fileExists(dir, "pyproject.toml") || fileExists(dir, "setup.py") || fileExists(dir, "requirements.txt")) {
    langs.add("python");
  }
  if (fileExists(dir, "pom.xml") || fileExists(dir, "build.gradle") || fileExists(dir, "build.gradle.kts")) {
    langs.add("java");
  }
  if (fileExists(dir, "Gemfile")) langs.add("ruby");
  if (fileExists(dir, "Package.swift")) langs.add("swift");
  if (langs.size === 0) {
    const files = listDir(join(dir, "src")).concat(listDir(dir));
    if (files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) langs.add("typescript");
    else if (files.some((f) => f.endsWith(".js") || f.endsWith(".jsx"))) langs.add("javascript");
    if (files.some((f) => f.endsWith(".py"))) langs.add("python");
    if (files.some((f) => f.endsWith(".rs"))) langs.add("rust");
    if (files.some((f) => f.endsWith(".go"))) langs.add("go");
  }
  return Array.from(langs);
}
function detectFrameworks(dir) {
  const pkg = readJson(dir, "package.json");
  const allDeps = {
    ...pkg?.dependencies,
    ...pkg?.devDependencies,
    ...pkg?.peerDependencies
  };
  const frameworks = /* @__PURE__ */ new Set();
  const depMap = {
    react: "react",
    next: "next",
    "next.js": "next",
    vue: "vue",
    svelte: "svelte",
    "@angular/core": "angular",
    express: "express",
    fastify: "fastify",
    hono: "hono",
    electron: "electron",
    "react-native": "react-native",
    expo: "expo"
  };
  for (const [dep, framework] of Object.entries(depMap)) {
    if (allDeps[dep]) frameworks.add(framework);
  }
  if (fileExists(dir, "pyproject.toml")) {
    const content = readFileSync(join(dir, "pyproject.toml"), "utf-8");
    if (content.includes("fastapi")) frameworks.add("fastapi");
    if (content.includes("django")) frameworks.add("django");
    if (content.includes("flask")) frameworks.add("flask");
  }
  if (fileExists(dir, "requirements.txt")) {
    const content = readFileSync(join(dir, "requirements.txt"), "utf-8").toLowerCase();
    if (content.includes("fastapi")) frameworks.add("fastapi");
    if (content.includes("django")) frameworks.add("django");
    if (content.includes("flask")) frameworks.add("flask");
  }
  if (fileExists(dir, "pom.xml")) {
    const content = readFileSync(join(dir, "pom.xml"), "utf-8");
    if (content.includes("spring-boot")) frameworks.add("spring");
  }
  if (fileExists(dir, "build.gradle")) {
    const content = readFileSync(join(dir, "build.gradle"), "utf-8");
    if (content.includes("spring-boot")) frameworks.add("spring");
  }
  return Array.from(frameworks);
}
function detectLinters(dir) {
  const linters = /* @__PURE__ */ new Set();
  const linterFiles = [
    ["biome.json", "biome"],
    [["biome.jsonc"], "biome"],
    [".eslintrc", "eslint"],
    [".eslintrc.js", "eslint"],
    [".eslintrc.json", "eslint"],
    [".eslintrc.cjs", "eslint"],
    ["eslint.config.js", "eslint"],
    ["eslint.config.mjs", "eslint"],
    [".prettierrc", "prettier"],
    [".prettierrc.json", "prettier"],
    ["prettier.config.js", "prettier"],
    ["ruff.toml", "ruff"],
    [".ruff.toml", "ruff"],
    [".flake8", "flake8"],
    [".rubocop.yml", "rubocop"],
    [".golangci.yml", "golangci-lint"],
    [".golangci.yaml", "golangci-lint"],
    ["checkstyle.xml", "checkstyle"]
  ];
  for (const [file, linter] of linterFiles) {
    const files = Array.isArray(file) ? file : [file];
    if (files.some((f) => fileExists(dir, f))) linters.add(linter);
  }
  const pkg = readJson(dir, "package.json");
  const allDeps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (allDeps["@biomejs/biome"]) linters.add("biome");
  if (allDeps.eslint) linters.add("eslint");
  if (allDeps.prettier) linters.add("prettier");
  if (fileExists(dir, "pyproject.toml")) {
    const content = readFileSync(join(dir, "pyproject.toml"), "utf-8");
    if (content.includes("[tool.ruff]")) linters.add("ruff");
  }
  return Array.from(linters);
}
function detectTestFramework(dir) {
  const testFiles = [
    ["vitest.config.ts", "vitest"],
    ["vitest.config.js", "vitest"],
    ["vitest.config.mts", "vitest"],
    ["jest.config.ts", "jest"],
    ["jest.config.js", "jest"],
    ["jest.config.cjs", "jest"],
    [".mocharc.js", "mocha"],
    [".mocharc.yml", "mocha"],
    ["pytest.ini", "pytest"],
    ["conftest.py", "pytest"],
    ["spec/spec_helper.rb", "rspec"]
  ];
  for (const [file, framework] of testFiles) {
    if (fileExists(dir, file)) return framework;
  }
  const pkg = readJson(dir, "package.json");
  const allDeps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (allDeps.vitest) return "vitest";
  if (allDeps.jest || allDeps["@jest/core"]) return "jest";
  if (allDeps.mocha) return "mocha";
  if (fileExists(dir, "pyproject.toml")) {
    const content = readFileSync(join(dir, "pyproject.toml"), "utf-8");
    if (content.includes("[tool.pytest")) return "pytest";
  }
  if (fileExists(dir, "Cargo.toml")) return "cargo-test";
  if (fileExists(dir, "go.mod")) return "go-test";
  if (fileExists(dir, "pom.xml") || fileExists(dir, "build.gradle")) return "junit";
  return null;
}
function detectBuildSystem(dir) {
  if (fileExists(dir, "Cargo.toml")) return "cargo";
  if (fileExists(dir, "go.mod")) return "go";
  if (fileExists(dir, "pom.xml")) return "maven";
  if (fileExists(dir, "build.gradle") || fileExists(dir, "build.gradle.kts")) return "gradle";
  if (fileExists(dir, "Makefile")) return "make";
  if (fileExists(dir, "Rakefile")) return "rake";
  if (fileExists(dir, "bun.lock") || fileExists(dir, "bun.lockb")) return "bun";
  if (fileExists(dir, "pnpm-lock.yaml")) return "pnpm";
  if (fileExists(dir, "package.json")) return "npm";
  return null;
}
function detectPackageManager(dir) {
  if (fileExists(dir, "bun.lock") || fileExists(dir, "bun.lockb")) return "bun";
  if (fileExists(dir, "pnpm-lock.yaml")) return "pnpm";
  if (fileExists(dir, "yarn.lock")) return "yarn";
  if (fileExists(dir, "package-lock.json")) return "npm";
  if (fileExists(dir, "package.json")) return "npm";
  return null;
}
function detectEntryPoints(dir, languages) {
  const candidates = [];
  const isNode = languages.includes("typescript") || languages.includes("javascript");
  if (isNode) {
    const pkg = readJson(dir, "package.json");
    if (pkg?.main) candidates.push(pkg.main);
    if (typeof pkg?.exports === "string") candidates.push(pkg.exports);
    if (pkg?.bin) {
      if (typeof pkg.bin === "string") candidates.push(pkg.bin);
      else candidates.push(...Object.values(pkg.bin));
    }
    const common = [
      "src/index.ts",
      "src/index.js",
      "src/main.ts",
      "src/main.js",
      "src/app.ts",
      "src/app.js",
      "src/cli.ts",
      "src/cli.js",
      "index.ts",
      "index.js"
    ];
    for (const f of common) {
      if (fileExists(dir, f) && !candidates.includes(f)) candidates.push(f);
    }
  }
  if (languages.includes("python")) {
    const pyEntries = ["main.py", "app.py", "src/main.py", "src/app.py", "__main__.py"];
    for (const f of pyEntries) {
      if (fileExists(dir, f)) candidates.push(f);
    }
  }
  if (languages.includes("rust")) {
    if (fileExists(dir, "src/main.rs")) candidates.push("src/main.rs");
    if (fileExists(dir, "src/lib.rs")) candidates.push("src/lib.rs");
  }
  if (languages.includes("go")) {
    if (fileExists(dir, "main.go")) candidates.push("main.go");
    if (fileExists(dir, "cmd")) {
      const cmds = listDir(join(dir, "cmd"));
      for (const cmd of cmds) candidates.push(`cmd/${cmd}/main.go`);
    }
  }
  return candidates.slice(0, 5);
}
function detectIsMonorepo(dir) {
  const pkg = readJson(dir, "package.json");
  if (pkg?.workspaces) return true;
  if (fileExists(dir, "pnpm-workspace.yaml")) return true;
  if (fileExists(dir, "lerna.json")) return true;
  if (fileExists(dir, "nx.json")) return true;
  if (fileExists(dir, "turbo.json")) return true;
  const dirs = listDir(dir).filter((d) => !d.startsWith(".") && d !== "node_modules");
  const subPkgs = dirs.filter((d) => fileExists(dir, d, "package.json"));
  return subPkgs.length >= 2;
}
function inferProjectType(frameworks, languages, isMonorepo, dir) {
  if (isMonorepo) return "monorepo";
  if (frameworks.includes("react-native") || frameworks.includes("expo")) return "mobile";
  if (frameworks.includes("react") || frameworks.includes("next") || frameworks.includes("vue") || frameworks.includes("svelte") || frameworks.includes("angular") || frameworks.includes("fastapi") || frameworks.includes("django") || frameworks.includes("flask") || frameworks.includes("spring") || frameworks.includes("express") || frameworks.includes("fastify") || frameworks.includes("hono")) {
    return "web-app";
  }
  const pkg = readJson(dir, "package.json");
  if (pkg?.bin) return "cli";
  if (languages.includes("rust") && fileExists(dir, "src/main.rs")) return "cli";
  return "library";
}
async function detectStack(dir) {
  const languages = detectLanguages(dir);
  const frameworks = detectFrameworks(dir);
  const existingLinters = detectLinters(dir);
  const testFramework = detectTestFramework(dir);
  const buildSystem = detectBuildSystem(dir);
  const packageManager = detectPackageManager(dir);
  const entryPoints = detectEntryPoints(dir, languages);
  const isMonorepo = detectIsMonorepo(dir);
  const projectType = inferProjectType(frameworks, languages, isMonorepo, dir);
  return {
    projectType,
    languages,
    frameworks,
    existingLinters,
    testFramework,
    buildSystem,
    entryPoints,
    isMonorepo,
    packageManager
  };
}

export {
  detectStack
};
//# sourceMappingURL=chunk-GE2FWTDY.js.map