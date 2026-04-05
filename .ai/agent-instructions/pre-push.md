# Pre-Push Checklist

Run this BEFORE every push. The pre-push hook enforces the quality checks automatically,
but this checklist ensures you don't miss anything else.

## Quality Gates (enforced by hook — will block push on failure)

- [ ] `npx biome check .` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes

## Self-Review (your responsibility)

- [ ] All acceptance criteria from ticket are met
- [ ] No placeholder or stub implementations — full implementations only
- [ ] No commented-out code left behind
- [ ] No hardcoded secrets, credentials, or local paths
- [ ] Tests cover the happy path and primary edge cases
- [ ] Commit messages follow conventional format: `type(scope): subject`

## Documentation

- [ ] If architecture or patterns changed: update relevant `.ai/codebase/` docs
- [ ] If domain model changed: update relevant `.ai/ddd/` docs (if applicable)
- [ ] If new ADR warranted: write it in `.ai/adr/` before merging
- [ ] Linear ticket status updated to **In Review**

## PR Format

Title: `[TICKET-ID] Brief description`

Body should include:
- Implementation plan / approach
- Acceptance criteria checklist
- Link to Linear ticket (if applicable)

---

The pre-push hook runs quality gates automatically. This checklist is for the
items that can't be automated: completeness, correctness, and documentation.
