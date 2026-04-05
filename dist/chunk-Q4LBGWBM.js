#!/usr/bin/env node
import {
  CONFIG_DEFAULTS
} from "./chunk-JRM7MC4Q.js";

// src/config/loader.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
var FILENAME = ".harness.json";
var HarnessConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "HarnessConfigError";
  }
};
function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    if (overrideVal === void 0) continue;
    const baseVal = base[key];
    if (overrideVal !== null && typeof overrideVal === "object" && !Array.isArray(overrideVal) && baseVal !== null && typeof baseVal === "object" && !Array.isArray(baseVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}
function validate(raw, filePath) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new HarnessConfigError(`${filePath}: must be a JSON object`);
  }
  const obj = raw;
  if (obj.version !== void 0 && typeof obj.version !== "string") {
    throw new HarnessConfigError(`${filePath}: "version" must be a string`);
  }
  if (obj.project !== void 0 && (typeof obj.project !== "object" || Array.isArray(obj.project))) {
    throw new HarnessConfigError(`${filePath}: "project" must be an object`);
  }
  if (obj.features !== void 0 && (typeof obj.features !== "object" || Array.isArray(obj.features))) {
    throw new HarnessConfigError(`${filePath}: "features" must be an object`);
  }
  if (obj.hooks !== void 0 && (typeof obj.hooks !== "object" || Array.isArray(obj.hooks))) {
    throw new HarnessConfigError(`${filePath}: "hooks" must be an object`);
  }
  if (obj.linear !== void 0 && (typeof obj.linear !== "object" || Array.isArray(obj.linear))) {
    throw new HarnessConfigError(`${filePath}: "linear" must be an object`);
  }
}
function loadConfig(projectDir) {
  const filePath = join(projectDir, FILENAME);
  if (!existsSync(filePath)) {
    throw new HarnessConfigError(
      `No ${FILENAME} found in ${projectDir}. Run "harness init" to set up the harness.`
    );
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (err) {
    throw new HarnessConfigError(
      `${filePath}: invalid JSON \u2014 ${err instanceof Error ? err.message : String(err)}`
    );
  }
  validate(raw, filePath);
  return deepMerge(CONFIG_DEFAULTS, raw);
}
function loadConfigOrNull(projectDir) {
  try {
    return loadConfig(projectDir);
  } catch {
    return null;
  }
}

export {
  loadConfigOrNull
};
//# sourceMappingURL=chunk-Q4LBGWBM.js.map