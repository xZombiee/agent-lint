import { inferScriptName } from "../utils/packageManager.js";
const COMMAND_PATTERN = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?([A-Za-z0-9:_-]+)/giu;
const NATURAL_LANGUAGE_COMMANDS = new Set([
    "blocks",
    "dependency",
    "packages",
    "runs",
]);
function isInsideInlineCode(line, matchIndex) {
    const prefix = line.slice(0, matchIndex);
    const backtickCount = [...prefix.matchAll(/`/gu)].length;
    return backtickCount % 2 === 1;
}
function hasCommandCue(line, matchIndex) {
    if (isInsideInlineCode(line, matchIndex)) {
        return true;
    }
    const prefix = line.slice(Math.max(0, matchIndex - 32), matchIndex).toLowerCase();
    return /\b(run|use|execute|call|prefer|entrypoint|script|command|with|via)\s*$/u.test(prefix);
}
function isPatternScriptReference(line, matchEnd, commandName) {
    const nextCharacter = line[matchEnd] ?? "";
    return (nextCharacter === "*" ||
        nextCharacter === "?" ||
        commandName.endsWith(":") ||
        commandName.includes("*") ||
        commandName.includes("?"));
}
function extractWorkingDirectory(line, matchEnd) {
    const afterCommand = line.slice(matchEnd);
    const match = /\b(?:in|inside|from)\s+(?:the\s+)?`?(?<directory>[A-Za-z0-9._/-]+)`?\s+(?:folder|directory|dir)\b/iu.exec(afterCommand);
    const directory = match?.groups?.directory?.replace(/^\.\/+/u, "").replace(/\/+$/u, "");
    return directory === "" ? undefined : directory;
}
export function extractCommands(content) {
    const commands = [];
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
            if (packageManager !== "npm" &&
                packageManager !== "pnpm" &&
                packageManager !== "yarn" &&
                packageManager !== "bun") {
                continue;
            }
            if (!commandName) {
                continue;
            }
            if (NATURAL_LANGUAGE_COMMANDS.has(commandName.toLowerCase()) ||
                isPatternScriptReference(line, matchEnd, commandName) ||
                !hasCommandCue(line, matchIndex)) {
                continue;
            }
            const scriptName = inferScriptName(packageManager, commandName, explicitRun);
            if (!scriptName) {
                continue;
            }
            const command = {
                packageManager,
                scriptName,
                rawCommand: match[0],
                line: index + 1,
                instructionText: trimmedLine,
                explicitRun,
            };
            const workingDirectory = extractWorkingDirectory(line, matchEnd);
            if (workingDirectory !== undefined) {
                command.workingDirectory = workingDirectory;
            }
            commands.push(command);
        }
    });
    return commands;
}
//# sourceMappingURL=extractCommands%202.js.map