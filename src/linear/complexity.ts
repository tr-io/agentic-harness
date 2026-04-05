/**
 * TRI-53: Ticket complexity assessment and splitting
 */
import type { LinearTicket } from "./client.js";

export interface ComplexityScore {
  score: number;
  reasons: string[];
  isComplex: boolean;
}

const COMPLEXITY_THRESHOLD = 6;

/** Assess ticket complexity from its content */
export function assessComplexity(ticket: LinearTicket): ComplexityScore {
  const reasons: string[] = [];
  let score = 0;

  const desc = ticket.description ?? "";
  const title = ticket.title;

  // Count acceptance criteria (checkbox lines)
  const checkboxes = (desc.match(/- \[[ x]\]/gi) ?? []).length;
  if (checkboxes >= 5) {
    score += 3;
    reasons.push(`${checkboxes} acceptance criteria (≥5 → complex)`);
  } else if (checkboxes >= 3) {
    score += 1;
    reasons.push(`${checkboxes} acceptance criteria`);
  }

  // Multiple module keywords in description
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
    "test",
  ];
  const foundModules = moduleKeywords.filter(
    (kw) => desc.toLowerCase().includes(kw) || title.toLowerCase().includes(kw),
  );
  if (foundModules.length >= 3) {
    score += 3;
    reasons.push(`touches ${foundModules.length} modules: ${foundModules.slice(0, 3).join(", ")}…`);
  } else if (foundModules.length >= 2) {
    score += 1;
    reasons.push(`touches multiple modules: ${foundModules.join(", ")}`);
  }

  // Vague/large-scope words
  const vagueWords = ["refactor", "migrate", "redesign", "overhaul", "rewrite", "complete", "full"];
  const foundVague = vagueWords.filter((w) => (desc + title).toLowerCase().includes(w));
  if (foundVague.length > 0) {
    score += 2;
    reasons.push(`large-scope keywords: ${foundVague.join(", ")}`);
  }

  // Long description
  const wordCount = desc.split(/\s+/).filter(Boolean).length;
  if (wordCount > 300) {
    score += 1;
    reasons.push(`long description (${wordCount} words)`);
  }

  return {
    score,
    reasons,
    isComplex: score >= COMPLEXITY_THRESHOLD,
  };
}

/** Generate proposed sub-ticket splits from a complex ticket */
export function proposeSplit(ticket: LinearTicket): Array<{ title: string; description: string }> {
  const desc = ticket.description ?? "";

  // Extract checkbox items as potential sub-tickets
  const checkboxes = desc
    .split("\n")
    .filter((l) => /^- \[[ x]\]/.test(l))
    .map((l) => l.replace(/^- \[[ x]\]\s*/, "").trim())
    .filter(Boolean);

  if (checkboxes.length >= 2) {
    // Group checkboxes into 2-3 incremental sub-tickets
    const chunkSize = Math.ceil(checkboxes.length / Math.min(3, checkboxes.length));
    const chunks: string[][] = [];
    for (let i = 0; i < checkboxes.length; i += chunkSize) {
      chunks.push(checkboxes.slice(i, i + chunkSize));
    }

    return chunks.map((chunk, i) => ({
      title: `[${i + 1}/${chunks.length}] ${ticket.title}: ${chunk[0]}${chunk.length > 1 ? " (+ more)" : ""}`,
      description: `Part ${i + 1} of ${chunks.length} from ${ticket.identifier}: ${ticket.title}\n\n**Acceptance criteria:**\n${chunk.map((c) => `- [ ] ${c}`).join("\n")}\n\nParent ticket: ${ticket.url}`,
    }));
  }

  // Fallback: split into setup + implementation + testing
  return [
    {
      title: `[1/3] ${ticket.title}: Setup & scaffolding`,
      description: `Setup phase for ${ticket.identifier}. Create necessary files, types, and interfaces.\n\nParent: ${ticket.url}`,
    },
    {
      title: `[2/3] ${ticket.title}: Core implementation`,
      description: `Core implementation phase for ${ticket.identifier}.\n\nParent: ${ticket.url}`,
    },
    {
      title: `[3/3] ${ticket.title}: Tests & integration`,
      description: `Tests and integration for ${ticket.identifier}.\n\nParent: ${ticket.url}`,
    },
  ];
}
