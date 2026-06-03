import path from "node:path";
import { readFile } from "node:fs/promises";
import { extractCommands } from "../parsers/extractCommands.js";
import { extractContradictionSignals } from "../parsers/extractContradictionSignals.js";
import { extractFilePaths } from "../parsers/extractFilePaths.js";
import { extractCiMentions } from "../parsers/extractCiMentions.js";
import { extractPackageManagerMentions } from "../parsers/extractPackageManagerMentions.js";
import { extractRuntimeMentions } from "../parsers/extractRuntimeMentions.js";
import { extractToolMentions } from "../parsers/extractToolMentions.js";
import { buildRepoFacts } from "./buildRepoFacts.js";
import { findInstructionFiles } from "./findInstructionFiles.js";
import { listRepoFiles } from "./listRepoFiles.js";
import { listTrackedPaths, readGitIgnoreRules } from "./readGitIgnoreRules.js";
import { readPackageJson } from "./readPackageJson.js";
function collectRepoDirectories(repoFiles) {
    const directories = new Set();
    for (const repoFile of repoFiles) {
        const segments = repoFile.split("/");
        for (let depth = 1; depth < segments.length; depth += 1) {
            directories.add(segments.slice(0, depth).join("/"));
        }
    }
    return [...directories].sort((left, right) => left.localeCompare(right));
}
async function readInstructionFiles(projectRoot, instructionPaths) {
    return Promise.all(instructionPaths.map(async (instructionPath) => {
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
    }));
}
export async function buildScanContext(projectRoot, config) {
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
//# sourceMappingURL=buildScanContext.js.map