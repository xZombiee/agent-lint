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
//# sourceMappingURL=packageJsonLookup.js.map