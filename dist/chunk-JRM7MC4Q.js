#!/usr/bin/env node

// src/config/defaults.ts
var CONFIG_DEFAULTS = {
  version: "0.1.0",
  project: {
    name: "",
    type: "web-app",
    stacks: [],
    entryPoints: [],
    testCommand: "",
    lintCommand: "",
    typeCheckCommand: "",
    buildCommand: ""
  },
  linear: {
    enabled: false,
    teamKey: ""
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
    keelEnforcement: false
  },
  hooks: {
    prePush: {
      lint: true,
      typeCheck: true,
      unitTest: true
    }
  }
};

export {
  CONFIG_DEFAULTS
};
//# sourceMappingURL=chunk-JRM7MC4Q.js.map