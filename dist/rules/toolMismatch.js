import { getAlternativeTools, getToolDefinition } from "../utils/supportedTools.js";
function joinToolNames(toolNames) {
    if (toolNames.length <= 1) {
        return toolNames[0] ?? "";
    }
    if (toolNames.length === 2) {
        return `${toolNames[0]} and ${toolNames[1]}`;
    }
    return `${toolNames.slice(0, -1).join(", ")}, and ${toolNames.at(-1)}`;
}
export function toolMismatch(context) {
    const detectedTools = new Set(Object.keys(context.repoFacts.tools));
    const issues = [];
    for (const instructionFile of context.instructionFiles) {
        for (const mention of instructionFile.toolMentions) {
            if (mention.stance !== "use" || detectedTools.has(mention.tool)) {
                continue;
            }
            const alternatives = getAlternativeTools(mention.tool).filter((tool) => detectedTools.has(tool.key));
            if (alternatives.length === 0) {
                continue;
            }
            const expectedTool = getToolDefinition(mention.tool);
            const alternativeNames = alternatives.map((tool) => tool.name);
            const alternativeEvidence = alternatives.flatMap((tool) => [
                ...(context.repoFacts.tools[tool.key]?.packages ?? []),
                ...(context.repoFacts.tools[tool.key]?.configFiles ?? []),
            ]);
            issues.push({
                id: `tool-mismatch:${instructionFile.path}:${mention.line}:${mention.tool}`,
                rule: "toolMismatch",
                severity: "warning",
                sourceFile: instructionFile.path,
                line: mention.line,
                message: "Tool mismatch",
                evidence: {
                    instructionText: mention.instructionText,
                    repoFact: `${expectedTool.name} was not detected, but ${joinToolNames(alternativeNames)} ${alternativeNames.length === 1 ? "was" : "were"} detected via ${joinToolNames(alternativeEvidence)}.`,
                },
                suggestion: `Update the instruction to match ${joinToolNames(alternativeNames)} or install ${expectedTool.name}.`,
                suggestions: alternativeNames,
            });
        }
    }
    return issues;
}
//# sourceMappingURL=toolMismatch.js.map