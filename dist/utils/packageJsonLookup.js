import path from "node:path";
function normalizeDirectory(repoPath) {
    const directory = path.posix.dirname(repoPath);
    return directory === "." ? "" : directory;
}
function isPathWithinDirectory(repoPath, directory) {
    return directory === "" || repoPath === directory || repoPath.startsWith(`${directory}/`);
}
export function findNearestPackageJson(context, sourceFile) {
    let bestMatch = null;
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
export function findPackageJsonForCommand(context, sourceFile, command) {
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
//# sourceMappingURL=packageJsonLookup.js.map