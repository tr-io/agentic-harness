import type { TemplateContext } from "../../types.js";

export function productSpecsReadme(_ctx: TemplateContext): string {
  return `# Product Specifications

Product requirements documents (PRDs) and feature specifications.

## Purpose

Store detailed feature specs here. Each spec should include: problem statement, user stories, acceptance criteria, and out-of-scope items.

## Naming Convention

\`<feature-name>.md\` — e.g. \`user-auth.md\`, \`billing-flow.md\`
`;
}
