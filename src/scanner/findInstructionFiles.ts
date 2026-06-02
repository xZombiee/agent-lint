import { matchesPathPattern } from "../utils/pathPatterns.ts";

export function findInstructionFiles(repoFiles: string[], patterns: string[]): string[] {
  const instructionFiles = new Set<string>();

  for (const pattern of patterns) {
    for (const repoFile of repoFiles) {
      if (
        matchesPathPattern(repoFile, pattern) ||
        matchesPathPattern(repoFile.toLowerCase(), pattern.toLowerCase())
      ) {
        instructionFiles.add(repoFile);
      }
    }
  }

  return [...instructionFiles].sort((left, right) => left.localeCompare(right));
}
