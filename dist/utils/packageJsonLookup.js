import path from "node:path";
function normalizeDirectory(repoPath) {
    const directory = path.posix.dirname(repoPath);
    return directory === "." ? "" : directory;
}
function isPathWithinDirectory(repoPath, directory) {
    return directory === "" || repoPath === directory || repoPath.startsWith(`${directory}/`);
}
function normalizePackageFilter(packageFilter) {
    return packageFilter
        .replace(/^["']|["']$/gu, "")
        .replace(/^\.\//u, "")
        .replace(/\/+$/u, "");
}
function isComplexPackageFilter(packageFilter) {
    return /[<>{}*?]|\.\.\.|^\^|!/u.test(packageFilter);
}
function findPackageJsonByFilter(context, packageFilter) {
    const normalizedFilter = normalizePackageFilter(packageFilter);
    if (normalizedFilter === "" || isComplexPackageFilter(normalizedFilter)) {
        return null;
    }
    const nameMatch = context.packageJsons.find((packageJson) => packageJson.data.name === normalizedFilter);
    if (nameMatch) {
        return nameMatch;
    }
    const pathMatch = context.packageJsons.find((packageJson) => {
        const directory = normalizeDirectory(packageJson.path);
        return (directory === normalizedFilter ||
            path.posix.basename(directory) === normalizedFilter ||
            directory.endsWith(`/${normalizedFilter}`));
    });
    return pathMatch ?? null;
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
//# sourceMappingURL=packageJsonLookup.js.map