import { getAlternativeTools, getInstalledToolKeys, getToolDefinition } from "../utils/supportedTools.ts";
import type { AgentLintIssue, ScanContext } from "../types.ts";

function joinToolNames(toolNames: string[]): string {
  if (toolNames.length <= 1) {
    return toolNames[0] ?? "";
  }

  if (toolNames.length === 2) {
    return `${toolNames[0]} and ${toolNames[1]}`;
  }

  return `${toolNames.slice(0, -1).join(", ")}, and ${toolNames.at(-1)}`;
}

export function toolMismatch(context: ScanContext): AgentLintIssue[] {
  const installedTools = getInstalledToolKeys(context.packageJson);
  const issues: AgentLintIssue[] = [];

  for (const instructionFile of context.instructionFiles) {
    for (const mention of instructionFile.toolMentions) {
      if (mention.stance !== "use" || installedTools.has(mention.tool)) {
        continue;
      }

      const alternatives = getAlternativeTools(mention.tool).filter((tool) =>
        installedTools.has(tool.key),
      );

      if (alternatives.length === 0) {
        continue;
      }

      const expectedTool = getToolDefinition(mention.tool);
      const alternativeNames = alternatives.map((tool) => tool.name);

      issues.push({
        id: `tool-mismatch:${instructionFile.path}:${mention.line}:${mention.tool}`,
        rule: "toolMismatch",
        severity: "warning",
        sourceFile: instructionFile.path,
        line: mention.line,
        message: "Tool mismatch",
        evidence: {
          instructionText: mention.instructionText,
          repoFact: `${expectedTool.name} is not installed, but ${joinToolNames(alternativeNames)} ${alternativeNames.length === 1 ? "is" : "are"} installed.`,
        },
        suggestion: `Update the instruction to match ${joinToolNames(alternativeNames)} or install ${expectedTool.name}.`,
        suggestions: alternativeNames,
      });
    }
  }

  return issues;
}
