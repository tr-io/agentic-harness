/**
 * TRI-54: harness auto — session orchestration
 * TRI-55: CI monitoring, auto-fix, merge waiting
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

const CI_POLL_INTERVAL_MS = 15_000;
const CI_MAX_AUTO_FIX_ATTEMPTS = 3;

// ─── Git helpers ─────────────────────────────────────────────────────────────

function git(...args: string[]): { stdout: string; status: number } {
  const r = spawnSync("git", args, { encoding: "utf-8", cwd: process.cwd() });
  return { stdout: r.stdout?.trim() ?? "", status: r.status ?? 1 };
}

function gh(...args: string[]): { stdout: string; status: number } {
  const r = spawnSync("gh", args, { encoding: "utf-8", cwd: process.cwd() });
  return { stdout: r.stdout?.trim() ?? "", status: r.status ?? 1 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const { default: inquirer } = await import("inquirer");
  // biome-ignore lint/suspicious/noExplicitAny: inquirer v13 prompt() type is overly strict
  const { action } = await (inquirer.prompt as any)([
    {
      type: "list",
      name: "action",
      message: "How would you like to proceed?",
      choices: [
        { name: "Split into sub-tickets (recommended)", value: "split" },
        { name: "Proceed with original ticket (I accept the risk)", value: "proceed" },
      ],
    },
  ]);

  if (action === "proceed") return ticket;

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

  return created[0]; // Work on first sub-ticket
}

// ─── Session spawning ─────────────────────────────────────────────────────────

function buildBranchName(ticket: LinearTicket): string {
  const id = ticket.identifier.toLowerCase().replace("-", "-");
  const slug = ticket.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return `${id}-${slug}`;
}

function buildSessionPrompt(ticket: LinearTicket, branchName: string, simplify: boolean): string {
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

  const result = spawnSync("claude", ["--print", prompt], {
    encoding: "utf-8",
    cwd: process.cwd(),
    timeout: 30 * 60 * 1000, // 30 minute timeout
    stdio: ["pipe", "pipe", "inherit"],
  });

  if (result.status !== 0) {
    console.error("  Claude session failed or timed out");
    return null;
  }

  // Extract PR URL from output
  const prMatch = result.stdout?.match(/^PR:\s*(https?:\/\/\S+)/m);
  return prMatch?.[1] ?? null;
}

// ─── CI monitoring ────────────────────────────────────────────────────────────

interface CiStatus {
  state: "pending" | "success" | "failure";
  failedChecks: string[];
}

async function getCiStatus(prUrl: string): Promise<CiStatus> {
  const result = gh("pr", "checks", prUrl, "--json", "name,state,conclusion");

  if (result.status !== 0) {
    return { state: "pending", failedChecks: [] };
  }

  try {
    const checks = JSON.parse(result.stdout) as Array<{
      name: string;
      state: string;
      conclusion: string | null;
    }>;

    const pending = checks.filter((c) => c.state === "PENDING" || c.state === "QUEUED");
    const failed = checks.filter((c) => c.conclusion === "FAILURE" || c.conclusion === "TIMED_OUT");

    if (pending.length > 0) return { state: "pending", failedChecks: [] };
    if (failed.length > 0) {
      return { state: "failure", failedChecks: failed.map((c) => c.name) };
    }
    return { state: "success", failedChecks: [] };
  } catch {
    return { state: "pending", failedChecks: [] };
  }
}

async function getFailureLogs(prUrl: string, failedChecks: string[]): Promise<string> {
  const logs: string[] = [];
  for (const check of failedChecks.slice(0, 2)) {
    const result = gh("run", "view", "--log-failed", "--json", "jobs");
    if (result.status === 0) logs.push(`## ${check}\n${result.stdout.slice(0, 2000)}`);
  }
  return logs.join("\n\n") || "CI failed — check the PR for details.";
}

async function autoFixCi(
  prUrl: string,
  ticket: LinearTicket,
  failedChecks: string[],
): Promise<boolean> {
  const logs = await getFailureLogs(prUrl, failedChecks);

  const fixPrompt = `CI failed on PR ${prUrl} for ticket ${ticket.identifier}.

## Failed checks
${failedChecks.join(", ")}

## Failure logs
${logs}

Diagnose and fix the CI failures. Make targeted fixes, commit them, and push to the existing branch.
Do NOT create a new branch. Do NOT open a new PR. Just fix the failures and push.`;

  const result = spawnSync("claude", ["--print", "--no-markdown", fixPrompt], {
    encoding: "utf-8",
    cwd: process.cwd(),
    timeout: 15 * 60 * 1000,
    stdio: ["pipe", "pipe", "inherit"],
  });

  return result.status === 0;
}

async function waitForMerge(prUrl: string): Promise<boolean> {
  console.log("  Waiting for PR approval and merge…");

  for (let attempt = 0; attempt < 120; attempt++) {
    await sleep(CI_POLL_INTERVAL_MS);
    const result = gh("pr", "view", prUrl, "--json", "state", "--jq", ".state");
    if (result.stdout === "MERGED") return true;
    if (result.stdout === "CLOSED") return false;
  }

  console.log("  Timed out waiting for merge (30 minutes)");
  return false;
}

async function monitorAndWait(prUrl: string, ticket: LinearTicket): Promise<boolean> {
  console.log(`\n  Monitoring CI for ${prUrl}`);
  let fixAttempts = 0;

  // Add "waiting for review" comment
  gh("pr", "comment", prUrl, "--body", "🤖 CI checks running — will notify when ready for review.");

  // Poll CI
  for (;;) {
    await sleep(CI_POLL_INTERVAL_MS);
    const status = await getCiStatus(prUrl);

    if (status.state === "pending") {
      process.stdout.write(".");
      continue;
    }

    if (status.state === "success") {
      console.log("\n  ✓ CI passed");
      gh(
        "pr",
        "comment",
        prUrl,
        "--body",
        "✅ CI passed — ready for review. Waiting for approval.\n\n_Automated by @tr-io/harness_",
      );
      break;
    }

    // CI failed
    console.log(`\n  ✗ CI failed: ${status.failedChecks.join(", ")}`);
    if (fixAttempts >= CI_MAX_AUTO_FIX_ATTEMPTS) {
      console.log(`  Circuit breaker: ${CI_MAX_AUTO_FIX_ATTEMPTS} auto-fix attempts exhausted.`);
      console.log(`  Please review and fix manually: ${prUrl}`);
      gh(
        "pr",
        "comment",
        prUrl,
        "--body",
        `❌ Auto-fix limit reached after ${CI_MAX_AUTO_FIX_ATTEMPTS} attempts. Manual intervention required.`,
      );
      return false;
    }

    fixAttempts++;
    console.log(`  Auto-fix attempt ${fixAttempts}/${CI_MAX_AUTO_FIX_ATTEMPTS}…`);
    await autoFixCi(prUrl, ticket, status.failedChecks);
  }

  // Wait for merge
  const merged = await waitForMerge(prUrl);
  return merged;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runAuto(ticketId: string, options: AutoOptions): Promise<void> {
  const cwd = process.cwd();

  if (!existsSync(join(cwd, ".harness.json"))) {
    console.error('No .harness.json found. Run "harness init" first.');
    process.exit(1);
  }

  const config = loadConfigOrNull(cwd);
  if (!config?.features.autoLoop) {
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

  // 6. CI monitoring + merge waiting
  const success = await monitorAndWait(prUrl, ticket);

  if (success) {
    try {
      await updateTicketStatus(ticket.id, ticket.team.id, "Done");
      console.log("\n  ✓ Status → Done");
    } catch {
      /* non-fatal */
    }
    console.log(`\n✅ ${ticket.identifier} complete. PR merged: ${prUrl}\n`);
  } else {
    console.log(`\n⚠  ${ticket.identifier} requires manual attention: ${prUrl}\n`);
    process.exit(1);
  }
}
