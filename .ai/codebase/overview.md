# Codebase Overview — @tr-io/harness

CLI tool that bootstraps agentic development infrastructure onto any software project.

## Entry Points

- `src/cli.ts` — CLI binary; registers all commands via commander
- `src/commands/` — thin wrappers that lazy-import the real modules

## Key Modules

| Module | Purpose |
|--------|---------|
| `src/detector/` | Stack detection from config files/deps → `StackReport` |
| `src/config/` | `.harness.json` loader with deep-merge defaults; `schema.json` |
| `src/scaffolder/` | Template engine: mandatory/recommended/optional tiers |
| `src/scaffolder/templates/` | All template content as TypeScript functions |
| `src/scaffolder/hooks/` | Self-contained Node.js hook scripts (scaffolded into target projects) |
| `src/init/` | `harness init` — wires detector + scaffolder + existing-init + CI |
| `src/existing-init/` | Sub-agent codebase analysis (Sonnet) + config merging for existing projects |
| `src/lint-setup/` | Stack-aware linter config templates + `harness lint-setup` |
| `src/ci/` | GitHub Actions workflow generator |
| `src/check/` | `harness check` — artifact health validation |
| `src/upgrade/` | `harness upgrade` — checksum-based upgrade with merge prompts |
| `src/linear/` | Linear GraphQL client, complexity scorer, ticket splitter |
| `src/auto/` | `harness auto` — ticket→implement→PR→CI→merge orchestration loop |

## Architectural Rules

- Hook scripts are **scaffolded into target projects** — must be self-contained, use `spawnSync` not `exec`
- Sub-agent calls must use `claude-sonnet-4-6` — never Opus
- Templates are TypeScript functions, not external files — no asset bundling needed
- Config loader uses deep-merge so consumers only override what they need

## Testing

Unit tests colocated in `__tests__/` per module. Integration tests in `src/__tests__/integration.test.ts`.

- `npm test` — 101 tests (vitest)
- `npm run typecheck` — TypeScript
- `npm run lint` — Biome
