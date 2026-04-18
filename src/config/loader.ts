import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DEFAULTS } from "./defaults.js";
import type { HarnessConfig } from "./types.js";

const FILENAME = ".harness.json";

export class HarnessConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HarnessConfigError";
  }
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideVal = override[key];
    if (overrideVal === undefined) continue;
    const baseVal = base[key];
    if (
      overrideVal !== null &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal as object, overrideVal as object) as T[keyof T];
    } else {
      result[key] = overrideVal as T[keyof T];
    }
  }
  return result;
}

/**
 * Migration shim: if a loaded config has top-level `linear` but no `integrations.linear`,
 * copy it across and emit a deprecation warning. Never breaks existing installs.
 */
function migrateTopLevelLinear(raw: Record<string, unknown>): Record<string, unknown> {
  if (!("linear" in raw)) return raw;

  const hasIntegrationsLinear =
    raw.integrations !== undefined &&
    typeof raw.integrations === "object" &&
    raw.integrations !== null &&
    "linear" in (raw.integrations as Record<string, unknown>);

  if (hasIntegrationsLinear) return raw;

  // Perform migration
  console.warn(
    "[harness] Deprecation warning: top-level `linear` in .harness.json is deprecated. " +
      "Please move it to `integrations.linear`. This will be removed in a future version.",
  );

  const migrated = { ...raw };
  const existingIntegrations =
    typeof raw.integrations === "object" && raw.integrations !== null ? raw.integrations : {};
  migrated.integrations = {
    ...(existingIntegrations as Record<string, unknown>),
    linear: raw.linear,
  };
  // Leave top-level linear in place so deep merge still works without breaking anything
  return migrated;
}

function validate(raw: unknown, filePath: string): asserts raw is Partial<HarnessConfig> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new HarnessConfigError(`${filePath}: must be a JSON object`);
  }
  const obj = raw as Record<string, unknown>;

  if (obj.version !== undefined && typeof obj.version !== "string") {
    throw new HarnessConfigError(`${filePath}: "version" must be a string`);
  }
  if (
    obj.project !== undefined &&
    (typeof obj.project !== "object" || Array.isArray(obj.project))
  ) {
    throw new HarnessConfigError(`${filePath}: "project" must be an object`);
  }
  if (
    obj.features !== undefined &&
    (typeof obj.features !== "object" || Array.isArray(obj.features))
  ) {
    throw new HarnessConfigError(`${filePath}: "features" must be an object`);
  }
  if (obj.hooks !== undefined && (typeof obj.hooks !== "object" || Array.isArray(obj.hooks))) {
    throw new HarnessConfigError(`${filePath}: "hooks" must be an object`);
  }
  if (
    obj.integrations !== undefined &&
    (typeof obj.integrations !== "object" || Array.isArray(obj.integrations))
  ) {
    throw new HarnessConfigError(`${filePath}: "integrations" must be an object`);
  }
  // Legacy top-level linear validation (kept for backwards compat during migration)
  if (obj.linear !== undefined && (typeof obj.linear !== "object" || Array.isArray(obj.linear))) {
    throw new HarnessConfigError(`${filePath}: "linear" must be an object`);
  }
}

export function loadConfig(projectDir: string): HarnessConfig {
  const filePath = join(projectDir, FILENAME);

  if (!existsSync(filePath)) {
    throw new HarnessConfigError(
      `No ${FILENAME} found in ${projectDir}. Run "harness init" to set up the harness.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (err) {
    throw new HarnessConfigError(
      `${filePath}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  validate(raw, filePath);

  // Apply migration shim before merging with defaults
  const migrated = migrateTopLevelLinear(raw as Record<string, unknown>);

  return deepMerge(CONFIG_DEFAULTS, migrated as Partial<HarnessConfig>);
}

export function loadConfigOrNull(projectDir: string): HarnessConfig | null {
  try {
    return loadConfig(projectDir);
  } catch {
    return null;
  }
}
