import { SUPPORTED_TOOLS } from "../utils/supportedTools.js";
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function detectStance(line, toolName) {
    const escapedToolName = escapeRegExp(toolName);
    const avoidPattern = new RegExp(`\\b(do not use|don't use|avoid|never use)\\b[^.\\n]{0,40}\\b${escapedToolName}\\b`, "iu");
    if (avoidPattern.test(line)) {
        return "avoid";
    }
    const usePattern = new RegExp(`\\b(use|prefer|using|with|via|run|test with|write tests with|lint with|format with|build with)\\b[^.\\n]{0,50}\\b${escapedToolName}\\b`, "iu");
    if (usePattern.test(line)) {
        return "use";
    }
    const mentionPattern = new RegExp(`\\b${escapedToolName}\\b`, "iu");
    if (mentionPattern.test(line)) {
        return "mention";
    }
    return null;
}
export function extractToolMentions(content) {
    const mentions = [];
    const lines = content.split(/\r?\n/u);
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
            return;
        }
        for (const tool of SUPPORTED_TOOLS) {
            const stance = detectStance(line, tool.name);
            if (!stance) {
                continue;
            }
            mentions.push({
                tool: tool.key,
                toolName: tool.name,
                line: index + 1,
                instructionText: trimmedLine,
                stance,
            });
        }
    });
    return mentions;
}
//# sourceMappingURL=extractToolMentions.js.map