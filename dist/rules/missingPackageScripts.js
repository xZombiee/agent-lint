import { findClosestMatches } from "../utils/pathSimilarity.js";
import { findPackageJsonForCommand } from "../utils/packageJsonLookup.js";
function buildCommandSuggestion(packageManager, suggestions) {
    if (suggestions.length === 0) {
        return "Add the missing script to package.json or update the instruction.";
    }
    const suggestedScript = suggestions[0];
    const commandPrefix = packageManager === "npm" ? "npm run" : `${packageManager}`;
    return `Use ${commandPrefix} ${suggestedScript} or update the instruction.`;
}
export function missingPackageScripts(context) {
    const issues = [];
    for (const instructionFile of context.instructionFiles) {
        for (const command of instructionFile.commands) {
            const packageJson = findPackageJsonForCommand(context, instructionFile.path, command);
            if (!packageJson) {
                continue;
            }
            const packageScripts = Object.keys(packageJson.data.scripts ?? {});
            if (packageScripts.includes(command.scriptName)) {
                continue;
            }
            const suggestions = findClosestMatches(command.scriptName, packageScripts, 3);
            issues.push({
                id: `missing-script:${instructionFile.path}:${command.line}:${command.packageManager}:${command.scriptName}`,
                rule: "missingPackageScripts",
                severity: "error",
                sourceFile: instructionFile.path,
                line: command.line,
                message: "Missing package script",
                evidence: {
                    instructionText: command.instructionText,
                    repoFact: `${packageJson.path} has no "${command.scriptName}" script.`,
                },
                suggestion: buildCommandSuggestion(command.packageManager, suggestions),
                suggestions,
            });
        }
    }
    return issues;
}
//# sourceMappingURL=missingPackageScripts.js.map