function getPreferredPackageManager(context) {
    const declared = context.repoFacts.packageManagers.declared;
    if (declared) {
        return {
            packageManager: declared,
            source: `package.json packageManager declares ${declared}`,
        };
    }
    const lockfileEntries = Object.entries(context.repoFacts.packageManagers.lockfiles)
        .filter(([, files]) => files.length > 0);
    if (lockfileEntries.length !== 1) {
        return null;
    }
    const [packageManager, files] = lockfileEntries[0] ?? [];
    if (!packageManager || !files) {
        return null;
    }
    return {
        packageManager,
        source: `${files[0]} indicates ${packageManager}`,
    };
}
function isGlobalToolInstall(rawCommand, instructionText) {
    if (!/\b(?:npm|pnpm|yarn|bun)\s+(?:add|install|i)\b/iu.test(rawCommand)) {
        return false;
    }
    const commandStart = instructionText.toLowerCase().indexOf(rawCommand.toLowerCase());
    const commandText = commandStart === -1
        ? instructionText
        : instructionText.slice(commandStart, commandStart + 120);
    return /\s(?:-g|--global)\b/iu.test(commandText);
}
export function packageManagerMismatch(context) {
    const preferred = getPreferredPackageManager(context);
    if (!preferred) {
        return [];
    }
    const issues = [];
    const seen = new Set();
    for (const instructionFile of context.instructionFiles) {
        for (const mention of instructionFile.packageManagerMentions) {
            if (mention.packageManager === preferred.packageManager) {
                continue;
            }
            if (isGlobalToolInstall(mention.rawCommand, mention.instructionText)) {
                continue;
            }
            const key = `${instructionFile.path}:${mention.line}:${mention.packageManager}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            issues.push({
                id: `package-manager-mismatch:${instructionFile.path}:${mention.line}:${mention.packageManager}`,
                rule: "packageManagerMismatch",
                severity: "warning",
                sourceFile: instructionFile.path,
                line: mention.line,
                message: "Package manager mismatch",
                evidence: {
                    instructionText: mention.instructionText,
                    repoFact: `${preferred.source}, but the instruction uses ${mention.packageManager}.`,
                },
                suggestion: `Use ${preferred.packageManager} commands or update the repository package-manager metadata.`,
                suggestions: [preferred.packageManager],
            });
        }
    }
    return issues;
}
//# sourceMappingURL=packageManagerMismatch.js.map