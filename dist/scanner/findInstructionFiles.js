import { matchesPathPattern } from "../utils/pathPatterns.js";
export function findInstructionFiles(repoFiles, patterns) {
    const instructionFiles = new Set();
    for (const pattern of patterns) {
        for (const repoFile of repoFiles) {
            if (matchesPathPattern(repoFile, pattern) ||
                matchesPathPattern(repoFile.toLowerCase(), pattern.toLowerCase())) {
                instructionFiles.add(repoFile);
            }
        }
    }
    return [...instructionFiles].sort((left, right) => left.localeCompare(right));
}
//# sourceMappingURL=findInstructionFiles.js.map