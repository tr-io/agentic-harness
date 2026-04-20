/**
 * TRI-54: harness auto — session orchestration
 * TRI-55: CI monitoring, auto-fix, merge waiting
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { loadConfigOrNull } from "../config/loader.js";
import {
  LinearClientError,
  assessComplexity,
  createSubIssue,
  extractTicketIdFromBranch,
  fetchTicket,
  formatTicketContext,
  isLinearAvailable,
  proposeSplit,
  updateTicketStatus,
} from "../linear/index.js";
import type { LinearTicket } from "../linear/index.js";

interface AutoOptions {
  simplify?: boolean;
}

function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ─── Complexity check + optional split ───────────────────────────────────────

async function handleComplexity(ticket: LinearTicket): Promise<LinearTicket> {
  const complexity = assessComplexity(ticket);

  if (!complexity.isComplex) {
    console.log(`  Complexity score: ${complexity.score} — proceeding directly`);
    return ticket;
  }

  console.log(`\n⚠  Ticket appears complex (score: ${complexity.score}):`);
  for (const r of complexity.reasons) console.log(`   • ${r}`);

  const splits = proposeSplit(ticket);
  console.log(`\n  Proposed split into ${splits.length} sub-tickets:`);
  splits.forEach((s, i) => console.log(`   ${i + 1}. ${s.title}`));

  const split = await confirm("Split into sub-tickets? [y/N] ");
  if (!split) return ticket;

  // Create sub-tickets in Linear
  console.log("\n  Creating sub-tickets…");
  const created: LinearTicket[] = [];
  for (const split of splits) {
    const sub = await createSubIssue({
      parentId: ticket.id,
      teamId: ticket.team.id,
      title: split.title,
      description: split.description,
    });
    console.log(`   ✓ Created ${sub.identifier}: ${sub.title}`);
    created.push(sub);
  }

  if (created.length === 0) {
    console.warn("  ⚠ No sub-tickets created — proceeding with original ticket");
    return ticket;
  }

  return created[0]; // Work on first sub-ticket
}

// ─── Session spawning ─────────────────────────────────────────────────────────

/** @internal */
export function buildBranchName(ticket: LinearTicket): string {
  const id = ticket.identifier.toLowerCase();
  const slug = ticket.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") // collapse consecutive dashes
    .slice(0, 40)
    .replace(/-$/, ""); // strip trailing dash after slice
  return `${id}-${slug}`;
}

/** @internal */
export function buildSessionPrompt(
  ticket: LinearTicket,
  branchName: string,
  simplify: boolean,
): string {
  const ticketCtx = formatTicketContext(ticket);
  return `You are implementing a Linear ticket as part of the @tr-io/harness automated workflow.

${ticketCtx}

## Your Task

Implement the ticket above. Follow the session protocol in .ai/agent-instructions/session-protocol.md exactly.

## Branch

Create and work on branch: \`${branchName}\`

\`\`\`bash
git checkout -b ${branchName}
\`\`\`

## Implementation Steps

1. Read CLAUDE.md and .ai/agent-instructions/session-protocol.md
2. Verify baseline (run tests, lint)
3. Implement the changes
4. Run tests and lint — fix any failures before pushing
5. Commit with conventional commit format
6. Push to remote
7. Create a PR with:
   - Title: [${ticket.identifier}] ${ticket.title}
   - Body: implementation plan + acceptance criteria checklist + link to ${ticket.url}
${simplify ? "8. Run /simplify on any files with >20 lines of changes" : ""}

Start now. When done, output the PR URL on a line by itself prefixed with "PR: ".`;
}

async function spawnClaudeSession(prompt: string): Promise<string | null> {
  console.log("  Spawning Claude Code session…");

  const result = spawnSync(
    "claude",
    ["--print", "--permission-mode", "bypassPermissions", prompt],
    {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: 30 * 60 * 1000, // 30 minute timeout
      stdio: ["pipe", "pipe", "inherit"],
    },
  );

  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(
        "  claude not found — is Claude Code installed? (npm install -g @anthropic-ai/claude-code)",
      );
    } else if (code === "ETIMEDOUT") {
      console.error("  Claude session timed out after 30 minutes");
    } else {
      console.error(`  Claude session error: ${result.error.message}`);
    }
    return null;
  }

  if (result.status !== 0) {
    console.error("  Claude session exited with non-zero status");
    if (result.stdout) {
      console.error("\n  Session output (last 2000 chars):");
      console.error(result.stdout.slice(-2000));
    }
    return null;
  }

  // Extract PR URL — match anywhere on a line (not just line-start)
  const prMatch = result.stdout?.match(/PR:\s*(https?:\/\/\S+)/m);
  if (!prMatch) {
    console.error("\n  No PR URL found in session output. Last 2000 chars:");
    console.error(result.stdout?.slice(-2000));
  }
  return prMatch?.[1] ?? null;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runAuto(ticketId: string, options: AutoOptions): Promise<void> {
  const cwd = process.cwd();

  if (!existsSync(join(cwd, ".harness.json"))) {
    console.error('No .harness.json found. Run "harness init" first.');
    process.exit(1);
  }

  const config = loadConfigOrNull(cwd);
  if (!config) {
    console.error('.harness.json is invalid or unreadable. Run "harness check" to diagnose.');
    process.exit(1);
  }
  if (!config.features.autoLoop) {
    console.error(
      'Auto loop is disabled. Enable it in .harness.json: "features": { "autoLoop": true }',
    );
    process.exit(1);
  }

  if (!isLinearAvailable()) {
    console.error("Linear API key not found. Set HARNESS_LINEAR_API_KEY or LINEAR_API_KEY.");
    process.exit(1);
  }

  console.log(`\n🤖 harness auto — ${ticketId}\n`);

  // 1. Fetch ticket
  let ticket: LinearTicket;
  try {
    console.log("  Fetching ticket from Linear…");
    ticket = await fetchTicket(ticketId);
    console.log(`  ✓ ${ticket.identifier}: ${ticket.title}`);
  } catch (err) {
    if (err instanceof LinearClientError) {
      console.error(`  Linear error: ${err.message}`);
    } else {
      console.error(`  Failed to fetch ticket: ${err}`);
    }
    process.exit(1);
  }

  // 2. Complexity check
  console.log("\n  Checking complexity…");
  ticket = await handleComplexity(ticket);

  // 3. Update status → In Progress
  try {
    await updateTicketStatus(ticket.id, ticket.team.id, "In Progress");
    console.log("  ✓ Status → In Progress");
  } catch {
    console.warn("  ⚠ Could not update ticket status (continuing anyway)");
  }

  // 4. Build session prompt and spawn Claude
  const branchName = buildBranchName(ticket);
  const sessionPrompt = buildSessionPrompt(ticket, branchName, Boolean(options.simplify));

  console.log(`\n  Branch: ${branchName}`);
  const prUrl = await spawnClaudeSession(sessionPrompt);

  if (!prUrl) {
    console.error("\n  ✗ Session completed but no PR URL found in output.");
    console.error("  Check the branch and create the PR manually.");
    process.exit(1);
  }

  console.log(`\n  ✓ PR created: ${prUrl}`);

  // 5. Update status → In Review
  try {
    await updateTicketStatus(ticket.id, ticket.team.id, "In Review");
    console.log("  ✓ Status → In Review");
  } catch {
    /* non-fatal */
  }

  console.log(`\n✅ ${ticket.identifier} ready for review: ${prUrl}\n`);
}
