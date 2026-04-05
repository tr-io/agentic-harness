import type { TemplateContext } from "../../types.js";

export function claudeSettings(ctx: TemplateContext): string {
  const hooks: Record<string, unknown[]> = {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: "node .claude/hooks/pre-push-check.js",
          },
        ],
      },
    ],
    PostToolUse: [],
    Stop: [],
  };

  if (ctx.features.branchNamingWarning) {
    (hooks.PreToolUse as unknown[]).push({
      matcher: "Bash",
      hooks: [
        {
          type: "command",
          command: "node .claude/hooks/branch-naming-warn.js",
        },
      ],
    });
  }

  if (ctx.features.artifactFreshnessCheck) {
    (hooks.PostToolUse as unknown[]).push({
      matcher: "Bash",
      hooks: [
        {
          type: "command",
          command: "node .claude/hooks/artifact-freshness.js",
        },
      ],
    });
  }

  if (ctx.features.completionReminder) {
    (hooks.Stop as unknown[]).push({
      hooks: [
        {
          type: "command",
          command: "node .claude/hooks/completion-reminder.js",
        },
      ],
    });
  }

  // Remove empty arrays
  if (hooks.PostToolUse.length === 0) delete hooks.PostToolUse;
  if (hooks.Stop.length === 0) delete hooks.Stop;

  return JSON.stringify({ hooks }, null, 2);
}
