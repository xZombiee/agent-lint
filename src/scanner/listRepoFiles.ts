import path from "node:path";
import { readdir } from "node:fs/promises";
import { shouldIgnorePath } from "../utils/pathPatterns.ts";

function toPosixPath(value: string): string {
  return value.replace(/\\/gu, "/");
}

export async function listRepoFiles(
  projectRoot: string,
  ignorePaths: string[],
): Promise<string[]> {
  const collectedFiles: string[] = [];

  async function walkDirectory(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = toPosixPath(path.relative(projectRoot, absolutePath));

      if (relativePath === "" || shouldIgnorePath(relativePath, ignorePaths)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walkDirectory(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        collectedFiles.push(relativePath);
      }
    }
  }

  await walkDirectory(projectRoot);

  return collectedFiles.sort((left, right) => left.localeCompare(right));
}
