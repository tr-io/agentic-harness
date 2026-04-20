import type { FeaturesConfig } from "../config/types.js";
import type { ProjectType } from "../detector/types.js";

export interface TemplateContext {
  projectName: string;
  projectType: ProjectType;
  stacks: string[];
  testCommand: string;
  lintCommand: string;
  typeCheckCommand: string;
  buildCommand: string;
  linearEnabled: boolean;
  linearTeamKey: string;
  features: FeaturesConfig;
}

export type TemplateTier = "mandatory" | "recommended" | "optional";

export interface ScaffoldedFile {
  /** Relative path from project root */
  path: string;
  content: string;
  executable?: boolean;
  tier: TemplateTier;
  /** One-line description for the CLAUDE.md TOC */
  description?: string;
}

export interface ScaffoldResult {
  files: ScaffoldedFile[];
  skipped: string[];
}
