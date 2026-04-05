import { describe, expect, it } from "vitest";
import { assessComplexity, proposeSplit } from "../complexity.js";
import type { LinearTicket } from "../client.js";

function makeTicket(overrides: Partial<LinearTicket> = {}): LinearTicket {
  return {
    id: "abc-123",
    identifier: "TRI-99",
    title: "Add feature",
    description: null,
    url: "https://linear.app/triobox/issue/TRI-99",
    state: { name: "Backlog", type: "backlog" },
    team: { id: "team-1", key: "TRI" },
    ...overrides,
  };
}

describe("assessComplexity", () => {
  it("returns low score for simple ticket", () => {
    const ticket = makeTicket({ title: "Fix typo in README", description: "Just fix it." });
    const result = assessComplexity(ticket);
    expect(result.score).toBeLessThan(6);
    expect(result.isComplex).toBe(false);
  });

  it("scores high for many acceptance criteria", () => {
    const desc = Array.from({ length: 6 }, (_, i) => `- [ ] Criteria ${i + 1}`).join("\n");
    const ticket = makeTicket({ description: desc });
    const result = assessComplexity(ticket);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.reasons.some((r) => r.includes("acceptance criteria"))).toBe(true);
  });

  it("scores high for multiple module keywords", () => {
    const ticket = makeTicket({
      description: "Update frontend, backend API, and database migration together",
    });
    const result = assessComplexity(ticket);
    expect(result.score).toBeGreaterThan(0);
  });

  it("scores high for large-scope words", () => {
    const ticket = makeTicket({ title: "Refactor entire auth system" });
    const result = assessComplexity(ticket);
    expect(result.reasons.some((r) => r.includes("refactor"))).toBe(true);
  });

  it("marks complex when score >= 6", () => {
    // Many checkboxes + vague words + multiple modules
    const desc = [
      ...Array.from({ length: 6 }, (_, i) => `- [ ] Step ${i + 1}`),
      "Refactor the frontend and backend API and database",
    ].join("\n");
    const ticket = makeTicket({ title: "Rewrite auth", description: desc });
    const result = assessComplexity(ticket);
    expect(result.isComplex).toBe(true);
  });
});

describe("proposeSplit", () => {
  it("splits checkbox items into chunks", () => {
    const desc = Array.from({ length: 6 }, (_, i) => `- [ ] Task ${i + 1}`).join("\n");
    const ticket = makeTicket({ description: desc });
    const splits = proposeSplit(ticket);
    expect(splits.length).toBeGreaterThanOrEqual(2);
    expect(splits.length).toBeLessThanOrEqual(3);
  });

  it("falls back to setup/impl/test split with no checkboxes", () => {
    const ticket = makeTicket({ description: "Some description without checkboxes." });
    const splits = proposeSplit(ticket);
    expect(splits).toHaveLength(3);
    expect(splits[0].title).toContain("Setup");
    expect(splits[1].title).toContain("implementation");
    expect(splits[2].title).toContain("Tests");
  });

  it("each sub-ticket links back to parent", () => {
    const ticket = makeTicket();
    const splits = proposeSplit(ticket);
    for (const split of splits) {
      expect(split.description).toContain(ticket.url);
    }
  });
});
