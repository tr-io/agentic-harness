# @tr-io/harness — Agentic Harness Specification

> A CLI tool that bootstraps and maintains agentic development infrastructure for any software project, optimized for Claude Code.

---

## Table of Contents

1. [Vision & Principles](#1-vision--principles)
2. [Architecture Overview](#2-architecture-overview)
3. [CLI Tool Design](#3-cli-tool-design)
4. [Best Practice Tiers](#4-best-practice-tiers)
5. [Directory Structure & Scaffolding](#5-directory-structure--scaffolding)
6. [Context Engineering](#6-context-engineering)
7. [Hooks & Backpressure](#7-hooks--backpressure)
8. [Session Protocol](#8-session-protocol)
9. [Linear Integration](#9-linear-integration)
10. [Auto Loop Workflow](#10-auto-loop-workflow)
11. [Stack Detection & Linter Bootstrapping](#11-stack-detection--linter-bootstrapping)
12. [Upgrade Mechanism](#12-upgrade-mechanism)
13. [Evaluation & QA Strategy](#13-evaluation--qa-strategy)
14. [GitHub Integration](#14-github-integration)
15. [Token Efficiency Strategy](#15-token-efficiency-strategy)
16. [Research References](#16-research-references)

---

## 1. Vision & Principles

### Goal

Create a repeatable, version-controlled CLI tool that bootstraps agentic development infrastructure onto any software project — greenfield or existing. The harness encodes best practices from Anthropic, OpenAI, and community research into mechanically enforced guardrails, structured context, and automated workflows.

### Core Principles

These principles are derived from the referenced harness engineering literature and refined through project-specific requirements.

1. **Repository is the single source of truth.** Anything the agent cannot discover in-repo does not exist. Slack threads, Google Docs, and undocumented decisions are invisible to the system.
2. **Enforce mechanically, not documentationally.** Architectural rules enforced via linters, hooks, and CI — not merely written down. Agents faithfully replicate whatever patterns exist, including bad ones.
3. **Backpressure over prescription.** Automated enforcement that blocks progress until quality standards are met. This creates intrinsic motivation for quality rather than extrinsic compliance via checklists.
4. **Context is a scarce resource.** Every token matters. Use progressive disclosure (short TOC → deep docs), subagent delegation for expensive reads, and structured artifacts that bridge sessions without bloating context.
5. **Incremental by default.** One task per session. Small PRs. Atomic commits. Complexity is the enemy of agent reliability.
6. **Separate generation from evaluation.** Agents rate their own work too generously. Build evaluation into the loop, even if lightweight.
7. **Harness components are assumptions.** Every component encodes an assumption about what the model can't do on its own. Re-evaluate with each model upgrade. Strip what's no longer load-bearing.
8. **Humans steer, agents execute.** Human time and attention are the only truly scarce resources. Optimize for minimal human intervention on routine work, maximum human leverage on judgment calls.

---

## 2. Architecture Overview

```
@tr-io/harness (npm package, private, installable from repo)
├── CLI binary: `harness`
├── Core modules:
│   ├── detector/        — Stack & project type detection
│   ├── scaffolder/      — Template rendering & file generation
│   ├── hooks/           — Hook scripts (shell + node)
│   ├── linters/         — Linter config templates per stack
│   ├── skills/          — Claude Code skills shipped with harness
│   ├── linear/          — Linear API integration
│   ├── auto/            — Auto loop orchestration
│   └── upgrade/         — Upgrade diffing & merge logic
├── Templates:
│   ├── mandatory/       — Always scaffolded
│   ├── recommended/     — Scaffolded by default, can be disabled
│   └── optional/        — Opt-in only
└── .harness.json schema definition
```

**Language:** TypeScript (Node.js)
**Distribution:** npm package `@tr-io/harness`, private, installable from git repo
**Future:** Can be published to npm registry when ready

---

## 3. CLI Tool Design

### Commands

| Command | Description |
|---------|-------------|
| `harness init` | Interactive bootstrap. Detects stack, asks questions, scaffolds files. Uses sub-agents (Sonnet/Haiku, never Opus) for existing codebase analysis. |
| `harness upgrade` | Pull latest harness version, diff scaffolded files against templates, prompt user for merge/overwrite/keep decisions. Additive-only — new features opt-in, existing defaults never change. |
| `harness check` | Validate harness health: are docs fresh, hooks installed, required artifacts present, `.harness.json` schema valid. |
| `harness lint-setup` | Detect stack and bootstrap linter/formatter configs if missing. |
| `harness auto <ticket-id>` | Automated ticket implementation loop (see Section 10). |

### Flags

| Flag | Applies To | Description |
|------|-----------|-------------|
| `--simplify` | `harness auto` | Run `/simplify` skill on files with substantial changes (>20 lines) before pushing. |
| `--dry-run` | `harness init`, `harness upgrade` | Preview what would be scaffolded/changed without writing files. |
| `--no-interactive` | `harness init` | Use detected defaults without prompting (for CI/scripting). |

### Configuration: `.harness.json`

Lives at the project root. Declares which features are enabled and their settings.

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/tr-io/agentic-harness/main/schema.json",
  "version": "1.0.0",
  "project": {
    "name": "my-project",
    "type": "web-app",           // web-app | cli | library | monorepo | mobile
    "stacks": ["typescript", "react", "node"],
    "entryPoints": ["src/index.ts"],
    "testCommand": "npm test",
    "lintCommand": "npm run lint",
    "typeCheckCommand": "npx tsc --noEmit",
    "buildCommand": "npm run build"
  },
  "linear": {
    "enabled": true,
    "teamKey": "COL",
    "projectId": "optional-project-id"
  },
  "features": {
    // Recommended (true by default)
    "adr": true,
    "testingDocs": true,
    "completionReminder": true,
    "branchNamingWarning": true,
    "linterBootstrap": true,
    "linearIntegration": true,
    "artifactFreshnessCheck": true,

    // Optional (false by default)
    "dddContextMaps": false,
    "latMd": false,
    "evaluatorQA": false,
    "autoLoop": false,
    "keelEnforcement": false
  },
  "hooks": {
    "prePush": {
      "lint": true,
      "typeCheck": true,
      "unitTest": true
    }
  }
}
```

---

## 4. Best Practice Tiers

### Mandatory (always enforced)

These are non-negotiable and always scaffolded regardless of configuration.

| Practice | Rationale |
|----------|-----------|
| **CLAUDE.md** as short TOC (~100 lines) | Progressive disclosure. Agents load this first, follow links to deeper docs only when needed. Prevents context crowding. |
| **`.ai/` directory** with `codebase/` and `agent-instructions/` | Structured context that survives session resets. Navigation maps let agents orient without expensive codebase scans. |
| **Pre-push hooks** (lint + type check + unit tests) | Backpressure. Blocks broken code from reaching remote. Agents learn to satisfy constraints preemptively. |
| **Conventional commits** | Machine-parseable history. Enables automated changelogs, semantic versioning, and agent comprehension of prior work. |
| **Branch naming convention** (`<ticket-id>-<description>`) | Traceability from branch to ticket. Agents can look up ticket context from branch name. |
| **Session lifecycle** in agent instructions | Prevents agents from skipping orientation, baseline verification, or cleanup steps. |
| **`.claude/settings.json`** with hooks | Mechanical enforcement entry point. Without this, hooks are suggestions, not guardrails. |

### Recommended (enabled by default, can be disabled)

| Practice | Rationale |
|----------|-----------|
| **`.ai/adr/`** — Architecture Decision Records | Captures *why* behind decisions. Agents that understand rationale make better judgment calls. |
| **`.ai/testing/`** — Testing convention docs | Framework for specifying testing strategy without prescribing one. |
| **Completion reminder hook** | Warning-only. Reminds agent to update artifacts and run pre-push checklist before ending session. |
| **Branch naming warning hook** | Warning-only. Alerts on non-conforming branch names but doesn't block. |
| **Linter/formatter bootstrapping** | Detected stack → appropriate config. No linter means no backpressure on code style. |
| **Linear ticket integration** in agent instructions | Agents pull ticket context when working on a task. Token-efficient: only fetched when needed. |
| **Artifact freshness check hook** | Warning-only. Detects code changes without corresponding `.ai/` doc updates. Uses lightweight skill scan. |

### Optional (disabled by default, opt-in)

| Practice | Rationale |
|----------|-----------|
| **`.ai/ddd/`** — Domain context maps | Valuable for complex domain-driven projects. Overkill for simple CLIs or libraries. |
| **`lat.md` knowledge graph** | Bidirectional linking between docs and code. Powerful but adds maintenance overhead. Integrates into `.ai/` structure. |
| **Evaluator/QA agent patterns** | Full separate evaluator pass. High token cost. Research needed on token-efficient variants. |
| **Auto loop workflow** | Automated ticket → implement → PR → CI → merge. Requires Linear integration and GitHub setup. |
| **`keel` structural enforcement** | Cross-file dependency graph validation. Valuable for large codebases. Needs further evaluation. |

### Dynamic Feature Awareness

When any optional feature is enabled, the artifact freshness check hook automatically includes that feature's artifacts in its scan. For example, enabling `dddContextMaps` means the freshness hook will warn if domain model changes don't have corresponding `.ai/ddd/` updates.

---

## 5. Directory Structure & Scaffolding

### Scaffolded Structure (all tiers)

```
project-root/
├── .harness.json                          # Harness configuration
├── CLAUDE.md                              # Short TOC (~100 lines)
├── .claude/
│   ├── settings.json                      # Hooks configuration
│   └── hooks/
│       ├── pre-push-check.sh              # Mandatory: lint + typecheck + test
│       ├── branch-naming-warn.sh          # Recommended: warning on bad branch names
│       ├── completion-reminder.sh         # Recommended: remind to update docs
│       └── artifact-freshness.sh          # Recommended: warn on stale docs
├── .ai/
│   ├── README.md                          # Index of all .ai/ contents
│   ├── agent-instructions/
│   │   ├── session-protocol.md            # Mandatory: orient → verify → implement → test → commit
│   │   ├── pre-plan.md                    # Mandatory: branch creation, ticket lookup
│   │   └── pre-push.md                    # Mandatory: checklist before pushing
│   ├── codebase/
│   │   └── [per-stack navigation maps]    # Auto-generated on init for existing projects
│   ├── adr/                               # Recommended: architecture decision records
│   │   └── README.md                      # ADR format template (Nygard format)
│   ├── testing/                           # Recommended: testing conventions
│   │   └── conventions.md                 # Framework for specifying test strategy
│   ├── ddd/                               # Optional: domain context maps
│   └── manifest.json                      # Auto-generated: source path → doc mapping
└── .github/
    └── workflows/
        └── ci.yml                         # Scaffolded if none exists (stack-aware)
```

### Greenfield vs Existing Project

| Step | Greenfield | Existing |
|------|-----------|----------|
| Stack detection | Ask user | Auto-detect from package.json, Cargo.toml, pyproject.toml, etc. |
| CLAUDE.md | Scaffold template | Generate filled-in TOC using sub-agent (Sonnet/Haiku) codebase scan |
| `.ai/codebase/` | Empty templates | Sub-agent generates navigation maps from actual code structure |
| `.ai/manifest.json` | Minimal | Auto-generated mapping source paths to doc coverage |
| Existing configs | N/A | Preserve. Merge where sensible. Ask user on ambiguous conflicts. |
| Linters | Bootstrap from scratch | Detect existing. Only add if missing. |
| Git hooks | Install fresh | Detect existing. Merge — don't overwrite. |

### Sub-Agent Strategy for Existing Projects

When bootstrapping onto an existing codebase, `harness init` spawns sub-agents to analyze the project:

- **Model constraint:** Sonnet or Haiku only. Never Opus. Token efficiency is paramount for bootstrapping.
- **Tasks:** Detect languages/frameworks, identify entry points, map directory structure, identify test commands, generate codebase navigation docs.
- **Output:** Pre-filled templates that the user reviews and commits.

---

## 6. Context Engineering

### CLAUDE.md Design

The root `CLAUDE.md` follows the "table of contents" pattern from OpenAI's harness engineering research. It must:

- Stay under ~100 lines
- Contain no deep technical details — only pointers
- Be loadable in every agent session without significant context cost
- Include: project overview, stack summary, build/test/lint commands, links to `.ai/` docs

**Template structure:**

```markdown
# Project Name

## Quick Reference
- **Stack:** [auto-detected]
- **Build:** `[command]`
- **Test:** `[command]`
- **Lint:** `[command]`
- **Type Check:** `[command]`

## Architecture
See [.ai/codebase/](.ai/codebase/) for navigation maps.

## Agent Instructions
See [.ai/agent-instructions/](.ai/agent-instructions/) for session protocol and workflows.

## Conventions
- Commits: conventional format — `type(scope): subject`
- Branches: `<ticket-id>-<description>` (e.g., `col-42-add-auth`)
- [ADRs](.ai/adr/) for architectural decisions
- [Testing conventions](.ai/testing/conventions.md)

## Constraints
[Project-specific constraints added by user]
```

### Progressive Disclosure

```
CLAUDE.md (always loaded, ~100 lines)
  └── .ai/README.md (index of all docs)
       ├── .ai/agent-instructions/* (loaded when starting work)
       ├── .ai/codebase/* (loaded when navigating unfamiliar code)
       ├── .ai/adr/* (loaded when making architectural decisions)
       ├── .ai/testing/* (loaded when writing/running tests)
       └── .ai/ddd/* (loaded when working with domain models)
```

Agents follow links on-demand. This minimizes baseline token cost while keeping deep context accessible.

### Manifest for Artifact Freshness

`.ai/manifest.json` maps source paths to the `.ai/` documents that cover them:

```json
{
  "mappings": [
    {
      "sourcePaths": ["src/auth/**", "src/identity/**"],
      "docs": [".ai/codebase/backend.md", ".ai/ddd/identity.md"]
    },
    {
      "sourcePaths": ["src/components/**", "src/pages/**"],
      "docs": [".ai/codebase/frontend.md"]
    }
  ],
  "generatedAt": "2026-04-05T00:00:00Z"
}
```

Auto-generated during `harness init`. Updated when `harness check` runs or when the artifact freshness hook detects drift.

---

## 7. Hooks & Backpressure

### Hook Architecture

All hooks are installed into `.claude/settings.json` and `.claude/hooks/`. They follow the backpressure principle: automated enforcement that blocks progress until quality standards are met, creating intrinsic motivation for quality.

### Hook Inventory

| Hook | Trigger | Behavior | Tier |
|------|---------|----------|------|
| **Pre-push check** | `PreToolUse` on `Bash` (git push) | Runs lint + type check + unit tests. **Blocks on failure.** Agent must fix issues before pushing. | Mandatory |
| **Branch naming warning** | `PreToolUse` on `Bash` (git checkout -b, git switch -c) | Warns if branch name doesn't match `<ticket-id>-<description>` pattern. **Warning only — does not block.** | Recommended |
| **Completion reminder** | `Stop` | Checks for uncommitted changes, reminds agent to: update `.ai/` docs, run pre-push checklist, offers `/simplify`. **Warning only — does not block.** | Recommended |
| **Artifact freshness** | `PostToolUse` on `Bash` (git commit) | Compares committed file paths against `.ai/manifest.json`. Warns if changed code paths have no corresponding doc updates. **Warning only — does not block.** Uses lightweight skill scan for token efficiency. | Recommended |

### Backpressure Strategy

Derived from the quality backpressure skill pattern:

1. **Agent generates code** → triggers pre-push hook
2. **Hook runs validation** (lint, type check, tests)
3. **Pass:** code advances to remote
4. **Fail:** hook output fed back to agent with actionable error messages. Agent enters remediation loop.
5. **Over repeated iterations**, agents learn to preemptively satisfy constraints — reducing iteration cycles.

Key insight: lint/type-check error messages should double as remediation instructions. When agents violate constraints, the error tells them exactly how to fix it.

### Self-Review Checklist (Lightweight Evaluation)

Instead of a full separate evaluator agent (high token cost), the harness includes a self-review checklist in the completion reminder hook:

```
Before pushing, verify:
- [ ] All acceptance criteria from ticket are met
- [ ] No placeholder/stub implementations
- [ ] No commented-out code
- [ ] No hardcoded secrets or credentials
- [ ] Tests cover the happy path and primary edge cases
- [ ] `.ai/` docs updated if architecture/patterns changed
- [ ] Commit messages follow conventional format
```

The completion reminder surfaces this checklist. The `/simplify` skill offer is included as an optional step for files with substantial changes.

---

## 8. Session Protocol

### Encoded Lifecycle

The session protocol is defined in `.ai/agent-instructions/session-protocol.md` and referenced from `CLAUDE.md`. Every agent session follows this sequence:

```
1. ORIENT
   ├── Read CLAUDE.md
   ├── Read git log (recent commits)
   ├── Read .ai/agent-instructions/session-protocol.md
   └── If working on a ticket: fetch Linear ticket details

2. VERIFY BASELINE
   ├── Run build/test commands to confirm existing functionality
   └── If failures found: fix before proceeding (or flag to user)

3. PLAN
   ├── Identify the single task for this session
   ├── If ticket is too large: propose split to user before implementing
   ├── Create branch: <ticket-id>-<description>
   └── Outline implementation approach

4. IMPLEMENT
   ├── Make incremental changes
   ├── Commit atomically (one logical change per commit)
   └── Follow conventional commit format

5. TEST
   ├── Run unit tests for changed code
   ├── Run lint + type check
   └── If browser/UI: test via automation if available

6. FINALIZE
   ├── Run self-review checklist
   ├── Offer /simplify on substantial changes (if --simplify flag or user opts in)
   ├── Update .ai/ docs if architecture/patterns changed
   ├── Push to remote
   └── Create PR with plan and ticket reference
```

### One Task Per Session

This is a core constraint. The research unanimously agrees:

- Prevents context exhaustion
- Maintains recoverability (git reset to known-good state)
- Forces incremental progress
- Reduces compounding bugs across sessions

When a ticket is too large, the harness proposes splitting it into sub-tickets (see Section 10).

---

## 9. Linear Integration

### Capabilities

| Feature | Description |
|---------|-------------|
| **Ticket context injection** | When an agent starts work on a ticket, fetch title, description, and acceptance criteria from Linear. Inject into session context. Token-efficient: only fetched when needed, not preloaded. |
| **Status updates** | Update ticket status as work progresses: `In Progress` (branch created), `In Review` (PR opened), `Done` (PR merged). |
| **PR linking** | PR descriptions auto-link to Linear ticket. Requires Linear GitHub bot (user sets up manually; `harness init` checks and suggests setup). |
| **Ticket splitting** | When a ticket is too complex, harness proposes sub-tickets. Presents split to user for approval before creating in Linear. |

### Configuration

Linear integration requires:

1. `linear.enabled: true` in `.harness.json`
2. Linear API key (stored securely, not in repo)
3. `linear.teamKey` to scope ticket operations
4. Optional `linear.projectId` to scope to a specific project

### Token Efficiency

Ticket details are fetched on-demand via the Linear MCP server, not cached in repo files. The ticket ID in the branch name serves as the lookup key — the agent only queries Linear when it needs acceptance criteria or status context.

---

## 10. Auto Loop Workflow

### Overview

`harness auto <ticket-id>` orchestrates the full cycle: pull ticket → plan → implement → push → PR → CI → wait for merge.

This is an **optional feature** (`features.autoLoop: true` in `.harness.json`).

### Workflow

```
harness auto <ticket-id> [--simplify]
│
├── 1. FETCH TICKET
│   └── Pull title, description, acceptance criteria from Linear
│   └── Update ticket status → In Progress
│
├── 2. COMPLEXITY CHECK
│   ├── Assess ticket scope against complexity threshold
│   ├── If too large: propose ticket split → present to user for approval
│   │   ├── User approves: create sub-tickets in Linear, pick first one
│   │   └── User declines: proceed with original (user accepts risk)
│   └── If acceptable: proceed
│
├── 3. CREATE SESSION
│   └── Spawn new Claude Code session with:
│       ├── Ticket context injected
│       ├── Session protocol from .ai/agent-instructions/
│       └── Branch: <ticket-id>-<description>
│
├── 4. PLAN
│   └── Agent creates implementation plan
│       └── Plan included in PR description later
│
├── 5. IMPLEMENT + TEST
│   └── Agent follows session protocol (implement → test → commit)
│   └── Pre-push hooks enforce quality (backpressure)
│
├── 6. PUSH + PR
│   ├── Push branch to remote
│   ├── Create PR with:
│   │   ├── Title: [TICKET-ID] Description
│   │   ├── Body: implementation plan + acceptance criteria checklist
│   │   └── Link to Linear ticket
│   ├── If --simplify: run /simplify on files with >20 lines changed
│   └── Update ticket status → In Review
│   └── Add PR comment: "Ready for review — waiting for approval"
│
├── 7. WAIT FOR CI
│   ├── Monitor CI checks
│   ├── On failure: auto-fix and re-push
│   └── On pass: continue waiting for human approval
│
├── 8. WAIT FOR MERGE
│   └── Block until PR is merged (human approval required)
│   └── Update ticket status → Done
│
└── 9. COMPLETE
    └── Session ends. Next ticket requires new `harness auto` invocation.
```

### Complexity Threshold

The harness evaluates ticket complexity based on:

- Number of acceptance criteria
- Estimated files to change (based on description keywords vs codebase map)
- Whether it crosses multiple bounded contexts or modules

If complexity exceeds threshold, it proposes splitting into incremental sub-tickets. This ensures:

- Each PR is reviewable in minutes, not hours
- Agent stays within reliable context window bounds
- Compounding bugs are minimized

### Simplify Integration

When `--simplify` is passed:

1. After implementation, before pushing
2. Identify files with >20 lines changed
3. Run `/simplify` skill on those files
4. Review simplification suggestions
5. Apply if improvements found, skip if not

This is also offered interactively via the completion reminder hook (without the flag).

---

## 11. Stack Detection & Linter Bootstrapping

### Detection Strategy

`harness init` and `harness lint-setup` detect project stack by examining:

| Signal | Detected From |
|--------|--------------|
| Language | File extensions, config files (package.json, Cargo.toml, pyproject.toml, go.mod, pom.xml, build.gradle) |
| Framework | Dependencies (react, next, express, fastapi, spring, etc.) |
| Existing linters | .eslintrc, biome.json, .prettierrc, ruff.toml, clippy, golangci-lint, checkstyle |
| Test framework | jest.config, vitest.config, pytest.ini, cargo test |
| Build system | Makefile, package.json scripts, gradle, maven |

### Linter Config Templates

When no linter is detected, `harness lint-setup` scaffolds an appropriate config:

| Stack | Linter | Formatter |
|-------|--------|-----------|
| TypeScript/JavaScript | Biome (preferred) or ESLint | Biome or Prettier |
| Python | Ruff | Ruff |
| Rust | Clippy | rustfmt |
| Go | golangci-lint | gofmt |
| Java | Checkstyle | google-java-format |
| Ruby | RuboCop | RuboCop |

The harness does NOT override existing linter configs. If a linter exists, it is preserved.

### CI Workflow Scaffolding

If no `.github/workflows/ci.yml` exists, `harness init` generates one based on detected stack:

- Lint step
- Type check step (if applicable)
- Unit test step
- Build step (if applicable)

The generated workflow uses the commands from `.harness.json` (`testCommand`, `lintCommand`, etc.).

---

## 12. Upgrade Mechanism

### `harness upgrade`

When the harness package is updated, running `harness upgrade` in a project:

1. **Compares** each scaffolded file against the new template version
2. **For unchanged files:** silently update to new version
3. **For customized files:** show a diff and prompt:
   - **Merge:** attempt three-way merge (template-old, template-new, user-current)
   - **Overwrite:** replace with new template
   - **Keep:** preserve user's version unchanged
4. **New features:** added as opt-in entries in `.harness.json` (disabled by default)

### Guarantees

- **Additive-only:** upgrades never change existing defaults or remove features
- **No silent overwrites:** any file the user has modified requires explicit decision
- **Schema migration:** `.harness.json` schema changes are backward-compatible. New fields get default values.

---

## 13. Evaluation & QA Strategy

### Lightweight Self-Review (Default)

The default evaluation strategy is a **self-review checklist** embedded in the completion reminder hook (see Section 7). This is token-efficient and provides baseline quality assurance.

### Full Evaluator Agent (Optional, Needs Research)

The research from Anthropic demonstrates significant quality improvements from separate evaluator agents, but at substantial token cost. If enabled (`features.evaluatorQA: true`):

- After implementation, spawn a separate agent session
- Evaluator reviews changes against acceptance criteria
- Uses concrete grading criteria with thresholds
- Provides actionable feedback if quality is insufficient
- Generator iterates until evaluator approves

**Open questions for evaluator pattern:**
- Token cost vs quality improvement tradeoff for typical ticket sizes
- Whether a Sonnet/Haiku evaluator is sufficient (vs requiring Opus)
- Optimal grading criteria per project type

### Pros and Cons

| Approach | Pros | Cons |
|----------|------|------|
| **Self-review checklist** | Near-zero token cost; fast; covers common issues | Self-evaluation bias; misses subtle quality issues |
| **Full evaluator agent** | Catches more issues; independent judgment; aligns with research best practices | High token cost; adds latency; may be overkill for small changes |

**Decision:** Start with self-review checklist. Evaluate full evaluator pattern in a future iteration with token cost measurements.

---

## 14. GitHub Integration

### Setup Checks (`harness init`)

During bootstrap, the harness checks for and **suggests** (does not auto-configure):

| Check | Suggestion |
|-------|-----------|
| Branch protection on `main` | Enable "Require pull request reviews before merging" |
| CI status checks | Enable "Require status checks to pass before merging" |
| Linear GitHub bot | Install Linear's GitHub integration for auto-linking |
| Force push protection | Disable force push to `main`/`master` |

These are surfaced as actionable recommendations. The user configures them manually.

### PR Format

PRs created by the harness (via auto loop or agent instructions) follow this format:

```markdown
## [TICKET-ID] Title from Linear

## Summary
[Implementation plan generated during planning phase]

## Changes
- [Bullet points of what changed]

## Acceptance Criteria
- [ ] [Criteria from Linear ticket]
- [ ] [Criteria from Linear ticket]

## Test Plan
- [ ] [How to verify the changes]

---
Linear: [link to ticket]
```

---

## 15. Token Efficiency Strategy

Token efficiency is a cross-cutting concern that influences every design decision.

| Technique | Application |
|-----------|-------------|
| **Progressive disclosure** | CLAUDE.md is ~100 lines. Deep docs loaded on-demand via links. |
| **On-demand ticket fetch** | Linear tickets fetched only when agent needs acceptance criteria, not preloaded. |
| **Sub-agent delegation** | Expensive operations (codebase scan, artifact freshness check) run in sub-agents (Sonnet/Haiku) to avoid bloating primary context. |
| **Lightweight skill scans** | Artifact freshness uses a fast skill that checks git diff against manifest — not a full codebase scan. |
| **Self-review over evaluator** | Default to checklist-based self-review. Full evaluator is opt-in. |
| **JSON for structured state** | JSON resists model-induced corruption better than freeform Markdown for machine-read artifacts (manifest, .harness.json). |
| **One task per session** | Prevents context exhaustion. Fresh sessions start clean. |

---

## 16. Research References

### Primary Sources

| Source | Key Contribution |
|--------|-----------------|
| [Anthropic: Harness Design for Long-Running Apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Multi-agent decomposition (planner/generator/evaluator), context resets over compaction, self-evaluation problem, iterative harness simplification |
| [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Two-agent system (initializer/coding), JSON feature lists, session startup sequence, progress file + git history for state bridging |
| [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/) | Repository as knowledge system, AGENTS.md as TOC, architectural constraint enforcement, entropy management via "golden principles", mechanical linter enforcement, agent-to-agent review loops |
| [ghuntley.com/ralph](https://ghuntley.com/ralph/) | Monolithic single-process loop, one item per loop, subagent delegation, standards-driven generation, self-improving agent docs |
| [celesteanders/harness best-practices](https://github.com/celesteanders/harness/blob/main/docs/best-practices.md) | Consolidated best practices synthesis, session protocol lifecycle, security & sandboxing, one-task-per-session discipline |
| [banay.me: Backpressure](https://banay.me/dont-waste-your-backpressure/) | Type systems as feedback, automated build/test feedback loops, specification-driven development, domain-specific feedback mechanisms |

### Tools Evaluated

| Tool | Status | Notes |
|------|--------|-------|
| [lat.md](https://github.com/1st1/lat.md) | Optional integration | Knowledge graph CLI for codebases. Wiki-link syntax, bidirectional code-doc linking, MCP server. Integrates into `.ai/` structure. |
| [keel](https://keel.engineer) | Optional integration, needs evaluation | Structural code enforcement via dependency graph analysis. Multi-language. 40-60% fewer error-fix cycles reported. |
| [AI-DLC Quality Backpressure](https://mcpmarket.com/tools/skills/ai-dlc-quality-backpressure) | Strategy adopted | Stop hook validation pattern. Backpressure philosophy integrated into hook architecture. |

### Existing Harness Reference

The [colloquor project](file:///Users/leo/dev/colloquor) serves as the primary reference implementation, featuring:
- CLAUDE.md with progressive disclosure
- `.ai/` directory with agent instructions, codebase maps, DDD docs, testing conventions, ADRs
- Claude hooks (branch-check, pre-push, completion-check)
- Makefile as command surface
- Pre-plan and pre-push workflows
- CI/CD integration via GitHub Actions

---

## Appendix A: Open Questions & Future Work

| Question | Status |
|----------|--------|
| `keel` integration depth and value | Needs hands-on evaluation |
| Full evaluator agent token cost measurements | Deferred to future iteration |
| `lat.md` integration into `.ai/` structure | Design needed if opted in |
| Monorepo support (multiple stacks in one repo) | Needs design for multi-stack detection |
| Auto loop retry limits and circuit breakers | Needs design to prevent infinite CI fix loops |
| Complexity threshold calibration | Needs empirical data from real ticket sizes |

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Backpressure** | Automated enforcement that blocks progress until quality standards are met, creating intrinsic motivation for quality rather than extrinsic compliance. |
| **Progressive disclosure** | Loading minimal context initially, with deeper docs available on-demand. Reduces baseline token cost. |
| **Session protocol** | Fixed sequence of steps an agent follows each session: orient → verify → plan → implement → test → finalize. |
| **Artifact freshness** | Whether `.ai/` documentation reflects the current state of the code it documents. |
| **Golden principles** | Mechanical, opinionated rules encoded in the repository that cleanup agents enforce. |
| **Context anxiety** | Model behavior where agents prematurely conclude work as they approach context limits. |
