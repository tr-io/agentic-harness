#!/usr/bin/env node
import {
  loadConfigOrNull
} from "./chunk-Q4LBGWBM.js";
import "./chunk-JRM7MC4Q.js";
import "./chunk-ZWE3DS7E.js";

// src/check/index.ts
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
function pass(label, detail) {
  return { status: "pass", label, detail };
}
function warn(label, detail) {
  return { status: "warn", label, detail };
}
function fail(label, detail) {
  return { status: "fail", label, detail };
}
function checkFile(dir, rel, description) {
  return existsSync(join(dir, rel)) ? pass(description) : fail(description, `Missing: ${rel} \u2014 run "harness init" to scaffold`);
}
function lineCount(filePath) {
  try {
    return readFileSync(filePath, "utf-8").split("\n").length;
  } catch {
    return 0;
  }
}
async function runCheck() {
  const cwd = process.cwd();
  const results = [];
  const config = loadConfigOrNull(cwd);
  if (!config) {
    results.push(fail(".harness.json", 'Not found \u2014 run "harness init" to set up the harness'));
  } else {
    results.push(pass(".harness.json", "Valid config loaded"));
  }
  results.push(checkFile(cwd, "CLAUDE.md", "CLAUDE.md"));
  results.push(checkFile(cwd, ".ai/README.md", ".ai/README.md"));
  results.push(
    checkFile(
      cwd,
      ".ai/agent-instructions/session-protocol.md",
      ".ai/agent-instructions/session-protocol.md"
    )
  );
  results.push(
    checkFile(cwd, ".ai/agent-instructions/pre-plan.md", ".ai/agent-instructions/pre-plan.md")
  );
  results.push(
    checkFile(cwd, ".ai/agent-instructions/pre-push.md", ".ai/agent-instructions/pre-push.md")
  );
  results.push(checkFile(cwd, ".ai/manifest.json", ".ai/manifest.json"));
  results.push(checkFile(cwd, ".claude/settings.json", ".claude/settings.json"));
  results.push(
    checkFile(cwd, ".claude/hooks/pre-push-check.js", ".claude/hooks/pre-push-check.js")
  );
  const claudeMdPath = join(cwd, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    const lines = lineCount(claudeMdPath);
    if (lines <= 100) {
      results.push(pass("CLAUDE.md line count", `${lines} lines (\u2264100 \u2713)`));
    } else {
      results.push(
        warn(
          "CLAUDE.md line count",
          `${lines} lines \u2014 exceeds ~100 line target. Consider moving details to .ai/ subdocs.`
        )
      );
    }
  }
  if (config) {
    if (config.features.adr) {
      const r = existsSync(join(cwd, ".ai/adr/README.md")) ? pass(".ai/adr/README.md") : warn(
        ".ai/adr/README.md",
        "adr feature enabled but .ai/adr/README.md missing \u2014 run harness init"
      );
      results.push(r);
    }
    if (config.features.testingDocs) {
      const r = existsSync(join(cwd, ".ai/testing/conventions.md")) ? pass(".ai/testing/conventions.md") : warn(
        ".ai/testing/conventions.md",
        "testingDocs feature enabled but file missing \u2014 run harness init"
      );
      results.push(r);
    }
    const hookChecks = [
      [".claude/hooks/branch-naming-warn.js", "branchNamingWarning"],
      [".claude/hooks/completion-reminder.js", "completionReminder"],
      [".claude/hooks/artifact-freshness.js", "artifactFreshnessCheck"]
    ];
    for (const [rel, feature] of hookChecks) {
      if (config.features[feature]) {
        const hookPath = join(cwd, rel);
        if (!existsSync(hookPath)) {
          results.push(
            warn(rel, `Feature ${feature} enabled but hook script missing \u2014 run harness init`)
          );
        } else {
          results.push(pass(rel));
        }
      }
    }
    const commands = [
      [config.project.testCommand, "testCommand"],
      [config.project.lintCommand, "lintCommand"]
    ];
    for (const [cmd, name] of commands) {
      if (!cmd) {
        results.push(
          warn(
            name,
            `${name} not configured in .harness.json \u2014 pre-push hook will skip this check`
          )
        );
      } else {
        results.push(pass(name, cmd));
      }
    }
  }
  const icons = { pass: "\u2713", warn: "\u26A0", fail: "\u2717" };
  const counts = { pass: 0, warn: 0, fail: 0 };
  console.log("\n Harness Health Check\n");
  for (const r of results) {
    counts[r.status]++;
    const icon = icons[r.status];
    const detail = r.detail ? `  \u2192 ${r.detail}` : "";
    console.log(` ${icon}  ${r.label}${detail ? `
    ${r.detail}` : ""}`);
  }
  console.log(`
${counts.pass} passed, ${counts.warn} warnings, ${counts.fail} failed
`);
  if (counts.fail > 0) process.exit(1);
}
export {
  runCheck
};
//# sourceMappingURL=check-X7MPRF2Y.js.map