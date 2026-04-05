import type { TemplateContext } from "../../types.js";

export function claudeSettings(ctx: TemplateContext): string {
  const hooks: Record<string, unknown[] | undefined> = {
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
  if ((hooks.PostToolUse as unknown[]).length === 0) hooks.PostToolUse = undefined;
  if ((hooks.Stop as unknown[]).length === 0) hooks.Stop = undefined;

  return JSON.stringify({ hooks }, null, 2);
}
