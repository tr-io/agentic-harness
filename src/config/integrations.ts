import type { LinearConfig } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface IntegrationPlugin<TConfig = unknown> {
  /** Unique integration identifier (e.g. "linear") */
  id: string;
  /** Default configuration values for this integration */
  defaults: TConfig;
  /** Validate config and environment — returns errors if not ready */
  validate(config: TConfig, env: Record<string, string | undefined>): Promise<ValidationResult>;
}

// ─── Linear integration ───────────────────────────────────────────────────────

const linearDefaults: LinearConfig = {
  enabled: false,
  teamKey: "",
};

export const linearIntegration: IntegrationPlugin<LinearConfig> = {
  id: "linear",
  defaults: linearDefaults,
  async validate(config, env): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config.enabled) {
      return { valid: true, errors: [] };
    }

    if (!config.teamKey) {
      errors.push("integrations.linear.teamKey is required when linear is enabled");
    }

    const apiKey = env.HARNESS_LINEAR_API_KEY ?? env.LINEAR_API_KEY;
    if (!apiKey) {
      errors.push(
        "Linear API key not found — set HARNESS_LINEAR_API_KEY or LINEAR_API_KEY environment variable",
      );
    }

    return { valid: errors.length === 0, errors };
  },
};

/** Registry of all known integration plugins */
export const integrationRegistry: IntegrationPlugin[] = [linearIntegration as IntegrationPlugin];
