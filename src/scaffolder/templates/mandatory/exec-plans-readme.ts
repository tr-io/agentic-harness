import type { TemplateContext } from "../../types.js";

export function execPlansReadme(_ctx: TemplateContext): string {
  return `# Execution Plans

Active and completed execution plans for this project.

## Structure

- \`active/\` — plans currently in progress
- \`completed/\` — finished plans (for reference and post-mortems)

## Naming Convention

\`<ticket-id>-<short-title>.md\` — e.g. \`tri-42-auth-redesign.md\`
`;
}
