import type { TemplateContext } from "../../types.js";

export function prePush(ctx: TemplateContext): string {
  const lintLine = ctx.lintCommand ? `- [ ] \`${ctx.lintCommand}\` passes` : "- [ ] Lint passes";
  const typeLine = ctx.typeCheckCommand
    ? `- [ ] \`${ctx.typeCheckCommand}\` passes`
    : "- [ ] Type check passes";
  const testLine = ctx.testCommand
    ? `- [ ] \`${ctx.testCommand}\` passes`
    : "- [ ] Tests pass";
  const linearStatus = ctx.features.linearIntegration
    ? "\n- [ ] Linear ticket status updated to **In Review**"
    : "";

  return `# Pre-Push Checklist

Run this BEFORE every push. The pre-push hook enforces the quality checks automatically,
but this checklist ensures you don't miss anything else.

## Quality Gates (enforced by hook — will block push on failure)

${lintLine}
${typeLine}
${testLine}

## Self-Review (your responsibility)

- [ ] All acceptance criteria from ticket are met
- [ ] No placeholder or stub implementations — full implementations only
- [ ] No commented-out code left behind
- [ ] No hardcoded secrets, credentials, or local paths
- [ ] Tests cover the happy path and primary edge cases
- [ ] Commit messages follow conventional format: \`type(scope): subject\`

## Documentation

- [ ] If architecture or patterns changed: update relevant \`.ai/codebase/\` docs
- [ ] If domain model changed: update relevant \`.ai/ddd/\` docs (if applicable)
- [ ] If new ADR warranted: write it in \`.ai/adr/\` before merging${linearStatus}

## PR Format

Title: \`[TICKET-ID] Brief description\`

Body should include:
- Implementation plan / approach
- Acceptance criteria checklist
- Link to Linear ticket (if applicable)

---

The pre-push hook runs quality gates automatically. This checklist is for the
items that can't be automated: completeness, correctness, and documentation.
`;
}
