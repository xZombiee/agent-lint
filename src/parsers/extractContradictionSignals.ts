import { extractCommands } from "./extractCommands.ts";
import { extractToolMentions } from "./extractToolMentions.ts";
import type { ContradictionSignal } from "../types.ts";

export function extractContradictionSignals(content: string): ContradictionSignal[] {
  const signals: ContradictionSignal[] = [];

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
