import { getAlternativeTools, getToolDefinition, } from "../utils/supportedTools.js";
function joinValues(values) {
    if (values.length <= 1) {
        return values[0] ?? "";
    }
    if (values.length === 2) {
        return `${values[0]} and ${values[1]}`;
    }
    return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
export function explicitContradictions(context) {
    const issues = [];
    const detectedTools = new Set(Object.keys(context.repoFacts.tools));
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
                const alternatives = getAlternativeTools(signal.tool).filter((candidate) => detectedTools.has(candidate.key));
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
            continue;
        }
    }
    return issues;
}
//# sourceMappingURL=explicitContradictions.js.map