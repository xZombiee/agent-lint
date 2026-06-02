import type { ToolMention } from "../types.ts";
import { SUPPORTED_TOOLS } from "../utils/supportedTools.ts";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function detectStance(line: string, toolName: string): ToolMention["stance"] | null {
  const escapedToolName = escapeRegExp(toolName);
  const bareCommandPattern = new RegExp(
    `\\b(?:bare|raw)\\b[^.\\n]{0,24}\\b${escapedToolName}\\b|\\b${escapedToolName}\\b\\s+\\.\\.\\.`,
    "iu",
  );

  const avoidPattern = new RegExp(
    `\\b(do not use|don't use|avoid|never use)\\b[^.\\n]{0,40}\\b${escapedToolName}\\b`,
    "iu",
  );

  if (avoidPattern.test(line)) {
    if (bareCommandPattern.test(line)) {
      return "mention";
    }

    return "avoid";
  }

  const usePattern = new RegExp(
    `\\b(use|prefer|using|with|via|run|test with|write tests with|lint with|format with|build with)\\b[^.\\n]{0,50}\\b${escapedToolName}\\b`,
    "iu",
  );

  if (usePattern.test(line)) {
    return "use";
  }

  const mentionPattern = new RegExp(`\\b${escapedToolName}\\b`, "iu");

  if (mentionPattern.test(line)) {
    return "mention";
  }

  return null;
}

export function extractToolMentions(content: string): ToolMention[] {
  const mentions: ToolMention[] = [];
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
