export type ProjectType = "web-app" | "cli" | "library" | "monorepo" | "mobile";

export interface HarnessConfig {
  $schema?: string;
  version: string;
  project: ProjectConfig;
  linear: LinearConfig;
  features: FeaturesConfig;
  hooks: HooksConfig;
}

export interface ProjectConfig {
  name: string;
  type: ProjectType;
  stacks: string[];
  entryPoints: string[];
  testCommand: string;
  lintCommand: string;
  typeCheckCommand: string;
  buildCommand: string;
}

export interface LinearConfig {
  enabled: boolean;
  teamKey: string;
  projectId?: string;
}

export interface FeaturesConfig {
  // Recommended (true by default)
  adr: boolean;
  testingDocs: boolean;
  completionReminder: boolean;
  branchNamingWarning: boolean;
  linterBootstrap: boolean;
  linearIntegration: boolean;
  artifactFreshnessCheck: boolean;
  // Optional (false by default)
  dddContextMaps: boolean;
  latMd: boolean;
  evaluatorQA: boolean;
  autoLoop: boolean;
  keelEnforcement: boolean;
}

export interface HooksConfig {
  prePush: PrePushConfig;
}

export interface PrePushConfig {
  lint: boolean;
  typeCheck: boolean;
  unitTest: boolean;
}
