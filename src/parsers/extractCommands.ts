import type { ScriptCommand } from "../types.ts";
import { inferScriptName } from "../utils/packageManager.ts";

const COMMAND_PATTERN =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?([A-Za-z0-9:_-]+)/giu;
const NATURAL_LANGUAGE_COMMANDS = new Set([
  "blocks",
  "dependency",
  "packages",
  "runs",
]);

function isInsideInlineCode(line: string, matchIndex: number): boolean {
  const prefix = line.slice(0, matchIndex);
  const backtickCount = [...prefix.matchAll(/`/gu)].length;

  return backtickCount % 2 === 1;
}

function hasCommandCue(line: string, matchIndex: number): boolean {
  if (isInsideInlineCode(line, matchIndex)) {
    return true;
  }

  const prefix = line.slice(Math.max(0, matchIndex - 32), matchIndex).toLowerCase();

  return /\b(run|use|execute|call|prefer|entrypoint|script|command|with|via)\s*$/u.test(
    prefix,
  );
}

function isPatternScriptReference(line: string, matchEnd: number, commandName: string): boolean {
  const nextCharacter = line[matchEnd] ?? "";

  return (
    nextCharacter === "*" ||
    nextCharacter === "?" ||
    commandName.endsWith(":") ||
    commandName.includes("*") ||
    commandName.includes("?")
  );
}

export function extractCommands(content: string): ScriptCommand[] {
  const commands: ScriptCommand[] = [];
  const lines = content.split(/\r?\n/u);

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      return;
    }

    for (const match of line.matchAll(COMMAND_PATTERN)) {
      const packageManager = match[1];
      const explicitRun = Boolean(match[2]);
      const commandName = match[3];
      const matchIndex = match.index ?? 0;
      const matchEnd = matchIndex + match[0].length;

      if (
        packageManager !== "npm" &&
        packageManager !== "pnpm" &&
        packageManager !== "yarn" &&
        packageManager !== "bun"
      ) {
        continue;
      }

      if (!commandName) {
        continue;
      }

      if (
        NATURAL_LANGUAGE_COMMANDS.has(commandName.toLowerCase()) ||
        isPatternScriptReference(line, matchEnd, commandName) ||
        !hasCommandCue(line, matchIndex)
      ) {
        continue;
      }

      const scriptName = inferScriptName(packageManager, commandName, explicitRun);

      if (!scriptName) {
        continue;
      }

      commands.push({
        packageManager,
        scriptName,
        rawCommand: match[0],
        line: index + 1,
        instructionText: trimmedLine,
        explicitRun,
      });
    }
  });

  return commands;
}
