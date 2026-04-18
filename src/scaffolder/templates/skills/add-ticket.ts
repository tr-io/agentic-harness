import type { TemplateContext } from "../../types.js";

export function addTicketSkill(_ctx: TemplateContext): string {
  return `# /add-ticket

> **Skill stub** — full implementation ships in a future release.

Create a Linear ticket from the current conversation context.

## Usage

\`/add-ticket\`

## What it does

Reads the current conversation, extracts a title, description, and acceptance
criteria, then creates a Linear ticket in the configured team.

## Configuration

Requires \`integrations.linear.enabled: true\` in \`.harness.json\`.
`;
}
