/** Scaffolded as .claude/hooks/artifact-freshness.js in the target project */
export function artifactFreshnessScript(): string {
  return `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const tool = input?.tool_name ?? "";
const command = input?.tool_input?.command ?? "";

if (tool !== "Bash" || !command.includes("git commit")) process.exit(0);

const diff = spawnSync("git", ["diff-tree", "--no-commit-id", "-r", "--name-only", "HEAD"], {
  encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
});
if (diff.status !== 0) process.exit(0);

const changedFiles = (diff.stdout ?? "").trim().split("\\n").filter(Boolean);

let manifest = { mappings: [] };
try {
  if (existsSync(".ai/manifest.json")) {
    manifest = JSON.parse(readFileSync(".ai/manifest.json", "utf-8"));
  }
} catch { process.exit(0); }

const stale = [];
for (const mapping of manifest.mappings ?? []) {
  const { sourcePaths = [], docs = [] } = mapping;
  const prefix = (p) => p.replace("/**", "").replace("/*", "");
  const sourceChanged = sourcePaths.some((pat) => changedFiles.some((f) => f.startsWith(prefix(pat))));
  if (!sourceChanged) continue;
  const docChanged = docs.some((doc) => changedFiles.includes(doc));
  if (!docChanged) stale.push(...docs);
}

if (stale.length === 0) process.exit(0);

process.stderr.write(\`
[harness] ARTIFACT FRESHNESS WARNING

Code changed but these .ai/ docs were not updated:
\${[...new Set(stale)].map((d) => "  • " + d).join("\\n")}

Update them if your changes affected the patterns they document. Warning only.
\`);

process.exit(0);
`;
}
