import type { ScaffoldedFile } from "./types.js";

/**
 * Builds a directory-tree TOC of .ai/ files for inclusion in CLAUDE.md.
 * Groups files by their top-level segment under .ai/ (dirs collapsed to one entry).
 */
export function buildToc(files: ScaffoldedFile[]): string {
  const aiFiles = files.filter((f) => f.path.startsWith(".ai/"));

  // Map top-level key (e.g. "agent-instructions/" or "README.md") to description
  const groups = new Map<string, string | undefined>();

  for (const file of aiFiles) {
    const relative = file.path.slice(".ai/".length);
    const parts = relative.split("/");
    const key = parts.length > 1 ? `${parts[0]}/` : parts[0];
    if (!groups.has(key)) {
      groups.set(key, file.description);
    }
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    const aDir = a.endsWith("/");
    const bDir = b.endsWith("/");
    if (aDir && !bDir) return -1;
    if (!aDir && bDir) return 1;
    return a.localeCompare(b);
  });

  const lines = [".ai/"];
  for (let i = 0; i < sorted.length; i++) {
    const [key, description] = sorted[i];
    const isLast = i === sorted.length - 1;
    const prefix = isLast ? "└── " : "├── ";
    const desc = description ? `     ← ${description}` : "";
    lines.push(`${prefix}${key}${desc}`);
  }

  return lines.join("\n");
}
