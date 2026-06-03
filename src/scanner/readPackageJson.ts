import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PackageJsonData } from "../types.ts";
import { pathExists } from "../utils/pathExists.ts";

export async function readPackageJson(projectRoot: string): Promise<PackageJsonData | null> {
  const packageJsonPath = path.join(projectRoot, "package.json");

  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  const rawPackageJson = await readFile(packageJsonPath, "utf8");
  const parsedPackageJson = JSON.parse(rawPackageJson) as unknown;

  if (typeof parsedPackageJson !== "object" || parsedPackageJson === null) {
    throw new Error("package.json must contain a JSON object.");
  }

  const packageJson = parsedPackageJson as Record<string, unknown>;
  const result: PackageJsonData = {};

  if (isRecordOfStrings(packageJson.scripts)) {
    result.scripts = packageJson.scripts;
  }

  if (isRecordOfStrings(packageJson.dependencies)) {
    result.dependencies = packageJson.dependencies;
  }

  if (isRecordOfStrings(packageJson.devDependencies)) {
    result.devDependencies = packageJson.devDependencies;
  }

  if (isRecordOfStrings(packageJson.engines)) {
    result.engines = packageJson.engines;
  }

  if (typeof packageJson.packageManager === "string") {
    result.packageManager = packageJson.packageManager;
  }

  return result;
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string");
}
