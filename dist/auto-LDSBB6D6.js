#!/usr/bin/env node
import {
  loadConfigOrNull
} from "./chunk-Q4LBGWBM.js";
import "./chunk-JRM7MC4Q.js";

// src/auto/index.ts
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// src/linear/client.ts
var LinearClientError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "LinearClientError";
  }
};
function getApiKey() {
  return process.env.HARNESS_LINEAR_API_KEY ?? process.env.LINEAR_API_KEY ?? null;
}
async function graphql(query, variables = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new LinearClientError(
      "Linear API key not found. Set HARNESS_LINEAR_API_KEY or LINEAR_API_KEY environment variable."
    );
  }
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey
    },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) {
    throw new LinearClientError(`Linear API error: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  if (json.errors?.length) {
    throw new LinearClientError(
      `Linear API errors: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }
  if (!json.data) {
    throw new LinearClientError("Linear API returned no data");
  }
  return json.data;
}
async function fetchTicket(identifier) {
  const data = await graphql(
    `query GetIssue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        url
        state { name type }
        team { id key }
      }
    }`,
    { id: identifier }
  );
  return data.issue;
}
async function fetchTeamStates(teamId) {
  const data = await graphql(
    `query GetTeamStates($teamId: String!) {
      team(id: $teamId) {
        states { nodes { id name type } }
      }
    }`,
    { teamId }
  );
  return data.team.states.nodes;
}
async function updateTicketStatus(issueId, teamId, stateName) {
  const states = await fetchTeamStates(teamId);
  const target = states.find((s) => s.name.toLowerCase() === stateName.toLowerCase());
  if (!target) {
    throw new LinearClientError(
      `State "${stateName}" not found in team. Available: ${states.map((s) => s.name).join(", ")}`
    );
  }
  await graphql(
    `mutation UpdateIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
      }
    }`,
    { id: issueId, stateId: target.id }
  );
}
async function createSubIssue(opts) {
  const data = await graphql(
    `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        issue { id identifier title url state { name type } team { id key } }
      }
    }`,
    {
      input: {
        parentId: opts.parentId,
        teamId: opts.teamId,
        title: opts.title,
        description: opts.description
      }
    }
  );
  return data.issueCreate.issue;
}
function formatTicketContext(ticket) {
  return `## Active Ticket: ${ticket.identifier}

**Title:** ${ticket.title}
**URL:** ${ticket.url}
**Status:** ${ticket.state.name}

### Description
${ticket.description ?? "_No description provided_"}

---
Use the acceptance criteria above as your definition of done.
Update ticket status as you progress: In Progress \u2192 In Review \u2192 Done.
`;
}
function isLinearAvailable() {
  return Boolean(getApiKey());
}

// src/linear/complexity.ts
var COMPLEXITY_THRESHOLD = 6;
function assessComplexity(ticket) {
  const reasons = [];
  let score = 0;
  const desc = ticket.description ?? "";
  const title = ticket.title;
  const checkboxes = (desc.match(/- \[[ x]\]/gi) ?? []).length;
  if (checkboxes >= 5) {
    score += 3;
    reasons.push(`${checkboxes} acceptance criteria (\u22655 \u2192 complex)`);
  } else if (checkboxes >= 3) {
    score += 1;
    reasons.push(`${checkboxes} acceptance criteria`);
  }
  const moduleKeywords = [
    "frontend",
    "backend",
    "api",
    "database",
    "auth",
    "ui",
    "cli",
    "migration",
    "deployment",
    "ci",
    "test"
  ];
  const foundModules = moduleKeywords.filter(
    (kw) => desc.toLowerCase().includes(kw) || title.toLowerCase().includes(kw)
  );
  if (foundModules.length >= 3) {
    score += 3;
    reasons.push(`touches ${foundModules.length} modules: ${foundModules.slice(0, 3).join(", ")}\u2026`);
  } else if (foundModules.length >= 2) {
    score += 1;
    reasons.push(`touches multiple modules: ${foundModules.join(", ")}`);
  }
  const vagueWords = ["refactor", "migrate", "redesign", "overhaul", "rewrite", "complete", "full"];
  const foundVague = vagueWords.filter((w) => (desc + title).toLowerCase().includes(w));
  if (foundVague.length > 0) {
    score += 2;
    reasons.push(`large-scope keywords: ${foundVague.join(", ")}`);
  }
  const wordCount = desc.split(/\s+/).filter(Boolean).length;
  if (wordCount > 300) {
    score += 1;
    reasons.push(`long description (${wordCount} words)`);
  }
  return {
    score,
    reasons,
    isComplex: score >= COMPLEXITY_THRESHOLD
  };
}
function proposeSplit(ticket) {
  const desc = ticket.description ?? "";
  const checkboxes = desc.split("\n").filter((l) => /^- \[[ x]\]/.test(l)).map((l) => l.replace(/^- \[[ x]\]\s*/, "").trim()).filter(Boolean);
  if (checkboxes.length >= 2) {
    const chunkSize = Math.ceil(checkboxes.length / Math.min(3, checkboxes.length));
    const chunks = [];
    for (let i = 0; i < checkboxes.length; i += chunkSize) {
      chunks.push(checkboxes.slice(i, i + chunkSize));
    }
    return chunks.map((chunk, i) => ({
      title: `[${i + 1}/${chunks.length}] ${ticket.title}: ${chunk[0]}${chunk.length > 1 ? " (+ more)" : ""}`,
      description: `Part ${i + 1} of ${chunks.length} from ${ticket.identifier}: ${ticket.title}

**Acceptance criteria:**
${chunk.map((c) => `- [ ] ${c}`).join("\n")}

Parent ticket: ${ticket.url}`
    }));
  }
  return [
    {
      title: `[1/3] ${ticket.title}: Setup & scaffolding`,
      description: `Setup phase for ${ticket.identifier}. Create necessary files, types, and interfaces.

Parent: ${ticket.url}`
    },
    {
      title: `[2/3] ${ticket.title}: Core implementation`,
      description: `Core implementation phase for ${ticket.identifier}.

Parent: ${ticket.url}`
    },
    {
      title: `[3/3] ${ticket.title}: Tests & integration`,
      description: `Tests and integration for ${ticket.identifier}.

Parent: ${ticket.url}`
    }
  ];
}

