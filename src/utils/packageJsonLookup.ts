import path from "node:path";
import type {
  PackageJsonData,
  PackageJsonRecord,
  ScanContext,
  ScriptCommand,
} from "../types.ts";

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

function normalizePackageFilter(packageFilter: string): string {
  return packageFilter
    .replace(/^["']|["']$/gu, "")
    .replace(/^\.\//u, "")
    .replace(/\/+$/u, "");
}

function isComplexPackageFilter(packageFilter: string): boolean {
  return /[<>{}*?]|\.\.\.|^\^|!/u.test(packageFilter);
}

function findPackageJsonByFilter(
  context: ScanContext,
  packageFilter: string,
): PackageJsonMatch | null {
  const normalizedFilter = normalizePackageFilter(packageFilter);

  if (normalizedFilter === "" || isComplexPackageFilter(normalizedFilter)) {
    return null;
  }

  const nameMatch = context.packageJsons.find(
    (packageJson) => packageJson.data.name === normalizedFilter,
  );

  if (nameMatch) {
    return nameMatch;
  }

  const pathMatch = context.packageJsons.find((packageJson) => {
    const directory = normalizeDirectory(packageJson.path);

    return (
      directory === normalizedFilter ||
      path.posix.basename(directory) === normalizedFilter ||
      directory.endsWith(`/${normalizedFilter}`)
    );
  });

  return pathMatch ?? null;
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

export function findPackageJsonForCommand(
  context: ScanContext,
  sourceFile: string,
  command: ScriptCommand,
): PackageJsonMatch | null {
  if (command.packageFilter) {
    const packageJson = findPackageJsonByFilter(context, command.packageFilter);

    if (packageJson) {
      return packageJson;
    }

    return null;
  }

  if (!command.workingDirectory) {
    return findNearestPackageJson(context, sourceFile);
  }

  const normalizedDirectory = command.workingDirectory.replace(/^\/+/u, "").replace(/\/+$/u, "");
  const exactPackageJsonPath = path.posix.join(normalizedDirectory, "package.json");
  const exactMatch = context.packageJsons.find((packageJson) => packageJson.path === exactPackageJsonPath);

  if (exactMatch) {
    return exactMatch;
  }

  return findNearestPackageJson(context, sourceFile);
}
