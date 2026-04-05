#!/usr/bin/env node
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
} catch {
  /* no config — use defaults */
}

const prePush = config?.hooks?.prePush ?? { lint: true, typeCheck: true, unitTest: true };
const project = config?.project ?? {};

function run(label, cmd) {
  if (!cmd) return;
  // Split command string into executable + args to avoid shell injection
  const [bin, ...args] = cmd.split(/\s+/);
  process.stderr.write(`\n[harness] Running ${label}: ${cmd}\n`);
  const result = spawnSync(bin, args, { stdio: "inherit", cwd: process.cwd(), shell: false });
  if (result.status !== 0) {
    process.stderr.write(
      `\n[harness] BLOCKED: ${label} failed. Fix the issues above then push again.\n\n`,
    );
    process.exit(1);
  }
}

if (prePush.lint !== false && project.lintCommand) run("lint", project.lintCommand);
if (prePush.typeCheck !== false && project.typeCheckCommand)
  run("type check", project.typeCheckCommand);
if (prePush.unitTest !== false && project.testCommand) run("tests", project.testCommand);

process.exit(0);
