import { findClosestMatches } from "../utils/pathSimilarity.ts";
import type { AgentLintIssue, ScanContext } from "../types.ts";

function buildCommandSuggestion(packageManager: string, suggestions: string[]): string {
  if (suggestions.length === 0) {
    return "Add the missing script to package.json or update the instruction.";
  }

  const suggestedScript = suggestions[0];
  const commandPrefix = packageManager === "npm" ? "npm run" : `${packageManager}`;
  return `Use ${commandPrefix} ${suggestedScript} or update the instruction.`;
}

export function missingPackageScripts(context: ScanContext): AgentLintIssue[] {
  const packageScripts = Object.keys(context.packageJson?.scripts ?? {});

  if (context.packageJson === null) {
    return [];
  }

  const issues: AgentLintIssue[] = [];

  for (const instructionFile of context.instructionFiles) {
    for (const command of instructionFile.commands) {
      if (packageScripts.includes(command.scriptName)) {
        continue;
      }

      const suggestions = findClosestMatches(command.scriptName, packageScripts, 3);

      issues.push({
        id: `missing-script:${instructionFile.path}:${command.line}:${command.packageManager}:${command.scriptName}`,
        rule: "missingPackageScripts",
        severity: "warning",
        sourceFile: instructionFile.path,
        line: command.line,
        message: "Missing package script",
        evidence: {
          instructionText: command.instructionText,
          repoFact: `package.json has no "${command.scriptName}" script.`,
        },
        suggestion: buildCommandSuggestion(command.packageManager, suggestions),
        suggestions,
      });
    }
  }

  return issues;
}
