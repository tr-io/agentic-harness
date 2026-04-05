#!/usr/bin/env node

// src/scaffolder/index.ts
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

// src/scaffolder/hooks/artifact-freshness.ts
function artifactFreshnessScript() {
  return `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const tool = input?.tool_name ?? "";
const command = input?.tool_input?.command ?? "";

if (tool !== "Bash" || !command.includes("git commit")) process.exit(0);

const diff = spawnSync("git", ["diff-tree", "--no-commit-id", "-r", "--name-only", "HEAD"], {
  encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
});
if (diff.status !== 0) process.exit(0);

const changedFiles = (diff.stdout ?? "").trim().split("\\n").filter(Boolean);

let manifest = { mappings: [] };
try {
  if (existsSync(".ai/manifest.json")) {
    manifest = JSON.parse(readFileSync(".ai/manifest.json", "utf-8"));
  }
} catch { process.exit(0); }

const stale = [];
for (const mapping of manifest.mappings ?? []) {
  const { sourcePaths = [], docs = [] } = mapping;
  const prefix = (p) => p.replace("/**", "").replace("/*", "");
  const sourceChanged = sourcePaths.some((pat) => changedFiles.some((f) => f.startsWith(prefix(pat))));
  if (!sourceChanged) continue;
  const docChanged = docs.some((doc) => changedFiles.includes(doc));
  if (!docChanged) stale.push(...docs);
}

if (stale.length === 0) process.exit(0);

process.stderr.write(\`
[harness] ARTIFACT FRESHNESS WARNING

Code changed but these .ai/ docs were not updated:
\${[...new Set(stale)].map((d) => "  \u2022 " + d).join("\\n")}

Update them if your changes affected the patterns they document. Warning only.
\`);

process.exit(0);
`;
}

// src/scaffolder/hooks/branch-naming-warn.ts
function branchNamingWarnScript() {
  return `#!/usr/bin/env node
// branch-naming-warn.js \u2014 recommended warning hook (non-blocking)
// Warns when a new branch name doesn't follow the <ticket-id>-<description> convention.

import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const tool = input?.tool_name ?? "";
const command = input?.tool_input?.command ?? "";

if (tool !== "Bash") process.exit(0);

// Match git checkout -b <name> or git switch -c <name>
const checkoutMatch = command.match(/git\\s+checkout\\s+-b\\s+(\\S+)/);
const switchMatch = command.match(/git\\s+switch\\s+-c\\s+(\\S+)/);
const branchName = (checkoutMatch?.[1] ?? switchMatch?.[1] ?? "").trim();

if (!branchName) process.exit(0);

// Valid patterns:
//   <ticket-id>-<description>   e.g. tri-42-add-auth, col-7-fix-login
//   feature/<description>       fallback when no ticket
const validPattern = /^[a-z]+-\\d+-[a-z0-9-]+$|^feature\\/[a-z0-9-]+$/;

if (!validPattern.test(branchName)) {
  process.stderr.write(\`
[harness] WARNING: Branch name "\${branchName}" doesn't follow the convention.

  Preferred: <ticket-id>-<description>  (e.g. tri-42-add-auth)
  Fallback:  feature/<description>      (e.g. feature/add-logging)

This is a warning only \u2014 the branch was created. Consider renaming it.

\`);
}

process.exit(0);
`;
}

