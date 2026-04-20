import { describe, expect, it } from "vitest";
import type { LinearTicket } from "../../linear/index.js";
import { buildBranchName, buildSessionPrompt } from "../index.js";

function makeTicket(overrides: Partial<LinearTicket> = {}): LinearTicket {
  return {
    id: "uuid-1",
    identifier: "TRI-42",
    title: "Add auth flow",
    description: "Implement authentication",
    url: "https://linear.app/triobox/issue/TRI-42",
    state: { name: "In Progress", type: "started" },
    team: { id: "team-1", key: "TRI" },
    ...overrides,
  };
}

// ─── buildBranchName ──────────────────────────────────────────────────────────

describe("buildBranchName", () => {
  it("produces lowercase id-slug format", () => {
    const ticket = makeTicket({ identifier: "TRI-42", title: "Add auth flow" });
    expect(buildBranchName(ticket)).toBe("tri-42-add-auth-flow");
  });

  it("strips special characters from title", () => {
    const ticket = makeTicket({ identifier: "TRI-10", title: "Fix (critical) bug @v2" });
    expect(buildBranchName(ticket)).toBe("tri-10-fix-critical-bug-v2");
  });

  it("truncates title slug to 40 characters", () => {
    const ticket = makeTicket({
      identifier: "TRI-1",
      title: "This is a very long title that exceeds the forty character limit easily",
    });
    const result = buildBranchName(ticket);
    const slug = result.replace(/^tri-1-/, "");
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it("strips trailing dash after truncation", () => {
    // Construct a title that after slicing to 40 chars ends with a dash
    const ticket = makeTicket({
      identifier: "TRI-1",
      // "add auth flow for all existing users an" = 39 chars with no trailing dash edge case
      // Make title that ends with word boundary at exactly 40
      title: "add auth flow for all existing users and admins in the system",
    });
    const result = buildBranchName(ticket);
    expect(result).not.toMatch(/-$/);
  });

  it("collapses consecutive dashes", () => {
    const ticket = makeTicket({ identifier: "TRI-5", title: "foo -- bar  baz" });
    // "foo -- bar  baz" → strip special → "foo  bar  baz" → replace spaces with dash → "foo--bar--baz" → collapse → "foo-bar-baz"
    expect(buildBranchName(ticket)).toBe("tri-5-foo-bar-baz");
  });

  it("handles all-special-char title gracefully", () => {
    const ticket = makeTicket({ identifier: "TRI-99", title: "!!! *** ???" });
    const result = buildBranchName(ticket);
    expect(result).toMatch(/^tri-99/);
    // Should not throw
  });

  it("lowercases the identifier", () => {
    const ticket = makeTicket({ identifier: "ENG-7", title: "fix bug" });
    expect(buildBranchName(ticket)).toMatch(/^eng-7-/);
  });
});

// ─── buildSessionPrompt ───────────────────────────────────────────────────────

describe("buildSessionPrompt", () => {
  it("contains the ticket identifier and title", () => {
    const ticket = makeTicket({ identifier: "TRI-42", title: "Add auth flow" });
    const prompt = buildSessionPrompt(ticket, "tri-42-add-auth-flow", false);
    expect(prompt).toContain("TRI-42");
    expect(prompt).toContain("Add auth flow");
  });

  it("contains the branch name in a git checkout command", () => {
    const ticket = makeTicket();
    const branch = "tri-42-add-auth-flow";
    const prompt = buildSessionPrompt(ticket, branch, false);
    expect(prompt).toContain(branch);
    expect(prompt).toContain("git checkout -b");
  });

  it("contains the ticket URL", () => {
    const ticket = makeTicket({ url: "https://linear.app/triobox/issue/TRI-42" });
    const prompt = buildSessionPrompt(ticket, "tri-42-add-auth-flow", false);
    expect(prompt).toContain("https://linear.app/triobox/issue/TRI-42");
  });

  it("includes simplify step when simplify flag is true", () => {
    const ticket = makeTicket();
    const prompt = buildSessionPrompt(ticket, "tri-42-add-auth-flow", true);
    expect(prompt).toContain("/simplify");
  });

  it("omits simplify step when simplify flag is false", () => {
    const ticket = makeTicket();
    const prompt = buildSessionPrompt(ticket, "tri-42-add-auth-flow", false);
    expect(prompt).not.toContain("/simplify");
  });

  it("asks agent to output PR URL with 'PR: ' prefix", () => {
    const ticket = makeTicket();
    const prompt = buildSessionPrompt(ticket, "tri-42-branch", false);
    expect(prompt).toContain("PR: ");
  });
});
