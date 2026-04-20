# 001. Harness as a Claude Code Plugin

**Date:** 2026-04-19
**Status:** Accepted
**Ticket:** [TRI-73](https://linear.app/triobox/issue/TRI-73)

## Context

The harness is currently a standalone CLI (`harness <command>`) installed via npm and
initialized per-project via `harness init`. This covers the scaffolding story but leaves
a gap for in-session agent use: Claude agents running inside Claude Code must know the
correct CLI flags and workflow to call harness commands. They have no native signal that
the harness exists, what operations it supports, or how to invoke it.

The Claude Code plugin system provides a first-class mechanism to close this gap. A plugin
is a directory with a manifest (`plugin.json`), skill files (`.md` prompts invokable as
`/namespace:skill`), hook scripts, and an optional `bin/` entry. When a plugin is active,
its `bin/` is added to PATH for all Bash tool calls, and its skills are available as
slash commands.

This ADR defines the plugin directory architecture before any code is written. It resolves
five decision points: repo placement, the `bin/harness` entry mechanism, which hooks ship
with the plugin, distribution model, and install scope recommendation.

## Decision

Ship the harness plugin as a `packages/plugin/` directory inside the existing
`agentic-harness` repo, published as part of the `@tr-io/harness` npm package. The plugin
directory structure is:

```
packages/plugin/
├── .claude-plugin/
│   └── plugin.json          # manifest: name, version, description, author
├── bin/
│   └── harness              # thin Node.js shim → ../../../dist/cli.cjs
├── skills/
│   ├── init/
│   │   └── SKILL.md         # /harness:init
│   ├── auto/
│   │   └── SKILL.md         # /harness:auto <ticket-id>
│   ├── configure/
│   │   └── SKILL.md         # /harness:configure
│   ├── apply/
│   │   └── SKILL.md         # /harness:apply
│   └── taxonomy/
│       └── SKILL.md         # /harness:taxonomy
├── hooks/
│   └── hooks.json           # default hook declarations (pre-push-check only)
└── settings.json            # optional default Claude Code settings overrides
```

## Rationale

### Repo placement: same repo (`packages/plugin/`)

The skill files (e.g., `/harness:auto`) reference CLI commands by name and flag. Any
mismatch between a skill's instructions and the actual CLI interface is a silent failure
mode — the agent calls the wrong flag and proceeds. Keeping the plugin in the same repo
enforces a single release cut: a CLI change and its corresponding skill update ship
together in the same commit and npm version.

A separate plugin repo would require synchronized cross-repo releases and introduce a
versioning surface area that has no benefit at this stage. If the Claude Code plugin
marketplace matures and demands an independent distribution identity, a thin wrapper repo
can be created then.

### `bin/harness`: shim script, not symlink

A shim (`#!/usr/bin/env node` → `require('../../../dist/cli.cjs')`) is chosen over a
symlink for three reasons:

1. **npm tarball fidelity.** `npm pack` preserves symlinks inconsistently, and on
   Windows they may be silently dereferenced. A shim is a regular file and survives
   packaging on all platforms.
2. **Relative path resilience.** The shim resolves its target relative to its own
   location at runtime, which is known and stable in the installed npm tree.
3. **Extensibility.** A shim can emit a version mismatch warning or load environment
   variables before delegating to the CLI, without touching the CLI source.

The shim content:
```js
#!/usr/bin/env node
require('../../../dist/cli.cjs');
```

This assumes the plugin directory is at `<package-root>/packages/plugin/` and the built
CLI is at `<package-root>/dist/cli.cjs`, which is the output path produced by `tsup`.

### Hooks shipped with the plugin

`harness init` scaffolds four hook scripts:

| Hook | Feature flag | Always written |
|------|-------------|----------------|
| `pre-push-check.js` | — | Yes (mandatory) |
| `branch-naming-warn.js` | `branchNamingWarning` | No |
| `completion-reminder.js` | `completionReminder` | No |
| `artifact-freshness.js` | `artifactFreshnessCheck` | No |

When installed at `user` scope, a plugin's hooks fire for every project. Shipping all four
hooks enabled by default would affect projects that never ran `harness init` and have no
`.harness.json`. The plugin therefore ships only `pre-push-check` enabled in its default
`hooks/hooks.json`. The remaining three hooks are declared but disabled; they activate
when the user runs `harness configure` and opts into the corresponding features.

This preserves parity with the `harness init` behavior: mandatory baseline always on,
optional hooks require explicit opt-in.

### Distribution: npm-first, git-based marketplace as thin wrapper

The harness CLI is already published to npm as `@tr-io/harness`. Adding `packages/plugin/`
to the published files (via `package.json` `files` field) makes the plugin directory
available at a deterministic path inside the installed package tree. Claude Code can
reference it as:

```bash
claude --plugin-dir $(node -e "require.resolve('@tr-io/harness/plugin')")
```

or, after global install:

```bash
claude --plugin-dir $(harness plugin-dir)   # new sub-command to print the path
```

A git-based Claude Code marketplace entry (a thin GitHub repo or registry entry) can point
to this npm path without maintaining a separate release pipeline. Distribution converges on
a single artifact: the npm publish.

### Install scope: project recommended, user supported

The harness is fundamentally project-scoped. Its hooks read `.harness.json`, its skills
reference `.ai/` directories, and its correctness depends on per-project configuration.
Installing at `project` scope (committed to the repo's `.claude/plugins/` directory or
equivalent) gives teams:

- **Version lock.** The plugin version is fixed to the repo's `package.json`, matching
  the installed CLI.
- **Team consistency.** Every developer who checks out the repo gets the same skills and
  hooks without a separate install step.
- **Safe defaults.** Hooks do not activate in unrelated projects.

User-scope install (`claude plugin install harness --scope user`) is supported for
developers who want `harness` on PATH in all projects. In that case the skill files still
work, but hooks should be reviewed for cross-project side effects before enabling.

The recommended install flow:

```bash
# Add as a project-scoped plugin (committed to repo):
claude plugin install @tr-io/harness --scope project

# Dev testing against a local build:
claude --plugin-dir ./packages/plugin
```

## Consequences

**Easier:**

- Claude agents gain native, namespaced access to harness operations via `/harness:*`
  skills — no flag lookup required.
- The harness binary is always on PATH during Bash tool calls when the plugin is active,
  eliminating manual `npx` invocations in hook scripts.
- Skill files and CLI source live in the same repo, so drift between documented behavior
  and actual behavior is caught at code review time.
- A single `npm publish` distributes both the CLI and the plugin.

**Harder:**

- The repo structure becomes a monorepo (`packages/plugin/` alongside `src/`), requiring
  `tsup` or build config changes to handle the new package boundary.
- The `bin/harness` shim must be kept in sync with the `dist/` output path. Any tsup
  output path change silently breaks the shim.
- Testing the plugin end-to-end requires a running Claude Code instance with plugin
  loading support, which is harder to wire into CI than unit tests.

**New problems introduced:**

- Skills shipped in the plugin are static `.md` files. When the CLI gains new flags or
  commands, the skills must be manually updated — there is no code-generation step
  producing them from the CLI's Commander definitions. This creates a documentation debt
  that accumulates without a forcing function.
- The `harness plugin-dir` sub-command (needed for the `--plugin-dir` install path UX)
  is a new CLI surface added for plugin distribution bookkeeping rather than harness
  functionality.

**Related work:**

- [TRI-74](https://linear.app/triobox/issue/TRI-74) — Plugin scaffold: implements the
  directory structure defined here.
- [TRI-61](https://linear.app/triobox/issue/TRI-61) — `/build` skill: one of the skills
  that will ship in the plugin.