// src/scaffolder/hooks/completion-reminder.ts
function completionReminderScript() {
  return `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args) {
  const r = spawnSync("git", args, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  return r.stdout?.trim() ?? "";
}

const status = git("status", "--porcelain");
const unpushed = git("log", "@{u}..", "--oneline");
const hasUncommitted = status.length > 0;
const hasUnpushed = unpushed.length > 0;

if (!hasUncommitted && !hasUnpushed) process.exit(0);

const changedFiles = status.split("\\n").filter(Boolean).map((l) => l.slice(3));

// Detect substantially changed files (>20 lines inserted)
let largeFiles = [];
const diffStat = spawnSync("git", ["diff", "--stat", "HEAD"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
if (diffStat.status === 0) {
  largeFiles = (diffStat.stdout ?? "")
    .split("\\n")
    .filter((l) => { const m = l.match(/(\\d+) insertion/); return m && parseInt(m[1], 10) > 20; })
    .map((l) => l.split("|")[0].trim())
    .filter(Boolean);
}

process.stderr.write(\`
[harness] SESSION ENDING WITH WORK IN PROGRESS
\${hasUncommitted ? "\\nUncommitted:\\n" + changedFiles.map((f) => "  \u2022 " + f).join("\\n") : ""}
\${hasUnpushed ? "\\nUnpushed:\\n" + unpushed.split("\\n").map((l) => "  \u2022 " + l).join("\\n") : ""}

Self-review checklist:
  \u25A1  All acceptance criteria met
  \u25A1  No placeholder/stub implementations
  \u25A1  No commented-out code
  \u25A1  No hardcoded secrets or local paths
  \u25A1  Tests cover happy path and edge cases
  \u25A1  .ai/ docs updated if architecture/patterns changed
  \u25A1  Commit messages follow conventional format
\${largeFiles.length > 0 ? "\\nConsider /simplify on:\\n" + largeFiles.map((f) => "  \u2022 " + f).join("\\n") : ""}
\`);

process.exit(0);
`;
}

// src/scaffolder/hooks/pre-push-check.ts
function prePushCheckScript() {
  return `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const tool = input?.tool_name ?? "";
const command = input?.tool_input?.command ?? "";

if (tool !== "Bash" || !command.includes("git push")) process.exit(0);

let config = {};
try {
  if (existsSync(".harness.json")) {
    config = JSON.parse(readFileSync(".harness.json", "utf-8"));
  }
} catch { /* no config \u2014 use defaults */ }

const prePush = config?.hooks?.prePush ?? { lint: true, typeCheck: true, unitTest: true };
const project = config?.project ?? {};

function run(label, cmd) {
  if (!cmd) return;
  // Split command string into executable + args to avoid shell injection
  const [bin, ...args] = cmd.split(/\\s+/);
  process.stderr.write(\`\\n[harness] Running \${label}: \${cmd}\\n\`);
  const result = spawnSync(bin, args, { stdio: "inherit", cwd: process.cwd(), shell: false });
  if (result.status !== 0) {
    process.stderr.write(\`\\n[harness] BLOCKED: \${label} failed. Fix the issues above then push again.\\n\\n\`);
    process.exit(1);
  }
}

if (prePush.lint !== false && project.lintCommand) run("lint", project.lintCommand);
if (prePush.typeCheck !== false && project.typeCheckCommand) run("type check", project.typeCheckCommand);
if (prePush.unitTest !== false && project.testCommand) run("tests", project.testCommand);

process.exit(0);
`;
}

// src/scaffolder/templates/mandatory/ai-manifest.ts
function aiManifest() {
  return JSON.stringify(
    {
      $schema: "https://raw.githubusercontent.com/tr-io/agentic-harness/main/manifest-schema.json",
      mappings: [],
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      note: "Add mappings as you document the codebase. Each mapping links source paths to the .ai/ docs that cover them."
    },
    null,
    2
  );
}

