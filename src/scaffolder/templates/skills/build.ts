import type { TemplateContext } from "../../types.js";

export function buildSkill(_ctx: TemplateContext): string {
  return `# /build

> **Skill stub** — full implementation ships in a future release.

Guided feature implementation following the harness session protocol.

## Usage

\`/build <description>\`

## What it does

Walks through planning, implementation, testing, and finalization for a
described feature, following the steps in \`.ai/agent-instructions/session-protocol.md\`.
`;
}