// src/auto/index.ts
var CI_POLL_INTERVAL_MS = 15e3;
var CI_MAX_AUTO_FIX_ATTEMPTS = 3;
function gh(...args) {
  const r = spawnSync("gh", args, { encoding: "utf-8", cwd: process.cwd() });
  return { stdout: r.stdout?.trim() ?? "", status: r.status ?? 1 };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function handleComplexity(ticket) {
  const complexity = assessComplexity(ticket);
  if (!complexity.isComplex) {
    console.log(`  Complexity score: ${complexity.score} \u2014 proceeding directly`);
    return ticket;
  }
  console.log(`
\u26A0  Ticket appears complex (score: ${complexity.score}):`);
  for (const r of complexity.reasons) console.log(`   \u2022 ${r}`);
  const splits = proposeSplit(ticket);
  console.log(`
  Proposed split into ${splits.length} sub-tickets:`);
  splits.forEach((s, i) => console.log(`   ${i + 1}. ${s.title}`));
  const { default: inquirer } = await import("inquirer");
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "How would you like to proceed?",
      choices: [
        { name: "Split into sub-tickets (recommended)", value: "split" },
        { name: "Proceed with original ticket (I accept the risk)", value: "proceed" }
      ]
    }
  ]);
  if (action === "proceed") return ticket;
  console.log("\n  Creating sub-tickets\u2026");
  const created = [];
  for (const split of splits) {
    const sub = await createSubIssue({
      parentId: ticket.id,
      teamId: ticket.team.id,
      title: split.title,
      description: split.description
    });
    console.log(`   \u2713 Created ${sub.identifier}: ${sub.title}`);
    created.push(sub);
  }
  return created[0];
}
function buildBranchName(ticket) {
  const id = ticket.identifier.toLowerCase().replace("-", "-");
  const slug = ticket.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40);
  return `${id}-${slug}`;
}
function buildSessionPrompt(ticket, branchName, simplify) {
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
4. Run tests and lint \u2014 fix any failures before pushing
5. Commit with conventional commit format
6. Push to remote
7. Create a PR with:
   - Title: [${ticket.identifier}] ${ticket.title}
   - Body: implementation plan + acceptance criteria checklist + link to ${ticket.url}
${simplify ? "8. Run /simplify on any files with >20 lines of changes" : ""}

Start now. When done, output the PR URL on a line by itself prefixed with "PR: ".`;
}
async function spawnClaudeSession(prompt) {
  console.log("  Spawning Claude Code session\u2026");
  const result = spawnSync("claude", ["--print", "--no-markdown", prompt], {
    encoding: "utf-8",
    cwd: process.cwd(),
    timeout: 30 * 60 * 1e3,
    // 30 minute timeout
    stdio: ["pipe", "pipe", "inherit"]
  });
  if (result.status !== 0) {
    console.error("  Claude session failed or timed out");
    return null;
  }
  const prMatch = result.stdout?.match(/^PR:\s*(https?:\/\/\S+)/m);
  return prMatch?.[1] ?? null;
}
async function getCiStatus(prUrl) {
  const result = gh("pr", "checks", prUrl, "--json", "name,state,conclusion");
  if (result.status !== 0) {
    return { state: "pending", failedChecks: [] };
  }
  try {
    const checks = JSON.parse(result.stdout);
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
async function getFailureLogs(prUrl, failedChecks) {
  const logs = [];
  for (const check of failedChecks.slice(0, 2)) {
    const result = gh("run", "view", "--log-failed", "--json", "jobs");
    if (result.status === 0) logs.push(`## ${check}
${result.stdout.slice(0, 2e3)}`);
  }
  return logs.join("\n\n") || "CI failed \u2014 check the PR for details.";
}
async function autoFixCi(prUrl, ticket, failedChecks) {
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
    timeout: 15 * 60 * 1e3,
    stdio: ["pipe", "pipe", "inherit"]
  });
  return result.status === 0;
}
async function waitForMerge(prUrl) {
  console.log("  Waiting for PR approval and merge\u2026");
  for (let attempt = 0; attempt < 120; attempt++) {
    await sleep(CI_POLL_INTERVAL_MS);
    const result = gh("pr", "view", prUrl, "--json", "state", "--jq", ".state");
    if (result.stdout === "MERGED") return true;
    if (result.stdout === "CLOSED") return false;
  }
  console.log("  Timed out waiting for merge (30 minutes)");
  return false;
}
async function monitorAndWait(prUrl, ticket) {
  console.log(`
  Monitoring CI for ${prUrl}`);
  let fixAttempts = 0;
  gh("pr", "comment", prUrl, "--body", "\u{1F916} CI checks running \u2014 will notify when ready for review.");
  for (; ; ) {
    await sleep(CI_POLL_INTERVAL_MS);
    const status = await getCiStatus(prUrl);
    if (status.state === "pending") {
      process.stdout.write(".");
      continue;
    }
    if (status.state === "success") {
      console.log("\n  \u2713 CI passed");
      gh(
        "pr",
        "comment",
        prUrl,
        "--body",
        "\u2705 CI passed \u2014 ready for review. Waiting for approval.\n\n_Automated by @tr-io/harness_"
      );
      break;
    }
    console.log(`
  \u2717 CI failed: ${status.failedChecks.join(", ")}`);
    if (fixAttempts >= CI_MAX_AUTO_FIX_ATTEMPTS) {
      console.log(`  Circuit breaker: ${CI_MAX_AUTO_FIX_ATTEMPTS} auto-fix attempts exhausted.`);
      console.log(`  Please review and fix manually: ${prUrl}`);
      gh(
        "pr",
        "comment",
        prUrl,
        "--body",
        `\u274C Auto-fix limit reached after ${CI_MAX_AUTO_FIX_ATTEMPTS} attempts. Manual intervention required.`
      );
      return false;
    }
    fixAttempts++;
    console.log(`  Auto-fix attempt ${fixAttempts}/${CI_MAX_AUTO_FIX_ATTEMPTS}\u2026`);
    await autoFixCi(prUrl, ticket, status.failedChecks);
  }
  const merged = await waitForMerge(prUrl);
  return merged;
}
async function runAuto(ticketId, options) {
  const cwd = process.cwd();
  if (!existsSync(join(cwd, ".harness.json"))) {
    console.error('No .harness.json found. Run "harness init" first.');
    process.exit(1);
  }
  const config = loadConfigOrNull(cwd);
  if (!config?.features.autoLoop) {
    console.error(
      'Auto loop is disabled. Enable it in .harness.json: "features": { "autoLoop": true }'
    );
    process.exit(1);
  }
  if (!isLinearAvailable()) {
    console.error("Linear API key not found. Set HARNESS_LINEAR_API_KEY or LINEAR_API_KEY.");
    process.exit(1);
  }
  console.log(`
\u{1F916} harness auto \u2014 ${ticketId}
`);
  let ticket;
  try {
    console.log("  Fetching ticket from Linear\u2026");
    ticket = await fetchTicket(ticketId);
    console.log(`  \u2713 ${ticket.identifier}: ${ticket.title}`);
  } catch (err) {
    if (err instanceof LinearClientError) {
      console.error(`  Linear error: ${err.message}`);
    } else {
      console.error(`  Failed to fetch ticket: ${err}`);
    }
    process.exit(1);
  }
  console.log("\n  Checking complexity\u2026");
  ticket = await handleComplexity(ticket);
  try {
    await updateTicketStatus(ticket.id, ticket.team.id, "In Progress");
    console.log("  \u2713 Status \u2192 In Progress");
  } catch {
    console.warn("  \u26A0 Could not update ticket status (continuing anyway)");
  }
  const branchName = buildBranchName(ticket);
  const sessionPrompt = buildSessionPrompt(ticket, branchName, Boolean(options.simplify));
  console.log(`
  Branch: ${branchName}`);
  const prUrl = await spawnClaudeSession(sessionPrompt);
  if (!prUrl) {
    console.error("\n  \u2717 Session completed but no PR URL found in output.");
    console.error("  Check the branch and create the PR manually.");
    process.exit(1);
  }
  console.log(`
  \u2713 PR created: ${prUrl}`);
  try {
    await updateTicketStatus(ticket.id, ticket.team.id, "In Review");
    console.log("  \u2713 Status \u2192 In Review");
  } catch {
  }
  const success = await monitorAndWait(prUrl, ticket);
  if (success) {
    try {
      await updateTicketStatus(ticket.id, ticket.team.id, "Done");
      console.log("\n  \u2713 Status \u2192 Done");
    } catch {
    }
    console.log(`
\u2705 ${ticket.identifier} complete. PR merged: ${prUrl}
`);
  } else {
    console.log(`
\u26A0  ${ticket.identifier} requires manual attention: ${prUrl}
`);
    process.exit(1);
  }
}
export {
  runAuto
};
//# sourceMappingURL=auto-LDSBB6D6.js.map