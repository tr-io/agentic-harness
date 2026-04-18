import type { TemplateContext } from "../../types.js";

export function designDocsReadme(_ctx: TemplateContext): string {
  return `# Design Documents

Design documents and core beliefs for this project.

## Purpose

Store technical design docs (TDDs), RFCs, and architectural proposals here. Each doc should explain the problem, the considered alternatives, and the chosen approach.

## Naming Convention

\`YYYY-MM-DD-<short-title>.md\` — e.g. \`2025-01-15-auth-redesign.md\`
`;
}
