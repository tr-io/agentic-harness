#!/usr/bin/env node
import {
  buildFileList
} from "./chunk-XZYE27ZT.js";
import {
  loadConfigOrNull
} from "./chunk-Q4LBGWBM.js";
import {
  detectStack
} from "./chunk-GE2FWTDY.js";
import {
  CONFIG_DEFAULTS
} from "./chunk-JRM7MC4Q.js";
import "./chunk-ZWE3DS7E.js";

// src/upgrade/index.ts
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
var CHECKSUMS_FILE = ".harness-checksums.json";
function md5(content) {
  return createHash("md5").update(content).digest("hex");
}
function readChecksums(projectDir) {
  const path = join(projectDir, CHECKSUMS_FILE);
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
  } catch {
    return {};
  }
}
function writeChecksums(projectDir, checksums) {
  writeFileSync(join(projectDir, CHECKSUMS_FILE), JSON.stringify(checksums, null, 2));
}
function computeChecksums(files) {
  const result = {};
  for (const f of files) result[f.path] = md5(f.content);
  return result;
}
async function runUpgrade(options) {
  const cwd = process.cwd();
  const dryRun = Boolean(options.dryRun);
  const config = loadConfigOrNull(cwd);
  if (!config) {
    console.error('No .harness.json found. Run "harness init" first.');
    process.exit(1);
  }
  const stack = await detectStack(cwd);
  const newFiles = buildFileList(config, stack);
  const storedChecksums = readChecksums(cwd);
  const unchanged = [];
  const diffs = [];
  const newPaths = [];
  for (const file of newFiles) {
    const fullPath = join(cwd, file.path);
    const templateChecksum = md5(file.content);
    if (!existsSync(fullPath)) {
      newPaths.push(file.path);
      continue;
    }
    const currentContent = readFileSync(fullPath, "utf-8");
    const currentChecksum = md5(currentContent);
    const originalChecksum = storedChecksums[file.path];
    if (originalChecksum && currentChecksum === originalChecksum) {
      unchanged.push(file.path);
      continue;
    }
    if (currentChecksum === templateChecksum) {
      unchanged.push(file.path);
      continue;
    }
    diffs.push({
      path: file.path,
      newContent: file.content,
      currentContent,
      templateChecksum,
      currentChecksum,
      originalChecksum,
      isCustomized: originalChecksum !== void 0 && currentChecksum !== originalChecksum
    });
  }
  const newFeatures = Object.keys(CONFIG_DEFAULTS.features).filter((k) => !(k in config.features));
  if (unchanged.length === 0 && diffs.length === 0 && newPaths.length === 0 && newFeatures.length === 0) {
    console.log("\u2713 Already up to date.");
    return;
  }
  console.log(`
Harness Upgrade${dryRun ? " (dry run)" : ""}
`);
  if (unchanged.length > 0) {
    console.log(`  ${unchanged.length} file(s) up to date`);
  }
  if (newPaths.length > 0) {
    console.log("\nNew files:");
    for (const p of newPaths) {
      console.log(`  + ${p}`);
      if (!dryRun) {
        const { mkdirSync } = await import("fs");
        const { dirname } = await import("path");
        const newFile = newFiles.find((f) => f.path === p);
        if (newFile) {
          mkdirSync(dirname(join(cwd, p)), { recursive: true });
          writeFileSync(join(cwd, p), newFile.content, "utf-8");
        }
      }
    }
  }
  if (diffs.length > 0) {
    console.log("\nFiles with changes:");
    for (const diff of diffs) {
      const customTag = diff.isCustomized ? " (you have customized this file)" : "";
      console.log(`  ~ ${diff.path}${customTag}`);
    }
    if (!dryRun) {
      const { default: inquirer } = await import("./dist-AKLBVIGZ.js");
      for (const diff of diffs) {
        console.log(`
\u2500\u2500\u2500 ${diff.path} \u2500\u2500\u2500`);
        if (diff.isCustomized) {
          console.log("  Your customizations will be affected. Choose how to proceed:");
        }
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: `How to update ${diff.path}?`,
            choices: [
              { name: "Keep your version (skip)", value: "keep" },
              { name: "Overwrite with new template", value: "overwrite" }
            ]
          }
        ]);
        if (action === "overwrite") {
          writeFileSync(join(cwd, diff.path), diff.newContent, "utf-8");
          console.log("    \u2713 Updated");
        } else {
          console.log("    \u2500 Kept");
        }
      }
    }
  }
  if (newFeatures.length > 0 && !dryRun) {
    const updatedConfig = {
      ...config,
      features: {
        ...config.features,
        ...Object.fromEntries(
          newFeatures.map((k) => [
            k,
            CONFIG_DEFAULTS.features[k] ?? false
          ])
        )
      }
    };
    writeFileSync(join(cwd, ".harness.json"), JSON.stringify(updatedConfig, null, 2));
    console.log(
      `
\u2713 Added new feature toggles: ${newFeatures.join(", ")} (all disabled by default)`
    );
  }
  if (!dryRun) {
    const newChecksums = computeChecksums(newFiles);
    writeChecksums(cwd, newChecksums);
    console.log("\n\u2713 Upgrade complete.");
  }
}
export {
  computeChecksums,
  readChecksums,
  runUpgrade,
  writeChecksums
};
//# sourceMappingURL=upgrade-N3P4KRFG.js.map