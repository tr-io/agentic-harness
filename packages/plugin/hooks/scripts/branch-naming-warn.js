#!/usr/bin/env node
// Source: src/scaffolder/hooks/branch-naming-warn.ts — keep in sync
// branch-naming-warn.js — recommended warning hook (non-blocking)
// Warns when a new branch name doesn't follow the <ticket-id>-<description> convention.

import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const tool = input?.tool_name ?? "";
const command = input?.tool_input?.command ?? "";

if (tool !== "Bash") process.exit(0);

// Match git checkout -b <name> or git switch -c <name>
const checkoutMatch = command.match(/git\s+checkout\s+-b\s+(\S+)/);
const switchMatch = command.match(/git\s+switch\s+-c\s+(\S+)/);
const branchName = (checkoutMatch?.[1] ?? switchMatch?.[1] ?? "").trim();

if (!branchName) process.exit(0);

// Valid patterns:
//   <ticket-id>-<description>   e.g. tri-42-add-auth, col-7-fix-login
//   feature/<description>       fallback when no ticket
const validPattern = /^[a-z]+-\d+-[a-z0-9-]+$|^feature\/[a-z0-9-]+$/;

if (!validPattern.test(branchName)) {
  process.stderr.write(`
[harness] WARNING: Branch name "${branchName}" doesn't follow the convention.

  Preferred: <ticket-id>-<description>  (e.g. tri-42-add-auth)
  Fallback:  feature/<description>      (e.g. feature/add-logging)

This is a warning only — the branch was created. Consider renaming it.

`);
}

process.exit(0);