// src/scaffolder/templates/mandatory/ai-readme.ts
function aiReadme(ctx) {
  const optional2 = [];
  if (ctx.features.dddContextMaps) optional2.push("- `ddd/` \u2014 domain-driven design context maps");
  if (ctx.features.latMd) optional2.push("- `lat.md` \u2014 knowledge graph (see lat.md docs)");
  return `# .ai/ \u2014 Agent Context Index

This directory is the single source of truth for agent context.
Agents follow links on demand \u2014 nothing here is loaded automatically except CLAUDE.md.

## Contents

### agent-instructions/
Instructions agents follow at each lifecycle stage.
- [session-protocol.md](agent-instructions/session-protocol.md) \u2014 full session lifecycle
- [pre-plan.md](agent-instructions/pre-plan.md) \u2014 before starting any work
- [pre-push.md](agent-instructions/pre-push.md) \u2014 before every push

### codebase/
Navigation maps for the ${ctx.projectName} codebase.
Add one file per major module/subsystem describing structure, entry points, and key abstractions.
${ctx.features.adr ? "\n### adr/\nArchitecture decision records. See [adr/README.md](adr/README.md) for format.\n" : ""}${ctx.features.testingDocs ? "\n### testing/\nTesting conventions and coverage map. See [testing/conventions.md](testing/conventions.md).\n" : ""}${optional2.length ? `
${optional2.join("\n")}
` : ""}
### manifest.json
Maps source paths to the docs that cover them.
Used by the artifact freshness hook to detect stale documentation.
`;
}

// src/scaffolder/templates/mandatory/claude-md.ts
function claudeMd(ctx) {
  const stacks = ctx.stacks.length ? ctx.stacks.join(", ") : "not detected";
  const adrLine = ctx.features.adr ? "\n- [ADRs](.ai/adr/) for architectural decisions" : "";
  const testingLine = ctx.features.testingDocs ? "\n- [Testing conventions](.ai/testing/conventions.md)" : "";
  const linearLine = ctx.features.linearIntegration ? `
- **Linear:** fetch ticket context via branch name (e.g. \`${ctx.linearTeamKey.toLowerCase()}-42-<description>\`)` : "";
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
- [Session protocol](.ai/agent-instructions/session-protocol.md) \u2014 orient \u2192 verify \u2192 plan \u2192 implement \u2192 test \u2192 finalize
- [Pre-plan workflow](.ai/agent-instructions/pre-plan.md) \u2014 branch creation, ticket lookup
- [Pre-push checklist](.ai/agent-instructions/pre-push.md) \u2014 before every push

## Conventions

- **Commits:** \`type(scope): subject\` (conventional commits)
- **Branches:** \`<ticket-id>-<description>\` (e.g. \`tri-42-add-auth\`)${adrLine}${testingLine}${linearLine}

## Constraints

<!-- Add project-specific constraints, gotchas, and non-obvious rules here -->

## Resources

- [.ai/README.md](.ai/README.md) \u2014 index of all agent context docs
`;
}

// src/scaffolder/templates/mandatory/claude-settings.ts
function claudeSettings(ctx) {
  const hooks = {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: "node .claude/hooks/pre-push-check.js"
          }
        ]
      }
    ],
    PostToolUse: [],
    Stop: []
  };
  if (ctx.features.branchNamingWarning) {
    hooks.PreToolUse.push({
      matcher: "Bash",
      hooks: [
        {
          type: "command",
          command: "node .claude/hooks/branch-naming-warn.js"
        }
      ]
    });
  }
  if (ctx.features.artifactFreshnessCheck) {
    hooks.PostToolUse.push({
      matcher: "Bash",
      hooks: [
        {
          type: "command",
          command: "node .claude/hooks/artifact-freshness.js"
        }
      ]
    });
  }
  if (ctx.features.completionReminder) {
    hooks.Stop.push({
      hooks: [
        {
          type: "command",
          command: "node .claude/hooks/completion-reminder.js"
        }
      ]
    });
  }
  if (hooks.PostToolUse.length === 0) hooks.PostToolUse = void 0;
  if (hooks.Stop.length === 0) hooks.Stop = void 0;
  return JSON.stringify({ hooks }, null, 2);
}

// src/scaffolder/templates/mandatory/codebase-readme.ts
function codebaseReadme(ctx) {
  return `# Codebase Navigation

This directory contains navigation maps for the **${ctx.projectName}** codebase.
Add one file per major module or subsystem.

## Convention

Each file should document:
- **Purpose** \u2014 what this module does
- **Entry points** \u2014 where to start reading
- **Key abstractions** \u2014 important types, interfaces, classes
- **Dependencies** \u2014 what this module depends on
- **Constraints** \u2014 rules agents must follow when working here

## Files

<!-- Add entries here as you document modules -->
<!-- Example: -->
<!-- - [backend.md](backend.md) \u2014 API server, routes, services -->
<!-- - [frontend.md](frontend.md) \u2014 UI components, stores, routing -->

*No navigation maps yet. As you build the codebase, document modules here.*
`;
}

