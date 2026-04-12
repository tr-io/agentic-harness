# agentic-harness

> **Project type:** cli | **Stack:** typescript

## Quick Reference

| Task | Command |
|------|---------|
| Build | `npm run build` |
| Test | `npm test` |
| Lint | `npx biome check .` |
| Type Check | `npx tsc --noEmit` |

## Architecture

See [.ai/codebase/](.ai/codebase/) for navigation maps.

## Agent Instructions

See [.ai/agent-instructions/](.ai/agent-instructions/) for:
- [Session protocol](.ai/agent-instructions/session-protocol.md) — orient → verify → plan → implement → test → finalize
- [Pre-plan workflow](.ai/agent-instructions/pre-plan.md) — branch creation, ticket lookup
- [Pre-push checklist](.ai/agent-instructions/pre-push.md) — before every push

## Conventions

- **Commits:** `type(scope): subject` (conventional commits)
- **Branches:** `<ticket-id>-<description>` (e.g. `tri-42-add-auth`)
- [ADRs](.ai/adr/) for architectural decisions
- [Testing conventions](.ai/testing/conventions.md)
- **Linear:** fetch ticket context via branch name (e.g. `tri, the project is https://linear.app/triobox/project/agentic-harness-e3c80386917a/overview-42-<description>`)

## Constraints

<!-- Add project-specific constraints, gotchas, and non-obvious rules here -->

## Resources

- [.ai/README.md](.ai/README.md) — index of all agent context docs
