import { buildToc } from "../../toc.js";
import type { ScaffoldedFile, TemplateContext } from "../../types.js";

export function claudeMd(ctx: TemplateContext, files: ScaffoldedFile[]): string {
  const stacks = ctx.stacks.length ? ctx.stacks.join(", ") : "not detected";
  const linearLine = ctx.features.linearIntegration
    ? `\n- **Linear:** fetch ticket context via branch name (e.g. \`${ctx.linearTeamKey.toLowerCase()}-42-<description>\`)`
    : "";

  const toc = buildToc(files);

  return `# ${ctx.projectName}

> **Project type:** ${ctx.projectType} | **Stack:** ${stacks}

## Quick Commands

| Task | Command |
|------|---------|
| Build | \`${ctx.buildCommand || "# not configured"}\` |
| Test | \`${ctx.testCommand || "# not configured"}\` |
| Lint | \`${ctx.lintCommand || "# not configured"}\` |
| Type Check | \`${ctx.typeCheckCommand || "# not configured"}\` |

## Conventions

- **Commits:** \`type(scope): subject\` (conventional commits)
- **Branches:** \`<ticket-id>-<description>\` (e.g. \`tri-42-add-auth\`)${linearLine}

## Constraints

<!-- Add project-specific constraints, gotchas, and non-obvious rules here -->

## Agent Documentation

${toc}
`;
}