// src/scaffolder/templates/mandatory/pre-plan.ts
function prePlan(ctx) {
  const linearSection = ctx.features.linearIntegration ? `
## Ticket Context

When working on a Linear ticket:

1. Extract ticket ID from branch name (e.g. \`tri-42\` from \`tri-42-add-auth\`)
2. Fetch ticket details: title, description, acceptance criteria
3. Use acceptance criteria as your definition of done
4. Update ticket status \u2192 **In Progress** when branch is created

If the ticket seems too large in scope, **propose a split before implementing.**
Incremental tickets = incremental PRs = reviewable, safe changes.
` : "";
  const teamKey = ctx.linearTeamKey || "TEAM";
  return `# Pre-Plan Workflow

Run this BEFORE starting any implementation work.

## Branch Creation

Branch names must follow the convention:

\`\`\`
<ticket-id>-<concise-description>
\`\`\`

Examples:
- \`${teamKey.toLowerCase()}-42-add-user-auth\`
- \`${teamKey.toLowerCase()}-17-fix-login-redirect\`
- \`feature/add-logging\` (fallback when no ticket exists)

Create the branch:
\`\`\`bash
git checkout -b <ticket-id>-<description>
\`\`\`
${linearSection}
## Complexity Check

Before implementing, ask:

- Can this be done in < 200 lines of meaningful change?
- Does it touch only 1-2 modules?
- Can it be reviewed in < 15 minutes?

If **no** to any of these \u2014 propose splitting to the user first.

## Checklist

- [ ] Branch name follows convention
- [ ] Baseline is verified (tests pass, lint clean)
- [ ] Single task identified for this session
- [ ] Implementation approach outlined
- [ ] Ticket context fetched (if applicable)
`;
}

// src/scaffolder/templates/mandatory/pre-push.ts
function prePush(ctx) {
  const lintLine = ctx.lintCommand ? `- [ ] \`${ctx.lintCommand}\` passes` : "- [ ] Lint passes";
  const typeLine = ctx.typeCheckCommand ? `- [ ] \`${ctx.typeCheckCommand}\` passes` : "- [ ] Type check passes";
  const testLine = ctx.testCommand ? `- [ ] \`${ctx.testCommand}\` passes` : "- [ ] Tests pass";
  const linearStatus = ctx.features.linearIntegration ? "\n- [ ] Linear ticket status updated to **In Review**" : "";
  return `# Pre-Push Checklist

Run this BEFORE every push. The pre-push hook enforces the quality checks automatically,
but this checklist ensures you don't miss anything else.

## Quality Gates (enforced by hook \u2014 will block push on failure)

${lintLine}
${typeLine}
${testLine}

## Self-Review (your responsibility)

- [ ] All acceptance criteria from ticket are met
- [ ] No placeholder or stub implementations \u2014 full implementations only
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

// src/scaffolder/templates/mandatory/session-protocol.ts
function sessionProtocol(ctx) {
  const linearStep = ctx.features.linearIntegration ? "   \u2514\u2500\u2500 If working on a ticket: fetch Linear ticket details (branch name contains ticket ID)" : "";
  const linearBranch = ctx.features.linearIntegration ? "   \u251C\u2500\u2500 If Linear enabled: fetch ticket \u2192 update status \u2192 In Progress" : "";
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

- \u274C Skipping baseline verification \u2014 you WILL compound broken state
- \u274C Working on multiple tasks in one session \u2014 context exhaustion
- \u274C Committing placeholder/stub implementations
- \u274C Skipping tests because "it's just a small change"
- \u274C Pushing without running the pre-push checklist
`;
}

