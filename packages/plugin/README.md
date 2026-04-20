# harness — Claude Code Plugin

Agentic harness as a Claude Code plugin. Adds `/harness:*` skills and default hooks to your Claude Code session.

## Install

```bash
# Project-scoped (recommended — pins plugin version to repo):
claude plugin install @tr-io/harness --scope project

# Dev/local testing:
claude --plugin-dir ./packages/plugin
```

## Skills

Skills are populated incrementally. See `skills/` for available commands (invokable as `/harness:<skill>`).

## Hooks

Default hooks are declared in `hooks/hooks.json`. Populated by the harness configure workflow.

## Bin

`bin/harness` is a thin Node.js shim that delegates to the built CLI (`dist/cli.cjs`). It is added to PATH for all Bash tool calls when the plugin is active.

```bash
harness --version   # works in any Bash tool call during a plugin session
```
