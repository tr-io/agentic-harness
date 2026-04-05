import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DEFAULTS } from "../config/defaults.js";
import { loadConfigOrNull } from "../config/loader.js";
import { detectStack } from "../detector/index.js";
import { buildFileList } from "../scaffolder/index.js";

const CHECKSUMS_FILE = ".harness-checksums.json";

type ChecksumMap = Record<string, string>;

function md5(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

export function readChecksums(projectDir: string): ChecksumMap {
  const path = join(projectDir, CHECKSUMS_FILE);
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
  } catch {
    return {};
  }
}

export function writeChecksums(projectDir: string, checksums: ChecksumMap): void {
  writeFileSync(join(projectDir, CHECKSUMS_FILE), JSON.stringify(checksums, null, 2));
}

export function computeChecksums(files: Array<{ path: string; content: string }>): ChecksumMap {
  const result: ChecksumMap = {};
  for (const f of files) result[f.path] = md5(f.content);
  return result;
}

interface FileDiff {
  path: string;
  newContent: string;
  currentContent: string;
  templateChecksum: string;
  currentChecksum: string;
  originalChecksum: string | undefined;
  isCustomized: boolean;
}

export async function runUpgrade(options: { dryRun?: boolean }): Promise<void> {
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

  const unchanged: string[] = [];
  const diffs: FileDiff[] = [];
  const newPaths: string[] = [];

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

    // File hasn't been customized — safe to silently update
    if (originalChecksum && currentChecksum === originalChecksum) {
      unchanged.push(file.path);
      continue;
    }

    // Content matches new template already — nothing to do
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
      isCustomized: originalChecksum !== undefined && currentChecksum !== originalChecksum,
    });
  }

  // Check for new feature toggles to add
  const newFeatures = Object.keys(CONFIG_DEFAULTS.features).filter((k) => !(k in config.features));

  if (
    unchanged.length === 0 &&
    diffs.length === 0 &&
    newPaths.length === 0 &&
    newFeatures.length === 0
  ) {
    console.log("✓ Already up to date.");
    return;
  }

  console.log(`\nHarness Upgrade${dryRun ? " (dry run)" : ""}\n`);

  if (unchanged.length > 0) {
    console.log(`  ${unchanged.length} file(s) up to date`);
  }

  if (newPaths.length > 0) {
    console.log("\nNew files:");
    for (const p of newPaths) {
      console.log(`  + ${p}`);
      if (!dryRun) {
        const { mkdirSync } = await import("node:fs");
        const { dirname } = await import("node:path");
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
      const { default: inquirer } = await import("inquirer");
      for (const diff of diffs) {
        console.log(`\n─── ${diff.path} ───`);
        if (diff.isCustomized) {
          console.log("  Your customizations will be affected. Choose how to proceed:");
        }

        // biome-ignore lint/suspicious/noExplicitAny: inquirer v13 prompt() type is overly strict
        const { action } = await (inquirer.prompt as any)([
          {
            type: "list",
            name: "action",
            message: `How to update ${diff.path}?`,
            choices: [
              { name: "Keep your version (skip)", value: "keep" },
              { name: "Overwrite with new template", value: "overwrite" },
            ],
          },
        ]);

        if (action === "overwrite") {
          writeFileSync(join(cwd, diff.path), diff.newContent, "utf-8");
          console.log("    ✓ Updated");
        } else {
          console.log("    ─ Kept");
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
            (CONFIG_DEFAULTS.features as unknown as Record<string, boolean>)[k] ?? false,
          ]),
        ),
      },
    };
    writeFileSync(join(cwd, ".harness.json"), JSON.stringify(updatedConfig, null, 2));
    console.log(
      `\n✓ Added new feature toggles: ${newFeatures.join(", ")} (all disabled by default)`,
    );
  }

  if (!dryRun) {
    // Update stored checksums
    const newChecksums = computeChecksums(newFiles);
    writeChecksums(cwd, newChecksums);
    console.log("\n✓ Upgrade complete.");
  }
}