// src/scaffolder/templates/optional/ddd-readme.ts
function dddReadme(ctx) {
  return `# Domain Context Maps

This directory documents the domain model for **${ctx.projectName}** using
Domain-Driven Design (DDD) concepts.

## Convention

One file per bounded context: \`<context-name>.md\`

Each context file should document:

\`\`\`markdown
# <Context Name>

## Aggregates
List aggregates with their fields, invariants, and identity.

## Repository Interfaces
Abstract interfaces for data access \u2014 no implementation details here.

## Application Services / Use Cases
Business logic orchestration. What can this context do?

## Facade (Cross-Context API)
Public API exposed to other contexts. Other contexts NEVER import
repos or aggregates directly \u2014 only the facade.

## Infrastructure Adapters
Concrete implementations (DB, message queue, external APIs).

## Cross-Context Rules
What rules govern how this context interacts with others?
\`\`\`

## Index

<!-- Add entries as contexts are documented -->

*No contexts documented yet.*
`;
}

// src/scaffolder/templates/recommended/adr-readme.ts
function adrReadme(ctx) {
  return `# Architecture Decision Records

This directory records architectural decisions made during development of **${ctx.projectName}**.

## Format (Nygard)

Each ADR is a numbered markdown file: \`NNN-title-in-kebab-case.md\`

\`\`\`markdown
# NNN. Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-NNN]

## Context

What situation or problem led to this decision?
What forces are at play?

## Decision

What was decided? State it clearly and directly.

## Rationale

Why was this decision made over the alternatives?
What tradeoffs were accepted?

## Consequences

What are the results of this decision?
What becomes easier? What becomes harder?
What new problems are introduced?
\`\`\`

## Rules

- ADRs are **immutable** once accepted \u2014 never edit a decision after acceptance
- To reverse a decision: write a new ADR that supersedes the old one
- Write the ADR **before** implementing the decision, not after
- Link to relevant code, tickets, or external references

## Index

<!-- Add entries as ADRs are written -->
<!-- Example: -->
<!-- - [001](001-use-postgresql.md) \u2014 Use PostgreSQL as primary datastore -->

*No decisions recorded yet.*
`;
}

// src/scaffolder/templates/recommended/testing-conventions.ts
function testingConventions(ctx) {
  return `# Testing Conventions

This document defines the testing strategy for **${ctx.projectName}**.

## Test Types

### Unit Tests
- **What:** Pure logic with no I/O, no network, no database
- **Where:** \`<!-- e.g., src/**/*.test.ts or tests/unit/ -->\`
- **Command:** \`${ctx.testCommand || "<!-- configure testCommand in .harness.json -->"}\`
- **Target:** Fast, many. Run on every save.

### Integration Tests
- **What:** Real dependencies (DB, HTTP, message queue)
- **Where:** \`<!-- e.g., tests/integration/ -->\`
- **Command:** \`<!-- e.g., npm run test:integration -->\`
- **Target:** Key workflows. Run pre-push.

### E2E Tests
- **What:** Full user flows against a running application
- **Where:** \`<!-- e.g., e2e/ -->\`
- **Command:** \`<!-- e.g., playwright test -->\`
- **Target:** Smoke tests and critical paths. Run post-deploy.

## Conventions

### Naming
\`\`\`
<!-- Fill in your naming convention -->
<!-- Example: describe('AuthService', () => { it('returns 401 for invalid token') }) -->
\`\`\`

### Query Style (if UI testing)
- Query by role/label/text \u2014 never by CSS class or test ID
- Test behavior, not implementation

### Mocking Strategy
\`\`\`
<!-- Fill in your mocking boundaries -->
<!-- Example: mock at adapters (HTTP, DB), never mock domain logic -->
\`\`\`

## Coverage Map

Track coverage in a \`coverage.md\` file in this directory as the project grows.

| Module | Unit Tests | Integration | E2E | Notes |
|--------|-----------|-------------|-----|-------|
| *none yet* | \u2014 | \u2014 | \u2014 | \u2014 |

## What NOT to Test

\`\`\`
<!-- List things explicitly out of scope -->
<!-- Example: third-party SDKs, generated code, trivial getters/setters -->
\`\`\`
`;
}

