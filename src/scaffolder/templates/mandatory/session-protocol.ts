import type { TemplateContext } from "../../types.js";

export function sessionProtocol(ctx: TemplateContext): string {
  const linearStep = ctx.features.linearIntegration
    ? `   └── If working on a ticket: fetch Linear ticket details (branch name contains ticket ID)`
    : "";
  const linearBranch = ctx.features.linearIntegration
    ? `   ├── If Linear enabled: fetch ticket → update status → In Progress`
    : "";

  return `# Session Protocol

Every agent session MUST follow this lifecycle. No exceptions.

## 1. ORIENT

\`\`\`
1. Read CLAUDE.md (always)
2. Run: git log --oneline -10
3. Read .ai/agent-instructions/session-protocol.md (this file)
${linearStep}
\`\`\`

**Goal:** Understand what was done before, what branch you're on, what the task is.

## 2. VERIFY BASELINE

\`\`\`
1. Run the test command: ${ctx.testCommand || "<testCommand from .harness.json>"}
2. Run the lint command: ${ctx.lintCommand || "<lintCommand from .harness.json>"}
3. If failures found: fix BEFORE proceeding (or flag to user)
\`\`\`

**Goal:** Never build on a broken baseline. Compounding bugs across sessions is a top failure mode.

## 3. PLAN

\`\`\`
1. Identify the SINGLE task for this session
2. If the task is too large: propose a split to the user before implementing
3. Create branch: <ticket-id>-<description>
${linearBranch}
4. Outline implementation approach in 3-5 bullets
\`\`\`

**One task per session.** This prevents context exhaustion and maintains recoverability.

## 4. IMPLEMENT

\`\`\`
1. Make incremental changes
2. Commit atomically: one logical change per commit
3. Follow conventional commits: type(scope): subject
   Types: feat | fix | docs | style | refactor | test | chore | perf
\`\`\`

## 5. TEST

\`\`\`
1. Run unit tests for changed code: ${ctx.testCommand || "<testCommand>"}
2. Run lint + type check: ${ctx.lintCommand || "<lintCommand>"} && ${ctx.typeCheckCommand || "<typeCheckCommand>"}
3. If browser/UI involved: test via automation if available
\`\`\`

## 6. FINALIZE

\`\`\`
1. Run self-review checklist (see .ai/agent-instructions/pre-push.md)
2. Update .ai/ docs if architecture or patterns changed
3. Push to remote (pre-push hook enforces quality)
4. Create PR with: implementation plan, acceptance criteria, Linear ticket link
\`\`\`

---

## Anti-Patterns to Avoid

- ❌ Skipping baseline verification — you WILL compound broken state
- ❌ Working on multiple tasks in one session — context exhaustion
- ❌ Committing placeholder/stub implementations
- ❌ Skipping tests because "it's just a small change"
- ❌ Pushing without running the pre-push checklist
`;
}
