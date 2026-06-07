import type { PackageManager, ScriptCommand } from "../types.ts";
import { inferScriptName } from "../utils/packageManager.ts";

const PACKAGE_MANAGER_PATTERN = /\b(npm|pnpm|yarn|bun)\b/giu;
const SHELL_SEPARATORS = new Set(["&&", "||", ";", "|"]);
const FILTER_FLAGS = new Set(["-F", "--filter"]);
const DIRECTORY_FLAGS = new Set(["-C", "--dir", "--cwd", "--prefix"]);
const NATURAL_LANGUAGE_COMMANDS = new Set([
  "blocks",
  "dependency",
  "packages",
  "runs",
]);
const COMMON_IMPLICIT_SCRIPT_NAMES = new Set([
  "build",
  "check",
  "clean",
  "coverage",
  "dev",
  "format",
  "lint",
  "prepare",
  "prepack",
  "postinstall",
  "start",
  "test",
  "typecheck",
]);

interface InlineCodeBounds {
  end: number;
}

interface ParsedCommand {
  scriptName: string;
  rawCommand: string;
  explicitRun: boolean;
  workingDirectory?: string;
  packageFilter?: string;
}

function getInlineCodeBounds(line: string, matchIndex: number): InlineCodeBounds | null {
  const prefix = line.slice(0, matchIndex);
  const backtickCount = [...prefix.matchAll(/`/gu)].length;

  if (backtickCount % 2 === 0) {
    return null;
  }

  const end = line.indexOf("`", matchIndex);

  return {
    end: end === -1 ? line.length : end,
  };
}

function isInsideInlineCode(line: string, matchIndex: number): boolean {
  return getInlineCodeBounds(line, matchIndex) !== null;
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

function sanitizeShellToken(token: string): string {
  return token
    .trim()
    .replace(/^[$]+/u, "")
    .replace(/^[`"']+/u, "")
    .replace(/[`"']+$/u, "")
    .replace(/[),.]+$/u, "");
}

function tokenizeCommand(commandText: string): string[] {
  const tokens: string[] = [];

  for (const match of commandText.matchAll(/"[^"]*"|'[^']*'|[^\s]+/gu)) {
    const token = sanitizeShellToken(match[0]);

    if (token === "") {
      continue;
    }

    if (SHELL_SEPARATORS.has(token)) {
      break;
    }

    tokens.push(token);
  }

  return tokens;
}

function extractCommandText(line: string, matchIndex: number): { text: string; inline: boolean } {
  const inlineBounds = getInlineCodeBounds(line, matchIndex);

  if (inlineBounds) {
    return {
      text: line.slice(matchIndex, inlineBounds.end),
      inline: true,
    };
  }

  return {
    text: line.slice(matchIndex),
    inline: false,
  };
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

function extractWorkingDirectory(line: string, matchEnd: number): string | undefined {
  const afterCommand = line.slice(matchEnd);
  const match =
    /\b(?:in|inside|from)\s+(?:the\s+)?`?(?<directory>[A-Za-z0-9._/-]+)`?\s+(?:folder|directory|dir)\b/iu.exec(
      afterCommand,
    );
  const directory = match?.groups?.directory?.replace(/^\.\/+/u, "").replace(/\/+$/u, "");

  return directory === "" ? undefined : directory;
}

function normalizeOptionValue(value: string | undefined): string | undefined {
  const normalized = value?.replace(/^["']|["']$/gu, "").trim();

  return normalized === "" ? undefined : normalized;
}

function isPlaceholderFilter(value: string): boolean {
  return /[<>{}*?]|\.\.\.|^\^/u.test(value);
}

function isScriptToken(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9:_-]+$/u.test(value));
}

function hasBinaryLikeArgument(tokens: string[], scriptIndex: number): boolean {
  const nextToken = tokens[scriptIndex + 1];

  return Boolean(nextToken && !nextToken.startsWith("-"));
}

function allowsImplicitScriptWithArguments(scriptName: string): boolean {
  return COMMON_IMPLICIT_SCRIPT_NAMES.has(scriptName.toLowerCase()) || scriptName.includes(":");
}

function parseCommandTokens(
  packageManager: PackageManager,
  tokens: string[],
  inline: boolean,
): ParsedCommand | null {
  let tokenIndex = 1;
  let packageFilter: string | undefined;
  let workingDirectory: string | undefined;

  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];

    if (!token?.startsWith("-")) {
      break;
    }

    if (FILTER_FLAGS.has(token)) {
      packageFilter = normalizeOptionValue(tokens[tokenIndex + 1]);
      tokenIndex += 2;
      continue;
    }

    if (token.startsWith("--filter=")) {
      packageFilter = normalizeOptionValue(token.slice("--filter=".length));
      tokenIndex += 1;
      continue;
    }

    if (DIRECTORY_FLAGS.has(token)) {
      workingDirectory = normalizeOptionValue(tokens[tokenIndex + 1]);
      tokenIndex += 2;
      continue;
    }

    const directoryFlag = [...DIRECTORY_FLAGS].find((flag) => token.startsWith(`${flag}=`));

    if (directoryFlag) {
      workingDirectory = normalizeOptionValue(token.slice(directoryFlag.length + 1));
      tokenIndex += 1;
      continue;
    }

    tokenIndex += 1;
  }

  if (packageFilter && isPlaceholderFilter(packageFilter)) {
    return null;
  }

  const commandName = tokens[tokenIndex];

  if (!isScriptToken(commandName) || NATURAL_LANGUAGE_COMMANDS.has(commandName.toLowerCase())) {
    return null;
  }

  const explicitRun = commandName === "run" || commandName === "run-script";
  const scriptIndex = explicitRun ? tokenIndex + 1 : tokenIndex;
  const rawScriptName = explicitRun ? tokens[scriptIndex] : commandName;

  if (!isScriptToken(rawScriptName)) {
    return null;
  }

  const scriptName = inferScriptName(packageManager, rawScriptName, explicitRun);

  if (!scriptName) {
    return null;
  }

  if (
    inline &&
    !explicitRun &&
    hasBinaryLikeArgument(tokens, scriptIndex) &&
    !allowsImplicitScriptWithArguments(scriptName)
  ) {
    return null;
  }

  const parsedCommand: ParsedCommand = {
    scriptName,
    rawCommand: tokens.slice(0, scriptIndex + 1).join(" "),
    explicitRun,
  };

  if (workingDirectory !== undefined) {
    parsedCommand.workingDirectory = workingDirectory;
  }

  if (packageFilter !== undefined) {
    parsedCommand.packageFilter = packageFilter;
  }

  return parsedCommand;
}

export function extractCommands(content: string): ScriptCommand[] {
  const commands: ScriptCommand[] = [];
  const lines = content.split(/\r?\n/u);

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      return;
    }

    for (const match of line.matchAll(PACKAGE_MANAGER_PATTERN)) {
      const packageManager = match[1]?.toLowerCase() as PackageManager | undefined;
      const matchIndex = match.index ?? 0;

      if (
        !packageManager ||
        (packageManager !== "npm" &&
          packageManager !== "pnpm" &&
          packageManager !== "yarn" &&
          packageManager !== "bun") ||
        !hasCommandCue(line, matchIndex)
      ) {
        continue;
      }

      const commandText = extractCommandText(line, matchIndex);
      const tokens = tokenizeCommand(commandText.text);

      if (tokens[0]?.toLowerCase() !== packageManager) {
        continue;
      }

      const parsedCommand = parseCommandTokens(packageManager, tokens, commandText.inline);

      if (!parsedCommand) {
        continue;
      }

      const matchEnd = matchIndex + parsedCommand.rawCommand.length;

      if (isPatternScriptReference(line, matchEnd, parsedCommand.scriptName)) {
        continue;
      }

      const command: ScriptCommand = {
        packageManager,
        scriptName: parsedCommand.scriptName,
        rawCommand: parsedCommand.rawCommand,
        line: index + 1,
        instructionText: trimmedLine,
        explicitRun: parsedCommand.explicitRun,
      };
      const workingDirectory =
        parsedCommand.workingDirectory ?? extractWorkingDirectory(line, matchEnd);

      if (workingDirectory !== undefined) {
        command.workingDirectory = workingDirectory;
      }

      if (parsedCommand.packageFilter !== undefined) {
        command.packageFilter = parsedCommand.packageFilter;
      }

      commands.push(command);
    }
  });

  return commands;
}