// src/scaffolder/index.ts
function buildContext(config, stack) {
  return {
    projectName: config.project.name || stack.entryPoints[0] || "my-project",
    projectType: config.project.type,
    stacks: config.project.stacks.length ? config.project.stacks : stack.languages,
    testCommand: config.project.testCommand,
    lintCommand: config.project.lintCommand,
    typeCheckCommand: config.project.typeCheckCommand,
    buildCommand: config.project.buildCommand,
    linearEnabled: config.linear.enabled,
    linearTeamKey: config.linear.teamKey,
    features: config.features
  };
}
function mandatory(ctx) {
  const files = [
    { path: "CLAUDE.md", content: claudeMd(ctx), tier: "mandatory" },
    { path: ".ai/README.md", content: aiReadme(ctx), tier: "mandatory" },
    {
      path: ".ai/agent-instructions/session-protocol.md",
      content: sessionProtocol(ctx),
      tier: "mandatory"
    },
    { path: ".ai/agent-instructions/pre-plan.md", content: prePlan(ctx), tier: "mandatory" },
    { path: ".ai/agent-instructions/pre-push.md", content: prePush(ctx), tier: "mandatory" },
    { path: ".ai/codebase/README.md", content: codebaseReadme(ctx), tier: "mandatory" },
    { path: ".ai/manifest.json", content: aiManifest(), tier: "mandatory" },
    { path: ".claude/settings.json", content: claudeSettings(ctx), tier: "mandatory" },
    // Hook scripts
    {
      path: ".claude/hooks/pre-push-check.js",
      content: prePushCheckScript(),
      executable: true,
      tier: "mandatory"
    }
  ];
  return files;
}
function recommended(ctx) {
  const files = [];
  if (ctx.features.adr) {
    files.push({ path: ".ai/adr/README.md", content: adrReadme(ctx), tier: "recommended" });
  }
  if (ctx.features.testingDocs) {
    files.push({
      path: ".ai/testing/conventions.md",
      content: testingConventions(ctx),
      tier: "recommended"
    });
  }
  if (ctx.features.branchNamingWarning) {
    files.push({
      path: ".claude/hooks/branch-naming-warn.js",
      content: branchNamingWarnScript(),
      executable: true,
      tier: "recommended"
    });
  }
  if (ctx.features.completionReminder) {
    files.push({
      path: ".claude/hooks/completion-reminder.js",
      content: completionReminderScript(),
      executable: true,
      tier: "recommended"
    });
  }
  if (ctx.features.artifactFreshnessCheck) {
    files.push({
      path: ".claude/hooks/artifact-freshness.js",
      content: artifactFreshnessScript(),
      executable: true,
      tier: "recommended"
    });
  }
  return files;
}
function optional(ctx) {
  const files = [];
  if (ctx.features.dddContextMaps) {
    files.push({ path: ".ai/ddd/README.md", content: dddReadme(ctx), tier: "optional" });
  }
  return files;
}
function buildFileList(config, stack) {
  const ctx = buildContext(config, stack);
  return [...mandatory(ctx), ...recommended(ctx), ...optional(ctx)];
}
function scaffold(projectDir, config, stack, opts = {}) {
  const files = buildFileList(config, stack);
  const written = [];
  const skipped = [];
  for (const file of files) {
    const fullPath = join(projectDir, file.path);
    if (opts.skipExisting && existsSync(fullPath)) {
      skipped.push(file.path);
      continue;
    }
    if (!opts.dryRun) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, "utf-8");
    }
    written.push(file);
  }
  return { files: written, skipped };
}

export {
  buildFileList,
  scaffold
};
//# sourceMappingURL=chunk-XZYE27ZT.js.map