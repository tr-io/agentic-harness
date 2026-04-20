#!/usr/bin/env node
// Source: src/scaffolder/hooks/completion-reminder.ts — keep in sync
import { spawnSync } from "node:child_process";

function git(...args) {
  const r = spawnSync("git", args, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  return r.stdout?.trim() ?? "";
}

const status = git("status", "--porcelain");
const unpushed = git("log", "@{u}..", "--oneline");
const hasUncommitted = status.length > 0;
const hasUnpushed = unpushed.length > 0;

if (!hasUncommitted && !hasUnpushed) process.exit(0);

const changedFiles = status.split("\n").filter(Boolean).map((l) => l.slice(3));

// Detect substantially changed files (>20 lines inserted)
let largeFiles = [];
const diffStat = spawnSync("git", ["diff", "--stat", "HEAD"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
if (diffStat.status === 0) {
  largeFiles = (diffStat.stdout ?? "")
    .split("\n")
    .filter((l) => { const m = l.match(/(\d+) insertion/); return m && parseInt(m[1], 10) > 20; })
    .map((l) => l.split("|")[0].trim())
    .filter(Boolean);
}

process.stderr.write(`
[harness] SESSION ENDING WITH WORK IN PROGRESS
${hasUncommitted ? "\nUncommitted:\n" + changedFiles.map((f) => "  • " + f).join("\n") : ""}
${hasUnpushed ? "\nUnpushed:\n" + unpushed.split("\n").map((l) => "  • " + l).join("\n") : ""}

Self-review checklist:
  □  All acceptance criteria met
  □  No placeholder/stub implementations
  □  No commented-out code
  □  No hardcoded secrets or local paths
  □  Tests cover happy path and edge cases
  □  .ai/ docs updated if architecture/patterns changed
  □  Commit messages follow conventional format
${largeFiles.length > 0 ? "\nConsider /simplify on:\n" + largeFiles.map((f) => "  • " + f).join("\n") : ""}
`);

process.exit(0);
