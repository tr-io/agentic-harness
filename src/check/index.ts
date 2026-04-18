import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadConfigOrNull } from "../config/loader.js";

type CheckStatus = "pass" | "warn" | "fail";

interface CheckResult {
  status: CheckStatus;
  label: string;
  detail?: string;
}

function pass(label: string, detail?: string): CheckResult {
  return { status: "pass", label, detail };
}
function warn(label: string, detail: string): CheckResult {
  return { status: "warn", label, detail };
}
function fail(label: string, detail: string): CheckResult {
  return { status: "fail", label, detail };
}

function checkFile(dir: string, rel: string, description: string): CheckResult {
  return existsSync(join(dir, rel))
    ? pass(description)
    : fail(description, `Missing: ${rel} — run "harness init" to scaffold`);
}

function lineCount(filePath: string): number {
  try {
    return readFileSync(filePath, "utf-8").split("\n").length;
  } catch {
    return 0;
  }
}

function isExecutable(filePath: string): boolean {
  try {
    const mode = statSync(filePath).mode;
    return (mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export async function runCheck(): Promise<void> {
  const cwd = process.cwd();
  const results: CheckResult[] = [];

  // 1. .harness.json
  const config = loadConfigOrNull(cwd);
  if (!config) {
    results.push(fail(".harness.json", 'Not found — run "harness init" to set up the harness'));
  } else {
    results.push(pass(".harness.json", "Valid config loaded"));
  }

  // 2. Mandatory artifacts
  results.push(checkFile(cwd, "CLAUDE.md", "CLAUDE.md"));
  results.push(checkFile(cwd, ".ai/README.md", ".ai/README.md"));
  results.push(
    checkFile(
      cwd,
      ".ai/agent-instructions/session-protocol.md",
      ".ai/agent-instructions/session-protocol.md",
    ),
  );
  results.push(
    checkFile(cwd, ".ai/agent-instructions/pre-plan.md", ".ai/agent-instructions/pre-plan.md"),
  );
  results.push(
    checkFile(cwd, ".ai/agent-instructions/pre-push.md", ".ai/agent-instructions/pre-push.md"),
  );
  results.push(checkFile(cwd, ".ai/manifest.json", ".ai/manifest.json"));
  results.push(checkFile(cwd, ".claude/settings.json", ".claude/settings.json"));
  results.push(
    checkFile(cwd, ".claude/hooks/pre-push-check.js", ".claude/hooks/pre-push-check.js"),
  );

  // 2b. Mandatory .ai/ subdirectories and topic docs (new structure)
  const mandatoryAiDocs: Array<[string, string]> = [
    [".ai/design-docs/README.md", ".ai/design-docs/README.md"],
    [".ai/exec-plans/README.md", ".ai/exec-plans/README.md"],
    [".ai/generated/README.md", ".ai/generated/README.md"],
    [".ai/product-specs/README.md", ".ai/product-specs/README.md"],
    [".ai/references/README.md", ".ai/references/README.md"],
    [".ai/ARCHITECTURE.md", ".ai/ARCHITECTURE.md"],
    [".ai/DESIGN.md", ".ai/DESIGN.md"],
    [".ai/PLANS.md", ".ai/PLANS.md"],
    [".ai/PRODUCT_SENSE.md", ".ai/PRODUCT_SENSE.md"],
    [".ai/QUALITY_SCORE.md", ".ai/QUALITY_SCORE.md"],
    [".ai/RELIABILITY.md", ".ai/RELIABILITY.md"],
    [".ai/SECURITY.md", ".ai/SECURITY.md"],
  ];
  for (const [rel, label] of mandatoryAiDocs) {
    results.push(checkFile(cwd, rel, label));
  }

  // 3. CLAUDE.md line count
  const claudeMdPath = join(cwd, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    const lines = lineCount(claudeMdPath);
    if (lines <= 100) {
      results.push(pass("CLAUDE.md line count", `${lines} lines (≤100 ✓)`));
    } else {
      results.push(
        warn(
          "CLAUDE.md line count",
          `${lines} lines — exceeds ~100 line target. Consider moving details to .ai/ subdocs.`,
        ),
      );
    }
  }

  // 4. Recommended artifacts (if enabled)
  if (config) {
    if (config.features.adr) {
      const r = existsSync(join(cwd, ".ai/adr/README.md"))
        ? pass(".ai/adr/README.md")
        : warn(
            ".ai/adr/README.md",
            "adr feature enabled but .ai/adr/README.md missing — run harness init",
          );
      results.push(r);
    }
    if (config.features.testingDocs) {
      const r = existsSync(join(cwd, ".ai/testing/conventions.md"))
        ? pass(".ai/testing/conventions.md")
        : warn(
            ".ai/testing/conventions.md",
            "testingDocs feature enabled but file missing — run harness init",
          );
      results.push(r);
    }

    // 5. Hook script existence
    const hookChecks: Array<[string, string]> = [
      [".claude/hooks/branch-naming-warn.js", "branchNamingWarning"],
      [".claude/hooks/completion-reminder.js", "completionReminder"],
      [".claude/hooks/artifact-freshness.js", "artifactFreshnessCheck"],
    ];
    for (const [rel, feature] of hookChecks) {
      if (config.features[feature as keyof typeof config.features]) {
        const hookPath = join(cwd, rel);
        if (!existsSync(hookPath)) {
          results.push(
            warn(rel, `Feature ${feature} enabled but hook script missing — run harness init`),
          );
        } else {
          results.push(pass(rel));
        }
      }
    }

    // 6. Skill files (if enabled)
    if (config.features.skills) {
      const skillChecks: Array<[string, string]> = [
        [".claude/skills/add-ticket.md", "skills.addTicket"],
        [".claude/skills/build.md", "skills.build"],
      ];
      const skillEnabled: Record<string, boolean> = {
        "skills.addTicket": config.features.skills.addTicket,
        "skills.build": config.features.skills.build,
      };
      for (const [rel, feature] of skillChecks) {
        if (skillEnabled[feature]) {
          const skillPath = join(cwd, rel);
          if (!existsSync(skillPath)) {
            results.push(
              fail(rel, `Feature ${feature} enabled but skill file missing — run harness init`),
            );
          } else {
            results.push(pass(rel));
          }
        }
      }
    }

    // 7. Commands configured
    const commands: Array<[string, string]> = [
      [config.project.testCommand, "testCommand"],
      [config.project.lintCommand, "lintCommand"],
    ];
    for (const [cmd, name] of commands) {
      if (!cmd) {
        results.push(
          warn(
            name,
            `${name} not configured in .harness.json — pre-push hook will skip this check`,
          ),
        );
      } else {
        results.push(pass(name, cmd));
      }
    }
  }

  // Print results
  const icons: Record<CheckStatus, string> = { pass: "✓", warn: "⚠", fail: "✗" };
  const counts = { pass: 0, warn: 0, fail: 0 };

  console.log("\n Harness Health Check\n");
  for (const r of results) {
    counts[r.status]++;
    const icon = icons[r.status];
    const detail = r.detail ? `  → ${r.detail}` : "";
    console.log(` ${icon}  ${r.label}${detail ? `\n    ${r.detail}` : ""}`);
  }

  console.log(`\n${counts.pass} passed, ${counts.warn} warnings, ${counts.fail} failed\n`);

  if (counts.fail > 0) process.exit(1);
}
