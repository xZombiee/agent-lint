import path from "node:path";
import { readFile } from "node:fs/promises";
import { extractCommands } from "../parsers/extractCommands.ts";
import { extractContradictionSignals } from "../parsers/extractContradictionSignals.ts";
import { extractFilePaths } from "../parsers/extractFilePaths.ts";
import { extractCiMentions } from "../parsers/extractCiMentions.ts";
import { extractPackageManagerMentions } from "../parsers/extractPackageManagerMentions.ts";
import { extractRuntimeMentions } from "../parsers/extractRuntimeMentions.ts";
import { extractToolMentions } from "../parsers/extractToolMentions.ts";
import { buildRepoFacts } from "./buildRepoFacts.ts";
import { findInstructionFiles } from "./findInstructionFiles.ts";
import { listRepoFiles } from "./listRepoFiles.ts";
import { listTrackedPaths, readGitIgnoreRules } from "./readGitIgnoreRules.ts";
import { readPackageJson } from "./readPackageJson.ts";
import type { ParsedInstructionFile, ResolvedAgentLintConfig, ScanContext } from "../types.ts";

function collectRepoDirectories(repoFiles: string[]): string[] {
  const directories = new Set<string>();

  for (const repoFile of repoFiles) {
    const segments = repoFile.split("/");

    for (let depth = 1; depth < segments.length; depth += 1) {
      directories.add(segments.slice(0, depth).join("/"));
    }
  }

  return [...directories].sort((left, right) => left.localeCompare(right));
}

async function readInstructionFiles(
  projectRoot: string,
  instructionPaths: string[],
): Promise<ParsedInstructionFile[]> {
  return Promise.all(
    instructionPaths.map(async (instructionPath) => {
      const absolutePath = path.join(projectRoot, instructionPath);
      const content = await readFile(absolutePath, "utf8");

      return {
        path: instructionPath,
        content,
        fileReferences: extractFilePaths(content),
        commands: extractCommands(content),
        packageManagerMentions: extractPackageManagerMentions(content),
        runtimeMentions: extractRuntimeMentions(content),
        ciMentions: extractCiMentions(content),
        toolMentions: extractToolMentions(content),
        contradictionSignals: extractContradictionSignals(content),
      };
    }),
  );
}

export async function buildScanContext(
  projectRoot: string,
  config: ResolvedAgentLintConfig,
): Promise<ScanContext> {
  const repoFiles = await listRepoFiles(projectRoot, config.ignorePaths);
  const repoDirectories = collectRepoDirectories(repoFiles);
  const instructionPaths = findInstructionFiles(repoFiles, config.instructionFiles);
  const gitIgnoreRules = await readGitIgnoreRules(projectRoot, repoFiles);
  const trackedPaths = await listTrackedPaths(projectRoot);
  const packageJson = await readPackageJson(projectRoot);
  const repoFacts = await buildRepoFacts(projectRoot, repoFiles, packageJson);
  const instructionFiles = await readInstructionFiles(projectRoot, instructionPaths);

  return {
    projectRoot,
    config,
    repoFiles,
    repoDirectories,
    gitIgnoreRules,
    trackedPaths,
    packageJson,
    repoFacts,
    instructionFiles,
  };
}
