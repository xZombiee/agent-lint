import type { ScriptCommand } from "../types.ts";
import { inferScriptName } from "../utils/packageManager.ts";

const COMMAND_PATTERN =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?([A-Za-z0-9:_-]+)/giu;

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
