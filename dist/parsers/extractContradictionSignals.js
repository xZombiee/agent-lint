import { extractCommands } from "./extractCommands.js";
import { extractToolMentions } from "./extractToolMentions.js";
export function extractContradictionSignals(content) {
    const signals = [];
    for (const command of extractCommands(content)) {
        signals.push({
            kind: "requireCommand",
            packageManager: command.packageManager,
            scriptName: command.scriptName,
            line: command.line,
            instructionText: command.instructionText,
        });
    }
    for (const mention of extractToolMentions(content)) {
        if (mention.stance === "use") {
            signals.push({
                kind: "requireTool",
                tool: mention.tool,
                line: mention.line,
                instructionText: mention.instructionText,
            });
        }
        if (mention.stance === "avoid") {
            signals.push({
                kind: "forbidTool",
                tool: mention.tool,
                line: mention.line,
                instructionText: mention.instructionText,
            });
        }
    }
    return signals;
}
//# sourceMappingURL=extractContradictionSignals.js.map