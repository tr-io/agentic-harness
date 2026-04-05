import type { Language } from "../../detector/types.js";

export interface LinterTemplate {
  filename: string;
  content: string;
  lintCommand: string;
  formatCommand?: string;
}

export const linterTemplates: Partial<Record<Language, LinterTemplate>> = {
  typescript: {
    filename: "biome.json",
    lintCommand: "npx biome check .",
    formatCommand: "npx biome format --write .",
    content: JSON.stringify(
      {
        $schema: "https://biomejs.dev/schemas/1.9.4/schema.json",
        organizeImports: { enabled: true },
        linter: { enabled: true, rules: { recommended: true } },
        formatter: { enabled: true, indentStyle: "space", indentWidth: 2, lineWidth: 100 },
        javascript: { formatter: { quoteStyle: "double", trailingCommas: "all" } },
        files: { ignore: ["dist/**", "node_modules/**", "build/**"] },
      },
      null,
      2,
    ),
  },
  javascript: {
    filename: "biome.json",
    lintCommand: "npx biome check .",
    formatCommand: "npx biome format --write .",
    content: JSON.stringify(
      {
        $schema: "https://biomejs.dev/schemas/1.9.4/schema.json",
        organizeImports: { enabled: true },
        linter: { enabled: true, rules: { recommended: true } },
        formatter: { enabled: true, indentStyle: "space", indentWidth: 2 },
        files: { ignore: ["dist/**", "node_modules/**"] },
      },
      null,
      2,
    ),
  },
  python: {
    filename: "ruff.toml",
    lintCommand: "ruff check .",
    formatCommand: "ruff format .",
    content: `# Ruff configuration — https://docs.astral.sh/ruff/
line-length = 100
target-version = "py312"

[lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM"]
ignore = ["E501"]

[format]
quote-style = "double"
indent-style = "space"
`,
  },
  rust: {
    filename: "rustfmt.toml",
    lintCommand: "cargo clippy -- -D warnings",
    formatCommand: "cargo fmt",
    content: `edition = "2021"
max_width = 100
tab_spaces = 4
`,
  },
  go: {
    filename: ".golangci.yml",
    lintCommand: "golangci-lint run",
    content: `# golangci-lint configuration
run:
  timeout: 5m

linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - unused
    - gofmt
    - goimports

linters-settings:
  gofmt:
    simplify: true
`,
  },
  java: {
    filename: "checkstyle.xml",
    lintCommand: "mvn checkstyle:check",
    content: `<?xml version="1.0"?>
<!DOCTYPE module PUBLIC
    "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
    "https://checkstyle.org/dtds/configuration_1_3.dtd">
<module name="Checker">
  <property name="severity" value="error"/>
  <module name="TreeWalker">
    <module name="NeedBraces"/>
    <module name="WhitespaceAround"/>
    <module name="EmptyLineSeparator"/>
    <module name="UnusedImports"/>
  </module>
</module>
`,
  },
  ruby: {
    filename: ".rubocop.yml",
    lintCommand: "rubocop",
    formatCommand: "rubocop -A",
    content: `AllCops:
  NewCops: enable
  TargetRubyVersion: 3.2
  Exclude:
    - 'vendor/**/*'
    - 'db/schema.rb'

Layout/LineLength:
  Max: 120

Style/Documentation:
  Enabled: false
`,
  },
};
