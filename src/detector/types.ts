export type ProjectType = "web-app" | "cli" | "library" | "monorepo" | "mobile";

export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "ruby"
  | "csharp"
  | "cpp"
  | "swift"
  | "kotlin";

export type Framework =
  | "react"
  | "next"
  | "vue"
  | "svelte"
  | "angular"
  | "express"
  | "fastify"
  | "hono"
  | "fastapi"
  | "django"
  | "flask"
  | "spring"
  | "electron"
  | "react-native"
  | "expo";

export type Linter =
  | "biome"
  | "eslint"
  | "prettier"
  | "ruff"
  | "flake8"
  | "pylint"
  | "clippy"
  | "golangci-lint"
  | "checkstyle"
  | "rubocop"
  | "standardrb";

export type TestFramework =
  | "vitest"
  | "jest"
  | "mocha"
  | "pytest"
  | "cargo-test"
  | "go-test"
  | "junit"
  | "rspec";

export type BuildSystem =
  | "npm"
  | "pnpm"
  | "bun"
  | "cargo"
  | "go"
  | "gradle"
  | "maven"
  | "make"
  | "rake";

export interface PackageJson {
  main?: string;
  exports?: string | Record<string, unknown>;
  bin?: string | Record<string, string>;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface StackReport {
  projectType: ProjectType;
  languages: Language[];
  frameworks: Framework[];
  existingLinters: Linter[];
  testFramework: TestFramework | null;
  buildSystem: BuildSystem | null;
  entryPoints: string[];
  isMonorepo: boolean;
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | null;
}
