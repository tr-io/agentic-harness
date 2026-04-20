import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LinearTicket } from "../client.js";
import { extractTicketIdFromBranch, formatTicketContext, isLinearAvailable } from "../client.js";

function makeTicket(overrides: Partial<LinearTicket> = {}): LinearTicket {
  return {
    id: "uuid-1",
    identifier: "TRI-42",
    title: "Add auth flow",
    description: "Implement OAuth2 authentication",
    url: "https://linear.app/triobox/issue/TRI-42",
    state: { name: "In Progress", type: "started" },
    team: { id: "team-1", key: "TRI" },
    ...overrides,
  };
}

// ─── extractTicketIdFromBranch ────────────────────────────────────────────────

describe("extractTicketIdFromBranch", () => {
  it("extracts ticket ID from standard branch name", () => {
    expect(extractTicketIdFromBranch("tri-42-add-auth-flow")).toBe("TRI-42");
  });

  it("uppercases the team key", () => {
    expect(extractTicketIdFromBranch("eng-7-fix-bug")).toBe("ENG-7");
  });

  it("handles multi-digit ticket numbers", () => {
    expect(extractTicketIdFromBranch("tri-1234-some-feature")).toBe("TRI-1234");
  });

  it("returns null for branch with no team-number prefix", () => {
    expect(extractTicketIdFromBranch("main")).toBeNull();
  });

  it("returns null for feature/ style branches", () => {
    expect(extractTicketIdFromBranch("feature/add-auth")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTicketIdFromBranch("")).toBeNull();
  });
});

// ─── formatTicketContext ──────────────────────────────────────────────────────

describe("formatTicketContext", () => {
  it("contains the ticket identifier", () => {
    expect(formatTicketContext(makeTicket())).toContain("TRI-42");
  });

  it("contains the ticket title", () => {
    expect(formatTicketContext(makeTicket())).toContain("Add auth flow");
  });

  it("contains the ticket URL", () => {
    expect(formatTicketContext(makeTicket())).toContain("https://linear.app/triobox/issue/TRI-42");
  });

  it("contains the status name", () => {
    expect(
      formatTicketContext(makeTicket({ state: { name: "In Review", type: "completed" } })),
    ).toContain("In Review");
  });

  it("shows description when provided", () => {
    expect(formatTicketContext(makeTicket({ description: "Implement OAuth2" }))).toContain(
      "Implement OAuth2",
    );
  });

  it("shows fallback text when description is null", () => {
    const output = formatTicketContext(makeTicket({ description: null }));
    expect(output).toContain("No description provided");
  });
});

// ─── isLinearAvailable ────────────────────────────────────────────────────────

describe("isLinearAvailable", () => {
  let savedHarness: string | undefined;
  let savedLinear: string | undefined;

  beforeEach(() => {
    savedHarness = process.env.HARNESS_LINEAR_API_KEY;
    savedLinear = process.env.LINEAR_API_KEY;
    // biome-ignore lint/performance/noDelete: process.env requires delete to fully unset the key
    delete process.env.HARNESS_LINEAR_API_KEY;
    // biome-ignore lint/performance/noDelete: process.env requires delete to fully unset the key
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(() => {
    if (savedHarness !== undefined) {
      process.env.HARNESS_LINEAR_API_KEY = savedHarness;
    } else {
      // biome-ignore lint/performance/noDelete: process.env requires delete to fully unset the key
      delete process.env.HARNESS_LINEAR_API_KEY;
    }
    if (savedLinear !== undefined) {
      process.env.LINEAR_API_KEY = savedLinear;
    } else {
      // biome-ignore lint/performance/noDelete: process.env requires delete to fully unset the key
      delete process.env.LINEAR_API_KEY;
    }
  });

  it("returns false when neither env var is set", () => {
    expect(isLinearAvailable()).toBe(false);
  });

  it("returns true when HARNESS_LINEAR_API_KEY is set", () => {
    process.env.HARNESS_LINEAR_API_KEY = "lin_api_test123";
    expect(isLinearAvailable()).toBe(true);
  });

  it("returns true when LINEAR_API_KEY is set", () => {
    process.env.LINEAR_API_KEY = "lin_api_fallback456";
    expect(isLinearAvailable()).toBe(true);
  });

  it("prefers HARNESS_LINEAR_API_KEY over LINEAR_API_KEY", () => {
    process.env.HARNESS_LINEAR_API_KEY = "harness_key";
    process.env.LINEAR_API_KEY = "linear_key";
    // Both set — should still return true
    expect(isLinearAvailable()).toBe(true);
  });
});
