import path from "node:path";
import type { PackageJsonData, PackageJsonRecord, ScanContext } from "../types.ts";

export interface PackageJsonMatch {
  path: string;
  data: PackageJsonData;
}

function normalizeDirectory(repoPath: string): string {
  const directory = path.posix.dirname(repoPath);
  return directory === "." ? "" : directory;
}

function isPathWithinDirectory(repoPath: string, directory: string): boolean {
  return directory === "" || repoPath === directory || repoPath.startsWith(`${directory}/`);
}

export function findNearestPackageJson(
  context: ScanContext,
  sourceFile: string,
): PackageJsonMatch | null {
  let bestMatch: PackageJsonRecord | null = null;
  let bestDirectoryLength = -1;

  for (const packageJson of context.packageJsons) {
    const directory = normalizeDirectory(packageJson.path);

    if (!isPathWithinDirectory(sourceFile, directory)) {
      continue;
    }

    if (directory.length > bestDirectoryLength) {
      bestMatch = packageJson;
      bestDirectoryLength = directory.length;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  if (!context.packageJson) {
    return null;
  }

  return {
    path: "package.json",
    data: context.packageJson,
  };
}
