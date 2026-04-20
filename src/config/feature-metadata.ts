import type { FeatureMetadata } from "./types.js";

export const FEATURE_METADATA: Record<string, FeatureMetadata> = {
  // Feedforward / Computational
  adr: {
    controlType: "feedforward",
    executionType: "computational",
    description: "ADR docs — guide agents toward architectural intent before they act",
  },
  testingDocs: {
    controlType: "feedforward",
    executionType: "computational",
    description: "Testing conventions — pre-load patterns so agents write correct tests first time",
  },
  linterBootstrap: {
    controlType: "feedforward",
    executionType: "computational",
    description: "Linter bootstrap — deterministic style enforcement scaffolded at init time",
  },
  linearIntegration: {
    controlType: "feedforward",
    executionType: "computational",
    description: "Linear integration — surfaces ticket context to guide session scope",
  },
  dddContextMaps: {
    controlType: "feedforward",
    executionType: "computational",
    description: "DDD context maps — domain boundary docs that steer design decisions upfront",
  },
  latMd: {
    controlType: "feedforward",
    executionType: "computational",
    description: "LAT.md — latency/performance targets loaded before the agent starts coding",
  },
  // Feedforward / Inferential
  skills: {
    controlType: "feedforward",
    executionType: "inferential",
    description: "Skill templates — AI-interpreted guides that steer multi-step workflows",
  },
  evaluatorQA: {
    controlType: "feedforward",
    executionType: "inferential",
    description: "Evaluator QA sub-agent — semantic analysis of codebase before implementation",
  },
  // Feedback / Computational
  branchNamingWarning: {
    controlType: "feedback",
    executionType: "computational",
    description:
      "Branch naming warning — detects naming violations after the agent creates a branch",
  },
  artifactFreshnessCheck: {
    controlType: "feedback",
    executionType: "computational",
    description: "Artifact freshness check — detects stale .ai/ docs after code changes",
  },
  autoLoop: {
    controlType: "feedback",
    executionType: "computational",
    description: "Auto loop — monitors CI and re-triggers the agent on failures",
  },
  keelEnforcement: {
    controlType: "feedback",
    executionType: "computational",
    description: "Keel enforcement — validates schema conformance after config mutations",
  },
  // Feedback / Inferential
  completionReminder: {
    controlType: "feedback",
    executionType: "inferential",
    description: "Completion reminder — AI-based signal that prompts the agent to wrap up cleanly",
  },
};
