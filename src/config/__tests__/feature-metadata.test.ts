import { describe, expect, it } from "vitest";
import { FEATURE_METADATA } from "../feature-metadata.js";

describe("FEATURE_METADATA", () => {
  const entries = Object.entries(FEATURE_METADATA);

  it("has at least one feedforward entry", () => {
    expect(entries.some(([, m]) => m.controlType === "feedforward")).toBe(true);
  });

  it("has at least one feedback entry", () => {
    expect(entries.some(([, m]) => m.controlType === "feedback")).toBe(true);
  });

  it("has at least one computational entry", () => {
    expect(entries.some(([, m]) => m.executionType === "computational")).toBe(true);
  });

  it("has at least one inferential entry", () => {
    expect(entries.some(([, m]) => m.executionType === "inferential")).toBe(true);
  });

  it("every entry has a valid controlType", () => {
    for (const [key, meta] of entries) {
      expect(
        ["feedforward", "feedback"].includes(meta.controlType),
        `${key}.controlType is invalid: ${meta.controlType}`,
      ).toBe(true);
    }
  });

  it("every entry has a valid executionType", () => {
    for (const [key, meta] of entries) {
      expect(
        ["computational", "inferential"].includes(meta.executionType),
        `${key}.executionType is invalid: ${meta.executionType}`,
      ).toBe(true);
    }
  });

  it("every entry has a non-empty description", () => {
    for (const [key, meta] of entries) {
      expect(meta.description.length, `${key}.description is empty`).toBeGreaterThan(0);
    }
  });

  it("includes expected feedforward keys", () => {
    const keys = Object.keys(FEATURE_METADATA);
    for (const k of ["adr", "testingDocs", "linterBootstrap", "skills", "evaluatorQA"]) {
      expect(keys, `expected key "${k}" to be present`).toContain(k);
    }
  });

  it("includes expected feedback keys", () => {
    const keys = Object.keys(FEATURE_METADATA);
    for (const k of [
      "branchNamingWarning",
      "artifactFreshnessCheck",
      "completionReminder",
      "autoLoop",
      "keelEnforcement",
    ]) {
      expect(keys, `expected key "${k}" to be present`).toContain(k);
    }
  });

  it("adr is classified as feedforward / computational", () => {
    expect(FEATURE_METADATA.adr.controlType).toBe("feedforward");
    expect(FEATURE_METADATA.adr.executionType).toBe("computational");
  });

  it("completionReminder is classified as feedback / inferential", () => {
    expect(FEATURE_METADATA.completionReminder.controlType).toBe("feedback");
    expect(FEATURE_METADATA.completionReminder.executionType).toBe("inferential");
  });

  it("skills is classified as feedforward / inferential", () => {
    expect(FEATURE_METADATA.skills.controlType).toBe("feedforward");
    expect(FEATURE_METADATA.skills.executionType).toBe("inferential");
  });

  it("branchNamingWarning is classified as feedback / computational", () => {
    expect(FEATURE_METADATA.branchNamingWarning.controlType).toBe("feedback");
    expect(FEATURE_METADATA.branchNamingWarning.executionType).toBe("computational");
  });
});
