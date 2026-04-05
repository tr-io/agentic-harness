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
  return deepMerge(CONFIG_DEFAULTS, raw);
}

export function loadConfigOrNull(projectDir: string): HarnessConfig | null {
  try {
    return loadConfig(projectDir);
  } catch {
    return null;
  }
}
