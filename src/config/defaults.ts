import type { HarnessConfig } from "./types.js";

export const CONFIG_DEFAULTS: HarnessConfig = {
  version: "0.1.0",
  project: {
    name: "",
    type: "web-app",
    stacks: [],
    entryPoints: [],
    testCommand: "",
    lintCommand: "",
    typeCheckCommand: "",
    buildCommand: "",
  },
  integrations: {
    linear: {
      enabled: false,
      teamKey: "",
    },
  },
  features: {
    // Recommended: on by default
    adr: true,
    testingDocs: true,
    completionReminder: true,
    branchNamingWarning: true,
    linterBootstrap: true,
    linearIntegration: true,
    artifactFreshnessCheck: true,
    // Optional: off by default
    dddContextMaps: false,
    latMd: false,
    evaluatorQA: false,
    autoLoop: false,
    keelEnforcement: false,
  },
  hooks: {
    prePush: {
      lint: true,
      typeCheck: true,
      unitTest: true,
    },
  },
};
