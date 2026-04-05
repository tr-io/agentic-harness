import type { TemplateContext } from "../../types.js";

export function aiReadme(ctx: TemplateContext): string {
  const optional: string[] = [];
  if (ctx.features.dddContextMaps) optional.push("- `ddd/` — domain-driven design context maps");
  if (ctx.features.latMd) optional.push("- `lat.md` — knowledge graph (see lat.md docs)");

  return `# .ai/ — Agent Context Index

This directory is the single source of truth for agent context.
Agents follow links on demand — nothing here is loaded automatically except CLAUDE.md.

## Contents

### agent-instructions/
Instructions agents follow at each lifecycle stage.
- [session-protocol.md](agent-instructions/session-protocol.md) — full session lifecycle
- [pre-plan.md](agent-instructions/pre-plan.md) — before starting any work
- [pre-push.md](agent-instructions/pre-push.md) — before every push

### codebase/
Navigation maps for the ${ctx.projectName} codebase.
Add one file per major module/subsystem describing structure, entry points, and key abstractions.
${ctx.features.adr ? "\n### adr/\nArchitecture decision records. See [adr/README.md](adr/README.md) for format.\n" : ""}${ctx.features.testingDocs ? "\n### testing/\nTesting conventions and coverage map. See [testing/conventions.md](testing/conventions.md).\n" : ""}${optional.length ? `\n${optional.join("\n")}\n` : ""}
### manifest.json
Maps source paths to the docs that cover them.
Used by the artifact freshness hook to detect stale documentation.
`;
}
