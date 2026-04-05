import type { TemplateContext } from "../../types.js";

export function claudeMd(ctx: TemplateContext): string {
  const stacks = ctx.stacks.length ? ctx.stacks.join(", ") : "not detected";
  const adrLine = ctx.features.adr ? "\n- [ADRs](.ai/adr/) for architectural decisions" : "";
  const testingLine = ctx.features.testingDocs
    ? "\n- [Testing conventions](.ai/testing/conventions.md)"
    : "";
  const linearLine = ctx.features.linearIntegration
    ? `\n- **Linear:** fetch ticket context via branch name (e.g. \`${ctx.linearTeamKey.toLowerCase()}-42-<description>\`)`
    : "";

  return `# ${ctx.projectName}

> **Project type:** ${ctx.projectType} | **Stack:** ${stacks}

## Quick Reference

| Task | Command |
|------|---------|
| Build | \`${ctx.buildCommand || "# not configured"}\` |
| Test | \`${ctx.testCommand || "# not configured"}\` |
| Lint | \`${ctx.lintCommand || "# not configured"}\` |
| Type Check | \`${ctx.typeCheckCommand || "# not configured"}\` |

## Architecture

See [.ai/codebase/](.ai/codebase/) for navigation maps.

## Agent Instructions

See [.ai/agent-instructions/](.ai/agent-instructions/) for:
- [Session protocol](.ai/agent-instructions/session-protocol.md) — orient → verify → plan → implement → test → finalize
- [Pre-plan workflow](.ai/agent-instructions/pre-plan.md) — branch creation, ticket lookup
- [Pre-push checklist](.ai/agent-instructions/pre-push.md) — before every push

## Conventions

- **Commits:** \`type(scope): subject\` (conventional commits)
- **Branches:** \`<ticket-id>-<description>\` (e.g. \`tri-42-add-auth\`)${adrLine}${testingLine}${linearLine}

## Constraints

<!-- Add project-specific constraints, gotchas, and non-obvious rules here -->

## Resources

- [.ai/README.md](.ai/README.md) — index of all agent context docs
`;
}
