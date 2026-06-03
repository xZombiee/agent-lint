import {
  getAlternativeTools,
  getToolDefinition,
} from "../utils/supportedTools.ts";
import type { AgentLintIssue, ScanContext, SupportedToolKey } from "../types.ts";

function joinValues(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export function explicitContradictions(context: ScanContext): AgentLintIssue[] {
  const issues: AgentLintIssue[] = [];
  const detectedTools = new Set(Object.keys(context.repoFacts.tools) as SupportedToolKey[]);
  const packageScripts = new Set(Object.keys(context.packageJson?.scripts ?? {}));

  for (const instructionFile of context.instructionFiles) {
    for (const signal of instructionFile.contradictionSignals) {
      if (signal.kind === "forbidTool") {
        if (!detectedTools.has(signal.tool)) {
          continue;
        }

        const tool = getToolDefinition(signal.tool);
        const evidence = [
          ...(context.repoFacts.tools[signal.tool]?.packages ?? []),
          ...(context.repoFacts.tools[signal.tool]?.configFiles ?? []),
        ];

        issues.push({
          id: `explicit-contradiction:forbid-tool:${instructionFile.path}:${signal.line}:${signal.tool}`,
          rule: "explicitContradictions",
          severity: "warning",
          sourceFile: instructionFile.path,
          line: signal.line,
          message: "Explicit contradiction in instructions",
          evidence: {
            instructionText: signal.instructionText,
            repoFact: `${tool.name} is detected via ${joinValues(evidence)}.`,
          },
          suggestion: `Either remove ${tool.name} from the repository or update the instruction.`,
        });

        continue;
      }

      if (signal.kind === "requireTool") {
        if (detectedTools.has(signal.tool)) {
          continue;
        }

        const tool = getToolDefinition(signal.tool);
        const alternatives = getAlternativeTools(signal.tool).filter((candidate) =>
          detectedTools.has(candidate.key),
        );

        if (alternatives.length === 0) {
          continue;
        }

        const alternativeNames = alternatives.map((candidate) => candidate.name);

        issues.push({
          id: `explicit-contradiction:require-tool:${instructionFile.path}:${signal.line}:${signal.tool}`,
          rule: "explicitContradictions",
          severity: "warning",
          sourceFile: instructionFile.path,
          line: signal.line,
          message: "Explicit contradiction in instructions",
          evidence: {
            instructionText: signal.instructionText,
            repoFact: `${tool.name} is absent, but ${joinValues(alternativeNames)} ${alternativeNames.length === 1 ? "is" : "are"} installed.`,
          },
          suggestion: `Update the instruction to match ${joinValues(alternativeNames)} or install ${tool.name}.`,
          suggestions: alternativeNames,
        });

        continue;
      }

      if (context.packageJson === null || packageScripts.has(signal.scriptName)) {
        continue;
      }

      issues.push({
        id: `explicit-contradiction:command:${instructionFile.path}:${signal.line}:${signal.packageManager}:${signal.scriptName}`,
        rule: "explicitContradictions",
        severity: "warning",
        sourceFile: instructionFile.path,
        line: signal.line,
        message: "Explicit contradiction in instructions",
        evidence: {
          instructionText: signal.instructionText,
          repoFact: `package.json has no "${signal.scriptName}" script.`,
        },
        suggestion: `Add the "${signal.scriptName}" script or update the instruction.`,
      });
    }
  }

  return issues;
}
